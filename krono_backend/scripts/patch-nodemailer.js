// postinstall : restaure 2 fichiers de node_modules/nodemailer qui échouent
// systématiquement à s'installer sur l'infra de build Render (cause non identifiée
// côté Render — confirmé hors de notre contrôle : reproduit avec cache vidé, install
// fraîche et registre npm officiel forcé explicitement). Contenu vendoré ici identique
// bit à bit au tarball npm officiel de nodemailer@9.0.3 (vérifié).
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const vendorDir = join(__dirname, 'vendor-patches', 'nodemailer');
const targetDir = join(__dirname, '..', 'node_modules', 'nodemailer', 'lib');

const files = [
  { from: join(vendorDir, 'errors.js'), to: join(targetDir, 'errors.js') },
  { from: join(vendorDir, 'shared', 'url.js'), to: join(targetDir, 'shared', 'url.js') },
];

for (const { from, to } of files) {
  if (!existsSync(from)) continue; // nodemailer absent (ex: install partiel côté dev) — rien à faire
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`[patch-nodemailer] restauré: ${to}`);
}
