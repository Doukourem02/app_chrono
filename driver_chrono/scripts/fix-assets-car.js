#!/usr/bin/env node
/**
 * Supprime Assets.car des outputPaths de [CP] Copy Pods Resources
 * pour corriger l'erreur "Multiple commands produce Assets.car"
 */
const fs = require('fs');
const path = require('path');

const iosDir = path.join(__dirname, '..', 'ios');
const pbxPath = path.join(iosDir, 'ChronoPro.xcodeproj', 'project.pbxproj');

if (!fs.existsSync(pbxPath)) {
  console.warn('[fix-assets-car] project.pbxproj not found');
  process.exit(0);
}

let content = fs.readFileSync(pbxPath, 'utf8');

// Supprimer la ligne Assets.car des outputPaths dans [CP] Copy Pods Resources
// Match line: tabs/spaces + "....Assets.car",
const assetsCarLine = /^\s*"[^"]*Assets\.car",\r?\n/gm;
const newContent = content.replace(assetsCarLine, '');
if (newContent !== content) {
  fs.writeFileSync(pbxPath, newContent);
  console.log('[fix-assets-car] Removed Assets.car from [CP] Copy Pods Resources outputPaths');
} else {
  console.log('[fix-assets-car] Assets.car not found in outputPaths (already fixed?)');
}
