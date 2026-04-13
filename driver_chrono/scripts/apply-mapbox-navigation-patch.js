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
  const gradle = fs.readFileSync(androidGradlePath, 'utf8');
  const nextGradle = gradle.replace(
    /implementation\s+["']com\.mapbox\.navigation:android:[^"']+["']/,
    'implementation "com.mapbox.navigation:android:2.20.4"'
  );
  if (gradle !== nextGradle) {
    fs.writeFileSync(androidGradlePath, nextGradle);
    console.log('[apply-mapbox-navigation-patch] Bumped Fleetbase Android MapboxNavigation to 2.20.4');
  }
}
