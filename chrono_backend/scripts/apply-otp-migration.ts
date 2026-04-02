/**
 * Crée la table otp_codes (migration 006). Usage :
 *   cd chrono_backend && npx tsx scripts/apply-otp-migration.ts
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
    console.error('DATABASE_URL manquant dans .env');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'migrations', '006_create_otp_codes_table.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const { Client } = pkg;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Migration otp_codes appliquée avec succès.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
