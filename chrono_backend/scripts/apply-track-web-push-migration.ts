/**
 * Crée track_web_push_subscriptions (migration 007). Usage :
 *   cd chrono_backend && npx tsx scripts/apply-track-web-push-migration.ts
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

  const sqlPath = path.join(__dirname, '..', 'migrations', '007_track_web_push_subscriptions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const { Client } = pkg;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log('Migration track_web_push_subscriptions appliquée avec succès.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
