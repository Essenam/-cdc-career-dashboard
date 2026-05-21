const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const csv     = require('csv-parser');
const { supabase, supabaseAdmin } = require('../config/db');
const { SCORE_WEIGHTS, getRiskLevel } = require('../utils/constants');
const { getEventTriggers, getAppointmentTriggers, getApplicationTriggers } = require('../utils/triggers');
const { invalidateAnalyticsCache } = require('./staffRoutes');

const genId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function fmtDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
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

function detectSeparator(filePath) {
  const firstLine = fs.readFileSync(filePath, 'utf8').split('\n')[0] || '';
  const tabs   = (firstLine.match(/\t/g)  || []).length;
  const commas = (firstLine.match(/,/g)   || []).length;
  return tabs > commas ? '\t' : ',';
}

const router = express.Router();

// Multer: 50 MB limit, CSV/TSV/TXT files only
// fileFilter uses cb(null, false) to silently reject bad files so multer doesn't drop
// the connection; the route handler checks for rejected files explicitly.
const ALLOWED_EXTENSIONS = new Set(['.csv', '.tsv', '.txt']);
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ALLOWED_EXTENSIONS.has(ext));
  }
});

function hasRejectedFile(req) {
  // multer 2.x: files with cb(null,false) appear in req.body as nothing — original files
  // are available via the incoming field; detect by comparing field count to accepted files.
  // Simpler: check if originalname extension is disallowed for every uploaded file.
  const files = req.files || (req.file ? [req.file] : []);
  return files.length === 0;
}

// Reset all data
router.post('/reset', async (req, res) => {
  try {
    await Promise.all([
      supabaseAdmin.from('job_applications').delete().neq('app_id', 'KEEP'),
      supabaseAdmin.from('career_events').delete().neq('event_id', 'KEEP'),
      supabaseAdmin.from('interview_appointments').delete().neq('appt_id', 'KEEP'),
      supabaseAdmin.from('task_completions').delete().neq('student_id', 'KEEP'),
    ]);
    await supabaseAdmin.from('student_career_progress').delete().neq('student_id', 'KEEP');
    invalidateAnalyticsCache();
    res.json({ success: true, message: 'All data cleared. Ready for a fresh upload.' });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manually resync all student scores
router.post('/resync', async (req, res) => {
  try {
    await recalculateAllScores();
    invalidateAnalyticsCache();
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
    total_applications_in_db:                apps.data?.length,
    unique_student_ids_in_job_applications:  uniqueAppStudents,
    students_not_in_progress_table:          studentsNotInProgress,
    students_in_progress_table:              students.data,
    recent_applications:                     apps.data?.slice(0, 10)
  });
});

// Preview CSV headers and first row
router.post('/preview-csv', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded or file type not allowed. Use .csv, .tsv, or .txt.' });

    const headers = [];
    const rows = [];

    try {
      await new Promise((resolve) => {
        const sep = detectSeparator(req.file.path);
        fs.createReadStream(req.file.path)
          .pipe(csv({ separator: sep }))
          .on('headers', (h) => headers.push(...h))
          .on('data', (row) => { if (rows.length < 3) rows.push(row); })
          .on('end', () => resolve(true))
          .on('error', () => resolve(false));
      });
      res.json({ headers, sampleRows: rows });
    } finally {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
  });
});

router.post('/upload-csv', (req, res) => {
  upload.array('files')(req, res, async (err) => {
  if (err) return res.status(400).json({ error: err.message });
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  let totalRecordsProcessed = 0;
  const warnings = [];

  // Roster first so current_year is set before activity files run
  const sortedFiles = [...req.files].sort((a, b) => {
    const isRosterA = a.originalname.toLowerCase().includes('student') || a.originalname.toLowerCase().includes('roster');
    const isRosterB = b.originalname.toLowerCase().includes('student') || b.originalname.toLowerCase().includes('roster');
    return isRosterA ? -1 : isRosterB ? 1 : 0;
  });

  for (const file of sortedFiles) {
    const fileName = file.originalname.toLowerCase();
    let count = 0;

    try {
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
    } catch (err) {
      console.error(`Error processing ${file.originalname}:`, err.message);
      warnings.push(`"${file.originalname}" failed to process: ${err.message}`);
    } finally {
      try { fs.unlinkSync(file.path); } catch {}
    }
  }

  try {
    await recalculateAllScores();
    invalidateAnalyticsCache();
  } catch (err) {
    console.error('Score recalculation error after upload:', err.message);
  }

  res.json({
    success: true,
    message: totalRecordsProcessed > 0
      ? `Successfully imported ${totalRecordsProcessed} records.`
      : 'Upload completed but no records were imported.',
    recordsProcessed: totalRecordsProcessed,
    warnings
  });
  }); // end upload.array callback
});

async function ensureStudentRecord(studentId, fields = {}) {
  if (!studentId) return;

  const { data: existing } = await supabase
    .from('student_career_progress')
    .select('student_id, full_name, email')
    .eq('student_id', studentId)
    .single();

  const nameParts  = (fields.full_name || '').trim().split(' ');
  const first_name = fields.first_name || nameParts[0] || '';
  const last_name  = fields.last_name  || nameParts.slice(1).join(' ') || '';
  const full_name  = fields.full_name  || `${first_name} ${last_name}`.trim();

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
    const updates = {};
    if (full_name && full_name !== studentId) {
      updates.full_name = full_name;
      if (first_name) updates.first_name = first_name;
      if (last_name)  updates.last_name  = last_name;
    }
    if (fields.email)           updates.email           = fields.email;
    if (fields.major)           updates.major           = fields.major;
    if (fields.graduation_date) updates.graduation_date = fields.graduation_date;
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

// Build a Set of fingerprints from the DB to skip duplicate rows on re-upload
async function buildExistingFingerprints(table, columns) {
  const { data } = await supabase.from(table).select(columns.join(', '));
  const set = new Set();
  for (const row of data || []) {
    set.add(columns.map(c => (row[c] || '').toString().toLowerCase()).join('|'));
  }
  return set;
}

async function processStudentRoster(filePath) {
  return new Promise((resolve, reject) => {
    const studentMap = {};
    const sep = detectSeparator(filePath);
    fs.createReadStream(filePath)
      .pipe(csv({ separator: sep }))
      .on('data', (row) => {
        const studentId = row['Students Card Id'] || row['Card Id'] || row['Student Card Id'] || row['ID'];
        if (!studentId) return;
        if (!studentMap[studentId]) {
          const firstName = row['Students First Name'] || row['First Name'] || row['first_name'] || '';
          const lastName  = row['Students Last Name']  || row['Last Name']  || row['last_name']  || '';
          studentMap[studentId] = {
            studentId,
            firstName,
            lastName,
            fullName:   row['Full Name'] || row['Name'] || `${firstName} ${lastName}`.trim(),
            email:      row['Students Email - Primary'] || row['Email'] || row['School Email'] || '',
            major:      (row['Majors Name'] || row['Major'] || row['Primary Major'] || '').split(';')[0].trim(),
            gradDate:   row['Students Self-Reported Graduation Date'] || row['Graduation Date'] || row['Expected Graduation Date'] || null,
            schoolYear: row['School Year Name'] || row['School Year'] || row['Year'] || null,
            hasResume:  false,
          };
        }
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

            if (r.hasResume) {
              await autoCompleteTriggeredTasks(r.studentId, ['document:resume'], null, 'Auto — Resume uploaded to Handshake');
            }
          }
          resolve(processed);
        } catch (err) { reject(err); }
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
          // Dedup: skip rows that already exist in the DB (same student + company + title + date)
          const existing = await buildExistingFingerprints(
            'job_applications',
            ['student_id', 'company_name', 'job_title', 'applied_date']
          );

          let processed = 0;
          const studentTriggers = {};

          for (const record of records) {
            if (!record.student_id) continue;

            const fp = [record.student_id, record.employer_name, record.job_title, record.application_date]
              .map(v => (v || '').toString().toLowerCase()).join('|');
            if (existing.has(fp)) continue;

            await ensureStudentRecord(record.student_id, {
              full_name: record.full_name, first_name: record.first_name, last_name: record.last_name,
              email: record.email, major: record.major, graduation_date: record.graduation_date
            });

            const { error } = await supabase.from('job_applications').insert({
              app_id:          genId('APP'),
              student_id:      record.student_id,
              company_name:    record.employer_name,
              job_title:       record.job_title,
              applied_date:    record.application_date,
              status:          record.status || 'pending',
              source:          'handshake',
              fully_qualified: record.fully_qualified,
              external_apply:  record.external_apply
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
            await autoCompleteTriggeredTasks(sid, [...triggers], null, 'Auto — Job applications on Handshake');
          }

          resolve(processed);
        } catch (error) { reject(error); }
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
        const firstName  = row['Student Attendees First Name'] || row['First Name'] || '';
        const lastName   = row['Student Attendees Last Name']  || row['Last Name']  || '';
        const major      = (row['Student Attendee Majors Name'] || row['Major'] || '').split(';')[0].trim();
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
          // Dedup: skip rows that already exist (same student + event + date)
          const existing = await buildExistingFingerprints(
            'career_events',
            ['student_id', 'event_title', 'attended_date']
          );

          let processed = 0;
          for (const record of records) {
            if (!record.student_id) continue;

            const fp = [record.student_id, record.event_name, record.event_date]
              .map(v => (v || '').toString().toLowerCase()).join('|');
            if (existing.has(fp)) continue;

            await ensureStudentRecord(record.student_id, {
              full_name: record.full_name, first_name: record.first_name, last_name: record.last_name,
              email: record.email, major: record.major, school_year: record.school_year,
            });

            const { error } = await supabase.from('career_events').insert({
              event_id:      genId('EVT'),
              student_id:    record.student_id,
              event_title:   record.event_name,
              event_type:    record.event_type || 'career_event',
              attended_date: record.event_date,
              checked_in:    record.checked_in,
              is_drop_in:    false,
              source:        'handshake'
            });

            if (error) {
              console.error('career_events insert error:', error.message, record.student_id);
            } else {
              processed++;
              const source = `Auto — ${record.event_name || record.event_type} (${fmtDate(record.event_date)})`;
              await autoCompleteTriggeredTasks(record.student_id, getEventTriggers(record.event_name, record.event_type), record.event_date, source);
            }
          }

          resolve(processed);
        } catch (error) { reject(error); }
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
          const existing = await buildExistingFingerprints(
            'career_events',
            ['student_id', 'event_title', 'attended_date']
          );

          let processed = 0;
          for (const record of records) {
            if (!record.student_id) continue;

            const fp = [record.student_id, record.fair_name, record.fair_date]
              .map(v => (v || '').toString().toLowerCase()).join('|');
            if (existing.has(fp)) continue;

            await ensureStudentRecord(record.student_id, {
              full_name: record.full_name, first_name: record.first_name, last_name: record.last_name,
              email: record.email, major: record.major, school_year: record.school_year,
            });

            const { error } = await supabase.from('career_events').insert({
              event_id:      genId('EVT'),
              student_id:    record.student_id,
              event_title:   record.fair_name,
              event_type:    'Career Fair',
              attended_date: record.fair_date,
              checked_in:    true,
              is_drop_in:    false,
              source:        'handshake'
            });

            if (error) {
              console.error('career_fair insert error:', error.message, record.student_id);
            } else {
              processed++;
              const source = `Auto — ${record.fair_name} (${fmtDate(record.fair_date)})`;
              await autoCompleteTriggeredTasks(record.student_id, ['event:any', 'event:career_fair'], record.fair_date, source);
            }
          }

          resolve(processed);
        } catch (error) { reject(error); }
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
        const major      = (row['Student Majors (at Appt. Time) Name List'] || row['Major'] || '').split(';')[0].trim();
        const schoolYear = (row['Student School Year (at Appt. Time) Name List'] || '').split(';')[0].trim();
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
          const existing = await buildExistingFingerprints(
            'interview_appointments',
            ['student_id', 'company_name', 'scheduled_date']
          );

          let processed = 0;
          const studentTriggers = {};

          for (const record of records) {
            if (!record.student_id) continue;

            const fp = [record.student_id, record.topic, record.appointment_date]
              .map(v => (v || '').toString().toLowerCase()).join('|');
            if (existing.has(fp)) continue;

            await ensureStudentRecord(record.student_id, {
              full_name: record.full_name, first_name: record.first_name, last_name: record.last_name,
              major: record.major, school_year: record.school_year,
            });

            const { error } = await supabase.from('interview_appointments').insert({
              appt_id:          genId('INT'),
              student_id:       record.student_id,
              company_name:     record.topic,
              scheduled_date:   record.appointment_date,
              duration_minutes: 30,
              notes: [
                record.staff_name  ? `Career Coach: ${record.staff_name}` : null,
                record.description ? `Notes: ${record.description}`        : null,
              ].filter(Boolean).join(' · ') || null,
              status: 'completed',
              source: 'cdc'
            });

            if (error) {
              console.error('interview_appointments insert error:', error.message, record.student_id);
            } else {
              processed++;
              const advisorPart = record.staff_name ? ` with ${record.staff_name}` : '';
              const source = `Auto — ${record.topic}${advisorPart} (${fmtDate(record.appointment_date)})`;
              await autoCompleteTriggeredTasks(record.student_id, getAppointmentTriggers(record.topic), record.appointment_date, source);
            }
          }

          resolve(processed);
        } catch (error) { reject(error); }
      })
      .on('error', reject);
  });
}

async function recalculateAllScores() {
  try {
    const [progressRes, appsRes, eventsRes, apptsRes] = await Promise.all([
      supabase.from('student_career_progress').select('student_id'),
      supabase.from('job_applications').select('student_id, status'),
      supabase.from('career_events').select('student_id, event_title, event_type, attended_date'),
      supabase.from('interview_appointments').select('student_id, company_name, scheduled_date, notes')
    ]);

    const existingIds = new Set((progressRes.data || []).map(r => r.student_id));

    const allActivityIds = new Set([
      ...(appsRes.data  || []).map(r => r.student_id),
      ...(eventsRes.data || []).map(r => r.student_id),
      ...(apptsRes.data  || []).map(r => r.student_id)
    ]);

    for (const id of allActivityIds) {
      if (id && !existingIds.has(id)) {
        const { error } = await supabaseAdmin.from('student_career_progress').insert({
          student_id: id, full_name: id, first_name: '', last_name: '', email: '', major: '',
          engagement_score: 0, career_events_attended: 0, job_applications_count: 0,
          risk_level: 'need outreach', updated_at: new Date().toISOString()
        });
        if (error) console.error('recalculate: failed to create student', id, error.message);
        else existingIds.add(id);
      }
    }

    for (const e of eventsRes.data || []) {
      if (!e.student_id) continue;
      const source = `Auto — ${e.event_title || e.event_type} (${fmtDate(e.attended_date)})`;
      await autoCompleteTriggeredTasks(e.student_id, getEventTriggers(e.event_title, e.event_type), e.attended_date, source);
    }

    for (const a of apptsRes.data || []) {
      if (!a.student_id) continue;
      const advisorMatch = (a.notes || '').match(/(?:Career Coach|Advisor): ([^·\n]+)/);
      const advisor = advisorMatch ? advisorMatch[1].trim() : '';
      const advisorPart = advisor ? ` with ${advisor}` : '';
      const source = `Auto — ${a.company_name}${advisorPart} (${fmtDate(a.scheduled_date)})`;
      await autoCompleteTriggeredTasks(a.student_id, getAppointmentTriggers(a.company_name), a.scheduled_date, source);
    }

    const appTriggers = {};
    for (const a of appsRes.data || []) {
      if (!a.student_id) continue;
      if (!appTriggers[a.student_id]) appTriggers[a.student_id] = new Set();
      getApplicationTriggers(a.status).forEach(v => appTriggers[a.student_id].add(v));
    }
    for (const [sid, triggers] of Object.entries(appTriggers)) {
      await autoCompleteTriggeredTasks(sid, [...triggers], null, 'Auto — Job applications on Handshake');
    }

    const allIds = new Set([...existingIds, ...allActivityIds]);
    for (const id of allIds) {
      if (id) await updateEngagementScore(id);
    }
  } catch (error) {
    console.error('Error recalculating scores:', error);
  }
}

async function autoCompleteTriggeredTasks(studentId, triggerValues, activityDate, sourceLabel) {
  try {
    const { data: studentRow } = await supabaseAdmin
      .from('student_career_progress')
      .select('current_year')
      .eq('student_id', studentId)
      .single();

    const currentYear = studentRow?.current_year;
    if (!currentYear) return;

    const { data: tasks } = await supabase
      .from('roadmap_tasks')
      .select('id')
      .eq('year', currentYear)
      .in('trigger', triggerValues);

    if (!tasks?.length) return;

    const now = new Date().toISOString();
    for (const task of tasks) {
      const { error } = await supabaseAdmin
        .from('task_completions')
        .upsert(
          {
            student_id: studentId,
            task_key:   `task_${task.id}`,
            completed:  true,
            source:     sourceLabel || 'Auto — imported from Handshake',
            updated_at: now
          },
          { onConflict: 'student_id,task_key', ignoreDuplicates: true }
        );
      if (error) console.error('autoCompleteTriggeredTasks upsert error:', error.message);
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
    const appCount   = appsRes.data?.length   || 0;
    const apptCount  = appointmentsRes.data?.length || 0;

    const score = (eventCount * SCORE_WEIGHTS.event) + (appCount * SCORE_WEIGHTS.application) + (apptCount * SCORE_WEIGHTS.appointment);

    await supabaseAdmin
      .from('student_career_progress')
      .update({
        engagement_score:       score,
        career_events_attended: eventCount,
        job_applications_count: appCount,
        risk_level:             getRiskLevel(score),
        updated_at:             new Date().toISOString()
      })
      .eq('student_id', studentId);

  } catch (error) {
    console.error('Error in updateEngagementScore:', error);
  }
}

module.exports = router;
