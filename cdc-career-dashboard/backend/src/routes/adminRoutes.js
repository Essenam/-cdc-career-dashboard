const express = require('express');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const { supabase, supabaseAdmin } = require('../config/db');

const genId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Determine which trigger values apply based on activity content
function getEventTriggers(eventTitle, eventType) {
  // Check both the event name and the structured Event Type Name field
  const title = (eventTitle || '').toLowerCase();
  const type  = (eventType  || '').toLowerCase();
  const values = ['event:any'];
  if (title.includes('fair') || type.includes('fair') || type.includes('career fair')) values.push('event:career_fair');
  if (title.includes('negotiat') || title.includes('salary')) values.push('event:negotiation');
  return values;
}

function getAppointmentTriggers(appointmentTypes) {
  // appointmentTypes may be a semicolon-separated list, e.g. "Resume Review; Career Planning"
  const t = (appointmentTypes || '').toLowerCase();
  const values = ['appointment:any'];
  if (t.includes('resume')) {
    values.push('appointment:resume');
    values.push('document:resume'); // resume review implies having a resume — fires Y1/Y4 resume tasks too
  }
  if (t.includes('mock') || t.includes('interview')) values.push('appointment:mock');
  if (t.includes('offer') || t.includes('negotiat') || t.includes('salary')) values.push('appointment:offer');
  return values;
}

function getApplicationTriggers(status) {
  const values = ['application:any'];
  if ((status || '').toLowerCase() === 'accepted') values.push('application:accepted');
  return values;
}

const SCHOOL_YEAR_MAP = {
  'freshman': 1, '1st year': 1, 'first year': 1, 'first-year': 1,
  'sophomore': 2, '2nd year': 2, 'second year': 2,
  'junior': 3, '3rd year': 3, 'third year': 3,
  'senior': 4, '4th year': 4, 'fourth year': 4,
};

function deriveCurrentYear(schoolYear, gradDate) {
  if (schoolYear) {
    const mapped = SCHOOL_YEAR_MAP[schoolYear.toLowerCase().trim()];
    if (mapped) return mapped;
    const parsed = parseInt(schoolYear);
    if (parsed >= 1 && parsed <= 4) return parsed;
  }
  if (gradDate) {
    const gradYear = new Date(gradDate).getFullYear();
    const now = new Date().getFullYear();
    const yr = 4 - (gradYear - now);
    if (yr >= 1 && yr <= 4) return yr;
  }
  return null;
}

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
      supabaseAdmin.from('task_completions').delete().neq('student_id', 'KEEP'),
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

    // Process roster files first so current_year is set before activity files run
    const sortedFiles = [...req.files].sort((a, b) => {
      const isRosterA = a.originalname.toLowerCase().includes('student') || a.originalname.toLowerCase().includes('roster');
      const isRosterB = b.originalname.toLowerCase().includes('student') || b.originalname.toLowerCase().includes('roster');
      return isRosterA ? -1 : isRosterB ? 1 : 0;
    });

    for (const file of sortedFiles) {
      const fileName = file.originalname.toLowerCase();
      let count = 0;

      if (fileName.includes('student') || fileName.includes('roster')) {
        count = await processStudentRoster(file.path);
      } else if (fileName.includes('applications')) {
        count = await processApplications(file.path);
      } else if (fileName.includes('fair')) {
        count = await processCareerFair(file.path);
      } else if (fileName.includes('events')) {
        count = await processEvents(file.path);
      } else if (fileName.includes('appointments') || fileName.includes('interview')) {
        count = await processAppointments(file.path);
      } else {
        warnings.push(`"${file.originalname}" was skipped — filename must include "students", "roster", "applications", "fair", "events", or "appointments".`);
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
    const derivedYear = deriveCurrentYear(fields.school_year || null, fields.graduation_date || null);
    const { error: insertErr } = await supabaseAdmin.from('student_career_progress').insert({
      student_id: studentId,
      full_name: full_name || studentId,
      first_name,
      last_name,
      email: fields.email || null,
      major: fields.major || '',
      current_year: fields.current_year || derivedYear || null,
      graduation_date: fields.graduation_date || null,
      engagement_score: 0,
      career_events_attended: 0,
      job_applications_count: 0,
      risk_level: 'need outreach',
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
    // Set current_year from school_year or graduation_date if we have it
    if (fields.school_year || fields.graduation_date) {
      const derivedYear = deriveCurrentYear(fields.school_year || null, fields.graduation_date || null);
      if (derivedYear) updates.current_year = derivedYear;
    }

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
    // Group by student ID — Handshake exports one row per document,
    // so a student with a resume + cover letter appears twice.
    const studentMap = {};

    const sep = detectSeparator(filePath);
    fs.createReadStream(filePath)
      .pipe(csv({ separator: sep }))
      .on('data', (row) => {
        const studentId = row['Students Card Id'] || row['Card Id'] || row['Student Card Id'] || row['ID'];
        if (!studentId) return;

        if (!studentMap[studentId]) {
          const firstName  = row['Students First Name'] || row['First Name'] || row['first_name'] || '';
          const lastName   = row['Students Last Name']  || row['Last Name']  || row['last_name']  || '';
          studentMap[studentId] = {
            studentId,
            firstName,
            lastName,
            fullName:    row['Full Name'] || row['Name'] || `${firstName} ${lastName}`.trim(),
            email:       row['Students Email - Primary'] || row['Email'] || row['School Email'] || '',
            major:       (row['Majors Name'] || row['Major'] || row['Primary Major'] || '').split(';')[0].trim(),
            gradDate:    row['Students Self-Reported Graduation Date'] || row['Graduation Date'] || row['Expected Graduation Date'] || null,
            schoolYear:  row['School Year Name'] || row['School Year'] || row['Year'] || null,
            hasResume:   false,
          };
        }

        // Any row for this student may carry a document — check all of them
        const docType = (row['Document Types Name'] || '').toLowerCase();
        if (docType.includes('resume')) studentMap[studentId].hasResume = true;
      })
      .on('end', async () => {
        try {
          let processed = 0;

          for (const r of Object.values(studentMap)) {
            const nameParts  = r.fullName.split(' ');
            const first_name = r.firstName || nameParts[0] || '';
            const last_name  = r.lastName  || nameParts.slice(1).join(' ') || '';

            const { data: existing } = await supabase
              .from('student_career_progress')
              .select('student_id')
              .eq('student_id', r.studentId)
              .single();

            if (existing) {
              const updates = { updated_at: new Date().toISOString() };
              if (r.fullName) { updates.full_name = r.fullName; updates.first_name = first_name; updates.last_name = last_name; }
              if (r.email)    updates.email = r.email;
              if (r.major)    updates.major = r.major;
              if (r.gradDate) updates.graduation_date = r.gradDate;
              const derivedYear = deriveCurrentYear(r.schoolYear, r.gradDate);
              if (derivedYear) updates.current_year = derivedYear;

              const { error } = await supabaseAdmin
                .from('student_career_progress')
                .update(updates)
                .eq('student_id', r.studentId);
              if (!error) processed++;
              else console.error('roster update error:', error.message, r.studentId);
            } else {
              const { error } = await supabaseAdmin
                .from('student_career_progress')
                .insert({
                  student_id:             r.studentId,
                  full_name:              r.fullName || r.studentId,
                  first_name,
                  last_name,
                  email:                  r.email || '',
                  major:                  r.major || '',
                  graduation_date:        r.gradDate || null,
                  current_year:           deriveCurrentYear(r.schoolYear, r.gradDate),
                  engagement_score:       0,
                  career_events_attended: 0,
                  job_applications_count: 0,
                  risk_level:             'need outreach',
                  updated_at:             new Date().toISOString()
                });
              if (!error) processed++;
              else console.error('roster insert error:', error.message, r.studentId);
            }

            // Resume uploaded to Handshake → infer student has created/updated their resume
            if (r.hasResume) {
              await autoCompleteTriggeredTasks(r.studentId, ['document:resume'], null);
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
        const last_name  = row['Applicant (student) Last Name']  || row['Last Name']  || '';
        records.push({
          student_id:       row['Applicant (student) Card Id'] || row['Card Id'],
          first_name,
          last_name,
          full_name:        `${first_name} ${last_name}`.trim(),
          email:            row['Applicant (student) Email - Institution'] || row['Applicant (student) Email'] || row['Email'] || '',
          major:            row['Major'] || '',
          graduation_date:  row['Graduation Date'] || null,
          employer_name:    row['Employer Name'],
          job_title:        row['Job Title'],
          application_type: row['Applications Application Type'] || null,
          application_date: row['Applications Created At Date'] || null,
          status:           row['Applications Status'],
          fully_qualified:  (row['Applications Fully Qualified? (Yes / No)'] || '').toLowerCase() === 'yes',
          external_apply:   (row['Job External Apply? (Yes / No)'] || '').toLowerCase() === 'yes'
        });
      })
      .on('end', async () => {
        try {
          let processed = 0;
          // Collect trigger values per student across all their applications
          const studentTriggers = {};

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
              if (!studentTriggers[record.student_id]) studentTriggers[record.student_id] = new Set();
              getApplicationTriggers(record.status).forEach(v => studentTriggers[record.student_id].add(v));
            }
          }

          for (const [sid, triggers] of Object.entries(studentTriggers)) {
            await autoCompleteTriggeredTasks(sid, [...triggers], null);
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
        const firstName = row['Student Attendees First Name'] || row['First Name'] || '';
        const lastName  = row['Student Attendees Last Name']  || row['Last Name']  || '';
        const major     = (row['Student Attendee Majors Name'] || row['Major'] || '').split(';')[0].trim();
        const schoolYear = (row['Student Attendee School Years Name'] || '').split(';')[0].trim();
        records.push({
          student_id:  row['Student Attendees Card Id'] || row['Card Id'],
          first_name:  firstName,
          last_name:   lastName,
          full_name:   `${firstName} ${lastName}`.trim(),
          email:       row['Student Attendees Email - Institution'] || row['Email'] || '',
          major,
          school_year: schoolYear,
          event_name:  row['Events Name'] || row['Content'],
          event_type:  row['Event Type Name'] || '',
          event_date:  row['Events Start Date Date'] || row['Start Date Date'] || row['Start Date Time'],
          checked_in:  (row['Attendees Checked In? (Yes / No)'] || '').toLowerCase() === 'yes',
        });
      })
      .on('end', async () => {
        try {
          let processed = 0;
          // Collect trigger values per student, keyed by most recent event date
          const studentTriggers = {};

          for (const record of records) {
            if (!record.student_id) continue;

            await ensureStudentRecord(record.student_id, {
              full_name:   record.full_name,
              first_name:  record.first_name,
              last_name:   record.last_name,
              email:       record.email,
              major:       record.major,
              school_year: record.school_year,
            });

            const { error } = await supabase
              .from('career_events')
              .insert({
                event_id:     genId('EVT'),
                student_id:   record.student_id,
                event_title:  record.event_name,
                event_type:   record.event_type || 'career_event',
                attended_date: record.event_date,
                checked_in:   record.checked_in,
                is_drop_in:   false,
                source:       'handshake'
              });

            if (error) {
              console.error('career_events insert error:', error.message, record.student_id);
            } else {
              processed++;
              if (!studentTriggers[record.student_id]) studentTriggers[record.student_id] = { triggers: new Set(), date: null };
              getEventTriggers(record.event_name, record.event_type).forEach(v => studentTriggers[record.student_id].triggers.add(v));
              if (record.event_date && (!studentTriggers[record.student_id].date || record.event_date > studentTriggers[record.student_id].date)) {
                studentTriggers[record.student_id].date = record.event_date;
              }
            }
          }

          for (const [sid, { triggers, date }] of Object.entries(studentTriggers)) {
            await autoCompleteTriggeredTasks(sid, [...triggers], date);
          }

          resolve(processed);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function processCareerFair(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];

    const sep = detectSeparator(filePath);
    fs.createReadStream(filePath)
      .pipe(csv({ separator: sep }))
      .on('data', (row) => {
        const firstName  = row['Student Attendees First Name'] || '';
        const lastName   = row['Student Attendees Last Name']  || '';
        const major      = (row['Student Attendee Majors Name'] || '').split(';')[0].trim();
        const schoolYear = (row['Student Attendee School Year (at Fair Time) Name'] || '').split(';')[0].trim();
        records.push({
          student_id:  row['Student Attendees Card Id'],
          first_name:  firstName,
          last_name:   lastName,
          full_name:   `${firstName} ${lastName}`.trim(),
          email:       row['Student Attendees Email - Institution'] || '',
          major,
          school_year: schoolYear,
          fair_name:   row['Career Fairs Name'] || '',
          fair_date:   row['Career Fair Dates and Times Start Date'] || '',
        });
      })
      .on('end', async () => {
        try {
          let processed = 0;
          const studentTriggers = {};

          for (const record of records) {
            if (!record.student_id) continue;

            await ensureStudentRecord(record.student_id, {
              full_name:   record.full_name,
              first_name:  record.first_name,
              last_name:   record.last_name,
              email:       record.email,
              major:       record.major,
              school_year: record.school_year,
            });

            const { error } = await supabase
              .from('career_events')
              .insert({
                event_id:     genId('EVT'),
                student_id:   record.student_id,
                event_title:  record.fair_name,
                event_type:   'Career Fair',
                attended_date: record.fair_date,
                checked_in:   true,
                is_drop_in:   false,
                source:       'handshake'
              });

            if (error) {
              console.error('career_fair insert error:', error.message, record.student_id);
            } else {
              processed++;
              if (!studentTriggers[record.student_id]) studentTriggers[record.student_id] = { triggers: new Set(), date: null };
              // Career fair always fires both triggers — no keyword guessing needed
              ['event:any', 'event:career_fair'].forEach(v => studentTriggers[record.student_id].triggers.add(v));
              if (record.fair_date && (!studentTriggers[record.student_id].date || record.fair_date > studentTriggers[record.student_id].date)) {
                studentTriggers[record.student_id].date = record.fair_date;
              }
            }
          }

          for (const [sid, { triggers, date }] of Object.entries(studentTriggers)) {
            await autoCompleteTriggeredTasks(sid, [...triggers], date);
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
        const firstName  = row['Student First Name'] || row['First Name'] || '';
        const lastName   = row['Student Last Name']  || row['Last Name']  || '';
        const staffFirst = row['Staff Member First Name'] || '';
        const staffLast  = row['Staff Member Last Name']  || '';
        // "Name List" fields may contain semicolon-separated values — take first for storage
        const major      = (row['Student Majors (at Appt. Time) Name List'] || row['Major'] || '').split(';')[0].trim();
        const schoolYear = (row['Student School Year (at Appt. Time) Name List'] || '').split(';')[0].trim();
        // Appointment Types Name List is the structured type — used for trigger matching
        const apptTypes  = row['Appointment Types Name List'] || row['Content'] || '';

        records.push({
          student_id:       row['Student Card Id'] || row['Card Id'],
          first_name:       firstName,
          last_name:        lastName,
          full_name:        `${firstName} ${lastName}`.trim(),
          major,
          school_year:      schoolYear,
          topic:            apptTypes,
          description:      row['Appointments Description'] || '',
          appointment_date: row['Appointments Start Date Date'] || row['Start Date Time'],
          staff_name:       `${staffFirst} ${staffLast}`.trim() || row['Staff Name'] || '',
        });
      })
      .on('end', async () => {
        try {
          let processed = 0;
          // Collect trigger values per student across all their appointments
          const studentTriggers = {};

          for (const record of records) {
            if (!record.student_id) continue;

            await ensureStudentRecord(record.student_id, {
              full_name:   record.full_name,
              first_name:  record.first_name,
              last_name:   record.last_name,
              major:       record.major,
              school_year: record.school_year,
            });

            const { error } = await supabase
              .from('interview_appointments')
              .insert({
                appt_id:        genId('INT'),
                student_id:     record.student_id,
                company_name:   record.topic,
                scheduled_date: record.appointment_date,
                duration_minutes: 30,
                notes: [
                  record.staff_name  ? `Advisor: ${record.staff_name}` : null,
                  record.description ? `Notes: ${record.description}`  : null,
                ].filter(Boolean).join(' · ') || null,
                status: 'completed',
                source: 'cdc'
              });

            if (error) {
              console.error('interview_appointments insert error:', error.message, record.student_id);
            } else {
              processed++;
              if (!studentTriggers[record.student_id]) studentTriggers[record.student_id] = { triggers: new Set(), date: null };
              getAppointmentTriggers(record.topic).forEach(v => studentTriggers[record.student_id].triggers.add(v));
              if (record.appointment_date && (!studentTriggers[record.student_id].date || record.appointment_date > studentTriggers[record.student_id].date)) {
                studentTriggers[record.student_id].date = record.appointment_date;
              }
            }
          }

          for (const [sid, { triggers, date }] of Object.entries(studentTriggers)) {
            await autoCompleteTriggeredTasks(sid, [...triggers], date);
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
    // Fetch activity data with content fields needed for trigger matching
    const [progressRes, appsRes, eventsRes, apptsRes] = await Promise.all([
      supabase.from('student_career_progress').select('student_id'),
      supabase.from('job_applications').select('student_id, status'),
      supabase.from('career_events').select('student_id, event_title, event_type'),
      supabase.from('interview_appointments').select('student_id, company_name')
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
          risk_level: 'need outreach',
          updated_at: new Date().toISOString()
        });
        if (error) console.error('recalculate: failed to create student', id, error.message);
        else existingIds.add(id);
      }
    }

    // Build per-student trigger sets from all existing activity
    const triggerMap = {};
    const addTriggers = (studentId, values) => {
      if (!studentId) return;
      if (!triggerMap[studentId]) triggerMap[studentId] = new Set();
      values.forEach(v => triggerMap[studentId].add(v));
    };

    for (const e of eventsRes.data  || []) addTriggers(e.student_id, getEventTriggers(e.event_title, e.event_type));
    for (const a of appsRes.data    || []) addTriggers(a.student_id, getApplicationTriggers(a.status));
    for (const a of apptsRes.data   || []) addTriggers(a.student_id, getAppointmentTriggers(a.company_name));

    // Fire triggers retroactively, then recalculate scores
    const allIds = new Set([...existingIds, ...allActivityIds]);
    for (const id of allIds) {
      if (!id) continue;
      if (triggerMap[id]?.size > 0) await autoCompleteTriggeredTasks(id, [...triggerMap[id]], null);
      await updateEngagementScore(id);
    }
  } catch (error) {
    console.error('Error recalculating scores:', error);
  }
}

// Auto-complete roadmap tasks whose trigger matches one of the given values.
// activityDate sets completed_at so the timeline reflects the real activity date.
async function autoCompleteTriggeredTasks(studentId, triggerValues, activityDate) {
  try {
    const { data: studentRow, error: yearErr } = await supabaseAdmin
      .from('student_career_progress')
      .select('current_year')
      .eq('student_id', studentId)
      .single();

    const currentYear = studentRow?.current_year;
    console.log(`[trigger] ${studentId} year=${currentYear} triggers=[${triggerValues}]`);
    if (yearErr) console.log(`[trigger] year fetch error:`, yearErr.message);
    if (!currentYear) { console.log(`[trigger] skipped — no current_year`); return; }

    const { data: tasks, error: tasksErr } = await supabase
      .from('roadmap_tasks')
      .select('id, task_text')
      .eq('year', currentYear)
      .in('trigger', triggerValues);

    if (tasksErr) console.log(`[trigger] tasks fetch error:`, tasksErr.message);
    console.log(`[trigger] ${studentId} matched ${tasks?.length || 0} tasks`);
    if (!tasks?.length) return;

    const completedAt = activityDate || new Date().toISOString();
    for (const task of tasks) {
      console.log(`[trigger] completing: ${studentId} → task_${task.id} (${task.task_text?.slice(0, 50)})`);
      const { error: upsertErr } = await supabaseAdmin
        .from('task_completions')
        .upsert(
          { student_id: studentId, task_key: `task_${task.id}`, completed: true, completed_at: completedAt },
          { onConflict: 'student_id,task_key' }
        );
      if (upsertErr) console.log(`[trigger] upsert error:`, upsertErr.message);
    }
  } catch (err) {
    console.error('autoCompleteTriggeredTasks error:', err.message, studentId, triggerValues);
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
    const appCount   = appsRes.data?.length || 0;
    const apptCount  = appointmentsRes.data?.length || 0;

    const score = (eventCount * 20) + (appCount * 15) + (apptCount * 10);

    const riskLevel = score >= 67 ? 'engaged'
      : score >= 33 ? 'developing'
      : 'need outreach';

    await supabaseAdmin
      .from('student_career_progress')
      .update({
        engagement_score: score,
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
