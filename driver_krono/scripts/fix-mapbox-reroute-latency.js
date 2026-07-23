#!/usr/bin/env node
/* eslint-env node */
/**
 * Réduit la latence du rerouting Mapbox.
 * Par défaut, le SDK attend plusieurs mises à jour avant de déclencher un recalcul.
 * Ce patch rend le rerouting plus réactif.
 */
const fs = require('fs');
const path = require('path');

const podsRoot = path.join(__dirname, '..', 'ios', 'Pods');
const coreConstantsPath = path.join(podsRoot, 'MapboxCoreNavigation/Sources/MapboxCoreNavigation/CoreConstants.swift');

if (!fs.existsSync(coreConstantsPath)) {
  console.log('[fix-mapbox-reroute-latency] CoreConstants.swift not found (run pod install first)');
  process.exit(0);
}

try {
  const mapboxDir = path.join(podsRoot, 'MapboxCoreNavigation');
  require('child_process').execSync(`chmod -R u+w "${mapboxDir}"`, { stdio: 'ignore' });
} catch (_) {}

let content = fs.readFileSync(coreConstantsPath, 'utf8');

// Déjà patché
if (content.includes('Reroute latency réduit pour Chrono')) {
  console.log('[fix-mapbox-reroute-latency] Already patched');
  process.exit(0);
}

// Réduire la distance max avant recalcul : 50m → 30m (déclenchement plus rapide)
content = content.replace(
  /public var RouteControllerMaximumDistanceBeforeRecalculating: CLLocationDistance = 50/,
  'public var RouteControllerMaximumDistanceBeforeRecalculating: CLLocationDistance = 30 // Reroute latency réduit pour Chrono'
);

// Réduire le nombre de mises à jour incorrectes avant reroute : 4 → 2
content = content.replace(
  /public var RouteControllerMinNumberOfInCorrectCourses: Int = 4/,
  'public var RouteControllerMinNumberOfInCorrectCourses: Int = 2 // Reroute latency réduit pour Chrono'
);

// Réduire le multiplicateur de cap incorrect : 4 → 2
content = content.replace(
  /public var RouteControllerIncorrectCourseMultiplier: Int = 4/,
  'public var RouteControllerIncorrectCourseMultiplier: Int = 2 // Reroute latency réduit pour Chrono'
);

fs.writeFileSync(coreConstantsPath, content);
console.log('[fix-mapbox-reroute-latency] Patched CoreConstants - rerouting plus réactif');
