import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import pool from '../config/db.js';
import { sendOTPEmail, sendOTPSMS } from '../services/emailService.js';
import { storeOTP, verifyOTP } from '../config/otpStorage.js';
import { generateTokens, refreshAccessToken } from '../utils/jwt.js';
import logger from '../utils/logger.js';
import { maskEmail, maskUserId } from '../utils/maskSensitiveData.js';
import { createDefaultPaymentMethods } from '../utils/createDefaultPaymentMethods.js';

// Interface for Request with brute force protection methods
interface RequestWithBruteForce<B = any> extends Request<{}, {}, B> {
  recordFailedAttempt?: () => void;
  resetAttempts?: () => void;
}

// Interface for register request body
interface RegisterBody {
  email: string;
  password?: string;
  phone?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
}

// Interface for login request body
interface LoginBody {
  email: string;
  password: string;
}

// Interface for send OTP request body
interface SendOTPBody {
  email: string;
  phone?: string;
  otpMethod?: string;
  role?: string;
}

// Interface for verify OTP request body
interface VerifyOTPBody {
  email: string;
  phone?: string;
  otp: string;
  method?: string;
  role?: string;
}

// Interface for refresh token request body
interface RefreshTokenBody {
  refreshToken: string;
}

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
      // 🔒 SÉCURITÉ: Masquer userId
      logger.info(`✅ Profil driver déjà existant pour user ${maskUserId(userId)}`);
      return existingProfile;
    }
    

    const { data: driverProfile, error: insertError } = await clientForInsert
      .from('driver_profiles')
      .insert([{
        user_id: userId,
        email: email,
        phone: phone || null,
        first_name: firstName || null,
        last_name: lastName || null,
        vehicle_type: 'moto', 
        is_online: false,
        is_available: true,
        rating: 5.0, 
        total_deliveries: 0
      }])
      .select()
      .single();
    
    if (insertError) {
      // 🔒 SÉCURITÉ: Masquer userId
      logger.error(`❌ Erreur création profil driver pour ${maskUserId(userId)}:`, insertError);
    
      return null;
    }
    
    // 🔒 SÉCURITÉ: Masquer userId
    logger.info(`✅ Profil driver créé avec succès pour user ${maskUserId(userId)}`);
    return driverProfile;
  } catch (error: any) {
    // 🔒 SÉCURITÉ: Masquer userId
    logger.error(`❌ Erreur création profil driver pour ${maskUserId(userId)}:`, error);
    
    return null;
  }
};


const registerUserWithPostgreSQL = async (
  req: Request<{}, {}, RegisterBody>,
  res: Response
): Promise<void> => {
  try {
    const { email, password, phone, role = 'client', firstName, lastName } = req.body;

    // 🔒 SÉCURITÉ: Masquer l'email dans les logs
    logger.info(`📝 Inscription utilisateur : ${maskEmail(email)} avec rôle ${role}`);


    logger.info("⏳ Création compte Supabase Auth...");

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
          last_name: lastName || ''
        }
      });
      authUser = result.data;
      authError = result.error;
    } else {
      
      logger.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY non défini, utilisation de signUp() (nécessite confirmation email)");
      const result = await supabase.auth.signUp({
        email: email,
        password: password || Math.random().toString(36).slice(-8),
        options: {
          data: {
            role: role,
            phone: phone,
            first_name: firstName || '',
            last_name: lastName || ''
          }
        }
      });
      authUser = result.data;
      authError = result.error;
    }
    if (authError) {
      logger.error("❌ Erreur Supabase Auth:", authError);
      logger.debug("🔍 Détails erreur:", JSON.stringify(authError, null, 2));
      

      let errorMessage = authError.message;
      if (authError.message.includes('not allowed')) {
        errorMessage = 'Inscription non autorisée. Vérifiez la configuration Supabase Auth.';
      } else if (authError.message.includes('already registered')) {
        errorMessage = 'Cet email est déjà utilisé.';
      }
      
      res.status(400).json({
        success: false,
        message: errorMessage,
        details: authError
      });
      return;
    }

    const userId = authUser?.user?.id || authUser?.id;
    if (!userId) {
      logger.error("❌ Erreur: utilisateur créé mais ID introuvable");
      res.status(500).json({
        success: false,
        message: "Erreur lors de la création du compte",
        error: "ID utilisateur introuvable"
      });
      return;
    }

    // 🔒 SÉCURITÉ: Masquer userId
    logger.info("✅ Compte Supabase créé ! ID:", maskUserId(userId));

  
    logger.info("⏳ Ajout dans votre table PostgreSQL users...");
    
    try {
      
      const clientForInsert = supabaseAdmin || supabase;
      
      if (!supabaseAdmin) {
        logger.warn('⚠️ supabaseAdmin non disponible (SUPABASE_SERVICE_ROLE_KEY manquant), insertion dans users peut échouer à cause de RLS');
      }
    
      const { data: userData, error: dbError } = await clientForInsert
        .from('users')
        .insert([
          {
            id: userId,
            email: email,
            phone: phone,
            role: role,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (dbError) {
        logger.error("❌ Erreur PostgreSQL via Supabase:", dbError);
        
        if (dbError.code === '42501' && !supabaseAdmin) {
          logger.warn('⚠️ Insertion users échouée à cause de RLS (SUPABASE_SERVICE_ROLE_KEY manquant)');
          logger.warn('💡 Solution: Ajouter SUPABASE_SERVICE_ROLE_KEY dans .env ou créer une politique RLS qui permet l\'insertion');
          
          const minimalUserData = {
            id: userId,
            email: email,
            phone: phone,
            role: role,
            created_at: new Date().toISOString()
          };
          
          logger.info("✅ Utilisateur créé dans Auth, mais pas dans table users (RLS bloqué)");
          res.status(201).json({
            success: true,
            message: "Utilisateur créé avec succès ! (Note: profil users non créé à cause de RLS)",
            data: {
              user: minimalUserData,
              profile: null,
              session: authUser.session
            }
          });
          return;
        }
        
        throw new Error(`Erreur base de données: ${dbError.message}`);
      }

      logger.info("✅ Utilisateur ajouté dans PostgreSQL !");
      logger.debug("📊 Données PostgreSQL:", userData);

    let profile = null;
      if (role === 'driver') {
        logger.info("🚗 Création automatique du profil driver...");
        profile = await createDriverProfile(userId, email, phone, firstName, lastName);
        if (profile) {
          logger.info("✅ Profil driver créé avec succès !");
        } else {
          logger.warn("⚠️ Échec création profil driver (non bloquant)");
        }
      }

      // Créer les méthodes de paiement par défaut (cash et deferred)
      try {
        await createDefaultPaymentMethods(userId);
        logger.debug("✅ Méthodes de paiement par défaut créées");
      } catch (paymentMethodError: any) {
        // Ne pas bloquer l'inscription si la création des méthodes de paiement échoue
        logger.warn("⚠️ Échec création méthodes de paiement par défaut (non bloquant):", paymentMethodError.message);
      }
    
      res.status(201).json({
        success: true,
        message: "Utilisateur créé avec succès !",
        data: {
          user: userData,
          profile: profile,
          session: authUser.session
        }
      });

    } catch (dbError: any) {
      logger.error("❌ Erreur base de données:", dbError);
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'ajout en base de données",
        error: dbError.message
      });
    }

  } catch (error: any) {
    logger.error("❌ Erreur générale:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'inscription",
      error: error.message
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
      logger.error("❌ Erreur Supabase:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la vérification",
        error: error.message
      });
      return;
    }

    if (users && users.length > 0) {
      res.json({
        success: true,
        message: "Utilisateur trouvé dans PostgreSQL",
        user: users[0]
      });
    } else {
      res.json({
        success: false,
        message: "Utilisateur non trouvé dans PostgreSQL",
        user: null
      });
    }

  } catch (error: any) {
    logger.error("❌ Erreur vérification:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la vérification",
      error: error.message
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

      logger.info(`📊 ${result.rows.length} utilisateurs trouvés dans PostgreSQL`);

      res.json({
        success: true,
        message: `${result.rows.length} utilisateurs trouvés`,
        users: result.rows
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    logger.error("❌ Erreur liste utilisateurs:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des utilisateurs",
      error: error.message
    });
  }
};


const loginUserWithPostgreSQL = async (
  req: RequestWithBruteForce<LoginBody>,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // 🔒 SÉCURITÉ: Masquer l'email dans les logs
    logger.info(`🔐 Connexion utilisateur : ${maskEmail(email)}`);


    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
      return;
    }


    logger.info("⏳ Connexion Supabase Auth...");
    const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (authError) {
      // 🔒 SÉCURITÉ: Enregistrer la tentative échouée (protection force brute)
      if (req.recordFailedAttempt) {
        req.recordFailedAttempt();
      }
      
      logger.error("❌ Erreur Supabase Auth:", authError.message);
      res.status(400).json({
        success: false,
        message: `Erreur connexion : ${authError.message}`
      });
      return;
    }

    logger.info("✅ Connexion Supabase réussie ! ID:", authUser.user.id);


    logger.info("⏳ Récupération données PostgreSQL...");
    
    const client = await pool.connect();
    try {
  
      const userQuery = `SELECT * FROM users WHERE id = $1`;
      const userResult = await (client.query(userQuery, [authUser.user.id]) as any);

      if (userResult.rows.length === 0) {
        logger.warn("❌ Utilisateur pas trouvé dans PostgreSQL");
        res.status(404).json({
          success: false,
          message: "Utilisateur non trouvé dans la base de données"
        });
        return;
      }

      const user = userResult.rows[0];
      logger.info("✅ Utilisateur trouvé dans PostgreSQL !");

      // 🔒 SÉCURITÉ: Réinitialiser les tentatives après succès
      if (req.resetAttempts) {
        req.resetAttempts();
      }
      
      // Générer les tokens JWT (access + refresh)
      const { accessToken, refreshToken } = generateTokens(user);

      res.json({
        success: true,
        message: "Connexion réussie !",
        data: {
          user: user,
          tokens: {
            accessToken,
            refreshToken
          }
        }
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    logger.error("❌ Erreur générale:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la connexion",
      error: error.message
    });
  }
};


const sendOTPCode = async (
  req: Request<{}, {}, SendOTPBody>,
  res: Response
): Promise<void> => {
  try {
    const { email, phone, otpMethod = 'email', role = 'client' } = req.body;

    // 🔒 SÉCURITÉ: Masquer l'email dans les logs
    logger.info(`📲 Envoi OTP pour ${maskEmail(email)} via ${otpMethod} avec rôle ${role}`);


    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Stocker le code OTP dans PostgreSQL (au lieu de Map)
    await storeOTP(email, phone || '', role, otpCode);

    if (otpMethod === 'email') {
  
      // 🔒 SÉCURITÉ: Ne jamais logger le code OTP complet
      logger.info(`📧 Code OTP envoyé par email à ${maskEmail(email)}`);
      
      const emailResult = await sendOTPEmail(email, otpCode, role);
      
      if (!emailResult.success) {
        logger.error('❌ Échec envoi email:', emailResult.error);
        logger.info(`
          ========================================
          📧 FALLBACK EMAIL OTP pour ${role.toUpperCase()}
          ========================================
          À: ${email}
          Sujet: Code de vérification ${role}
          
          Votre code de vérification est: ${otpCode}
          
          Ce code expire dans 5 minutes.
          ========================================
        `);
      } else {
        logger.info('✅ Email OTP envoyé avec succès !');
      }
      
    } else if (otpMethod === 'sms') {
      // 📱 Envoi par SMS
      logger.info(`📱 Code OTP ${otpCode} envoyé par SMS au ${phone}`);
      
      const smsResult = await sendOTPSMS(phone || '', otpCode, role);
      
      if (!smsResult.success) {
        logger.error('❌ Échec envoi SMS:', smsResult.error);
      } else {
        logger.info('✅ SMS OTP envoyé avec succès !');
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
  
        debug_code: process.env.NODE_ENV === 'development' ? otpCode : undefined
      }
    });

  } catch (error: any) {
    logger.error("❌ Erreur envoi OTP:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi du code OTP",
      error: error.message
    });
  }
};

const verifyOTPCode = async (
  req: RequestWithBruteForce<VerifyOTPBody>,
  res: Response
): Promise<void> => {
  try {
    const { email, phone, otp, method, role = 'client' } = req.body;

    // 🔒 SÉCURITÉ: Ne jamais logger le code OTP
    logger.info(`✅ Vérification OTP pour ${maskEmail(email)}`);

    // Vérifier le code OTP dans PostgreSQL
    const isValid = await verifyOTP(email, phone || '', role, otp);

    if (!isValid) {
      // 🔒 SÉCURITÉ: Enregistrer la tentative échouée (protection force brute)
      if (req.recordFailedAttempt) {
        req.recordFailedAttempt();
      }
      
      res.status(400).json({
        success: false,
        message: "Code OTP incorrect ou expiré"
      });
      return;
    }
    
    // 🔒 SÉCURITÉ: Réinitialiser les tentatives après succès
    if (req.resetAttempts) {
      req.resetAttempts();
    }

    logger.info("✅ Code OTP valide !");

    // Vérifier si l'utilisateur existe déjà dans PostgreSQL
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (checkError) {
      logger.error("❌ Erreur vérification utilisateur:", checkError);
    }

    let userData: any;
    let isNewUser = false;

    if (existingUsers && existingUsers.length > 0) {
      // 🔍 Utilisateur existant - connexion
      logger.info("👤 Utilisateur existant trouvé dans PostgreSQL !");
      userData = existingUsers[0];
    } else {
      // 🆕 Nouvel utilisateur - vérifier d'abord dans Supabase Auth
      logger.info("🔍 Vérification dans Supabase Auth...");
      
      // Essayer de récupérer l'utilisateur depuis Supabase Auth par email
      // Ne fonctionne que si service role key est disponible
      let existingAuthUser: any = null;
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { data: authUsers, error: authListError } = await supabase.auth.admin.listUsers();
        if (authListError) {
          logger.warn("⚠️ Impossible de lister les utilisateurs Auth (nécessite service role key):", authListError.message);
        } else if (authUsers?.users) {
          existingAuthUser = authUsers.users.find((user: any) => user.email === email);
        }
      } else {
        logger.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY non défini, impossible de vérifier si l'utilisateur existe dans Supabase Auth");
      }
      
      if (existingAuthUser) {
        // L'utilisateur existe dans Supabase Auth mais pas dans PostgreSQL
        logger.info("👤 Utilisateur trouvé dans Supabase Auth, synchronisation vers PostgreSQL...");
        
        // Créer dans PostgreSQL avec l'ID existant
        // Utiliser supabaseAdmin si disponible pour bypasser RLS, sinon supabase
        const clientForInsert = supabaseAdmin || supabase;
        
        if (!supabaseAdmin) {
          logger.warn('⚠️ supabaseAdmin non disponible (SUPABASE_SERVICE_ROLE_KEY manquant), insertion dans users peut échouer à cause de RLS');
        }
        
        const { data: newUser, error: insertError } = await clientForInsert
          .from('users')
          .insert([{
            id: existingAuthUser.id,  // ✅ Utiliser directement l'ID de Supabase Auth
            email: email,
            phone: phone,
            role: role,
            created_at: existingAuthUser.created_at || new Date().toISOString()
          }])
          .select()
          .single();

        if (insertError) {
          logger.error("❌ Erreur synchronisation PostgreSQL:", insertError);
          
          // Si l'erreur est due à RLS et qu'on n'a pas de service role key, utiliser les données Auth
          if (insertError.code === '42501' && !supabaseAdmin) {
            logger.warn('⚠️ Synchronisation users échouée à cause de RLS (SUPABASE_SERVICE_ROLE_KEY manquant), utilisation des données Auth');
            userData = {
              id: existingAuthUser.id,
              email: email,
              phone: phone,
              role: role,
              created_at: existingAuthUser.created_at || new Date().toISOString()
            };
          } else {
            res.status(500).json({
              success: false,
              message: "Erreur lors de la synchronisation du profil utilisateur",
              error: insertError.message
            });
            return;
          }
        } else {
          userData = newUser;
        }
        
        // Créer automatiquement un profil driver si le rôle est 'driver'
        if (role === 'driver' && userData && userData.id) {
          logger.info("🚗 Création automatique du profil driver pour utilisateur synchronisé...");
          const driverProfile = await createDriverProfile(
            userData.id,
            email,
            phone,
            null,
            null
          );
          if (driverProfile) {
            logger.info("✅ Profil driver créé avec succès !");
          } else {
            logger.warn("⚠️ Échec création profil driver (non bloquant)");
          }
        }
        
        logger.info("✅ Utilisateur synchronisé avec succès !");
        
      } else {
        // Vraiment nouvel utilisateur - créer dans Supabase Auth puis PostgreSQL
        logger.info("🆕 Création nouvel utilisateur complet...");
        isNewUser = true;

        // Créer dans Supabase Auth d'abord
        const tempPassword = Math.random().toString(36).slice(-12);
        
        // Essayer d'abord avec admin API si service role key disponible
        let authUser: any, authError: any;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          // Utiliser admin.createUser pour créer un utilisateur confirmé directement
          const result = await supabase.auth.admin.createUser({
            email: email,
            password: tempPassword,
            email_confirm: true, // Confirmer l'email automatiquement
            user_metadata: {
              role: role,
              phone: phone
            }
          });
          authUser = result.data;
          authError = result.error;
        } else {
          // Fallback vers signUp si service role key non disponible
          logger.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY non défini, utilisation de signUp() (nécessite confirmation email)");
          const result = await supabase.auth.signUp({
            email: email,
            password: tempPassword,
            options: {
              data: {
                role: role,
                phone: phone
              }
            }
          });
          authUser = result.data;
          authError = result.error;
        }

        if (authError) {
          logger.error("❌ Erreur création Supabase Auth:", authError);
          
          // Messages d'erreur plus clairs
          let errorMessage = authError.message;
          if (authError.message.includes('not allowed') || authError.code === 'not_admin') {
            errorMessage = 'Création de compte non autorisée. Vérifiez la configuration Supabase (inscriptions activées et service role key configurée).';
          } else if (authError.message.includes('already registered')) {
            errorMessage = 'Cet email est déjà utilisé.';
          }
          
          res.status(400).json({
            success: false,
            message: "Erreur lors de la création du compte",
            error: errorMessage
          });
          return;
        }

        // admin.createUser retourne { data: { user } } au lieu de { data: { user } }
        const userId = authUser?.user?.id || authUser?.id;
        if (!userId) {
          logger.error("❌ Erreur: utilisateur créé mais ID introuvable");
          res.status(500).json({
            success: false,
            message: "Erreur lors de la création du compte",
            error: "ID utilisateur introuvable"
          });
          return;
        }

        // 🔒 SÉCURITÉ: Masquer userId
        logger.info("✅ Utilisateur créé dans Supabase Auth avec ID:", maskUserId(userId));
        
        // Créer dans PostgreSQL avec l'ID du nouvel utilisateur Auth
        // Utiliser supabaseAdmin si disponible pour bypasser RLS, sinon supabase
        const clientForInsert = supabaseAdmin || supabase;
        
        if (!supabaseAdmin) {
          logger.warn('⚠️ supabaseAdmin non disponible (SUPABASE_SERVICE_ROLE_KEY manquant), insertion dans users peut échouer à cause de RLS');
        }
        
        const { data: newUser, error: insertError } = await clientForInsert
          .from('users')
          .insert([{
            id: userId,
            email: email,
            phone: phone,
            role: role,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (insertError) {
          logger.error("❌ Erreur insertion PostgreSQL:", insertError);
          
          // Si l'erreur est due à RLS et qu'on n'a pas de service role key, continuer quand même
          // L'utilisateur existe dans Auth, on pourra le synchroniser plus tard
          if (insertError.code === '42501' && !supabaseAdmin) {
            logger.warn('⚠️ Insertion users échouée à cause de RLS (SUPABASE_SERVICE_ROLE_KEY manquant), mais utilisateur créé dans Auth');
            logger.warn('💡 Solution: Ajouter SUPABASE_SERVICE_ROLE_KEY dans .env ou créer une politique RLS qui permet l\'insertion');
            
            // Créer un utilisateur minimal pour continuer
            userData = {
              id: userId,
              email: email,
              phone: phone,
              role: role,
              created_at: new Date().toISOString()
            };
          } else {
            res.status(500).json({
              success: false,
              message: "Erreur lors de la création du profil utilisateur",
              error: insertError.message
            });
            return;
          }
        } else {
          userData = newUser;
        }

        // Créer automatiquement un profil driver si le rôle est 'driver'
        if (role === 'driver' && userData && userData.id) {
          logger.info("🚗 Création automatique du profil driver...");
          const driverProfile = await createDriverProfile(
            userData.id,
            email,
            phone,
            null, // firstName non disponible dans verifyOTPCode
            null  // lastName non disponible dans verifyOTPCode
          );
          if (driverProfile) {
            logger.info("✅ Profil driver créé avec succès !");
          } else {
            logger.warn("⚠️ Échec création profil driver (non bloquant)");
          }
        }

        // Créer les méthodes de paiement par défaut (cash et deferred)
        if (userData && userData.id) {
          try {
            await createDefaultPaymentMethods(userData.id);
            logger.debug("✅ Méthodes de paiement par défaut créées");
          } catch (paymentMethodError: any) {
            // Ne pas bloquer l'inscription si la création des méthodes de paiement échoue
            logger.warn("⚠️ Échec création méthodes de paiement par défaut (non bloquant):", paymentMethodError.message);
          }
        }

        logger.info("✅ Nouvel utilisateur créé avec succès !");
      }
    }

    // Note: Le code OTP est automatiquement supprimé lors de la vérification (dans verifyOTP)

    // Vérifier que userData est défini avant de générer les tokens
    if (!userData || !userData.id) {
      logger.error("❌ Erreur: userData non défini ou invalide");
      res.status(500).json({
        success: false,
        message: "Erreur lors de la création du profil utilisateur",
        error: "Données utilisateur invalides"
      });
      return;
    }

    // Générer les tokens JWT
    const { accessToken, refreshToken } = generateTokens(userData);

    res.json({
      success: true,
      message: isNewUser ? "Compte créé avec succès !" : "Connexion réussie !",
      data: {
        user: userData,
        tokens: {
          accessToken,
          refreshToken
        },
        isNewUser
      }
    });

  } catch (error: any) {
    logger.error("❌ Erreur vérification OTP:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la vérification",
      error: error.message
    });
  }
};

/**
 * Rafraîchir un token d'accès à partir d'un refresh token
 */
const refreshToken = async (
  req: Request<{}, {}, RefreshTokenBody>,
  res: Response
): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Refresh token requis'
      });
      return;
    }

    try {
      const { accessToken } = await refreshAccessToken(token);

      res.json({
        success: true,
        message: 'Token rafraîchi avec succès',
        data: {
          accessToken
        }
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Refresh token invalide ou expiré'
      });
      return;
    }
  } catch (error: any) {
    logger.error("❌ Erreur refresh token:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors du rafraîchissement du token",
      error: error.message
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
  refreshToken
};
