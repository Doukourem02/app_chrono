const { pool } = require('../config/db');
const { supabase } = require('../utils/supabase');
const { sendOTP } = require('../utils/notification');
const logger = require('../utils/logger');

// Store temporaire pour les OTP (en production, utilisez Redis)
const otpStore = new Map();

/**
 * Envoyer un OTP pour l'inscription avec rôle
 */
const sendRegistrationOTP = async (req, res) => {
  try {
    const { email, phone, role = 'client' } = req.body;

    // Validation des rôles autorisés
    const validRoles = ['client', 'driver', 'partner'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide',
        error: `Rôles autorisés: ${validRoles.join(', ')}`
      });
    }

    // Validation des données
    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email ou téléphone requis'
      });
    }

    // Déterminer la méthode de contact
    const method = email ? 'email' : 'sms';
    const contact = email || phone;

    // Vérifier si l'utilisateur existe déjà dans auth.users
    const client = await pool.connect();
    try {
      const checkQuery = `
        SELECT id, email, phone, user_role 
        FROM auth.users 
        WHERE email = $1 OR phone = $2
      `;
      const existingUser = await client.query(checkQuery, [email, phone]);
      
      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Un utilisateur avec cet email ou téléphone existe déjà'
        });
      }
    } finally {
      client.release();
    }

    // Générer et stocker l'OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = `${contact}_${role}`;
    
    otpStore.set(otpKey, {
      otp,
      email,
      phone,
      role,
      method,
      timestamp: Date.now(),
      attempts: 0
    });

    // Auto-suppression après 10 minutes
    setTimeout(() => {
      otpStore.delete(otpKey);
    }, 10 * 60 * 1000);

    // Envoyer l'OTP
    try {
      await sendOTP(contact, otp, method);
      
      logger.info(`OTP d'inscription envoyé`, { 
        contact, 
        method, 
        role,
        timestamp: new Date().toISOString() 
      });

      res.json({
        success: true,
        message: `Code de vérification envoyé par ${method === 'email' ? 'email' : 'SMS'}`,
        data: {
          contact: method === 'email' ? email : phone,
          method,
          role
        }
      });

    } catch (otpError) {
      logger.error('Erreur envoi OTP:', otpError);
      otpStore.delete(otpKey);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi du code de vérification',
        error: process.env.NODE_ENV === 'development' ? otpError.message : undefined
      });
    }

  } catch (error) {
    logger.error('Erreur sendRegistrationOTP:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'envoi de l\'OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Vérifier l'OTP et créer l'utilisateur avec profil spécialisé
 */
const verifyRegistrationOTP = async (req, res) => {
  try {
    const { email, phone, otp, role, password } = req.body;

    // Validation
    if (!otp || !role) {
      return res.status(400).json({
        success: false,
        message: 'OTP et rôle requis'
      });
    }

    const contact = email || phone;
    const otpKey = `${contact}_${role}`;
    const storedData = otpStore.get(otpKey);

    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'Code de vérification invalide ou expiré'
      });
    }

    // Vérifier l'OTP
    if (storedData.otp !== otp) {
      storedData.attempts += 1;
      if (storedData.attempts >= 3) {
        otpStore.delete(otpKey);
        return res.status(429).json({
          success: false,
          message: 'Trop de tentatives. Demandez un nouveau code.'
        });
      }
      
      return res.status(400).json({
        success: false,
        message: 'Code de vérification incorrect',
        attemptsLeft: 3 - storedData.attempts
      });
    }

    // Supprimer l'OTP du store
    otpStore.delete(otpKey);

    // Transaction pour créer l'utilisateur
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Créer l'utilisateur dans Supabase Auth
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: storedData.email,
        phone: storedData.phone,
        password: password || Math.random().toString(36).slice(-8), // Mot de passe temporaire si non fourni
        email_confirm: storedData.method === 'email',
        phone_confirm: storedData.method === 'sms',
        user_metadata: {
          role: storedData.role,
          registration_method: storedData.method
        }
      });

      if (authError) {
        throw new Error(`Erreur création utilisateur Supabase: ${authError.message}`);
      }

      // 2. Mettre à jour l'utilisateur dans auth.users avec nos données
      const updateUserQuery = `
        UPDATE auth.users 
        SET phone = $1, user_role = $2, status = 'active', phone_verified = true
        WHERE id = $3
        RETURNING id, email, phone, user_role as role, created_at
      `;
      
      const userResult = await client.query(updateUserQuery, [
        storedData.phone, 
        storedData.role, 
        authUser.user.id
      ]);

      if (userResult.rows.length === 0) {
        throw new Error('Échec de la mise à jour des données utilisateur');
      }

      const user = userResult.rows[0];

      // 3. Créer le profil spécialisé selon le rôle
      let profile = null;
      switch (storedData.role) {
        case 'client':
          profile = await createClientProfile(client, user.id);
          break;
        case 'driver':
          profile = await createDriverProfile(client, user.id);
          break;
        case 'partner':
          profile = await createPartnerProfile(client, user.id);
          break;
      }

      await client.query('COMMIT');

      logger.info('Utilisateur créé avec succès', {
        userId: user.id,
        email: user.email,
        role: user.role,
        profileId: profile?.id
      });

      res.status(201).json({
        success: true,
        message: 'Compte créé avec succès',
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            role: user.role,
            created_at: user.created_at
          },
          profile,
          token: authUser.session?.access_token
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Erreur verifyRegistrationOTP:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du compte',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Créer un profil client
 */
const createClientProfile = async (client, userId) => {
  const insertQuery = `
    INSERT INTO public.client_profiles (user_id, total_orders, rating)
    VALUES ($1, 0, 0.0)
    RETURNING id, user_id, total_orders, rating, created_at
  `;
  
  const result = await client.query(insertQuery, [userId]);
  return result.rows[0];
};

/**
 * Créer un profil chauffeur
 */
const createDriverProfile = async (client, userId) => {
  const insertQuery = `
    INSERT INTO public.driver_profiles (
      user_id, 
      first_name, 
      last_name,
      is_online, 
      is_available, 
      total_deliveries, 
      completed_deliveries, 
      cancelled_deliveries, 
      rating, 
      total_earnings
    )
    VALUES ($1, '', '', false, false, 0, 0, 0, 0.0, 0.0)
    RETURNING id, user_id, is_online, is_available, total_deliveries, rating, created_at
  `;
  
  const result = await client.query(insertQuery, [userId]);
  return result.rows[0];
};

/**
 * Créer un profil partenaire
 */
const createPartnerProfile = async (client, userId) => {
  const insertQuery = `
    INSERT INTO public.partner_profiles (
      user_id, 
      business_name, 
      business_type,
      contact_person,
      address,
      city,
      postal_code,
      total_orders, 
      rating, 
      commission_rate,
      is_verified
    )
    VALUES ($1, '', '', '', '', '', '', 0, 0.0, 10.0, false)
    RETURNING id, user_id, business_name, total_orders, rating, is_verified, created_at
  `;
  
  const result = await client.query(insertQuery, [userId]);
  return result.rows[0];
};

/**
 * Récupérer un utilisateur avec son profil
 */
const getUserWithProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const client = await pool.connect();
    try {
      // Récupérer l'utilisateur
      const userQuery = `
        SELECT id, email, phone, user_role as role, status, created_at, updated_at
        FROM auth.users 
        WHERE id = $1
      `;
      
      const userResult = await client.query(userQuery, [userId]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }
      
      const user = userResult.rows[0];
      
      // Récupérer le profil selon le rôle
      let profile = null;
      let profileQuery = '';
      
      switch (user.role) {
        case 'client':
          profileQuery = 'SELECT * FROM public.client_profiles WHERE user_id = $1';
          break;
        case 'driver':
          profileQuery = 'SELECT * FROM public.driver_profiles WHERE user_id = $1';
          break;
        case 'partner':
          profileQuery = 'SELECT * FROM public.partner_profiles WHERE user_id = $1';
          break;
      }
      
      if (profileQuery) {
        const profileResult = await client.query(profileQuery, [userId]);
        profile = profileResult.rows[0] || null;
      }
      
      res.json({
        success: true,
        data: {
          user,
          profile
        }
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Erreur getUserWithProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'utilisateur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  sendRegistrationOTP,
  verifyRegistrationOTP,
  getUserWithProfile,
  createClientProfile,
  createDriverProfile,
  createPartnerProfile
};