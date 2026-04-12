/**
 * Ajoute driver_profiles.heading_degrees (migration 008).
 *   cd chrono_backend && npx tsx scripts/apply-driver-heading-migration.ts
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error('DATABASE_URL manquant');
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, '..', 'migrations', '008_driver_profiles_heading_degrees.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const { Client } = pkg;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Migration heading_degrees appliquée.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
