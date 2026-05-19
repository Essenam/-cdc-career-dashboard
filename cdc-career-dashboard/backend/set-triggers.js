// Sets auto-complete triggers on roadmap tasks that can be inferred from CSV activity data.
// Safe to re-run — uses pattern matching, will not touch tasks that don't match.

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
  // event — auto-check when the student has any career event imported
  { trigger: 'event', pattern: '%Attend introductory CDC workshops%' },
  { trigger: 'event', pattern: '%Attend CDC workshops and events, including%' },
  { trigger: 'event', pattern: '%Connect with employers at Handshake career%' },
  { trigger: 'event', pattern: '%Nurture your network%' },

  // application — auto-check when the student has any application imported
  { trigger: 'application', pattern: '%Search and explore internship & job postings%' },
  { trigger: 'application', pattern: '%Find internships on Handshake using Labor Market%' },
  { trigger: 'application', pattern: '%Search for full-time positions on Handshake%' },

  // appointment — auto-check when the student has any CDC appointment imported
  { trigger: 'appointment', pattern: '%Schedule a Big Interview session or mock interview%' },
  { trigger: 'appointment', pattern: '%Practice with CDC-facilitated mock interviews%' },
];

async function run() {
  await client.connect();
  console.log('Connected.');
  let total = 0;
  for (const { trigger, pattern } of triggers) {
    const res = await client.query(
      `UPDATE roadmap_tasks SET trigger = $1 WHERE task_text LIKE $2 RETURNING id, year, task_text`,
      [trigger, pattern]
    );
    for (const row of res.rows) {
      console.log(`  [${trigger}] Y${row.year}: ${row.task_text.slice(0, 60)}...`);
    }
    total += res.rowCount;
  }
  console.log(`\nSet triggers on ${total} tasks.`);
  await client.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
