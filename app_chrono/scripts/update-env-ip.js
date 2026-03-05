#!/usr/bin/env node
/* eslint-env node */

/**
 * Délègue au script central qui met à jour l'IP dans tous les .env du projet.
 * Usage: node scripts/update-env-ip.js (depuis app_chrono)
 */
const path = require('path');
const projectRoot = path.resolve(process.cwd(), '..');
require(path.join(projectRoot, 'scripts', 'set-local-ip.js'));

