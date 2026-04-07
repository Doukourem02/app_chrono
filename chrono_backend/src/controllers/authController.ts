import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import pool from '../config/db.js';
import { sendOTPSMS } from '../services/emailService.js';
import { sendOTPWhatsApp } from '../services/twilioWhatsAppService.js';
import {storeOTP,verifyOTP,resolveOtpEmailForStorage,syntheticEmailFromPhone,} from '../config/otpStorage.js';
import { OTP_TTL_MINUTES } from '../config/otpTtl.js';
import { generateTokens, refreshAccessToken } from '../utils/jwt.js';
import logger from '../utils/logger.js';
import { maskEmail, maskPhone, maskUserId } from '../utils/maskSensitiveData.js';
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
  email?: string;
  phone?: string;
  otpMethod?: string;
  role?: string;
}

interface VerifyOTPBody {
  email?: string;
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Même contrat que check / email, mais par id (connexion téléphone sans e-mail exploitable côté app). */
const checkUserByIdInPostgreSQL = async (
  req: Request<{ userId: string }>,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId || !UUID_RE.test(userId)) {
      res.status(400).json({
        success: false,
        message: 'Identifiant utilisateur invalide',
        user: null,
      });
      return;
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .limit(1);

    if (error) {
      logger.error('Erreur Supabase (check-by-id):', error);
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
    logger.error('Erreur vérification par id:', error);
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
    const { email, phone, otpMethod = 'sms', role = 'client' } = req.body;
    const phoneStr = phone || '';
    const otpEmail = resolveOtpEmailForStorage(email, phoneStr);
    logger.info(`Envoi OTP pour ${maskPhone(phoneStr)} via ${otpMethod} avec rôle ${role}`);

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await storeOTP(otpEmail, phoneStr, role, otpCode);

    if (otpMethod === 'sms') {
      logger.info(`Code OTP ${otpCode} pour SMS au ${maskPhone(phoneStr)} (Twilio/Vonage)`);
      // Attendre l’API SMS : évite un 200 alors que Twilio/Vonage a refusé ; la livraison opérateur peut encore prendre du retard.
      const smsResult = await sendOTPSMS(phoneStr, otpCode, role);
      if (!smsResult.success) {
        logger.error('Échec envoi SMS:', smsResult.error);
        res.status(503).json({
          success: false,
          message: "Impossible d'envoyer le code par SMS pour le moment. Réessayez dans un instant.",
          error: process.env.NODE_ENV === 'development' ? smsResult.error : undefined,
        });
        return;
      }
      logger.info('SMS OTP envoyé avec succès !');
    } else if (otpMethod === 'whatsapp') {
      logger.info(`Code OTP envoyé par WhatsApp au ${phone}`);
      const waResult = await sendOTPWhatsApp(phoneStr, otpCode, role);
      if (!waResult.success) {
        logger.error('Échec envoi WhatsApp:', waResult.error);
        res.status(503).json({
          success: false,
          message: "Impossible d'envoyer le code par WhatsApp",
          error: process.env.NODE_ENV === 'development' ? waResult.error : undefined,
        });
        return;
      }
      logger.info('WhatsApp OTP envoyé avec succès !');
    }

    res.json({
      success: true,
      message: `Code OTP envoyé par ${otpMethod}`,
      data: {
        method: otpMethod,
        email: email?.trim() || undefined,
        phone: phoneStr,
        role,
        otpExpiresInMinutes: OTP_TTL_MINUTES,
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

/** Clé de comparaison téléphone : uniquement des chiffres (E.164 +225… vs 225… dans Auth). */
const phoneDigitsKey = (p: string): string => p.replace(/\D/g, '');

/**
 * Retrouve un utilisateur Supabase Auth par e-mail réel, e-mail OTP synthétique (p…@otp.chrono.local) ou téléphone.
 * Important : listUsers() sans pagination ne renvoie qu’une page — d’où des faux « utilisateur absent » puis createUser → « already registered ».
 */
async function findAuthUserInSupabase(
  contactEmail: string,
  authEmailForProvision: string,
  phoneKey: string
): Promise<any | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const provisionLower = (authEmailForProvision || '').toLowerCase();
  const contactLower = (contactEmail || '').toLowerCase();

  const matchesUser = (user: any): boolean => {
    if (contactLower && user.email?.toLowerCase() === contactLower) {
      return true;
    }
    if (provisionLower && user.email?.toLowerCase() === provisionLower) {
      return true;
    }
    const uPhone = user.phone ? phoneDigitsKey(user.phone) : '';
    const metaPhone = user.user_metadata?.phone
      ? phoneDigitsKey(String(user.user_metadata.phone))
      : '';
    if (phoneKey.length >= 8 && (uPhone === phoneKey || metaPhone === phoneKey)) {
      return true;
    }
    return false;
  };

  const perPage = 1000;
  const maxPages = 50;
  let page = 1;

  const adminClient = supabaseAdmin || supabase;

  while (page <= maxPages) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      logger.warn('findAuthUserInSupabase listUsers:', error.message);
      return null;
    }
    const users = data?.users ?? [];
    const found = users.find(matchesUser);
    if (found) {
      return found;
    }
    if (users.length < perPage) {
      break;
    }
    page += 1;
  }

  return null;
}

type SyncAuthToPostgresResult =
  | { ok: true; userData: any; driverProfile: any }
  | { ok: false; responseSent: true };

/** Utilisateur présent dans Supabase Auth mais pas (encore) dans public.users → insertion + profil driver si besoin */
async function syncAuthUserToPostgresFromVerify(
  existingAuthUser: any,
  authEmailForProvision: string,
  phoneStr: string,
  role: string,
  res: Response
): Promise<SyncAuthToPostgresResult> {
  logger.info('Utilisateur trouvé dans Supabase Auth, synchronisation vers PostgreSQL...');
  const clientForInsert = supabaseAdmin || supabase;
  if (!supabaseAdmin) {
    logger.warn(
      'supabaseAdmin non disponible (SUPABASE_SERVICE_ROLE_KEY manquant), insertion dans users peut échouer à cause de RLS'
    );
  }

  const syncEmail = existingAuthUser.email || authEmailForProvision;

  const { data: newUser, error: insertError } = await clientForInsert
    .from('users')
    .insert([
      {
        id: existingAuthUser.id,
        email: syncEmail,
        phone: phoneStr,
        role: role,
        created_at: existingAuthUser.created_at || new Date().toISOString(),
      },
    ])
    .select()
    .single();

  let userData: any;
  if (insertError) {
    const isUniqueConflict =
      insertError.code === '23505' ||
      /duplicate key|unique constraint/i.test(String(insertError.message || ''));

    if (isUniqueConflict) {
      const { data: byId } = await clientForInsert
        .from('users')
        .select('*')
        .eq('id', existingAuthUser.id)
        .maybeSingle();
      if (byId) {
        logger.info('Ligne users déjà présente (même id Auth), poursuite du flux verify-otp.');
        userData = byId;
      } else if (phoneStr?.trim()) {
        const { data: byPhone } = await clientForInsert
          .from('users')
          .select('*')
          .eq('phone', phoneStr.trim())
          .maybeSingle();
        if (byPhone) {
          logger.info('Ligne users déjà présente (même téléphone), poursuite du flux verify-otp.');
          userData = byPhone;
        }
      }
    }

    if (!userData) {
      logger.error('Erreur synchronisation PostgreSQL:', insertError);
      if (insertError.code === '2501' && !supabaseAdmin) {
        logger.warn(
          'Synchronisation users échouée à cause de RLS (SUPABASE_SERVICE_ROLE_KEY manquant), utilisation des données Auth'
        );
        userData = {
          id: existingAuthUser.id,
          email: syncEmail,
          phone: phoneStr,
          role: role,
          created_at: existingAuthUser.created_at || new Date().toISOString(),
        };
      } else {
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la synchronisation du profil utilisateur',
          error: insertError.message,
        });
        return { ok: false, responseSent: true };
      }
    }
  } else {
    userData = newUser;
  }

  let driverProfile: any = null;
  if (role === 'driver' && userData && userData.id) {
    logger.info('Création automatique du profil driver pour utilisateur synchronisé...');
    driverProfile = await createDriverProfile(
      userData.id,
      userData.email || syncEmail,
      phoneStr,
      null,
      null
    );
    if (driverProfile) {
      logger.info('Profil driver créé avec succès !');
    } else {
      logger.warn('Échec création profil driver (non bloquant)');
    }
  }

  logger.info('Utilisateur synchronisé avec succès !');
  return { ok: true, userData, driverProfile };
}

const verifyOTPCode = async (
  req: RequestWithBruteForce<VerifyOTPBody>,
  res: Response
): Promise<void> => {
  try {
    const { email, phone, otp, method, role = 'client' } = req.body;
    const phoneStr = phone || '';
    const otpEmail = resolveOtpEmailForStorage(email, phoneStr);
    const contactEmail = email?.trim() || '';
    const phoneKey = phoneDigitsKey(phoneStr);

    logger.info(`Vérification OTP pour ${maskPhone(phoneStr)}`);

    const isValid = await verifyOTP(otpEmail, phoneStr, role, otp);
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

    const authEmailForProvision = contactEmail || syntheticEmailFromPhone(phoneStr);

    // ÉTAPE 1 : Vérifier si l'utilisateur existe dans Supabase Auth (pagination + e-mail OTP synthétique)
    logger.info('Vérification dans Supabase Auth...');
    let existingAuthUser: any = null;

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      existingAuthUser = await findAuthUserInSupabase(
        contactEmail,
        authEmailForProvision,
        phoneKey
      );
    } else {
      logger.warn(
        "SUPABASE_SERVICE_ROLE_KEY non défini, impossible de vérifier si l'utilisateur existe dans Supabase Auth"
      );
    }

    // ÉTAPE 2 : Vérifier si l'utilisateur existe dans PostgreSQL (e-mail réel ou téléphone)
    let existingUsers: any[] | null = null;
    let checkError: any = null;

    if (contactEmail) {
      const r = await supabase.from('users').select('*').eq('email', contactEmail).limit(1);
      checkError = r.error;
      if (r.data?.length) {
        existingUsers = r.data;
      }
    }
    if ((!existingUsers || existingUsers.length === 0) && phoneStr.trim()) {
      const r2 = await supabase.from('users').select('*').eq('phone', phoneStr.trim()).limit(1);
      if (r2.error && !checkError) {
        checkError = r2.error;
      }
      if (r2.data?.length) {
        existingUsers = r2.data;
      }
    }

    if (checkError) {
      logger.error('Erreur vérification utilisateur:', checkError);
    }

    // ÉTAPE 3 : PostgreSQL sans Auth résolu — nettoyage orphelin sauf comptes OTP (sinon createUser échoue en doublon Auth)
    let trustPostgresOtpRow = false;
    if (existingUsers && existingUsers.length > 0 && !existingAuthUser) {
      const orphanedUser = existingUsers[0];
      const otpSynthetic =
        typeof orphanedUser.email === 'string' &&
        orphanedUser.email.toLowerCase().includes('@otp.chrono.local');

      if (otpSynthetic) {
        logger.warn(
          `Ligne users OTP sans correspondance listUsers Auth — compte conservé (${maskEmail(orphanedUser.email)}).`
        );
        trustPostgresOtpRow = true;
      } else {
        logger.warn(
          `Utilisateur trouvé dans PostgreSQL mais absent de Supabase Auth. Nettoyage des données orphelines pour ${maskEmail(orphanedUser.email)}`
        );
        await cleanupOrphanedUser(orphanedUser.id, orphanedUser.email);
        existingUsers.length = 0;
      }
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
    } else if (
      existingUsers &&
      existingUsers.length > 0 &&
      !existingAuthUser &&
      trustPostgresOtpRow
    ) {
      logger.info('Connexion via ligne PostgreSQL (OTP / Auth non listé).');
      userData = existingUsers[0];
      isNewUser = false;
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
      const syncResult = await syncAuthUserToPostgresFromVerify(
        existingAuthUser,
        authEmailForProvision,
        phoneStr,
        role,
        res
      );
      if (!syncResult.ok) {
        return;
      }
      userData = syncResult.userData;
      driverProfile = syncResult.driverProfile;
    } else if (!existingAuthUser && (!existingUsers || existingUsers.length === 0)) {
      // Utilisateur n'existe ni dans Supabase Auth ni dans PostgreSQL → Nouvel utilisateur
      logger.info('Création nouvel utilisateur complet...');
      isNewUser = true;
      const tempPassword = Math.random().toString(36).slice(-12);
      let authUser: any, authError: any;

      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const result = await supabase.auth.admin.createUser({
          email: authEmailForProvision,
          password: tempPassword,
          email_confirm: true,
          phone: phoneStr || undefined,
          user_metadata: {
            role: role,
            phone: phoneStr,
          },
        });
        authUser = result.data;
        authError = result.error;
      } else {
        logger.warn(
          'SUPABASE_SERVICE_ROLE_KEY non défini, utilisation de signUp() (nécessite confirmation email)'
        );
        const result = await supabase.auth.signUp({
          email: authEmailForProvision,
          password: tempPassword,
          options: {
            data: {
              role: role,
              phone: phoneStr,
            },
          },
        });
        authUser = result.data;
        authError = result.error;
      }

      let provisionedViaExistingAuth = false;

      if (authError) {
        const errRaw = String(authError.message || '');
        const errLower = errRaw.toLowerCase();
        const looksLikeDuplicate =
          errLower.includes('already registered') ||
          errLower.includes('already been registered') ||
          errLower.includes('duplicate') ||
          errLower.includes('user already exists') ||
          errLower.includes('email address is already') ||
          errLower.includes('email already') ||
          errLower.includes('phone already') ||
          errLower.includes('unique') ||
          errLower.includes('existe déjà') ||
          (authError as any).code === 'email_exists';

        let recovered: any = null;
        if (looksLikeDuplicate && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          recovered = await findAuthUserInSupabase(
            contactEmail,
            authEmailForProvision,
            phoneKey
          );
        }

        if (recovered) {
          logger.info(
            'Compte déjà présent dans Supabase Auth : récupération et synchronisation PostgreSQL (verify-otp).'
          );
          isNewUser = false;
          const syncResult = await syncAuthUserToPostgresFromVerify(
            recovered,
            authEmailForProvision,
            phoneStr,
            role,
            res
          );
          if (!syncResult.ok) {
            return;
          }
          userData = syncResult.userData;
          driverProfile = syncResult.driverProfile;
          provisionedViaExistingAuth = true;
        } else {
          logger.error('Erreur création Supabase Auth:', authError);
          let errorMessage = errRaw;
          if (errRaw.includes('not allowed') || authError.code === 'not_admin') {
            errorMessage =
              'Création de compte non autorisée. Vérifiez la configuration Supabase (inscriptions activées et service role key configurée).';
          } else if (looksLikeDuplicate) {
            errorMessage = 'Ce compte existe déjà (e-mail ou téléphone).';
          }
          res.status(400).json({
            success: false,
            message: 'Erreur lors de la création du compte',
            error: errorMessage,
          });
          return;
        }
      }

      if (!provisionedViaExistingAuth) {
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
            email: authEmailForProvision,
            phone: phoneStr,
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
            email: authEmailForProvision,
            phone: phoneStr,
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
        driverProfile = await createDriverProfile(
          userData.id,
          userData.email || authEmailForProvision,
          phoneStr,
          null,
          null
        );
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

    const updatedUser = result.rows[0];

    // Livreur : garder driver_profiles aligné (écran détail / carte utilise souvent cette table)
    if (updatedUser && String(updatedUser.role) === 'driver') {
      try {
        const dpSets: string[] = [];
        const dpVals: unknown[] = [];
        let n = 1;
        if (first_name !== undefined) {
          dpSets.push(`first_name = $${n++}`);
          dpVals.push(first_name || null);
        }
        if (last_name !== undefined) {
          dpSets.push(`last_name = $${n++}`);
          dpVals.push(last_name || null);
        }
        if (phone !== undefined) {
          dpSets.push(`phone = $${n++}`);
          dpVals.push(phone || null);
        }
        if (dpSets.length > 0) {
          dpSets.push('updated_at = NOW()');
          dpVals.push(userId);
          await (pool as any).query(
            `UPDATE driver_profiles SET ${dpSets.join(', ')} WHERE user_id = $${n}`,
            dpVals
          );
        }
      } catch (syncErr: any) {
        logger.warn('Sync driver_profiles après mise à jour users (non bloquant):', syncErr?.message || syncErr);
      }
    }

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: updatedUser,
    });
  } catch (error: any) {
    logger.error('Erreur mise à jour profil utilisateur:', error);
    const code = error?.code as string | undefined;
    if (code === '42703') {
      res.status(503).json({
        success: false,
        message:
          'Colonnes profil manquantes sur la table users. Exécuter la migration 024_users_name_avatar_columns.sql sur cette base.',
        error: error.message,
      });
      return;
    }
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
  checkUserByIdInPostgreSQL,
  getAllUsersFromPostgreSQL,
  sendOTPCode,
  verifyOTPCode,
  refreshToken,
};
