// Updates roadmap_tasks.trigger to use keyword-aware format (type:keyword).
// Safe to re-run — uses LIKE pattern matching, only touches matched rows.

require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const triggers = [
  // ── Year 1 ──────────────────────────────────────────────────────────────
  { trigger: 'application:any',   pattern: '%Log in to Handshake and complete your profile%' },
  { trigger: 'appointment:any',   pattern: '%Connect with a trusted mentor%Career Educator at the CDC%' },
  { trigger: 'event:any',         pattern: '%Attend introductory CDC workshops and events%' },

  // ── Year 2 ──────────────────────────────────────────────────────────────
  { trigger: 'appointment:any',   pattern: '%Create an initial career plan with a Career Educator%' },
  { trigger: 'appointment:any',   pattern: '%Schedule regular mentoring sessions%' },
  { trigger: 'appointment:resume',pattern: '%Have your resume reviewed at the CDC%' },
  { trigger: 'application:any',   pattern: '%Search and explore internship & job postings on Handshake%' },
  { trigger: 'event:any',         pattern: '%Attend CDC workshops and events, including%' },

  // ── Year 3 ──────────────────────────────────────────────────────────────
  { trigger: 'application:any',   pattern: '%Find internships on Handshake%' },
  { trigger: 'application:any',   pattern: '%Apply for leadership positions, research opportunities%' },
  { trigger: 'appointment:mock',  pattern: '%Schedule a Big Interview session or mock interview%' },
  { trigger: 'appointment:any',   pattern: '%Reflect on your experiences and discuss career implications%' },
  { trigger: 'event:career_fair', pattern: '%Connect with employers at Handshake career & opportunity fairs%' },
  { trigger: 'event:any',         pattern: '%Attend networking events, informational sessions%' },
  { trigger: 'appointment:resume',pattern: '%Get feedback from CDC advisors and mentors on your resume%' },

  // ── document:resume — student has a resume uploaded to Handshake ────────
  // One task per year so the trigger always lands on the student's current year
  { trigger: 'document:resume', pattern: '%Create or update your resume using Jobscan%' },
  { trigger: 'document:resume', pattern: '%Update your resume & personal statement based on Handshake%' },
  { trigger: 'document:resume', pattern: '%Tailor your resume and LinkedIn profile for roles%' },
  { trigger: 'document:resume', pattern: '%Continually develop & refine your LinkedIn profile and resume%' },

  // ── Year 4 ──────────────────────────────────────────────────────────────
  { trigger: 'application:any',      pattern: '%Search for full-time positions on Handshake%' },
  { trigger: 'application:any',      pattern: '%Prepare and submit applications for employment%' },
  { trigger: 'appointment:mock',     pattern: '%Practice with CDC-facilitated mock interviews%' },
  { trigger: 'appointment:any',      pattern: '%Ask mentors or alumni for feedback on your interview approach%' },
  { trigger: 'event:any',            pattern: '%Nurture your network%' },
  { trigger: 'event:career_fair',    pattern: '%Connect with employers at Handshake-hosted career fairs%' },
  { trigger: 'event:negotiation',    pattern: '%Attend CDC workshops on negotiating salary%' },
  { trigger: 'appointment:offer',    pattern: '%Consult with your mentors or CDC advisor on evaluating offers%' },
  { trigger: 'application:accepted', pattern: '%Close the loop by informing your network%' },
];

async function run() {
  await client.connect();
  console.log('Connected.');

  // Clear all existing triggers first so old-format values don't linger
  await client.query(`UPDATE roadmap_tasks SET trigger = NULL`);
  console.log('Cleared old trigger values.');

  let total = 0;
  for (const { trigger, pattern } of triggers) {
    const res = await client.query(
      `UPDATE roadmap_tasks SET trigger = $1 WHERE task_text LIKE $2 RETURNING id, year, task_text`,
      [trigger, pattern]
    );
    for (const row of res.rows) {
      console.log(`  [${trigger}] Y${row.year}: ${row.task_text.slice(0, 70)}...`);
    }
    total += res.rowCount;
  }

  console.log(`\nSet triggers on ${total} tasks.`);
  await client.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
