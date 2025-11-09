import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

interface KnownUser {
  id: string;
  email: string;
  phone?: string;
  role: 'client' | 'driver' | 'partner' | 'admin';
}

interface SyncUser {
  id: string;
  email: string;
  phone?: string;
  role: string;
  created_at: string;
}

export const syncUsersFromAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('🔄 Début synchronisation des utilisateurs...');

    // 1. Récupérer tous les utilisateurs de la table PostgreSQL
    const { data: existingUsers, error: selectError } = await supabase
      .from('users')
      .select('id, email');
    
    if (selectError) {
      logger.error('❌ Erreur lecture utilisateurs existants:', selectError);
      res.status(500).json({
        success: false,
        message: 'Erreur lecture base de données',
        error: selectError.message
      });
      return;
    }

    const existingEmails = existingUsers?.map(u => u.email) || [];
    logger.info(`📊 ${existingUsers?.length || 0} utilisateurs existants dans PostgreSQL`);

    // 2. Lister les utilisateurs connus à synchroniser
    const knownUsers: KnownUser[] = [
      {
        id: '2730de06-8444-4e28-873e-ba7267c4ca54',
        email: 'mdoukoure383@gmail.com',
        phone: '+225 0504343424',
        role: 'driver'
      },
      {
        id: '4edf6bb6-a9a3-40db-bbc3-43b3d466f8a9',
        email: 'mohamedabdoukoure250@gmail.com',
        phone: '+225 0778733971',
        role: 'client'
      }
    ];

    const usersToSync: SyncUser[] = [];
    
    for (const user of knownUsers) {
      if (!existingEmails.includes(user.email)) {
        usersToSync.push({
          id: user.id,
          email: user.email,
          phone: user.phone,
          role: user.role,
          created_at: new Date().toISOString()
        });
      }
    }

    logger.info(`📝 ${usersToSync.length} utilisateurs à synchroniser`);

    // 3. Insérer les utilisateurs manquants
    let syncedCount = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const user of usersToSync) {
      try {
        const { data, error } = await supabase
          .from('users')
          .insert([user])
          .select()
          .single();

        if (error) {
          logger.error(`❌ Erreur sync ${user.email}:`, error);
          errors.push({ email: user.email, error: error.message });
        } else {
          logger.info(`✅ Synchronisé: ${user.email}`);
          syncedCount++;
        }
      } catch (err: any) {
        logger.error(`❌ Exception sync ${user.email}:`, err);
        errors.push({ email: user.email, error: err.message || String(err) });
      }
    }

    // 4. Retourner le résultat
    res.json({
      success: true,
      message: `Synchronisation terminée: ${syncedCount} utilisateurs ajoutés`,
      data: {
        existingCount: existingUsers?.length || 0,
        syncedCount,
        totalCount: (existingUsers?.length || 0) + syncedCount,
        errors
      }
    });

  } catch (error: any) {
    logger.error('❌ Erreur générale synchronisation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la synchronisation',
      error: error.message || String(error)
    });
  }
};

export const checkSyncStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    // Compter les utilisateurs PostgreSQL
    const { data: pgUsers, error: pgError } = await supabase
      .from('users')
      .select('id, email, role, created_at');

    if (pgError) {
      res.status(500).json({
        success: false,
        message: 'Erreur lecture PostgreSQL',
        error: pgError.message
      });
      return;
    }

    res.json({
      success: true,
      data: {
        postgresql: {
          count: pgUsers?.length || 0,
          users: pgUsers || []
        },
        message: 'État de synchronisation récupéré'
      }
    });

  } catch (error: any) {
    logger.error('❌ Erreur vérification sync:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification',
      error: error.message || String(error)
    });
  }
};

