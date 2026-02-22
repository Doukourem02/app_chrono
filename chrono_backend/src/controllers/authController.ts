import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import pool from '../config/db.js';
import { sendOTPEmail, sendOTPSMS } from '../services/emailService.js';
import { storeOTP, verifyOTP } from '../config/otpStorage.js';
import { generateTokens, refreshAccessToken } from '../utils/jwt.js';
import logger from '../utils/logger.js';
import { maskEmail, maskUserId } from '../utils/maskSensitiveData.js';
import { createDefaultPaymentMethods } from '../utils/createDefaultPaymentMethods.js';

interface RequestWithBruteForce<B = any> extends Request<{}, {}, B> {
  recordFailedAttempt?: () => void;
  resetAttempts?: () => void;
}

interface RegisterBody {
  email: string;
  password?: string;
  phone?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface SendOTPBody {
  email: string;
  phone?: string;
  otpMethod?: string;
  role?: string;
}

interface VerifyOTPBody {
  email: string;
  phone?: string;
  otp: string;
  method?: string;
  role?: string;
}

interface RefreshTokenBody {
  refreshToken: string;
}

/**
 * Supprime toutes les traces d'un utilisateur (users + driver_profiles)
 * Utilisé quand un utilisateur est supprimé de Supabase Auth mais existe encore dans PostgreSQL
 */
const cleanupOrphanedUser = async (userId: string, email: string): Promise<void> => {
  try {
    logger.info(`Nettoyage des données orphelines pour ${maskEmail(email)} (${maskUserId(userId)})`);
    
    const clientForDelete = supabaseAdmin || supabase;
    
    // Supprimer le profil driver s'il existe
    try {
      const { error: driverProfileError } = await clientForDelete
        .from('driver_profiles')
        .delete()
        .eq('user_id', userId);
      
      if (driverProfileError) {
        logger.warn('Erreur suppression profil driver (peut ne pas exister):', driverProfileError);
      } else {
        logger.info('Profil driver supprimé avec succès');
      }
    } catch (error) {
      logger.warn('Erreur lors de la suppression du profil driver:', error);
    }

    // Supprimer l'utilisateur de la table users
    try {
      const { error: userDeleteError } = await clientForDelete
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (userDeleteError) {
        logger.error('Erreur suppression utilisateur:', userDeleteError);
      } else {
        logger.info('Utilisateur supprimé de PostgreSQL avec succès');
      }
    } catch (error) {
      logger.error('Erreur lors de la suppression de l\'utilisateur:', error);
    }

    logger.info(`Nettoyage terminé pour ${maskEmail(email)}`);
  } catch (error: any) {
    logger.error('Erreur lors du nettoyage des données orphelines:', error);
    // Ne pas throw, on continue même si le nettoyage échoue partiellement
  }
};

const createDriverProfile = async (
  userId: string,
  email: string,
  phone: string | null | undefined,
  firstName: string | null | undefined,
  lastName: string | null | undefined
): Promise<any> => {
  try {
    const clientForInsert = supabaseAdmin || supabase;

    const { data: existingProfile, error: checkError } = await clientForInsert
      .from('driver_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingProfile) {
      logger.info(`Profil driver déjà existant pour user ${maskUserId(userId)}`);
      return existingProfile;
    }

    const { data: driverProfile, error: insertError } = await clientForInsert
      .from('driver_profiles')
      .insert([
        {
          user_id: userId,
          email: email,
          phone: phone || null,
          first_name: firstName || null,
          last_name: lastName || null,
          vehicle_type: 'moto',
          driver_type: 'partner', // Par défaut, tous les livreurs s'inscrivant sont des partenaires
          is_online: false,
          is_available: true,
          rating: 5.0,
          total_deliveries: 0,
        },
      ])
      .select()
      .single();

    if (insertError) {
      logger.error(`Erreur création profil driver pour ${maskUserId(userId)}:`, insertError);
      return null;
    }

    logger.info(`Profil driver créé avec succès pour user ${maskUserId(userId)}`);
    return driverProfile;
  } catch (error: any) {
    logger.error(`Erreur création profil driver pour ${maskUserId(userId)}:`, error);
    return null;
  }
};

const registerUserWithPostgreSQL = async (
  req: Request<{}, {}, RegisterBody>,
  res: Response
): Promise<void> => {
  try {
    const { email, password, phone, role = 'client', firstName, lastName } = req.body;
    logger.info(` Inscription utilisateur : ${maskEmail(email)} avec rôle ${role}`);
    logger.info('Création compte Supabase Auth...');

    let authUser: any, authError: any;

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const result = await supabase.auth.admin.createUser({
        email: email,
        password: password || Math.random().toString(36).slice(-8),
        email_confirm: true,
        user_metadata: {
          role: role,
          phone: phone,
          first_name: firstName || '',
          last_name: lastName || '',
        },
      });
      authUser = result.data;
      authError = result.error;
    } else {
      logger.warn(
        'SUPABASE_SERVICE_ROLE_KEY non défini, utilisation de signUp() (nécessite confirmation email)'
      );
      const result = await supabase.auth.signUp({
        email: email,
        password: password || Math.random().toString(36).slice(-8),
        options: {
          data: {
            role: role,
            phone: phone,
            first_name: firstName || '',
            last_name: lastName || '',
          },
        },
      });
      authUser = result.data;
      authError = result.error;
    }

    if (authError) {
      logger.error('Erreur Supabase Auth:', authError);
      logger.debug('Détails erreur:', JSON.stringify(authError, null, 2));
      let errorMessage = authError.message;
      if (authError.message.includes('not allowed')) {
        errorMessage = 'Inscription non autorisée. Vérifiez la configuration Supabase Auth.';
      } else if (authError.message.includes('already registered')) {
        errorMessage = 'Cet email est déjà utilisé.';
      }
      res.status(400).json({
        success: false,
        message: errorMessage,
        details: authError,
      });
      return;
    }

    const userId = authUser?.user?.id || authUser?.id;
    if (!userId) {
      logger.error('Erreur: utilisateur créé mais ID introuvable');
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création du compte',
        error: 'ID utilisateur introuvable',
      });
      return;
    }

    // SÉCURITÉ: Masquer userId
    logger.info('Compte Supabase créé ! ID:', maskUserId(userId));
    logger.info('Ajout dans votre table PostgreSQL users...');

    try {
      const clientForInsert = supabaseAdmin || supabase;
      if (!supabaseAdmin) {
        logger.warn(
          'supabaseAdmin non disponible (SUPABASE_SERVICE_ROLE_KEY manquant), insertion dans users peut échouer à cause de RLS'
        );
      }

      const { data: userData, error: dbError } = await clientForInsert
        .from('users')
        .insert([
          {
            id: userId,
            email: email,
            phone: phone,
            role: role,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (dbError) {
        logger.error('Erreur PostgreSQL via Supabase:', dbError);
        if (dbError.code === '2501' && !supabaseAdmin) {
          logger.warn(
            'Insertion users échouée à cause de RLS (SUPABASE_SERVICE_ROLE_KEY manquant)'
          );
          logger.warn(
            'Solution: Ajouter SUPABASE_SERVICE_ROLE_KEY dans .env ou créer une politique RLS qui permet l\'insertion'
          );
          const minimalUserData = {
            id: userId,
            email: email,
            phone: phone,
            role: role,
            created_at: new Date().toISOString(),
          };

          logger.info('Utilisateur créé dans Auth, mais pas dans table users (RLS bloqué)');
          res.status(201).json({
            success: true,
            message: 'Utilisateur créé avec succès ! (Note: profil users non créé à cause de RLS)',
            data: {
              user: minimalUserData,
              profile: null,
              session: authUser.session,
            },
          });
          return;
        }

        throw new Error(`Erreur base de données: ${dbError.message}`);
      }

      logger.info('Utilisateur ajouté dans PostgreSQL !');
      logger.debug('Données PostgreSQL:', userData);

      let profile = null;
      if (role === 'driver') {
        logger.info('Création automatique du profil driver...');
        profile = await createDriverProfile(userId, email, phone, firstName, lastName);
        if (profile) {
          logger.info('Profil driver créé avec succès !');
        } else {
          logger.warn('Échec création profil driver (non bloquant)');
        }
      }

      // Créer les méthodes de paiement par défaut (cash et deferred)
      try {
        await createDefaultPaymentMethods(userId);
        logger.debug('Méthodes de paiement par défaut créées');
      } catch (paymentMethodError: any) {
        // Ne pas bloquer l'inscription si la création des méthodes de paiement échoue
        logger.warn(
          'Échec création méthodes de paiement par défaut (non bloquant):',
          paymentMethodError.message
        );
      }

      res.status(201).json({
        success: true,
        message: 'Utilisateur créé avec succès !',
        data: {
          user: userData,
          profile: profile,
          session: authUser.session,
        },
      });
    } catch (dbError: any) {
      logger.error('Erreur base de données:', dbError);
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'ajout en base de données",
        error: dbError.message,
      });
    }
  } catch (error: any) {
    logger.error('Erreur générale:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'inscription",
      error: error.message,
    });
  }
};

const checkUserInPostgreSQL = async (
  req: Request<{ email: string }>,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.params;

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (error) {
      logger.error('Erreur Supabase:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification',
        error: error.message,
      });
      return;
    }

    if (users && users.length > 0) {
      res.json({
        success: true,
        message: 'Utilisateur trouvé dans PostgreSQL',
        user: users[0],
      });
    } else {
      res.json({
        success: false,
        message: 'Utilisateur non trouvé dans PostgreSQL',
        user: null,
      });
    }
  } catch (error: any) {
    logger.error('Erreur vérification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification',
      error: error.message,
    });
  }
};

const getAllUsersFromPostgreSQL = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const client = await pool.connect();
    try {
      const query = `SELECT id, email, phone, role, created_at FROM users ORDER BY created_at DESC`;
      const result = await (client.query(query) as any);
      logger.info(`${result.rows.length} utilisateurs trouvés dans PostgreSQL`);
      res.json({
        success: true,
        message: `${result.rows.length} utilisateurs trouvés`,
        users: result.rows,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('Erreur liste utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des utilisateurs",
      error: error.message,
    });
  }
};

const loginUserWithPostgreSQL = async (
  req: RequestWithBruteForce<LoginBody>,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    logger.info(` Connexion utilisateur : ${maskEmail(email)}`);
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis',
      });
      return;
    }

    logger.info('Connexion Supabase Auth...');
    const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (authError) {
      if (req.recordFailedAttempt) {
        req.recordFailedAttempt();
      }

      logger.error('Erreur Supabase Auth:', authError.message);
      res.status(400).json({
        success: false,
        message: `Erreur connexion : ${authError.message}`,
      });
      return;
    }

    logger.info('Connexion Supabase réussie ! ID:', authUser.user.id);
    logger.info('Récupération données PostgreSQL...');

    const client = await pool.connect();
    try {
      const userQuery = `SELECT * FROM users WHERE id = $1`;
      const userResult = await (client.query(userQuery, [authUser.user.id]) as any);

      if (userResult.rows.length === 0) {
        logger.warn('Utilisateur pas trouvé dans PostgreSQL');
        res.status(404).json({
          success: false,
          message: "Utilisateur non trouvé dans la base de données",
        });
        return;
      }

      const user = userResult.rows[0];
      logger.info('Utilisateur trouvé dans PostgreSQL !');

      if (req.resetAttempts) {
        req.resetAttempts();
      }

      const { accessToken, refreshToken } = generateTokens(user);

      res.json({
        success: true,
        message: 'Connexion réussie !',
        data: {
          user: user,
          tokens: {
            accessToken,
            refreshToken,
          },
        },
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('Erreur générale:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la connexion",
      error: error.message,
    });
  }
};

const sendOTPCode = async (
  req: Request<{}, {}, SendOTPBody>,
  res: Response
): Promise<void> => {
  try {
    const { email, phone, otpMethod = 'email', role = 'client' } = req.body;
    logger.info(`Envoi OTP pour ${maskEmail(email)} via ${otpMethod} avec rôle ${role}`);

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await storeOTP(email, phone || '', role, otpCode);

    if (otpMethod === 'email') {
      logger.info(`Code OTP envoyé par email à ${maskEmail(email)}`);
      const emailResult = await sendOTPEmail(email, otpCode, role);
      if (!emailResult.success) {
        logger.error('Échec envoi email:', emailResult.error);
        // SÉCURITÉ: ne jamais logguer un OTP en production (risque de fuite via logs).
        if (process.env.NODE_ENV !== 'production') {
          logger.info(
            ` ======================================== FALLBACK EMAIL OTP pour ${role.toUpperCase()} ======================================== À: ${email} Sujet: Code de vérification ${role}
            
            Votre code de vérification est: ${otpCode}
            
            Ce code expire dans 5 minutes.
            ========================================
          `
          );
        } else {
          logger.warn(`Fallback OTP email déclenché pour ${maskEmail(email)} (envoi email KO)`);
        }
      } else {
        logger.info('Email OTP envoyé avec succès !');
      }
    } else if (otpMethod === 'sms') {
      logger.info(`Code OTP ${otpCode} envoyé par SMS au ${phone}`);
      const smsResult = await sendOTPSMS(phone || '', otpCode, role);
      if (!smsResult.success) {
        logger.error('Échec envoi SMS:', smsResult.error);
      } else {
        logger.info('SMS OTP envoyé avec succès !');
      }
    }

    res.json({
      success: true,
      message: `Code OTP envoyé par ${otpMethod}`,
      data: {
        method: otpMethod,
        email,
        phone,
        role,
        debug_code: process.env.NODE_ENV === 'development' ? otpCode : undefined,
      },
    });
  } catch (error: any) {
    logger.error('Erreur envoi OTP:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi du code OTP",
      error: error.message,
    });
  }
};

const verifyOTPCode = async (
  req: RequestWithBruteForce<VerifyOTPBody>,
  res: Response
): Promise<void> => {
  try {
    const { email, phone, otp, method, role = 'client' } = req.body;
    logger.info(`Vérification OTP pour ${maskEmail(email)}`);

    const isValid = await verifyOTP(email, phone || '', role, otp);
    if (!isValid) {
      if (req.recordFailedAttempt) {
        req.recordFailedAttempt();
      }

      res.status(400).json({
        success: false,
        message: 'Code OTP incorrect ou expiré',
      });
      return;
    }

    if (req.resetAttempts) {
      req.resetAttempts();
    }

    logger.info('Code OTP valide !');

    // ÉTAPE 1 : Vérifier d'abord si l'utilisateur existe dans Supabase Auth
    logger.info('Vérification dans Supabase Auth...');
    let existingAuthUser: any = null;

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data: authUsers, error: authListError } = await supabase.auth.admin.listUsers();
      if (authListError) {
        logger.warn(
          'Impossible de lister les utilisateurs Auth (nécessite service role key):',
          authListError.message
        );
      } else if (authUsers?.users) {
        existingAuthUser = authUsers.users.find((user: any) => user.email === email);
      }
    } else {
      logger.warn(
        "SUPABASE_SERVICE_ROLE_KEY non défini, impossible de vérifier si l'utilisateur existe dans Supabase Auth"
      );
    }

    // ÉTAPE 2 : Vérifier si l'utilisateur existe dans PostgreSQL
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (checkError) {
      logger.error('Erreur vérification utilisateur:', checkError);
    }

    // ÉTAPE 3 : Si l'utilisateur existe dans PostgreSQL mais PAS dans Supabase Auth, nettoyer les données orphelines
    if (existingUsers && existingUsers.length > 0 && !existingAuthUser) {
      logger.warn(
        `Utilisateur trouvé dans PostgreSQL mais absent de Supabase Auth. Nettoyage des données orphelines pour ${maskEmail(email)}`
      );
      const orphanedUser = existingUsers[0];
      await cleanupOrphanedUser(orphanedUser.id, email);
      // Réinitialiser pour traiter comme un nouvel utilisateur
      existingUsers.length = 0;
    }

    let userData: any;
    let isNewUser = false;
    let driverProfile: any = null; // Profil driver créé (si applicable)

    if (existingUsers && existingUsers.length > 0 && existingAuthUser) {
      // Utilisateur existe dans les deux (PostgreSQL + Supabase Auth)
      logger.info('Utilisateur existant trouvé dans PostgreSQL et Supabase Auth !');
      userData = existingUsers[0];
      
      // Récupérer le profil driver s'il existe
      if (role === 'driver' && userData.id) {
        try {
          const clientForSelect = supabaseAdmin || supabase;
          const { data: existingProfile } = await clientForSelect
            .from('driver_profiles')
            .select('*')
            .eq('user_id', userData.id)
            .single();
          if (existingProfile) {
            driverProfile = existingProfile;
          }
        } catch (error) {
          logger.warn('Impossible de récupérer le profil driver existant:', error);
        }
      }
    } else if (existingAuthUser && (!existingUsers || existingUsers.length === 0)) {
      // Utilisateur existe dans Supabase Auth mais pas dans PostgreSQL → Synchronisation
      logger.info('Utilisateur trouvé dans Supabase Auth, synchronisation vers PostgreSQL...');
      const clientForInsert = supabaseAdmin || supabase;
      if (!supabaseAdmin) {
        logger.warn(
          'supabaseAdmin non disponible (SUPABASE_SERVICE_ROLE_KEY manquant), insertion dans users peut échouer à cause de RLS'
        );
      }

      const { data: newUser, error: insertError } = await clientForInsert
        .from('users')
        .insert([
          {
            id: existingAuthUser.id,
            email: email,
            phone: phone,
            role: role,
            created_at: existingAuthUser.created_at || new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (insertError) {
        logger.error('Erreur synchronisation PostgreSQL:', insertError);
        if (insertError.code === '2501' && !supabaseAdmin) {
          logger.warn(
            'Synchronisation users échouée à cause de RLS (SUPABASE_SERVICE_ROLE_KEY manquant), utilisation des données Auth'
          );
          userData = {
            id: existingAuthUser.id,
            email: email,
            phone: phone,
            role: role,
            created_at: existingAuthUser.created_at || new Date().toISOString(),
          };
        } else {
          res.status(500).json({
            success: false,
            message: 'Erreur lors de la synchronisation du profil utilisateur',
            error: insertError.message,
          });
          return;
        }
      } else {
        userData = newUser;
      }

      if (role === 'driver' && userData && userData.id) {
        logger.info('Création automatique du profil driver pour utilisateur synchronisé...');
        driverProfile = await createDriverProfile(userData.id, email, phone, null, null);
        if (driverProfile) {
          logger.info('Profil driver créé avec succès !');
        } else {
          logger.warn('Échec création profil driver (non bloquant)');
        }
      }

      logger.info('Utilisateur synchronisé avec succès !');
    } else if (!existingAuthUser && (!existingUsers || existingUsers.length === 0)) {
      // Utilisateur n'existe ni dans Supabase Auth ni dans PostgreSQL → Nouvel utilisateur
      logger.info('Création nouvel utilisateur complet...');
      isNewUser = true;
      const tempPassword = Math.random().toString(36).slice(-12);
      let authUser: any, authError: any;

      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const result = await supabase.auth.admin.createUser({
          email: email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            role: role,
            phone: phone,
          },
        });
        authUser = result.data;
        authError = result.error;
      } else {
        logger.warn(
          'SUPABASE_SERVICE_ROLE_KEY non défini, utilisation de signUp() (nécessite confirmation email)'
        );
        const result = await supabase.auth.signUp({
          email: email,
          password: tempPassword,
          options: {
            data: {
              role: role,
              phone: phone,
            },
          },
        });
        authUser = result.data;
        authError = result.error;
      }

      if (authError) {
        logger.error('Erreur création Supabase Auth:', authError);
        let errorMessage = authError.message;
        if (authError.message.includes('not allowed') || authError.code === 'not_admin') {
          errorMessage =
            'Création de compte non autorisée. Vérifiez la configuration Supabase (inscriptions activées et service role key configurée).';
        } else if (authError.message.includes('already registered')) {
          errorMessage = 'Cet email est déjà utilisé.';
        }
        res.status(400).json({
          success: false,
          message: 'Erreur lors de la création du compte',
          error: errorMessage,
        });
        return;
      }

      const userId = authUser?.user?.id || authUser?.id;
      if (!userId) {
        logger.error('Erreur: utilisateur créé mais ID introuvable');
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la création du compte',
          error: 'ID utilisateur introuvable',
        });
        return;
      }

      logger.info('Utilisateur créé dans Supabase Auth avec ID:', maskUserId(userId));

      const clientForInsert = supabaseAdmin || supabase;
      if (!supabaseAdmin) {
        logger.warn(
          'supabaseAdmin non disponible (SUPABASE_SERVICE_ROLE_KEY manquant), insertion dans users peut échouer à cause de RLS'
        );
      }

      const { data: newUser, error: insertError } = await clientForInsert
        .from('users')
        .insert([
          {
            id: userId,
            email: email,
            phone: phone,
            role: role,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (insertError) {
        logger.error('Erreur insertion PostgreSQL:', insertError);
        if (insertError.code === '2501' && !supabaseAdmin) {
          logger.warn(
            'Insertion users échouée à cause de RLS (SUPABASE_SERVICE_ROLE_KEY manquant), mais utilisateur créé dans Auth'
          );
          logger.warn(
            'Solution: Ajouter SUPABASE_SERVICE_ROLE_KEY dans .env ou créer une politique RLS qui permet l\'insertion'
          );
          userData = {
            id: userId,
            email: email,
            phone: phone,
            role: role,
            created_at: new Date().toISOString(),
          };
        } else {
          res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du profil utilisateur',
            error: insertError.message,
          });
          return;
        }
      } else {
        userData = newUser;
      }

      if (role === 'driver' && userData && userData.id) {
        logger.info('Création automatique du profil driver...');
        driverProfile = await createDriverProfile(userData.id, email, phone, null, null);
        if (driverProfile) {
          logger.info('Profil driver créé avec succès !');
        } else {
          logger.warn('Échec création profil driver (non bloquant)');
        }
      }

      if (userData && userData.id) {
        try {
          await createDefaultPaymentMethods(userData.id);
          logger.debug('Méthodes de paiement par défaut créées');
        } catch (paymentMethodError: any) {
          logger.warn(
            'Échec création méthodes de paiement par défaut (non bloquant):',
            paymentMethodError.message
          );
        }
      }

      logger.info('Nouvel utilisateur créé avec succès !');
    }

    if (!userData || !userData.id) {
      logger.error('Erreur: userData non défini ou invalide');
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création du profil utilisateur',
        error: 'Données utilisateur invalides',
      });
      return;
    }

    // Si c'est un driver et qu'on n'a pas encore le profil, essayer de le récupérer
    let finalDriverProfile = driverProfile;
    if (role === 'driver' && !finalDriverProfile && userData.id) {
      try {
        const clientForSelect = supabaseAdmin || supabase;
        const { data: existingProfile } = await clientForSelect
          .from('driver_profiles')
          .select('*')
          .eq('user_id', userData.id)
          .single();
        if (existingProfile) {
          finalDriverProfile = existingProfile;
        }
      } catch (error) {
        logger.warn('Impossible de récupérer le profil driver:', error);
      }
    }

    const { accessToken, refreshToken } = generateTokens(userData);

    res.json({
      success: true,
      message: isNewUser ? 'Compte créé avec succès !' : 'Connexion réussie !',
      data: {
        user: userData,
        profile: finalDriverProfile, // Inclure le profil driver dans la réponse
        tokens: {
          accessToken,
          refreshToken,
        },
        isNewUser,
      },
    });
  } catch (error: any) {
    logger.error('Erreur vérification OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification',
      error: error.message,
    });
  }
};

const refreshToken = async (
  req: Request<{}, {}, RefreshTokenBody>,
  res: Response
): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Refresh token requis',
      });
      return;
    }

    try {
      const { accessToken } = await refreshAccessToken(token);

      res.json({
        success: true,
        message: 'Token rafraîchi avec succès',
        data: { accessToken },
      });
    } catch (error: any) {
      const msg = (error.message || '').toLowerCase();
      // Erreurs DB/réseau → 500 (JAMAIS 401, pas de déconnexion côté client)
      const isServerError =
        msg.includes('connection terminated') ||
        msg.includes('connection timeout') ||
        msg.includes('econnrefused') ||
        msg.includes('etimedout') ||
        msg.includes('enotfound') ||
        msg.includes('econnreset') ||
        msg.includes('socket hang up');
      if (isServerError) {
        logger.warn('Erreur serveur lors du refresh token:', msg);
        res.status(500).json({
          success: false,
          message: 'Service temporairement indisponible. Veuillez réessayer.',
        });
      } else {
        res.status(401).json({
          success: false,
          message: msg || 'Refresh token invalide ou expiré',
        });
      }
      return;
    }
  } catch (error: any) {
    logger.error('Erreur refresh token:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rafraîchissement du token',
      error: error.message,
    });
  }
};

/**
 * Met à jour le profil utilisateur (first_name, last_name, phone)
 */
export const updateUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { first_name, last_name, phone, avatar_url } = req.body;

    // SÉCURITÉ: empêcher les accès IDOR (un user ne doit pas modifier un autre user)
    const authUser = (req as any).user as { id?: string; role?: string } | undefined;
    if (!authUser?.id) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }
    const isAdmin = authUser.role === 'admin' || authUser.role === 'super_admin';
    if (!isAdmin && authUser.id !== userId) {
      res.status(403).json({ success: false, message: 'Accès refusé' });
      return;
    }

    // Vérifier que l'utilisateur existe
    const userResult = await (pool as any).query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
      return;
    }

    // Construire la requête de mise à jour dynamiquement
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      values.push(first_name || null);
      paramIndex++;
    }

    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      values.push(last_name || null);
      paramIndex++;
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      values.push(phone || null);
      paramIndex++;
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramIndex}`);
      values.push(avatar_url || null);
      paramIndex++;
    }

    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour',
      });
      return;
    }

    // Ajouter updated_at
    updates.push(`updated_at = NOW()`);
    
    // Ajouter userId à la fin pour la clause WHERE
    values.push(userId);
    const whereParamIndex = paramIndex;

    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${whereParamIndex}
      RETURNING id, email, phone, first_name, last_name, avatar_url, role, created_at, updated_at
    `;

    const result = await (pool as any).query(updateQuery, values);

    logger.info(`Profil utilisateur mis à jour pour ${maskUserId(userId)}`, {
      first_name: first_name !== undefined,
      last_name: last_name !== undefined,
      phone: phone !== undefined,
      avatar_url: avatar_url !== undefined,
    });

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur mise à jour profil utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil',
      error: error.message,
    });
  }
};

/**
 * Récupère le profil utilisateur (first_name, last_name, phone, avatar_url)
 */
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // SÉCURITÉ: empêcher les accès IDOR
    const authUser = (req as any).user as { id?: string; role?: string } | undefined;
    if (!authUser?.id) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }
    const isAdmin = authUser.role === 'admin' || authUser.role === 'super_admin';
    if (!isAdmin && authUser.id !== userId) {
      res.status(403).json({ success: false, message: 'Accès refusé' });
      return;
    }

    const result = await (pool as any).query(
      'SELECT id, email, phone, first_name, last_name, avatar_url, role, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (!result.rows || result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Profil récupéré avec succès',
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur récupération profil utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil',
      error: error.message,
    });
  }
};

/**
 * Upload un avatar vers Supabase Storage et met à jour le profil utilisateur
 */
export const uploadAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    // SÉCURITÉ: empêcher les accès IDOR
    const authUser = (req as any).user as { id?: string; role?: string } | undefined;
    if (!authUser?.id) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }
    const isAdmin = authUser.role === 'admin' || authUser.role === 'super_admin';
    if (!isAdmin && authUser.id !== userId) {
      res.status(403).json({ success: false, message: 'Accès refusé' });
      return;
    }

    if (!imageBase64) {
      res.status(400).json({
        success: false,
        message: 'Image base64 requise',
      });
      return;
    }

    // Vérifier que l'utilisateur existe
    const userResult = await (pool as any).query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
      return;
    }

    if (!supabaseAdmin) {
      res.status(500).json({
        success: false,
        message: 'Supabase non configuré',
      });
      return;
    }

    // Convertir base64 en Buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Vérifier la taille (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (buffer.length > maxSize) {
      res.status(400).json({
        success: false,
        message: 'Image trop grande. Taille maximum: 50MB',
      });
      return;
    }

    // Déterminer l'extension du fichier
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/gif' ? 'gif' : 'jpg';
    const fileName = `${userId}-${Date.now()}.${ext}`;
    const filePath = `avatars/${fileName}`;

    // Upload vers Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: mimeType,
      });

    if (uploadError) {
      logger.error('Erreur upload avatar:', uploadError);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'upload de l\'image',
        error: uploadError.message,
      });
      return;
    }

    // Obtenir l'URL publique
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Mettre à jour le profil utilisateur avec l'URL de l'avatar
    const updateResult = await (pool as any).query(
      `UPDATE users 
       SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, phone, first_name, last_name, avatar_url, role, created_at, updated_at`,
      [publicUrl, userId]
    );

    logger.info(`Avatar uploadé pour ${maskUserId(userId)}`, {
      filePath,
      publicUrl,
    });

    res.json({
      success: true,
      message: 'Avatar uploadé avec succès',
      data: {
        avatar_url: publicUrl,
        user: updateResult.rows[0],
      },
    });
  } catch (error: any) {
    logger.error('Erreur upload avatar:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload de l\'avatar',
      error: error.message,
    });
  }
};

export {
  registerUserWithPostgreSQL,
  loginUserWithPostgreSQL,
  checkUserInPostgreSQL,
  getAllUsersFromPostgreSQL,
  sendOTPCode,
  verifyOTPCode,
  refreshToken,
};
