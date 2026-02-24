#!/usr/bin/env node
/* eslint-env node */
/* global __dirname */
/**
 * Force le français pour Mapbox Navigation - supprime Yoruba (yo) et Vietnamien (vi)
 * pour éviter "Tun pada", "Atunjade", "Đang tính tuyến mới..." dans l'app ivoirienne.
 */
const fs = require('fs');
const path = require('path');

const podsRoot = path.join(__dirname, '..', 'ios', 'Pods');
const resourcesScript = path.join(podsRoot, 'Target Support Files/Pods-ChronoPro/Pods-ChronoPro-resources.sh');

if (!fs.existsSync(podsRoot)) {
  console.log('[fix-mapbox-french] Pods non trouvé (exécuter pod install d\'abord)');
  process.exit(0);
}

// 1. Supprimer yo.lproj (Yoruba) et vi.lproj (Vietnamien) des dossiers Mapbox
const localesToRemove = ['yo', 'vi'];
const mapboxDirs = [
  path.join(podsRoot, 'MapboxNavigation/Sources/MapboxNavigation/Resources'),
  path.join(podsRoot, 'MapboxCoreNavigation/Sources/MapboxCoreNavigation/Resources'),
  path.join(podsRoot, 'MapboxMaps/Sources/MapboxMaps/Ornaments/Compass'),
];

let removed = 0;
for (const dir of mapboxDirs) {
  if (!fs.existsSync(dir)) continue;
  for (const locale of localesToRemove) {
    const lprojPath = path.join(dir, `${locale}.lproj`);
    if (fs.existsSync(lprojPath)) {
      try {
        fs.chmodSync(lprojPath, 0o755);
        fs.rmSync(lprojPath, { recursive: true });
        removed++;
        const lang = locale === 'yo' ? 'Yoruba' : 'Vietnamien';
        console.log(`[fix-mapbox-french] Supprimé ${locale}.lproj (${lang}):`, lprojPath);
      } catch (err) {
        console.warn('[fix-mapbox-french] Impossible de supprimer', lprojPath, err.message);
      }
    }
  }
}

// 2. Retirer les lignes yo.lproj et vi.lproj du script resources (évite erreur "file not found")
if (fs.existsSync(resourcesScript)) {
  let content = fs.readFileSync(resourcesScript, 'utf8');
  const before = content;
  content = content.replace(/^\s*install_resource "\$\{PODS_ROOT\}\/[^"]*\/yo\.lproj[^"]*"\s*\n/gm, '');
  content = content.replace(/^\s*install_resource "\$\{PODS_ROOT\}\/[^"]*\/vi\.lproj[^"]*"\s*\n/gm, '');
  if (content !== before) {
    fs.writeFileSync(resourcesScript, content);
    console.log('[fix-mapbox-french] Lignes yo.lproj et vi.lproj retirées du script resources');
  }
}

if (removed > 0) {
  console.log('[fix-mapbox-french] Yoruba et Vietnamien supprimés -> Mapbox utilisera fr_FR');
} else {
  console.log('[fix-mapbox-french] yo.lproj et vi.lproj déjà absents ou patch appliqué');
}
