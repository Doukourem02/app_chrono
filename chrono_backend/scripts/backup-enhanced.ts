#!/usr/bin/env tsx
/**
 * Script de Backup Amélioré pour Chrono Backend
 * 
 * Fonctionnalités:
 * - Backup PostgreSQL (pg_dump)
 * - Backup Supabase (via API)
 * - Compression automatique
 * - Rotation des backups (garder N derniers)
 * - Vérification d'intégrité
 * - Logging détaillé
 * 
 * Usage:
 *   npm run backup:postgres
 *   npm run backup:supabase
 *   npm run backup:all
 *   npm run backup:test
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '30'); // Garder 30 jours de backups
const COMPRESS = process.env.COMPRESS_BACKUPS !== 'false'; // Compression par défaut

interface BackupResult {
  success: boolean;
  type: 'postgres' | 'supabase' | 'all';
  filePath?: string;
  size?: number;
  error?: string;
  timestamp: string;
}

/**
 * Créer le répertoire de backup s'il n'existe pas
 */
async function ensureBackupDir(): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Formater la date pour les noms de fichiers
 */
function formatDate(date: Date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
         date.toTimeString().split(' ')[0].replace(/:/g, '-');
}

/**
 * Obtenir la taille d'un fichier en MB
 */
async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return Math.round((stats.size / (1024 * 1024)) * 100) / 100; // MB
  } catch {
    return 0;
  }
}

/**
 * Compresser un fichier avec gzip
 */
async function compressFile(filePath: string): Promise<string> {
  if (!COMPRESS) return filePath;
  
  const compressedPath = `${filePath}.gz`;
  try {
    await execAsync(`gzip -f "${filePath}"`);
    return compressedPath;
  } catch (error: any) {
    console.error(`Erreur lors de la compression: ${error.message}`);
    return filePath;
  }
}

/**
 * Backup PostgreSQL
 */
async function backupPostgres(): Promise<BackupResult> {
  const timestamp = formatDate();
  const fileName = `postgres_backup_${timestamp}.sql`;
  const filePath = path.join(BACKUP_DIR, fileName);

  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL non configuré');
    }

    console.log('🔄 Démarrage du backup PostgreSQL...');
    
    // Extraire les informations de connexion depuis DATABASE_URL
    // Format: postgresql://user:password@host:port/database
    const url = new URL(databaseUrl);
    const host = url.hostname;
    const port = url.port || '5432';
    const database = url.pathname.slice(1); // Enlever le premier /
    const user = url.username;
    const password = url.password;

    // Exporter le mot de passe pour pg_dump
    process.env.PGPASSWORD = password;

    // Commande pg_dump
    const dumpCommand = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F c -f "${filePath}"`;

    await execAsync(dumpCommand);

    // Vérifier que le fichier existe et n'est pas vide
    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      throw new Error('Le fichier de backup est vide');
    }

    console.log(`✅ Backup PostgreSQL créé: ${filePath} (${stats.size} bytes)`);

    // Compresser si activé
    let finalPath = filePath;
    if (COMPRESS) {
      finalPath = await compressFile(filePath);
      const compressedSize = await getFileSize(finalPath);
      console.log(`📦 Backup compressé: ${compressedSize} MB`);
    }

    const size = await getFileSize(finalPath);

    return {
      success: true,
      type: 'postgres',
      filePath: finalPath,
      size,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`❌ Erreur lors du backup PostgreSQL: ${error.message}`);
    return {
      success: false,
      type: 'postgres',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  } finally {
    // Nettoyer le mot de passe de l'environnement
    delete process.env.PGPASSWORD;
  }
}

/**
 * Backup Supabase (via pg_dump de la connection string Supabase)
 */
async function backupSupabase(): Promise<BackupResult> {
  const timestamp = formatDate();
  const fileName = `supabase_backup_${timestamp}.sql`;
  const filePath = path.join(BACKUP_DIR, fileName);

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseDbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

    if (!supabaseDbUrl) {
      throw new Error('SUPABASE_DB_URL ou DATABASE_URL non configuré');
    }

    console.log('🔄 Démarrage du backup Supabase...');

    // Utiliser la même méthode que PostgreSQL
    const url = new URL(supabaseDbUrl);
    const host = url.hostname;
    const port = url.port || '5432';
    const database = url.pathname.slice(1);
    const user = url.username;
    const password = url.password;

    process.env.PGPASSWORD = password;

    const dumpCommand = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F c -f "${filePath}"`;

    await execAsync(dumpCommand);

    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      throw new Error('Le fichier de backup est vide');
    }

    console.log(`✅ Backup Supabase créé: ${filePath} (${stats.size} bytes)`);

    let finalPath = filePath;
    if (COMPRESS) {
      finalPath = await compressFile(filePath);
      const compressedSize = await getFileSize(finalPath);
      console.log(`📦 Backup compressé: ${compressedSize} MB`);
    }

    const size = await getFileSize(finalPath);

    return {
      success: true,
      type: 'supabase',
      filePath: finalPath,
      size,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`❌ Erreur lors du backup Supabase: ${error.message}`);
    return {
      success: false,
      type: 'supabase',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  } finally {
    delete process.env.PGPASSWORD;
  }
}

/**
 * Nettoyer les anciens backups (garder seulement les N derniers)
 */
async function cleanupOldBackups(type: 'postgres' | 'supabase' | 'all'): Promise<void> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    
    // Filtrer les fichiers de backup
    const backupFiles = files
      .filter(file => {
        if (type === 'postgres') return file.startsWith('postgres_backup_');
        if (type === 'supabase') return file.startsWith('supabase_backup_');
        return file.startsWith('postgres_backup_') || file.startsWith('supabase_backup_');
      })
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
      }));

    // Trier par date (plus récent en premier)
    const filesWithStats = await Promise.all(
      backupFiles.map(async (file) => {
        const stats = await fs.stat(file.path);
        return {
          ...file,
          mtime: stats.mtime,
        };
      })
    );

    filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Supprimer les fichiers au-delà de MAX_BACKUPS
    const filesToDelete = filesWithStats.slice(MAX_BACKUPS);
    
    if (filesToDelete.length > 0) {
      console.log(`🧹 Suppression de ${filesToDelete.length} ancien(s) backup(s)...`);
      for (const file of filesToDelete) {
        await fs.unlink(file.path);
        console.log(`  ✓ Supprimé: ${file.name}`);
      }
    }
  } catch (error: any) {
    console.error(`⚠️ Erreur lors du nettoyage: ${error.message}`);
  }
}

/**
 * Vérifier l'intégrité d'un backup
 */
async function verifyBackup(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    
    // Vérifier que le fichier existe et n'est pas vide
    if (stats.size === 0) {
      console.error(`❌ Le backup est vide: ${filePath}`);
      return false;
    }

    // Si c'est un fichier compressé, vérifier qu'il peut être décompressé
    if (filePath.endsWith('.gz')) {
      try {
        await execAsync(`gunzip -t "${filePath}"`);
        console.log(`✅ Backup compressé valide: ${filePath}`);
      } catch {
        console.error(`❌ Backup compressé corrompu: ${filePath}`);
        return false;
      }
    }

    // Pour les fichiers .sql, vérifier qu'ils contiennent du SQL valide
    if (filePath.endsWith('.sql')) {
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content.includes('PostgreSQL database dump') && !content.includes('CREATE TABLE')) {
        console.error(`❌ Le backup ne semble pas être un dump PostgreSQL valide`);
        return false;
      }
    }

    return true;
  } catch (error: any) {
    console.error(`❌ Erreur lors de la vérification: ${error.message}`);
    return false;
  }
}

/**
 * Sauvegarder les métadonnées du backup
 */
async function saveBackupMetadata(result: BackupResult): Promise<void> {
  const metadataFile = path.join(BACKUP_DIR, 'backup_metadata.json');
  
  try {
    let metadata: BackupResult[] = [];
    
    // Lire les métadonnées existantes
    try {
      const content = await fs.readFile(metadataFile, 'utf-8');
      metadata = JSON.parse(content);
    } catch {
      // Fichier n'existe pas encore, créer un nouveau
    }

    // Ajouter le nouveau backup
    metadata.push(result);

    // Garder seulement les N derniers
    metadata = metadata.slice(-MAX_BACKUPS);

    // Sauvegarder
    await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
  } catch (error: any) {
    console.error(`⚠️ Erreur lors de la sauvegarde des métadonnées: ${error.message}`);
  }
}

/**
 * Fonction principale
 */
async function main() {
  const args = process.argv.slice(2);
  const type = args[0] || 'all';

  console.log('🚀 Démarrage du processus de backup...');
  console.log(`📁 Répertoire de backup: ${BACKUP_DIR}`);
  console.log(`📦 Compression: ${COMPRESS ? 'Activée' : 'Désactivée'}`);
  console.log(`🗑️  Rétention: ${MAX_BACKUPS} backups maximum\n`);

  await ensureBackupDir();

  const results: BackupResult[] = [];

  try {
    if (type === 'postgres' || type === 'all') {
      const result = await backupPostgres();
      results.push(result);
      
      if (result.success && result.filePath) {
        const isValid = await verifyBackup(result.filePath);
        if (isValid) {
          await saveBackupMetadata(result);
          await cleanupOldBackups('postgres');
        } else {
          console.error('❌ Le backup PostgreSQL a échoué la vérification d\'intégrité');
        }
      }
    }

    if (type === 'supabase' || type === 'all') {
      const result = await backupSupabase();
      results.push(result);
      
      if (result.success && result.filePath) {
        const isValid = await verifyBackup(result.filePath);
        if (isValid) {
          await saveBackupMetadata(result);
          await cleanupOldBackups('supabase');
        } else {
          console.error('❌ Le backup Supabase a échoué la vérification d\'intégrité');
        }
      }
    }

    // Résumé
    console.log('\n📊 Résumé des backups:');
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length > 0) {
      console.log(`✅ ${successful.length} backup(s) réussi(s):`);
      successful.forEach(r => {
        console.log(`   - ${r.type}: ${r.filePath} (${r.size} MB)`);
      });
    }

    if (failed.length > 0) {
      console.log(`❌ ${failed.length} backup(s) échoué(s):`);
      failed.forEach(r => {
        console.log(`   - ${r.type}: ${r.error}`);
      });
      process.exit(1);
    }

    console.log('\n✅ Tous les backups ont été créés avec succès!');
  } catch (error: any) {
    console.error(`\n❌ Erreur fatale: ${error.message}`);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { backupPostgres, backupSupabase, verifyBackup, cleanupOldBackups };

