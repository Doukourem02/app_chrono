#!/usr/bin/env node
/* eslint-env node */
/**
 * Corrige "Multiple commands produce Assets.car" en excluant les xcassets
 * de l'app (ChronoPro/Images.xcassets) du script Pods resources.
 * L'app les compile déjà via "Compile Asset Catalogs".
 */
const fs = require('fs');
const path = require('path');

const iosDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'ios');
const resourcesScript = path.join(iosDir, 'Pods', 'Target Support Files', 'Pods-ChronoPro', 'Pods-ChronoPro-resources.sh');

if (!fs.existsSync(resourcesScript)) {
  console.log('[fix-pods-assets-car] Script resources non trouvé (exécuter pod install d\'abord)');
  process.exit(0);
}

let content = fs.readFileSync(resourcesScript, 'utf8');

// S'assure que ChronoPro/Images.xcassets est INCLUS (contient AppIcon).
// Si une exclusion a été appliquée précédemment, on la retire.
const marker = 'FIX_ASSETS_CAR_CHRONO';
const exclusionBlock = `      if [[ $line != *"/ChronoPro/Images.xcassets"* ]]; then
        XCASSET_FILES+=("$line")
      fi
  # ${marker}`;
const originalBlock = '      XCASSET_FILES+=("$line")';

if (content.includes(marker) && content.includes('/ChronoPro/Images.xcassets')) {
  const newContent = content.replace(exclusionBlock, originalBlock);
  if (newContent !== content) {
    fs.writeFileSync(resourcesScript, newContent);
    console.log('[fix-pods-assets-car] Exclusion retirée : ChronoPro/Images.xcassets inclus (AppIcon)');
  } else {
    console.log('[fix-pods-assets-car] Pattern non trouvé, tentative alternative');
    // Fallback: replace the multi-line block
    const altOld = /      if \[\[ \$line != \*"\/ChronoPro\/Images\.xcassets"\* \]\]; then\n        XCASSET_FILES\+=\("\$line"\)\n      fi\n  # FIX_ASSETS_CAR_CHRONO/g;
    if (altOld.test(content)) {
      content = content.replace(altOld, originalBlock);
      fs.writeFileSync(resourcesScript, content);
      console.log('[fix-pods-assets-car] Exclusion retirée (regex)');
    }
  }
} else if (!content.includes(marker)) {
  console.log('[fix-pods-assets-car] Pas d\'exclusion à retirer');
} else {
  console.log('[fix-pods-assets-car] Déjà correct');
}
