#!/usr/bin/env node
/* eslint-env node */

/**
 * Délègue au script central qui met à jour l'IP dans tous les .env du projet.
 * Usage: node scripts/update-env-ip.js
 */
const path = require('path');
require(path.resolve(__dirname, '../../scripts/set-local-ip.js'));

