const express = require('express');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const { supabase, supabaseAdmin } = require('../config/db');

const genId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Detect whether a file uses tabs or commas as delimiter
function detectSeparator(filePath) {
  const firstLine = fs.readFileSync(filePath, 'utf8').split('\n')[0] || '';
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return tabs > commas ? '\t' : ',';
}

const router = express.Router();

const upload = multer({ dest: 'uploads/' });

// Reset all data — clears every activity table and student_career_progress
router.post('/reset', async (req, res) => {
  try {
    await Promise.all([
      supabaseAdmin.from('job_applications').delete().neq('app_id', 'KEEP'),
      supabaseAdmin.from('career_events').delete().neq('event_id', 'KEEP'),
      supabaseAdmin.from('interview_appointments').delete().neq('appt_id', 'KEEP'),
    ]);
    await supabaseAdmin.from('student_career_progress').delete().neq('student_id', 'KEEP');
    res.json({ success: true, message: 'All data cleared. Ready for a fresh upload.' });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manually resync all student scores from activity tables
router.post('/resync', async (req, res) => {
  try {
    await recalculateAllScores();
    const { data: students } = await supabase
      .from('student_career_progress')
      .select('student_id, full_name, engagement_score, risk_level');
    res.json({ success: true, students });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Diagnostic: show distinct student IDs in each activity table
router.get('/diagnostics', async (req, res) => {
  const [apps, students] = await Promise.all([
    supabase.from('job_applications').select('student_id, company_name, applied_date').order('applied_date', { ascending: false }),
    supabase.from('student_career_progress').select('student_id, full_name, job_applications_count, engagement_score')
  ]);

  const uniqueAppStudents = [...new Set(apps.data?.map(r => r.student_id))];
  const studentsNotInProgress = uniqueAppStudents.filter(
    id => !students.data?.find(s => s.student_id === id)
  );

  res.json({
    total_applications_in_db: apps.data?.length,
    unique_student_ids_in_job_applications: uniqueAppStudents,
    students_not_in_progress_table: studentsNotInProgress,
    students_in_progress_table: students.data,
    recent_applications: apps.data?.slice(0, 10)
  });
});

// Preview CSV headers and first row — use this to diagnose column name mismatches
router.post('/preview-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const headers = [];
  const rows = [];

  const done = await new Promise((resolve) => {
    const sep = detectSeparator(req.file.path);
    fs.createReadStream(req.file.path)
      .pipe(csv({ separator: sep }))
      .on('headers', (h) => headers.push(...h))
      .on('data', (row) => { if (rows.length < 3) rows.push(row); })
      .on('end', () => resolve(true))
      .on('error', () => resolve(false));
  });

  fs.unlinkSync(req.file.path);
  res.json({ headers, sampleRows: rows });
});

router.post('/upload-csv', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    let totalRecordsProcessed = 0;
    const warnings = [];

    for (const file of req.files) {
      const fileName = file.originalname.toLowerCase();
      let count = 0;

      if (fileName.includes('student') || fileName.includes('roster')) {
        count = await processStudentRoster(file.path);
      } else if (fileName.includes('applications')) {
        count = await processApplications(file.path);
      } else if (fileName.includes('events')) {
        count = await processEvents(file.path);
      } else if (fileName.includes('appointments') || fileName.includes('interview')) {
        count = await processAppointments(file.path);
      } else {
        warnings.push(`"${file.originalname}" was skipped — filename must include "students", "roster", "applications", "events", or "appointments".`);
      }

      if (count === 0 && !warnings.some(w => w.includes(file.originalname))) {
        warnings.push(`"${file.originalname}" was processed but 0 records were inserted. Check that column headers match the expected format.`);
      }

      totalRecordsProcessed += count;
      fs.unlinkSync(file.path);
    }

    await recalculateAllScores();

    res.json({
      success: true,
      message: totalRecordsProcessed > 0
        ? `Successfully imported ${totalRecordsProcessed} records.`
        : 'Upload completed but no records were imported.',
      recordsProcessed: totalRecordsProcessed,
      warnings
    });
  } catch (error) {
    console.error('Error processing CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ensure a student record exists; create a placeholder if not
async function ensureStudentRecord(studentId, fields = {}) {
  if (!studentId) return;

  const { data: existing } = await supabase
    .from('student_career_progress')
    .select('student_id, full_name, email')
    .eq('student_id', studentId)
    .single();

  const nameParts = (fields.full_name || '').trim().split(' ');
  const first_name = fields.first_name || nameParts[0] || '';
  const last_name = fields.last_name || nameParts.slice(1).join(' ') || '';
  const full_name = fields.full_name || `${first_name} ${last_name}`.trim();

  if (!existing) {
    const { error: insertErr } = await supabaseAdmin.from('student_career_progress').insert({
      student_id: studentId,
      full_name: full_name || studentId,
      first_name,
      last_name,
      email: fields.email || null,
      major: fields.major || '',
      current_year: fields.current_year || null,
      graduation_date: fields.graduation_date || null,
      engagement_score: 0,
      career_events_attended: 0,
      job_applications_count: 0,
      risk_level: 'high',
      updated_at: new Date().toISOString()
    });

    if (insertErr) console.error('ensureStudentRecord insert error:', insertErr.message, studentId);
  } else {
    // Always overwrite with real data from the CSV if provided
    const updates = {};
    if (full_name && full_name !== studentId) {
      updates.full_name = full_name;
      if (first_name) updates.first_name = first_name;
      if (last_name) updates.last_name = last_name;
    }
    if (fields.email) updates.email = fields.email;
    if (fields.major) updates.major = fields.major;
    if (fields.graduation_date) updates.graduation_date = fields.graduation_date;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error: updateErr } = await supabaseAdmin
        .from('student_career_progress')
        .update(updates)
        .eq('student_id', studentId);
      if (updateErr) console.error('ensureStudentRecord update error:', updateErr.message, studentId);
    }
  }
}

async function processStudentRoster(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];

    const sep = detectSeparator(filePath);
    fs.createReadStream(filePath)
      .pipe(csv({ separator: sep }))
      .on('data', (row) => {
        // Support common Handshake roster column names
        const studentId = row['Card Id'] || row['card_id'] || row['Student Card Id'] || row['ID'];
        const firstName = row['First Name'] || row['first_name'] || '';
        const lastName = row['Last Name'] || row['last_name'] || '';
        const fullName = row['Full Name'] || row['Name'] || `${firstName} ${lastName}`.trim();
        const email = row['Email'] || row['email'] || row['School Email'] || '';
        const major = row['Major'] || row['Primary Major'] || row['major'] || '';
        const gradDate = row['Graduation Date'] || row['Expected Graduation Date'] || null;
        const schoolYear = row['School Year'] || row['Year'] || null;

        if (studentId) {
          records.push({ studentId, firstName, lastName, fullName, email, major, gradDate, schoolYear });
        }
      })
      .on('end', async () => {
        try {
          let processed = 0;

          for (const r of records) {
            const nameParts = r.fullName.split(' ');
            const first_name = r.firstName || nameParts[0] || '';
            const last_name = r.lastName || nameParts.slice(1).join(' ') || '';

            const { data: existing } = await supabase
              .from('student_career_progress')
              .select('student_id')
              .eq('student_id', r.studentId)
              .single();

            if (existing) {
              const updates = {
                updated_at: new Date().toISOString()
              };
              if (r.fullName) { updates.full_name = r.fullName; updates.first_name = first_name; updates.last_name = last_name; }
              if (r.email) updates.email = r.email;
              if (r.major) updates.major = r.major;
              if (r.gradDate) updates.graduation_date = r.gradDate;

              const { error } = await supabaseAdmin
                .from('student_career_progress')
                .update(updates)
                .eq('student_id', r.studentId);
              if (!error) processed++;
              else console.error('roster update error:', error.message, r.studentId);
            } else {
              const { error } = await supabase
                .from('student_career_progress')
                .insert({
                  student_id: r.studentId,
                  full_name: r.fullName || r.studentId,
                  first_name,
                  last_name,
                  email: r.email || '',
                  major: r.major || '',
                  graduation_date: r.gradDate || null,
                  engagement_score: 0,
                  career_events_attended: 0,
                  job_applications_count: 0,
                  risk_level: 'high',
                  updated_at: new Date().toISOString()
                });
              if (!error) processed++;
              else console.error('roster insert error:', error.message, r.studentId);
            }
          }

          resolve(processed);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

async function processApplications(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];

    const sep = detectSeparator(filePath);
    fs.createReadStream(filePath)
      .pipe(csv({ separator: sep }))
      .on('data', (row) => {
        const first_name = row['Applicant (student) First Name'] || row['First Name'] || '';
        const last_name = row['Applicant (student) Last Name'] || row['Last Name'] || '';
        records.push({
          student_id: row['Applicant (student) Card Id'] || row['Card Id'],
          first_name,
          last_name,
          full_name: `${first_name} ${last_name}`.trim(),
          email: row['Applicant (student) Email'] || row['Email'] || '',
          major: row['Major'] || '',
          graduation_date: row['Graduation Date'] || null,
          employer_name: row['Employer Name'],
          job_title: row['Job Title'],
          application_type: row['Applications Application Type'] || null,
          application_date: row['Applications Created At Date'],
          status: row['Applications Status'],
          fully_qualified: (row['Applications Fully Qualified? (Yes / No)'] || '').toLowerCase() === 'yes',
          external_apply: (row['Job External Apply? (Yes / No)'] || '').toLowerCase() === 'yes'
        });
      })
      .on('end', async () => {
        try {
          let processed = 0;

          for (const record of records) {
            if (!record.student_id) continue;

            await ensureStudentRecord(record.student_id, {
              full_name: record.full_name,
              first_name: record.first_name,
              last_name: record.last_name,
              email: record.email,
              major: record.major,
              graduation_date: record.graduation_date
            });

            const { error } = await supabase
              .from('job_applications')
              .insert({
                app_id: genId('APP'),
                student_id: record.student_id,
                company_name: record.employer_name,
                job_title: record.job_title,
                applied_date: record.application_date,
                status: record.status || 'pending',
                source: 'handshake',
                fully_qualified: record.fully_qualified,
                external_apply: record.external_apply
              });

            if (error) {
              console.error('job_applications insert error:', error.message, record.student_id);
            } else {
              processed++;
            }
          }

          resolve(processed);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function processEvents(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];

    const sep = detectSeparator(filePath);
    fs.createReadStream(filePath)
      .pipe(csv({ separator: sep }))
      .on('data', (row) => {
        records.push({
          student_id: row['Card Id'],
          full_name: row['Student Name'] || '',
          first_name: row['First Name'] || '',
          last_name: row['Last Name'] || '',
          email: row['Email'] || '',
          major: row['Major'] || '',
          event_name: row['Content'],
          event_date: row['Start Date Date'] || row['Start Date Time'],
          staff_name: row['Staff Name']
        });
      })
      .on('end', async () => {
        try {
          let processed = 0;

          for (const record of records) {
            if (!record.student_id) continue;

            await ensureStudentRecord(record.student_id, {
              full_name: record.full_name,
              first_name: record.first_name,
              last_name: record.last_name,
              email: record.email,
              major: record.major
            });

            const { error } = await supabase
              .from('career_events')
              .insert({
                event_id: genId('EVT'),
                student_id: record.student_id,
                event_title: record.event_name,
                event_type: 'career_event',
                attended_date: record.event_date,
                staff_name: record.staff_name,
                checked_in: true,
                is_drop_in: false,
                source: 'handshake'
              });

            if (error) {
              console.error('career_events insert error:', error.message, record.student_id);
            } else {
              processed++;
            }
          }

          resolve(processed);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function processAppointments(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];

    const sep = detectSeparator(filePath);
    fs.createReadStream(filePath)
      .pipe(csv({ separator: sep }))
      .on('data', (row) => {
        records.push({
          student_id: row['Card Id'],
          full_name: row['Student Name'] || '',
          first_name: row['First Name'] || '',
          last_name: row['Last Name'] || '',
          email: row['Email'] || '',
          major: row['Major'] || '',
          topic: row['Content'],
          appointment_date: row['Start Date Time'],
          duration_minutes: parseInt(row['Minutes Advising Time']) || 30,
          staff_name: row['Staff Name']
        });
      })
      .on('end', async () => {
        try {
          let processed = 0;

          for (const record of records) {
            if (!record.student_id) continue;

            await ensureStudentRecord(record.student_id, {
              full_name: record.full_name,
              first_name: record.first_name,
              last_name: record.last_name,
              email: record.email,
              major: record.major
            });

            const { error } = await supabase
              .from('interview_appointments')
              .insert({
                appt_id: genId('INT'),
                student_id: record.student_id,
                company_name: record.topic,
                scheduled_date: record.appointment_date,
                duration_minutes: record.duration_minutes,
                notes: record.staff_name ? `Advisor: ${record.staff_name}` : null,
                status: 'completed',
                source: 'cdc'
              });

            if (error) {
              console.error('interview_appointments insert error:', error.message, record.student_id);
            } else {
              processed++;
            }
          }

          resolve(processed);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function recalculateAllScores() {
  try {
    // Collect every student ID that appears in any activity table
    const [progressRes, appsRes, eventsRes, apptsRes] = await Promise.all([
      supabase.from('student_career_progress').select('student_id'),
      supabase.from('job_applications').select('student_id'),
      supabase.from('career_events').select('student_id'),
      supabase.from('interview_appointments').select('student_id')
    ]);

    const existingIds = new Set((progressRes.data || []).map(r => r.student_id));

    const allActivityIds = new Set([
      ...(appsRes.data || []).map(r => r.student_id),
      ...(eventsRes.data || []).map(r => r.student_id),
      ...(apptsRes.data || []).map(r => r.student_id)
    ]);

    // Create a student_career_progress row for any ID found in activities but not yet registered
    for (const id of allActivityIds) {
      if (id && !existingIds.has(id)) {
        const { error } = await supabaseAdmin.from('student_career_progress').insert({
          student_id: id,
          full_name: id,
          first_name: '',
          last_name: '',
          email: '',
          major: '',
          engagement_score: 0,
          career_events_attended: 0,
          job_applications_count: 0,
          risk_level: 'high',
          updated_at: new Date().toISOString()
        });
        if (error) console.error('recalculate: failed to create student', id, error.message);
        else existingIds.add(id);
      }
    }

    // Recalculate scores for every student
    const allIds = new Set([...existingIds, ...allActivityIds]);
    for (const id of allIds) {
      if (id) await updateEngagementScore(id);
    }
  } catch (error) {
    console.error('Error recalculating scores:', error);
  }
}

async function updateEngagementScore(studentId) {
  try {
    const [eventsRes, appsRes, appointmentsRes] = await Promise.all([
      supabase.from('career_events').select('event_id').eq('student_id', studentId),
      supabase.from('job_applications').select('app_id').eq('student_id', studentId),
      supabase.from('interview_appointments').select('appt_id').eq('student_id', studentId)
    ]);

    const eventCount = eventsRes.data?.length || 0;
    const appCount = appsRes.data?.length || 0;
    const appointmentCount = appointmentsRes.data?.length || 0;

    const engagementScore = (eventCount * 20) + (appCount * 15) + (appointmentCount * 10);

    let riskLevel = 'low';
    if (engagementScore < 50) riskLevel = 'high';
    else if (engagementScore < 100) riskLevel = 'medium';

    await supabaseAdmin
      .from('student_career_progress')
      .update({
        engagement_score: engagementScore,
        career_events_attended: eventCount,
        job_applications_count: appCount,
        risk_level: riskLevel,
        updated_at: new Date().toISOString()
      })
      .eq('student_id', studentId);
  } catch (error) {
    console.error('Error in updateEngagementScore:', error);
  }
}

module.exports = router;
