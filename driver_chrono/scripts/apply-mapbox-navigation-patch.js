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
