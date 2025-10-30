import { supabase } from '../config/supabase.js';
import pkg from 'pg';
const { Client } = pkg;


const otpStorage = new Map();


import { sendOTPEmail, sendOTPSMS } from '../services/emailService.js';


const registerUserWithPostgreSQL = async (req, res) => {
  try {
    const { email, password, phone, role = 'client', firstName, lastName } = req.body;

    console.log(`📝 Inscription utilisateur : ${email} avec rôle ${role}`);


    console.log("⏳ Création compte Supabase Auth...");
    const { data: authUser, error: authError } = await supabase.auth.signUp({
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
    if (authError) {
      console.log("❌ Erreur Supabase Auth:", authError);
      console.log("🔍 Détails erreur:", JSON.stringify(authError, null, 2));
      

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

    console.log("✅ Compte Supabase créé ! ID:", authUser.user.id);

  
    console.log("⏳ Ajout dans votre table PostgreSQL users...");
    
    try {
    
      const { data: userData, error: dbError } = await supabase
        .from('users')
        .insert([
          {
            id: authUser.user.id,
            email: email,
            phone: phone,
            role: role,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (dbError) {
        console.log("❌ Erreur PostgreSQL via Supabase:", dbError);
        throw new Error(`Erreur base de données: ${dbError.message}`);
      }

      console.log("✅ Utilisateur ajouté dans PostgreSQL !");
      console.log("📊 Données PostgreSQL:", userData);

      let profile = null;
    
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
      console.error("❌ Erreur base de données:", dbError);
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'ajout en base de données",
        error: dbError.message
      });
    }

  } catch (error) {
    console.error("❌ Erreur générale:", error);
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

    console.log(`🔍 Vérification utilisateur: ${email}`);


    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (error) {
      console.error("❌ Erreur Supabase:", error);
      return res.status(500).json({
        success: false,
        message: "Erreur lors de la vérification",
        error: error.message
      });
    }

    if (users && users.length > 0) {
      console.log("✅ Utilisateur trouvé dans PostgreSQL !");
      res.json({
        success: true,
        message: "Utilisateur trouvé dans PostgreSQL",
        user: users[0]
      });
    } else {
      console.log("❌ Utilisateur PAS trouvé dans PostgreSQL");
      res.json({
        success: false,
        message: "Utilisateur non trouvé dans PostgreSQL",
        user: null
      });
    }

  } catch (error) {
    console.error("❌ Erreur vérification:", error);
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

      console.log(`📊 ${result.rows.length} utilisateurs trouvés dans PostgreSQL`);

      res.json({
        success: true,
        message: `${result.rows.length} utilisateurs trouvés`,
        users: result.rows
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error("❌ Erreur liste utilisateurs:", error);
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

    console.log(`🔐 Connexion utilisateur : ${email}`);


    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }


    console.log("⏳ Connexion Supabase Auth...");
    const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (authError) {
      console.log("❌ Erreur Supabase Auth:", authError.message);
      return res.status(400).json({
        success: false,
        message: `Erreur connexion : ${authError.message}`
      });
    }

    console.log("✅ Connexion Supabase réussie ! ID:", authUser.user.id);


    console.log("⏳ Récupération données PostgreSQL...");
    
    const client = await pool.connect();
    try {
  
      const userQuery = `SELECT * FROM users WHERE id = $1`;
      const userResult = await client.query(userQuery, [authUser.user.id]);

      if (userResult.rows.length === 0) {
        console.log("❌ Utilisateur pas trouvé dans PostgreSQL");
        return res.status(404).json({
          success: false,
          message: "Utilisateur non trouvé dans la base de données"
        });
      }

      const user = userResult.rows[0];
      console.log("✅ Utilisateur trouvé dans PostgreSQL !");


      res.json({
        success: true,
        message: "Connexion réussie !",
        data: {
          user: user,
          session: authUser.session
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error("❌ Erreur générale:", error);
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

    console.log(`📲 Envoi OTP pour ${email} via ${otpMethod} avec rôle ${role}`);


    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    

    const otpKey = `${email}_${phone}_${role}`;
    otpStorage.set(otpKey, {
      code: otpCode,
      email,
      phone,
      role,
      method: otpMethod,
      createdAt: new Date(),
      verified: false
    });


    setTimeout(() => {
      otpStorage.delete(otpKey);
    }, 5 * 60 * 1000);

    if (otpMethod === 'email') {
  
      console.log(`📧 Code OTP ${otpCode} envoyé par email à ${email}`);
      
      const emailResult = await sendOTPEmail(email, otpCode, role);
      
      if (!emailResult.success) {
        console.error('❌ Échec envoi email:', emailResult.error);
        console.log(`
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
        console.log('✅ Email OTP envoyé avec succès !');
      }
      
    } else if (otpMethod === 'sms') {
      // 📱 Envoi par SMS
      console.log(`📱 Code OTP ${otpCode} envoyé par SMS au ${phone}`);
      
      const smsResult = await sendOTPSMS(phone, otpCode, role);
      
      if (!smsResult.success) {
        console.error('❌ Échec envoi SMS:', smsResult.error);
      } else {
        console.log('✅ SMS OTP envoyé avec succès !');
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
    console.error("❌ Erreur envoi OTP:", error);
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

    console.log(`✅ Vérification OTP pour ${email} avec code ${otp}`);

    // Vérifier le code OTP
    const otpKey = `${email}_${phone}_${role}`;
    const storedOTP = otpStorage.get(otpKey);

    if (!storedOTP) {
      return res.status(400).json({
        success: false,
        message: "Code OTP non trouvé ou expiré"
      });
    }

    if (storedOTP.code !== otp) {
      return res.status(400).json({
        success: false,
        message: "Code OTP incorrect"
      });
    }

    // Vérifier expiration (5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (storedOTP.createdAt < fiveMinutesAgo) {
      otpStorage.delete(otpKey);
      return res.status(400).json({
        success: false,
        message: "Code OTP expiré"
      });
    }

    console.log("✅ Code OTP valide !");

    // Marquer comme vérifié
    storedOTP.verified = true;
    otpStorage.set(otpKey, storedOTP);

    // Vérifier si l'utilisateur existe déjà dans PostgreSQL
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (checkError) {
      console.error("❌ Erreur vérification utilisateur:", checkError);
    }

    let userData;
    let isNewUser = false;

    if (existingUsers && existingUsers.length > 0) {
      // 🔍 Utilisateur existant - connexion
      console.log("👤 Utilisateur existant trouvé dans PostgreSQL !");
      userData = existingUsers[0];
    } else {
      // 🆕 Nouvel utilisateur - vérifier d'abord dans Supabase Auth
      console.log("🔍 Vérification dans Supabase Auth...");
      
      // Essayer de récupérer l'utilisateur depuis Supabase Auth par email
      const { data: authUsers, error: authListError } = await supabase.auth.admin.listUsers();
      
      let existingAuthUser = null;
      if (authUsers?.users) {
        existingAuthUser = authUsers.users.find(user => user.email === email);
      }
      
      if (existingAuthUser) {
        // L'utilisateur existe dans Supabase Auth mais pas dans PostgreSQL
        console.log("👤 Utilisateur trouvé dans Supabase Auth, synchronisation vers PostgreSQL...");
        
        // Créer dans PostgreSQL avec l'ID existant
        const { data: newUser, error: insertError } = await supabase
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
          console.error("❌ Erreur synchronisation PostgreSQL:", insertError);
          return res.status(500).json({
            success: false,
            message: "Erreur lors de la synchronisation du profil utilisateur",
            error: insertError.message
          });
        }

        userData = newUser;
        console.log("✅ Utilisateur synchronisé avec succès !");
        
      } else {
        // Vraiment nouvel utilisateur - créer dans Supabase Auth puis PostgreSQL
        console.log("🆕 Création nouvel utilisateur complet...");
        isNewUser = true;

        // Créer dans Supabase Auth d'abord
        const tempPassword = Math.random().toString(36).slice(-12);
        const { data: authUser, error: authError } = await supabase.auth.signUp({
          email: email,
          password: tempPassword,
          options: {
            data: {
              role: role,
              phone: phone
            }
          }
        });

        if (authError) {
          console.error("❌ Erreur création Supabase Auth:", authError);
          return res.status(400).json({
            success: false,
            message: "Erreur lors de la création du compte",
            error: authError.message
          });
        }

        console.log("✅ Utilisateur créé dans Supabase Auth avec ID:", authUser.user.id);
        
        // Créer dans PostgreSQL avec l'ID du nouvel utilisateur Auth
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([{
            id: authUser.user.id,
            email: email,
            phone: phone,
            role: role,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (insertError) {
          console.error("❌ Erreur insertion PostgreSQL:", insertError);
          return res.status(500).json({
            success: false,
            message: "Erreur lors de la création du profil utilisateur",
            error: insertError.message
          });
        }

        userData = newUser;
        console.log("✅ Nouvel utilisateur créé avec succès !");
      }
    }

    // Nettoyer le code OTP utilisé
    otpStorage.delete(otpKey);

    // Créer une session Supabase si c'est un nouvel utilisateur
    let sessionData = null;
    if (!isNewUser) {
      // Pour un utilisateur existant, on peut créer une session
      const { data: sessionResult, error: sessionError } = await supabase.auth.signInWithPassword({
        email: email,
        password: 'otp-verified-session' // Placeholder, à améliorer
      });
      
      if (!sessionError) {
        sessionData = sessionResult.session;
      }
    }

    res.json({
      success: true,
      message: isNewUser ? "Compte créé avec succès !" : "Connexion réussie !",
      data: {
        user: userData,
        session: sessionData,
        isNewUser
      }
    });

  } catch (error) {
    console.error("❌ Erreur vérification OTP:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la vérification",
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
  verifyOTPCode
};