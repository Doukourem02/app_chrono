#!/usr/bin/env node
/* eslint-env node */
/**
 * Échoue le build npm si le patch Krono sur @rnmapbox/maps n’est pas appliqué
 * (sinon EAS retombe sur android-ndk27:10.19.x introuvable).
 */
const fs = require('fs');
const path = require('path');

const gradle = path.join(__dirname, '../node_modules/@rnmapbox/maps/android/build.gradle');
if (!fs.existsSync(gradle)) {
  process.exit(0);
}
const s = fs.readFileSync(gradle, 'utf8');
if (s.includes('if (targetSdk >= 35)')) {
  console.error(
    '[verify-rnmapbox-android-patch] ÉCHEC : @rnmapbox/maps sans patch (if targetSdk >= 35). Lance : npx patch-package'
  );
  process.exit(1);
}
console.log('[verify-rnmapbox-android-patch] OK');
