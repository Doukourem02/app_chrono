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
const pbxPath = path.join(iosDir, 'ChronoPro.xcodeproj', 'project.pbxproj');

if (!fs.existsSync(pbxPath)) {
  process.exit(0);
}

let content = fs.readFileSync(pbxPath, 'utf8');

// Supprimer TOUTES les lignes Assets.car des outputPaths (évite conflit production)
const patterns = [
  /^\s*"\$\{TARGET_BUILD_DIR\}\/\$\{UNLOCALIZED_RESOURCES_FOLDER_PATH\}\/Assets\.car",?\s*\r?\n/gm,
  /^\s*"[^"]*\/Assets\.car",?\s*\r?\n/gm,
];
let newContent = content;
for (const re of patterns) {
  newContent = newContent.replace(re, '');
}
if (newContent !== content) {
  fs.writeFileSync(pbxPath, newContent);
  console.log('[fix-assets-car] Removed Assets.car from [CP] Copy Pods Resources');
}
