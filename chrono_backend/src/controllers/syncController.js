import { supabase } from '../config/supabase.js';


export const syncUsersFromAuth = async (req, res) => {
  try {
    console.log('🔄 Début synchronisation des utilisateurs...');

    // 1. Récupérer tous les utilisateurs de la table PostgreSQL
    const { data: existingUsers, error: selectError } = await supabase
      .from('users')
      .select('id, email');
    
    if (selectError) {
      console.error('❌ Erreur lecture utilisateurs existants:', selectError);
      return res.status(500).json({
        success: false,
        message: 'Erreur lecture base de données',
        error: selectError.message
      });
    }

    const existingEmails = existingUsers?.map(u => u.email) || [];
    console.log(`📊 ${existingUsers?.length || 0} utilisateurs existants dans PostgreSQL`);

    // 2. Lister les utilisateurs connus à synchroniser
    const knownUsers = [
      {
        id: '2730de06-8444-4e28-873e-ba7267c4ca54',
        email: 'mdoukoure383@gmail.com',
        phone: '+225 0504343424',
        role: 'driver'
      },
      {
        // ID à récupérer depuis Supabase Auth interface
        id: '4edf6bb6-a9a3-40db-bbc3-43b3d466f8a9', // À corriger
        email: 'mohamedabdoukoure250@gmail.com',
        phone: '+225 0778733971', // À confirmer
        role: 'client'
      }
    ];

    const usersToSync = [];
    
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

    console.log(`📝 ${usersToSync.length} utilisateurs à synchroniser`);

    // 3. Insérer les utilisateurs manquants
    let syncedCount = 0;
    const errors = [];

    for (const user of usersToSync) {
      try {
        const { data, error } = await supabase
          .from('users')
          .insert([user])
          .select()
          .single();

        if (error) {
          console.error(`❌ Erreur sync ${user.email}:`, error);
          errors.push({ email: user.email, error: error.message });
        } else {
          console.log(`✅ Synchronisé: ${user.email}`);
          syncedCount++;
        }
      } catch (err) {
        console.error(`❌ Exception sync ${user.email}:`, err);
        errors.push({ email: user.email, error: err.message });
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

  } catch (error) {
    console.error('❌ Erreur générale synchronisation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la synchronisation',
      error: error.message
    });
  }
};

export const checkSyncStatus = async (req, res) => {
  try {
    // Compter les utilisateurs PostgreSQL
    const { data: pgUsers, error: pgError } = await supabase
      .from('users')
      .select('id, email, role, created_at');

    if (pgError) {
      return res.status(500).json({
        success: false,
        message: 'Erreur lecture PostgreSQL',
        error: pgError.message
      });
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

  } catch (error) {
    console.error('❌ Erreur vérification sync:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification',
      error: error.message
    });
  }
};