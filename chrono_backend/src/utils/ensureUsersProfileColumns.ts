import type { Pool } from 'pg';
import logger from './logger.js';

/**
 * Garantit sur public.users les colonnes attendues par GET/PUT profil et avatar
 * (équivalent idempotent de migrations/024_users_name_avatar_columns.sql).
 * Une seule exécution réussie par processus ; si ALTER est interdit (rôle DB), retourne false.
 */
let ensurePromise: Promise<boolean> | null = null;

export function ensureUsersProfileColumns(pool: Pool): Promise<boolean> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      try {
        await pool.query(`
          ALTER TABLE public.users
            ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
            ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
            ADD COLUMN IF NOT EXISTS avatar_url TEXT;
        `);
        logger.info(
          '[schema] Colonnes public.users (first_name, last_name, avatar_url) présentes ou ajoutées.'
        );
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(
          '[schema] Impossible d’ajouter les colonnes profil sur public.users (droits DDL ?). Exécuter migrations/024_users_name_avatar_columns.sql à la main.',
          msg
        );
        return false;
      }
    })();
  }
  return ensurePromise;
}
