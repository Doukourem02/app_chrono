#!/usr/bin/env node
/* eslint-env node */
/**
 * Supprime Assets.car des outputPaths de [CP] Copy Pods Resources
 * pour corriger l'erreur "Multiple commands produce Assets.car"
 */
const fs = require('fs');
const path = require('path');

// Accept ios dir as first arg (quand appelé depuis Podfile post_install)
const iosDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'ios');
const pbxPath = path.join(iosDir, 'ChronoPro.xcodeproj', 'project.pbxproj');

if (!fs.existsSync(pbxPath)) {
  console.warn('[fix-assets-car] project.pbxproj not found');
  process.exit(0);
}

let content = fs.readFileSync(pbxPath, 'utf8');

// Supprimer la ligne Assets.car des outputPaths dans [CP] Copy Pods Resources
// Match: ".../Assets.car" (évite conflit avec Compile Asset Catalogs du target principal)
const assetsCarLine = /^\s*"[^"]*?\/Assets\.car",?\s*\r?\n/gm;
const newContent = content.replace(assetsCarLine, '');
if (newContent !== content) {
  fs.writeFileSync(pbxPath, newContent);
  console.log('[fix-assets-car] Removed Assets.car from [CP] Copy Pods Resources outputPaths');
} else {
  console.log('[fix-assets-car] Assets.car not found in outputPaths (already fixed?)');
}
