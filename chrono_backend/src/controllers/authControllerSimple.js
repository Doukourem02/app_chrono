// ✅ SOLUTION SIMPLE : Synchroniser Supabase Auth avec votre table PostgreSQL
// Ce fichier fait une seule chose : quand un utilisateur s'inscrit via Supabase,
// il l'ajoute AUSSI dans votre table PostgreSQL users

import { supabase } from '../config/supabase.js';
// Utilisons Supabase comme client PostgreSQL direct
import pkg from 'pg';
const { Client } = pkg;

// 🔄 Stockage temporaire des codes OTP (en production, utilisez Redis)
const otpStorage = new Map();

// 📧 Service d'envoi d'emails
import { sendOTPEmail, sendOTPSMS } from '../services/emailService.js';

/**
 * 🎯 FONCTION PRINCIPALE : Inscription utilisateur
 * 
 * QUE FAIT CETTE FONCTION :
 * 1. L'utilisateur s'inscrit normalement via Supabase Auth
 * 2. On ajoute CET UTILISATEUR dans votre table PostgreSQL users
 * 3. Maintenant il existe dans les DEUX endroits !
 */
const registerUserWithPostgreSQL = async (req, res) => {
  try {
    const { email, password, phone, role = 'client', firstName, lastName } = req.body;

    console.log(`📝 Inscription utilisateur : ${email} avec rôle ${role}`);

    // ✅ ÉTAPE 1 : Inscription normale Supabase Auth
    // ✅ ÉTAPE 1 : Création utilisateur avec l'API publique Supabase
    console.log("⏳ Création compte Supabase Auth...");
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password || Math.random().toString(36).slice(-8), // Mot de passe temporaire si non fourni
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
      
      // Messages d'erreur plus spécifiques
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

    // ✅ ÉTAPE 2 : Ajouter dans VOTRE table PostgreSQL users via Supabase
    console.log("⏳ Ajout dans votre table PostgreSQL users...");
    
    try {
      // Utiliser Supabase PostgreSQL directement (plus simple)
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

      // Créer un profil de base si c'est un driver (TODO: après avoir créé les tables)
      let profile = null;
      /* 
      if (role === 'driver') {
        const { data: profileData, error: profileError } = await supabase
          .from('driver_profiles')
          .insert([
            {
              user_id: authUser.user.id,
              first_name: firstName || '',
              last_name: lastName || '',
              is_online: false,
              is_available: false,
              total_deliveries: 0,
              rating: 0.0,
              total_earnings: 0.0
            }
          ])
          .select()
          .single();

        if (profileError) {
          console.log("⚠️ Erreur création profil driver (non bloquant):", profileError);
        } else {
          profile = profileData;
          console.log("✅ Profil driver créé !");
        }
      }
      */

      // ✅ SUCCÈS ! L'utilisateur existe maintenant dans les DEUX endroits
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

/**
 * 🔍 FONCTION DE VÉRIFICATION : Voir si l'utilisateur existe dans PostgreSQL
 */
const checkUserInPostgreSQL = async (req, res) => {
  try {
    const { email } = req.params;

    console.log(`🔍 Vérification utilisateur: ${email}`);

    // Utiliser Supabase client au lieu de pool
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

/**
 * 📋 FONCTION LISTE : Voir TOUS les utilisateurs dans PostgreSQL
 */
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

/**
 * 🔐 FONCTION DE CONNEXION : Vérifier utilisateur existant
 */
const loginUserWithPostgreSQL = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log(`🔐 Connexion utilisateur : ${email}`);

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    // ✅ ÉTAPE 1 : Connexion Supabase Auth
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

    // ✅ ÉTAPE 2 : Récupérer les données PostgreSQL
    console.log("⏳ Récupération données PostgreSQL...");
    
    const client = await pool.connect();
    try {
      // Récupérer dans VOTRE table users
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

      // ✅ SUCCÈS ! L'utilisateur existe dans les DEUX endroits
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

/**
 * 🎯 NOUVELLE FONCTION : Envoyer code OTP
 * 
 * UTILISATION :
 * - Génère code 6 chiffres
 * - L'envoie par email ou SMS
 * - Le stocke temporairement pour vérification
 */
const sendOTPCode = async (req, res) => {
  try {
    const { email, phone, otpMethod = 'email', role = 'client' } = req.body;

    console.log(`📲 Envoi OTP pour ${email} via ${otpMethod} avec rôle ${role}`);

    // Générer code OTP à 6 chiffres
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Stocker le code temporairement (5 minutes)
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

    // Nettoyer automatiquement après 5 minutes
    setTimeout(() => {
      otpStorage.delete(otpKey);
    }, 5 * 60 * 1000);

    if (otpMethod === 'email') {
      // 📧 Envoi par email RÉEL avec Gmail
      console.log(`📧 Code OTP ${otpCode} envoyé par email à ${email}`);
      
      const emailResult = await sendOTPEmail(email, otpCode, role);
      
      if (!emailResult.success) {
        console.error('❌ Échec envoi email:', emailResult.error);
        // Fallback vers console si email échoue
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
        // Ne jamais renvoyer le code en production !
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

/**
 * 🎯 NOUVELLE FONCTION : Vérifier code OTP et créer/connecter utilisateur
 * 
 * UTILISATION :
 * - Vérifie le code OTP
 * - Si code correct et utilisateur n'existe pas : création automatique
 * - Si code correct et utilisateur existe : connexion
 * - Retourne données utilisateur + session
 */
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

    // Vérifier si l'utilisateur existe déjà
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
      console.log("👤 Utilisateur existant trouvé !");
      userData = existingUsers[0];
    } else {
      // 🆕 Nouvel utilisateur - création automatique
      console.log("🆕 Création nouvel utilisateur...");
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

      // Créer dans PostgreSQL
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