// Adds source column to task_completions.
// Safe to re-run — uses IF NOT EXISTS.

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

async function run() {
  await client.connect();
  await client.query(`ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS source TEXT;`);
  console.log('Done — source column added to task_completions.');
  await client.end();
}

run().catch(err => { console.error(err.message); process.exit(1); });
