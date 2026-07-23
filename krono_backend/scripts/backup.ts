/**
 * Script de sauvegarde automatique pour PostgreSQL et Supabase
 * 
 * Usage:
 *   npm run backup:postgres
 *   npm run backup:supabase
 *   npm run backup:all
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../src/utils/logger.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BACKUP_DIR = path.join(__dirname, '../../backups');
const MAX_BACKUPS = 30; // Garder les 30 derniers backups

interface BackupConfig {
  databaseUrl: string;
  backupName: string;
  description: string;
}

/**
 * Crée le dossier de backup s'il n'existe pas
 */
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info(`📁 Dossier de backup créé: ${BACKUP_DIR}`);
  }
}

/**
 * Nettoie les anciens backups (garde seulement les N derniers)
 */
function cleanupOldBackups(prefix: string): void {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith(prefix) && file.endsWith('.sql'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Plus récent en premier

    // Supprimer les fichiers au-delà de MAX_BACKUPS
    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      toDelete.forEach(file => {
        fs.unlinkSync(file.path);
        logger.info(`🗑️ Ancien backup supprimé: ${file.name}`);
      });
    }
  } catch (error: any) {
    logger.error('❌ Erreur lors du nettoyage des backups:', error.message);
  }
}

/**
 * Sauvegarde PostgreSQL avec pg_dump
 */
export async function backupPostgreSQL(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    logger.warn('⚠️ DATABASE_URL non défini, saut de la sauvegarde PostgreSQL');
    return;
  }

  try {
    ensureBackupDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupFile = path.join(BACKUP_DIR, `postgres-backup-${timestamp}.sql`);
    
    logger.info('🔄 Début de la sauvegarde PostgreSQL...');
    
    // Utiliser pg_dump pour créer la sauvegarde
    const { stdout, stderr } = await execAsync(
      `pg_dump "${databaseUrl}" > "${backupFile}"`
    );
    
    if (stderr && !stderr.includes('NOTICE')) {
      logger.warn(`⚠️ Avertissements pg_dump: ${stderr}`);
    }
    
    const stats = fs.statSync(backupFile);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    logger.info(`✅ Sauvegarde PostgreSQL créée: ${backupFile} (${sizeMB} MB)`);
    
    // Nettoyer les anciens backups
    cleanupOldBackups('postgres-backup-');
    
  } catch (error: any) {
    logger.error('❌ Erreur lors de la sauvegarde PostgreSQL:', error.message);
    throw error;
  }
}

/**
 * Sauvegarde Supabase (export des données via API)
 * Note: Supabase gère ses propres backups, mais on peut exporter les données critiques
 */
export async function backupSupabase(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    logger.warn('⚠️ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non défini, saut de la sauvegarde Supabase');
    return;
  }

  try {
    ensureBackupDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupFile = path.join(BACKUP_DIR, `supabase-backup-${timestamp}.json`);
    
    logger.info('🔄 Début de la sauvegarde Supabase...');
    
    // Import dynamique pour éviter les problèmes de dépendances
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Tables critiques à sauvegarder
    const tables = ['users', 'driver_profiles', 'orders', 'ratings', 'otp_codes'];
    const backupData: { [key: string]: any[] } = {};
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(10000); // Limite pour éviter les problèmes de mémoire
        
        if (error) {
          logger.warn(`⚠️ Erreur lors de l'export de ${table}:`, error.message);
          continue;
        }
        
        backupData[table] = data || [];
        logger.info(`✅ Table ${table} exportée: ${data?.length || 0} lignes`);
      } catch (error: any) {
        logger.warn(`⚠️ Erreur lors de l'export de ${table}:`, error.message);
      }
    }
    
    // Sauvegarder dans un fichier JSON
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    
    const stats = fs.statSync(backupFile);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    logger.info(`✅ Sauvegarde Supabase créée: ${backupFile} (${sizeMB} MB)`);
    
    // Nettoyer les anciens backups
    cleanupOldBackups('supabase-backup-');
    
  } catch (error: any) {
    logger.error('❌ Erreur lors de la sauvegarde Supabase:', error.message);
    throw error;
  }
}

/**
 * Sauvegarde complète (PostgreSQL + Supabase)
 */
export async function backupAll(): Promise<void> {
  logger.info('🚀 Début de la sauvegarde complète...');
  
  try {
    await backupPostgreSQL();
    await backupSupabase();
    logger.info('✅ Sauvegarde complète terminée avec succès');
  } catch (error: any) {
    logger.error('❌ Erreur lors de la sauvegarde complète:', error.message);
    throw error;
  }
}

// Exécution si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'postgres':
      backupPostgreSQL().catch(process.exit);
      break;
    case 'supabase':
      backupSupabase().catch(process.exit);
      break;
    case 'all':
      backupAll().catch(process.exit);
      break;
    default:
      console.log('Usage: npm run backup:postgres | backup:supabase | backup:all');
      process.exit(1);
  }
}

