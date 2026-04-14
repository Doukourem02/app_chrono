#!/usr/bin/env node
/* eslint-env node */
/* global __dirname */
/**
 * Applique le patch MapboxNavigationView pour activer la navigation turn-by-turn complète.
 * Le package Fleetbase n'affiche que la carte sans calculer la route ni présenter NavigationViewController.
 */
const fs = require('fs');
const path = require('path');

const patchPath = path.join(__dirname, 'patches', 'MapboxNavigationView.swift');
const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@fleetbase',
  'react-native-mapbox-navigation',
  'ios',
  'MapboxNavigationView.swift'
);

if (!fs.existsSync(patchPath)) {
  console.log('[apply-mapbox-navigation-patch] Patch file not found, skipping');
  process.exit(0);
}

if (!fs.existsSync(path.dirname(targetPath))) {
  console.log('[apply-mapbox-navigation-patch] Package not installed, skipping');
  process.exit(0);
}

fs.copyFileSync(patchPath, targetPath);
console.log('[apply-mapbox-navigation-patch] Applied MapboxNavigationView turn-by-turn patch');

// Fleetbase pinne MapboxNavigation ~> 2.12.0 → MapboxMaps ~> 10.12.x uniquement, en conflit avec @rnmapbox/maps.
// MapboxNavigation 2.20.x dépend de MapboxMaps ~> 10.19 (toujours < 11), compatible avec rnmapbox en 10.19.x.
const podspecPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@fleetbase',
  'react-native-mapbox-navigation',
  'react-native-mapbox-navigation.podspec'
);
if (fs.existsSync(podspecPath)) {
  let pod = fs.readFileSync(podspecPath, 'utf8');
  const next = pod.replace(
    /s\.dependency 'MapboxNavigation', '~> 2\.12\.0'/,
    "s.dependency 'MapboxNavigation', '~> 2.20'"
  );
  if (pod !== next) {
    fs.writeFileSync(podspecPath, next);
    console.log('[apply-mapbox-navigation-patch] Bumped Fleetbase MapboxNavigation pod to ~> 2.20 (Maps ~> 10.19)');
  }
}

const androidGradlePath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@fleetbase',
  'react-native-mapbox-navigation',
  'android',
  'build.gradle'
);
if (fs.existsSync(androidGradlePath)) {
  const original = fs.readFileSync(androidGradlePath, 'utf8');
  let gradle = original;
  const navNext = gradle.replace(
    /implementation\s+["']com\.mapbox\.navigation:android:[^"']+["']/,
    'implementation "com.mapbox.navigation:android:2.20.4"'
  );
  if (navNext !== gradle) {
    gradle = navNext;
    console.log('[apply-mapbox-navigation-patch] Bumped Fleetbase Android MapboxNavigation to 2.20.4');
  }
  // RN / Expo 0.81 + AGP : JavaCompile en 17, kotlinOptions encore 1.8 → échec Gradle « Inconsistent JVM Target ».
  const beforeJvm = gradle;
  gradle = gradle.replace(
    /sourceCompatibility\s+JavaVersion\.VERSION_1_8/,
    'sourceCompatibility JavaVersion.VERSION_17'
  );
  gradle = gradle.replace(
    /targetCompatibility\s+JavaVersion\.VERSION_1_8/,
    'targetCompatibility JavaVersion.VERSION_17'
  );
  gradle = gradle.replace(/jvmTarget\s*=\s*["']1\.8["']/, 'jvmTarget = "17"');
  if (gradle !== beforeJvm) {
    console.log('[apply-mapbox-navigation-patch] Fleetbase android: Java/Kotlin JVM target → 17 (aligné AGP/RN)');
  }
  if (gradle !== original) {
    fs.writeFileSync(androidGradlePath, gradle);
  }
}

// MapboxNavigationView.kt référence R.drawable.mapbox_navigation_puck_icon (SDK ancien) ;
// avec Navigation 2.20 l’asset n’est plus dans le R du module → drawable local requis.
const puckPatchPath = path.join(__dirname, 'patches', 'mapbox_navigation_puck_icon.xml');
const fleetbaseAndroidRoot = path.join(
  __dirname,
  '..',
  'node_modules',
  '@fleetbase',
  'react-native-mapbox-navigation',
  'android'
);
const puckDrawableDir = path.join(fleetbaseAndroidRoot, 'src', 'main', 'res', 'drawable');
const puckDestPath = path.join(puckDrawableDir, 'mapbox_navigation_puck_icon.xml');
if (fs.existsSync(puckPatchPath) && fs.existsSync(fleetbaseAndroidRoot)) {
  fs.mkdirSync(puckDrawableDir, { recursive: true });
  fs.copyFileSync(puckPatchPath, puckDestPath);
  console.log('[apply-mapbox-navigation-patch] Fleetbase android: added mapbox_navigation_puck_icon drawable');
}
