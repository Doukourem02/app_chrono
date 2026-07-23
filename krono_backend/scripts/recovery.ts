#!/usr/bin/env tsx
/**
 * Script de Récupération (Recovery) pour Chrono Backend
 * 
 * Fonctionnalités:
 * - Restauration depuis un backup PostgreSQL
 * - Vérification avant restauration
 * - Mode dry-run pour tester
 * - Backup automatique avant restauration
 * 
 * Usage:
 *   npm run recovery:restore <backup_file>
 *   npm run recovery:list
 *   npm run recovery:test <backup_file>
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');

interface RecoveryOptions {
  backupFile: string;
  targetDatabase?: string;
  dryRun?: boolean;
  createBackupBeforeRestore?: boolean;
}

/**
 * Lister tous les backups disponibles
 */
async function listBackups(): Promise<string[]> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files
      .filter(file => 
        file.startsWith('postgres_backup_') || 
        file.startsWith('supabase_backup_')
      )
      .sort()
      .reverse(); // Plus récent en premier

    return backups.map(file => path.join(BACKUP_DIR, file));
  } catch (error: any) {
    console.error(`❌ Erreur lors de la lecture des backups: ${error.message}`);
    return [];
  }
}

/**
 * Demander confirmation à l'utilisateur
 */
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (oui/non): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'oui' || answer.toLowerCase() === 'o');
    });
  });
}

/**
 * Créer un backup avant la restauration
 */
async function createPreRestoreBackup(): Promise<string | null> {
  console.log('📦 Création d\'un backup de sécurité avant la restauration...');
  
  try {
    const { backupPostgres } = await import('./backup-enhanced.js');
    const result = await backupPostgres();
    
    if (result.success && result.filePath) {
      console.log(`✅ Backup de sécurité créé: ${result.filePath}`);
      return result.filePath;
    } else {
      console.error(`❌ Échec de la création du backup de sécurité: ${result.error}`);
      return null;
    }
  } catch (error: any) {
    console.error(`❌ Erreur lors de la création du backup: ${error.message}`);
    return null;
  }
}

/**
 * Décompresser un backup si nécessaire
 */
async function decompressBackup(filePath: string): Promise<string> {
  if (filePath.endsWith('.gz')) {
    const decompressedPath = filePath.replace('.gz', '');
    console.log(`📦 Décompression du backup...`);
    await execAsync(`gunzip -c "${filePath}" > "${decompressedPath}"`);
    return decompressedPath;
  }
  return filePath;
}

/**
 * Vérifier qu'un backup est valide avant restauration
 */
async function validateBackup(filePath: string): Promise<boolean> {
  console.log(`🔍 Vérification du backup: ${filePath}...`);

  try {
    const stats = await fs.stat(filePath);
    
    if (stats.size === 0) {
      console.error('❌ Le fichier de backup est vide');
      return false;
    }

    // Vérifier le format
    if (filePath.endsWith('.gz')) {
      try {
        await execAsync(`gunzip -t "${filePath}"`);
        console.log('✅ Backup compressé valide');
      } catch {
        console.error('❌ Backup compressé corrompu');
        return false;
      }
    }

    // Pour les fichiers .sql, vérifier le contenu
    if (filePath.endsWith('.sql') || filePath.endsWith('.sql.gz')) {
      // Décompresser temporairement pour vérifier
      const tempPath = await decompressBackup(filePath);
      try {
        const content = await fs.readFile(tempPath, { encoding: 'utf-8' });
        if (!content.includes('PostgreSQL database dump') && !content.includes('CREATE TABLE')) {
          console.error('❌ Le backup ne semble pas être un dump PostgreSQL valide');
          // Nettoyer le fichier temporaire
          if (tempPath !== filePath) {
            await fs.unlink(tempPath).catch(() => {});
          }
          return false;
        }
        console.log('✅ Format du backup valide');
        
        // Nettoyer le fichier temporaire si créé
        if (tempPath !== filePath) {
          await fs.unlink(tempPath).catch(() => {});
        }
      } catch (error: any) {
        console.error(`❌ Erreur lors de la lecture du backup: ${error.message}`);
        if (tempPath !== filePath) {
          await fs.unlink(tempPath).catch(() => {});
        }
        return false;
      }
    }

    return true;
  } catch (error: any) {
    console.error(`❌ Erreur lors de la validation: ${error.message}`);
    return false;
  }
}

/**
 * Restaurer un backup PostgreSQL
 */
async function restoreBackup(options: RecoveryOptions): Promise<boolean> {
  const { backupFile, targetDatabase, dryRun = false, createBackupBeforeRestore = true } = options;

  console.log('\n🚀 Démarrage de la restauration...');
  console.log(`📁 Backup: ${backupFile}`);
  console.log(`🎯 Base de données cible: ${targetDatabase || 'défaut'}`);
  console.log(`🧪 Mode dry-run: ${dryRun ? 'Oui' : 'Non'}\n`);

  // Vérifier que le fichier existe
  try {
    await fs.access(backupFile);
  } catch {
    console.error(`❌ Le fichier de backup n'existe pas: ${backupFile}`);
    return false;
  }

  // Valider le backup
  const isValid = await validateBackup(backupFile);
  if (!isValid) {
    console.error('❌ Le backup n\'est pas valide. Restauration annulée.');
    return false;
  }

  // Créer un backup de sécurité avant restauration
  if (createBackupBeforeRestore && !dryRun) {
    const safetyBackup = await createPreRestoreBackup();
    if (!safetyBackup) {
      const confirmed = await askConfirmation(
        '⚠️  Le backup de sécurité a échoué. Voulez-vous continuer quand même?'
      );
      if (!confirmed) {
        console.log('❌ Restauration annulée par l\'utilisateur');
        return false;
      }
    }
  }

  if (dryRun) {
    console.log('🧪 Mode dry-run: Aucune modification ne sera effectuée');
    console.log('✅ Le backup est valide et peut être restauré');
    return true;
  }

  // Demander confirmation
  console.log('\n⚠️  ATTENTION: Cette opération va écraser la base de données actuelle!');
  const confirmed = await askConfirmation('Êtes-vous sûr de vouloir continuer?');
  if (!confirmed) {
    console.log('❌ Restauration annulée par l\'utilisateur');
    return false;
  }

  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL non configuré');
    }

    // Extraire les informations de connexion
    const url = new URL(databaseUrl);
    const host = url.hostname;
    const port = url.port || '5432';
    const database = targetDatabase || url.pathname.slice(1);
    const user = url.username;
    const password = url.password;

    process.env.PGPASSWORD = password;

    // Décompresser si nécessaire
    let fileToRestore = backupFile;
    let tempFile: string | null = null;
    
    if (backupFile.endsWith('.gz')) {
      tempFile = backupFile.replace('.gz', '');
      console.log('📦 Décompression du backup...');
      await execAsync(`gunzip -c "${backupFile}" > "${tempFile}"`);
      fileToRestore = tempFile;
    }

    // Restaurer le backup
    console.log('🔄 Restauration en cours...');
    
    // Pour les fichiers .sql (format plain)
    if (fileToRestore.endsWith('.sql')) {
      const restoreCommand = `psql -h ${host} -p ${port} -U ${user} -d ${database} -f "${fileToRestore}"`;
      await execAsync(restoreCommand);
    } 
    // Pour les fichiers .dump ou .backup (format custom)
    else {
      const restoreCommand = `pg_restore -h ${host} -p ${port} -U ${user} -d ${database} --clean --if-exists "${fileToRestore}"`;
      await execAsync(restoreCommand);
    }

    // Nettoyer le fichier temporaire
    if (tempFile && tempFile !== backupFile) {
      await fs.unlink(tempFile).catch(() => {});
    }

    console.log('✅ Restauration terminée avec succès!');
    return true;
  } catch (error: any) {
    console.error(`❌ Erreur lors de la restauration: ${error.message}`);
    return false;
  } finally {
    delete process.env.PGPASSWORD;
  }
}

/**
 * Fonction principale
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'list':
        console.log('📋 Liste des backups disponibles:\n');
        const backups = await listBackups();
        if (backups.length === 0) {
          console.log('Aucun backup trouvé.');
        } else {
          backups.forEach((backup, index) => {
            const fileName = path.basename(backup);
            console.log(`${index + 1}. ${fileName}`);
          });
        }
        break;

      case 'test':
        const testFile = args[1];
        if (!testFile) {
          console.error('❌ Usage: npm run recovery:test <backup_file>');
          process.exit(1);
        }
        const fullTestPath = path.isAbsolute(testFile) ? testFile : path.join(BACKUP_DIR, testFile);
        const isValid = await validateBackup(fullTestPath);
        process.exit(isValid ? 0 : 1);
        break;

      case 'restore':
        const restoreFile = args[1];
        if (!restoreFile) {
          console.error('❌ Usage: npm run recovery:restore <backup_file>');
          process.exit(1);
        }
        const fullRestorePath = path.isAbsolute(restoreFile) ? restoreFile : path.join(BACKUP_DIR, restoreFile);
        const targetDb = args[2];
        const dryRun = args.includes('--dry-run');
        
        const success = await restoreBackup({
          backupFile: fullRestorePath,
          targetDatabase: targetDb,
          dryRun,
        });
        process.exit(success ? 0 : 1);
        break;

      default:
        console.log('Usage:');
        console.log('  npm run recovery:list                    - Lister les backups disponibles');
        console.log('  npm run recovery:test <backup_file>      - Tester un backup');
        console.log('  npm run recovery:restore <backup_file>   - Restaurer un backup');
        console.log('  npm run recovery:restore <backup_file> --dry-run  - Tester la restauration sans l\'exécuter');
        process.exit(1);
    }
  } catch (error: any) {
    console.error(`❌ Erreur: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { restoreBackup, listBackups, validateBackup };

