// src/controllers/authControllerWithDB.js
import supabase from '../config/supabase.js';
import pool from '../config/db.js';
import { sendOTP } from '../utils/notification.js';
import { logger } from '../utils/logger.js';

// Stockage temporaire des codes OTP (en production, utiliser Redis)
const otpStore = new Map();

/**
 * Générer un code OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Envoyer OTP pour inscription avec rôle
 */
export const sendRegistrationOTP = async (req, res) => {
  try {
    const { email, phone, method, role = 'client' } = req.body;

    // Validation
    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email ou téléphone requis'
      });
    }

    if (!['email', 'sms'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Méthode invalide (email ou sms)'
      });
    }

    if (!['client', 'driver', 'partner'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide (client, driver, partner)'
      });
    }

    // Vérifier si l'utilisateur existe déjà dans PostgreSQL
    const contact = method === 'email' ? email : phone;
    const checkQuery = `
      SELECT id, email, phone, role, status 
      FROM users 
      WHERE email = $1 OR phone = $2
    `;
    const existingUser = await pool.query(checkQuery, [email || null, phone || null]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Un compte existe déjà avec ces informations'
      });
    }

    // Générer et envoyer l'OTP
    const otp = generateOTP();
    const key = `registration_${contact}`;
    
    // Stocker temporairement les données d'inscription
    otpStore.set(key, {
      otp,
      email,
      phone,
      role,
      method,
      timestamp: Date.now(),
      verified: false
    });

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

    } catch (error) {
      logger.error('Erreur envoi OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi du code de vérification'
      });
    }

  } catch (error) {
    logger.error('Erreur sendRegistrationOTP:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * Vérifier OTP et créer l'utilisateur en PostgreSQL
 */
export const verifyRegistrationOTP = async (req, res) => {
  try {
    const { email, phone, otp, method, profileData = {} } = req.body;

    const contact = method === 'email' ? email : phone;
    const key = `registration_${contact}`;
    const storedData = otpStore.get(key);

    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'Code de vérification expiré ou invalide'
      });
    }

    // Vérifier le code OTP
    if (storedData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Code de vérification incorrect'
      });
    }

    // Vérifier l'expiration (10 minutes)
    if (Date.now() - storedData.timestamp > 10 * 60 * 1000) {
      otpStore.delete(key);
      return res.status(400).json({
        success: false,
        message: 'Code de vérification expiré'
      });
    }

    // Transaction PostgreSQL pour créer l'utilisateur
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Créer l'utilisateur dans Supabase Auth (optionnel pour la compatibilité)
      let authUserId = null;
      try {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: storedData.email,
          phone: storedData.phone,
          email_confirm: method === 'email',
          phone_confirm: method === 'sms',
          user_metadata: {
            role: storedData.role,
            registration_method: method
          }
        });

        if (!authError && authData?.user) {
          authUserId = authData.user.id;
        }
      } catch (authErr) {
        console.warn('Erreur Supabase Auth (non bloquante):', authErr);
      }

      // 2. Créer l'utilisateur dans PostgreSQL
      const insertUserQuery = `
        INSERT INTO users (email, phone, role, status, email_verified, phone_verified, auth_user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      
      const userResult = await client.query(insertUserQuery, [
        storedData.email,
        storedData.phone,
        storedData.role,
        'active',
        method === 'email',
        method === 'sms',
        authUserId
      ]);

      const newUser = userResult.rows[0];

      // 3. Créer le profil spécialisé selon le rôle
      let profileResult = null;
      if (storedData.role === 'client') {
        profileResult = await createClientProfile(client, newUser.id, profileData);
      } else if (storedData.role === 'driver') {
        profileResult = await createDriverProfile(client, newUser.id, profileData);
      } else if (storedData.role === 'partner') {
        profileResult = await createPartnerProfile(client, newUser.id, profileData);
      }

      await client.query('COMMIT');
      
      // Nettoyer le stockage temporaire
      otpStore.delete(key);

      logger.info('Utilisateur créé avec succès en PostgreSQL', {
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        method
      });

      res.json({
        success: true,
        message: 'Compte créé avec succès',
        user: {
          id: newUser.id,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
          status: newUser.status,
          isVerified: true,
          profile: profileResult
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
      message: 'Erreur lors de la création du compte'
    });
  }
};

/**
 * Créer un profil client
 */
const createClientProfile = async (client, userId, profileData) => {
  const query = `
    INSERT INTO client_profiles (user_id, first_name, last_name, address, city, postal_code)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  
  const result = await client.query(query, [
    userId,
    profileData.firstName || '',
    profileData.lastName || '',
    profileData.address || '',
    profileData.city || '',
    profileData.postalCode || ''
  ]);
  
  return result.rows[0];
};

/**
 * Créer un profil chauffeur
 */
const createDriverProfile = async (client, userId, profileData) => {
  const query = `
    INSERT INTO driver_profiles (user_id, first_name, last_name, license_number, vehicle_type, vehicle_plate)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  
  const result = await client.query(query, [
    userId,
    profileData.firstName || '',
    profileData.lastName || '',
    profileData.licenseNumber || '',
    profileData.vehicleType || '',
    profileData.vehiclePlate || ''
  ]);
  
  return result.rows[0];
};

/**
 * Créer un profil partenaire
 */
const createPartnerProfile = async (client, userId, profileData) => {
  const query = `
    INSERT INTO partner_profiles (user_id, business_name, business_type, contact_person, address, city, postal_code)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  
  const result = await client.query(query, [
    userId,
    profileData.businessName || '',
    profileData.businessType || '',
    profileData.contactPerson || '',
    profileData.address || '',
    profileData.city || '',
    profileData.postalCode || ''
  ]);
  
  return result.rows[0];
};

export default {
  sendRegistrationOTP,
  verifyRegistrationOTP
};