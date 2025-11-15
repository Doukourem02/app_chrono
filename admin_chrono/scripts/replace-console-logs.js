#!/usr/bin/env node
/**
 * Script pour remplacer les console.log par logger
 * Usage: node scripts/replace-console-logs.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const filesToProcess = execSync(
  'find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v ".next"',
  { cwd: __dirname + '/..', encoding: 'utf-8' }
).trim().split('\n').filter(Boolean);

let totalReplacements = 0;

filesToProcess.forEach((file) => {
  const filePath = path.join(__dirname, '..', file);
  
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    let fileReplacements = 0;

    // Vérifier si le fichier importe déjà logger
    const hasLoggerImport = content.includes("from '@/utils/logger'") || 
                           content.includes('from "../../utils/logger"') ||
                           content.includes('from "../utils/logger"') ||
                           content.includes('from "./utils/logger"');

    // Remplacer console.log par logger.debug
    const logMatches = content.match(/console\.log\(/g);
    if (logMatches) {
      content = content.replace(/console\.log\(/g, 'logger.debug(');
      fileReplacements += logMatches.length;
      modified = true;
    }

    // Remplacer console.error par logger.error
    const errorMatches = content.match(/console\.error\(/g);
    if (errorMatches) {
      content = content.replace(/console\.error\(/g, 'logger.error(');
      fileReplacements += errorMatches.length;
      modified = true;
    }

    // Remplacer console.warn par logger.warn
    const warnMatches = content.match(/console\.warn\(/g);
    if (warnMatches) {
      content = content.replace(/console\.warn\(/g, 'logger.warn(');
      fileReplacements += warnMatches.length;
      modified = true;
    }

    // Remplacer console.info par logger.info
    const infoMatches = content.match(/console\.info\(/g);
    if (infoMatches) {
      content = content.replace(/console\.info\(/g, 'logger.info(');
      fileReplacements += infoMatches.length;
      modified = true;
    }

    // Remplacer console.debug par logger.debug
    const debugMatches = content.match(/console\.debug\(/g);
    if (debugMatches) {
      content = content.replace(/console\.debug\(/g, 'logger.debug(');
      fileReplacements += debugMatches.length;
      modified = true;
    }

    // Ajouter l'import logger si nécessaire
    if (modified && !hasLoggerImport) {
      // Trouver la position pour insérer l'import
      const importMatch = content.match(/^import .+ from ['"].+['"];?$/m);
      if (importMatch) {
        const lastImportIndex = content.lastIndexOf(importMatch[0]);
        const insertIndex = content.indexOf('\n', lastImportIndex) + 1;
        
        // Déterminer le chemin relatif
        const relativePath = getRelativePath(filePath, path.join(__dirname, '..', 'utils', 'logger.ts'));
        const importStatement = `import { logger } from '${relativePath}'\n`;
        
        content = content.slice(0, insertIndex) + importStatement + content.slice(insertIndex);
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8');
      totalReplacements += fileReplacements;
      console.log(`✓ ${file}: ${fileReplacements} remplacements`);
    }
  } catch (error) {
    console.error(`✗ Erreur lors du traitement de ${file}:`, error.message);
  }
});

function getRelativePath(from, to) {
  const relative = path.relative(path.dirname(from), to);
  return relative.startsWith('.') ? relative : './' + relative;
}

console.log(`\n✅ Total: ${totalReplacements} remplacements effectués`);

