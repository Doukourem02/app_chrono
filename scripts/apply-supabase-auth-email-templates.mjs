import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function parseDotenvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) return null;

  const key = trimmed.slice(0, eqIndex).trim();
  let value = trimmed.slice(eqIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

async function loadEnvFile(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  if (!existsSync(fullPath)) return;

  const contents = await readFile(fullPath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseDotenvLine(line);
    if (parsed && process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

function projectRefFromUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const [ref] = parsed.hostname.split('.');
    return ref || null;
  } catch {
    return null;
  }
}

async function main() {
  await loadEnvFile('chrono_backend/.env');
  await loadEnvFile('admin_chrono/.env.local');

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef =
    process.env.SUPABASE_PROJECT_REF ||
    projectRefFromUrl(process.env.SUPABASE_URL) ||
    projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (!accessToken) {
    throw new Error(
      'SUPABASE_ACCESS_TOKEN est requis. Creez un token dans Supabase Dashboard > Account > Access Tokens.'
    );
  }
  if (!projectRef) {
    throw new Error(
      'SUPABASE_PROJECT_REF est requis, ou bien SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL doit etre defini.'
    );
  }

  const inviteTemplate = await readFile(
    path.join(rootDir, 'supabase/auth-email-templates/invite.html'),
    'utf8'
  );
  const magicLinkTemplate = await readFile(
    path.join(rootDir, 'supabase/auth-email-templates/magic-link.html'),
    'utf8'
  );

  const payload = {
    mailer_subjects_invite: 'Krono - Invitation au portail partenaire',
    mailer_templates_invite_content: inviteTemplate,
    mailer_subjects_magic_link: 'Krono - Connexion au portail partenaire',
    mailer_templates_magic_link_content: magicLinkTemplate,
  };

  const apiBase = process.env.SUPABASE_MANAGEMENT_API_URL || 'https://api.supabase.com';
  const configUrl = `${apiBase}/v1/projects/${projectRef}/config/auth`;

  const patchResponse = await fetch(configUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!patchResponse.ok) {
    const body = await patchResponse.text();
    throw new Error(`Supabase auth config PATCH failed (${patchResponse.status}): ${body}`);
  }

  const verifyResponse = await fetch(configUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!verifyResponse.ok) {
    const body = await verifyResponse.text();
    throw new Error(`Supabase auth config GET failed (${verifyResponse.status}): ${body}`);
  }

  const authConfig = await verifyResponse.json();
  const checks = [
    authConfig.mailer_subjects_invite === payload.mailer_subjects_invite,
    authConfig.mailer_templates_invite_content === payload.mailer_templates_invite_content,
    authConfig.mailer_subjects_magic_link === payload.mailer_subjects_magic_link,
    authConfig.mailer_templates_magic_link_content === payload.mailer_templates_magic_link_content,
  ];

  if (checks.some((ok) => !ok)) {
    throw new Error('Verification echouee: les templates lus depuis Supabase ne correspondent pas au payload envoye.');
  }

  console.log(`Templates Supabase Auth appliques et verifies pour le projet ${projectRef}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
