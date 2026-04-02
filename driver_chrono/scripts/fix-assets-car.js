#!/usr/bin/env node
/* eslint-env node */
/**
 * Supprime Assets.car des outputPaths de [CP] Copy Pods Resources
 * pour corriger l'erreur "Multiple commands produce Assets.car"
 * CRITIQUE : doit s'exécuter après chaque pod install (post_install Podfile)
 */
const fs = require('fs');
const path = require('path');

const iosDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'ios');

if (!fs.existsSync(iosDir)) {
  process.exit(0);
}

const pbxProjects = fs
  .readdirSync(iosDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.endsWith('.xcodeproj'))
  .map((d) => path.join(iosDir, d.name, 'project.pbxproj'))
  .filter((p) => fs.existsSync(p));

if (pbxProjects.length === 0) {
  process.exit(0);
}

const patterns = [
  /^\s*"\$\{TARGET_BUILD_DIR\}\/\$\{UNLOCALIZED_RESOURCES_FOLDER_PATH\}\/Assets\.car",?\s*\r?\n/gm,
  /^\s*"[^"]*\/Assets\.car",?\s*\r?\n/gm,
];

for (const pbxPath of pbxProjects) {
  let content = fs.readFileSync(pbxPath, 'utf8');
  let newContent = content;
  for (const re of patterns) {
    newContent = newContent.replace(re, '');
  }
  if (newContent !== content) {
    fs.writeFileSync(pbxPath, newContent);
    console.log('[fix-assets-car] Removed Assets.car from [CP] Copy Pods Resources:', path.basename(path.dirname(pbxPath)));
  }
}
