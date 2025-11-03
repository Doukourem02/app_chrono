import { supabase, supabaseAdmin } from '../config/supabase.js';
import pool from '../config/db.js';
import { sendOTPEmail, sendOTPSMS } from '../services/emailService.js';
import { storeOTP, verifyOTP } from '../config/otpStorage.js';
import { generateTokens, refreshAccessToken } from '../utils/jwt.js';
import logger from '../utils/logger.js';

/**
 * Crée automatiquement un profil driver dans driver_profiles
 * lorsque l'utilisateur s'inscrit avec le rôle 'driver'
 */
const createDriverProfile = async (userId, email, phone, firstName, lastName) => {
  try {
    const clientForInsert = supabaseAdmin || supabase;
    
    // Vérifier si un profil driver existe déjà
    const { data: existingProfile, error: checkError } = await clientForInsert
      .from('driver_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (existingProfile) {
      logger.info(`✅ Profil driver déjà existant pour user ${userId}`);
      return existingProfile;
    }
    
    // Créer le profil driver
    const { data: driverProfile, error: insertError } = await clientForInsert
      .from('driver_profiles')
      .insert([{
        user_id: userId,
        email: email,
        phone: phone || null,
        first_name: firstName || null,
        last_name: lastName || null,
        vehicle_type: 'moto', // Valeur par défaut
        is_online: false,
        is_available: true,
        rating: 5.0, // Note par défaut
        total_deliveries: 0
      }])
      .select()
      .single();
    
    if (insertError) {
      logger.error(`❌ Erreur création profil driver pour ${userId}:`, insertError);
      // Ne pas bloquer l'inscription si la création du profil échoue
      // Le profil pourra être créé plus tard
      return null;
    }
    
    logger.info(`✅ Profil driver créé avec succès pour user ${userId}`);
    return driverProfile;
  } catch (error) {
    logger.error(`❌ Erreur création profil driver pour ${userId}:`, error);
    // Ne pas bloquer l'inscription
    return null;
  }
};


const registerUserWithPostgreSQL = async (req, res) => {
  try {
    const { email, password, phone, role = 'client', firstName, lastName } = req.body;

    logger.info(`📝 Inscription utilisateur : ${email} avec rôle ${role}`);


    logger.info("⏳ Création compte Supabase Auth...");
    // Essayer d'abord avec admin API si service role key disponible
    let authUser, authError;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Utiliser admin.createUser pour créer un utilisateur confirmé directement
      const result = await supabase.auth.admin.createUser({
        email: email,
        password: password || Math.random().toString(36).slice(-8),
        email_confirm: true, // Confirmer l'email automatiquement
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
      // Fallback vers signUp si service role key non disponible
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
      
      return res.status(400).json({
        success: false,
        message: errorMessage,
        details: authError
      });
    }

    // admin.createUser retourne { data: { user } }
    const userId = authUser?.user?.id || authUser?.id;
    if (!userId) {
      logger.error("❌ Erreur: utilisateur créé mais ID introuvable");
      return res.status(500).json({
        success: false,
        message: "Erreur lors de la création du compte",
        error: "ID utilisateur introuvable"
      });
    }

    logger.info("✅ Compte Supabase créé ! ID:", userId);

  
    logger.info("⏳ Ajout dans votre table PostgreSQL users...");
    
    try {
      // Utiliser supabaseAdmin si disponible pour bypasser RLS, sinon supabase
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
        
        // Si l'erreur est due à RLS et qu'on n'a pas de service role key, créer un utilisateur minimal
        if (dbError.code === '42501' && !supabaseAdmin) {
          logger.warn('⚠️ Insertion users échouée à cause de RLS (SUPABASE_SERVICE_ROLE_KEY manquant)');
          logger.warn('💡 Solution: Ajouter SUPABASE_SERVICE_ROLE_KEY dans .env ou créer une politique RLS qui permet l\'insertion');
          
          // Utiliser les données de base pour continuer
          const minimalUserData = {
            id: userId,
            email: email,
            phone: phone,
            role: role,
            created_at: new Date().toISOString()
          };
          
          // Continuer avec les données minimales au lieu de throw
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

      // Créer automatiquement un profil driver si le rôle est 'driver'
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
    
      res.status(201).json({
        success: true,
        message: "Utilisateur créé avec succès !",
        data: {
          user: userData,
          profile: profile,
          session: authUser.session
        }
      });

    } catch (dbError) {
      logger.error("❌ Erreur base de données:", dbError);
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'ajout en base de données",
        error: dbError.message
      });
    }

  } catch (error) {
    logger.error("❌ Erreur générale:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'inscription",
      error: error.message
    });
  }
};


const checkUserInPostgreSQL = async (req, res) => {
  try {
    const { email } = req.params;

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (error) {
      logger.error("❌ Erreur Supabase:", error);
      return res.status(500).json({
        success: false,
        message: "Erreur lors de la vérification",
        error: error.message
      });
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

  } catch (error) {
    logger.error("❌ Erreur vérification:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la vérification",
      error: error.message
    });
  }
};


const getAllUsersFromPostgreSQL = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const query = `SELECT id, email, phone, role, created_at FROM users ORDER BY created_at DESC`;
      const result = await client.query(query);

      logger.info(`📊 ${result.rows.length} utilisateurs trouvés dans PostgreSQL`);

      res.json({
        success: true,
        message: `${result.rows.length} utilisateurs trouvés`,
        users: result.rows
      });

    } finally {
      client.release();
    }

  } catch (error) {
    logger.error("❌ Erreur liste utilisateurs:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des utilisateurs",
      error: error.message
    });
  }
};


const loginUserWithPostgreSQL = async (req, res) => {
  try {
    const { email, password } = req.body;

    logger.info(`🔐 Connexion utilisateur : ${email}`);


    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }


    logger.info("⏳ Connexion Supabase Auth...");
    const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (authError) {
      logger.error("❌ Erreur Supabase Auth:", authError.message);
      return res.status(400).json({
        success: false,
        message: `Erreur connexion : ${authError.message}`
      });
    }

    logger.info("✅ Connexion Supabase réussie ! ID:", authUser.user.id);


    logger.info("⏳ Récupération données PostgreSQL...");
    
    const client = await pool.connect();
    try {
  
      const userQuery = `SELECT * FROM users WHERE id = $1`;
      const userResult = await client.query(userQuery, [authUser.user.id]);

      if (userResult.rows.length === 0) {
        logger.warn("❌ Utilisateur pas trouvé dans PostgreSQL");
        return res.status(404).json({
          success: false,
          message: "Utilisateur non trouvé dans la base de données"
        });
      }

      const user = userResult.rows[0];
      logger.info("✅ Utilisateur trouvé dans PostgreSQL !");

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

  } catch (error) {
    logger.error("❌ Erreur générale:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la connexion",
      error: error.message
    });
  }
};


const sendOTPCode = async (req, res) => {
  try {
    const { email, phone, otpMethod = 'email', role = 'client' } = req.body;

    logger.info(`📲 Envoi OTP pour ${email} via ${otpMethod} avec rôle ${role}`);


    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Stocker le code OTP dans PostgreSQL (au lieu de Map)
    await storeOTP(email, phone, role, otpCode);

    if (otpMethod === 'email') {
  
      logger.info(`📧 Code OTP ${otpCode} envoyé par email à ${email}`);
      
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
      
      const smsResult = await sendOTPSMS(phone, otpCode, role);
      
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

  } catch (error) {
    logger.error("❌ Erreur envoi OTP:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi du code OTP",
      error: error.message
    });
  }
};

const verifyOTPCode = async (req, res) => {
  try {
    const { email, phone, otp, method, role = 'client' } = req.body;

    logger.info(`✅ Vérification OTP pour ${email} avec code ${otp}`);

    // Vérifier le code OTP dans PostgreSQL
    const isValid = await verifyOTP(email, phone, role, otp);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Code OTP incorrect ou expiré"
      });
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

    let userData;
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
      let existingAuthUser = null;
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { data: authUsers, error: authListError } = await supabase.auth.admin.listUsers();
        if (authListError) {
          logger.warn("⚠️ Impossible de lister les utilisateurs Auth (nécessite service role key):", authListError.message);
        } else if (authUsers?.users) {
          existingAuthUser = authUsers.users.find(user => user.email === email);
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
            return res.status(500).json({
              success: false,
              message: "Erreur lors de la synchronisation du profil utilisateur",
              error: insertError.message
            });
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
        let authUser, authError;
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
          
          return res.status(400).json({
            success: false,
            message: "Erreur lors de la création du compte",
            error: errorMessage
          });
        }

        // admin.createUser retourne { data: { user } } au lieu de { data: { user } }
        const userId = authUser?.user?.id || authUser?.id;
        if (!userId) {
          logger.error("❌ Erreur: utilisateur créé mais ID introuvable");
          return res.status(500).json({
            success: false,
            message: "Erreur lors de la création du compte",
            error: "ID utilisateur introuvable"
          });
        }

        logger.info("✅ Utilisateur créé dans Supabase Auth avec ID:", userId);
        
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
            return res.status(500).json({
              success: false,
              message: "Erreur lors de la création du profil utilisateur",
              error: insertError.message
            });
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

        logger.info("✅ Nouvel utilisateur créé avec succès !");
      }
    }

    // Note: Le code OTP est automatiquement supprimé lors de la vérification (dans verifyOTP)

    // Vérifier que userData est défini avant de générer les tokens
    if (!userData || !userData.id) {
      logger.error("❌ Erreur: userData non défini ou invalide");
      return res.status(500).json({
        success: false,
        message: "Erreur lors de la création du profil utilisateur",
        error: "Données utilisateur invalides"
      });
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

  } catch (error) {
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
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token requis'
      });
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
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: error.message || 'Refresh token invalide ou expiré'
      });
    }
  } catch (error) {
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