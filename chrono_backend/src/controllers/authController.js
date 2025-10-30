// src/controllers/authController.js
import supabase from '../config/supabase.js';
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
 * Envoyer OTP pour inscription
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

    // Vérifier si l'utilisateur existe déjà
    const contact = method === 'email' ? email : phone;
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, phone, role, status')
      .or(`email.eq.${email || 'null'},phone.eq.${phone || 'null'}`)
      .single();

    if (existingUser) {
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
 * Vérifier OTP et créer l'utilisateur
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

    try {
      // Créer l'utilisateur dans Supabase Auth
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

      if (authError) {
        logger.error('Erreur création utilisateur Supabase Auth:', authError);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la création du compte'
        });
      }

      // Créer l'entrée dans la table users personnalisée
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          email: storedData.email,
          phone: storedData.phone,
          role: storedData.role,
          status: 'active',
          email_verified: method === 'email',
          phone_verified: method === 'sms',
          auth_user_id: authData.user.id
        })
        .select()
        .single();

      if (userError) {
        logger.error('Erreur création utilisateur table users:', userError);
        // Nettoyer l'utilisateur Supabase Auth en cas d'erreur
        await supabase.auth.admin.deleteUser(authData.user.id);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la création du profil'
        });
      }

      // Créer le profil spécialisé selon le rôle
      let profileResult = null;
      if (storedData.role === 'client') {
        profileResult = await createClientProfile(userData.id, profileData);
      } else if (storedData.role === 'driver') {
        profileResult = await createDriverProfile(userData.id, profileData);
      } else if (storedData.role === 'partner') {
        profileResult = await createPartnerProfile(userData.id, profileData);
      }

      // Nettoyer le stockage temporaire
      otpStore.delete(key);

      logger.info('Utilisateur créé avec succès', {
        userId: userData.id,
        email: userData.email,
        role: userData.role,
        method
      });

      res.json({
        success: true,
        message: 'Compte créé avec succès',
        data: {
          user: {
            id: userData.id,
            email: userData.email,
            phone: userData.phone,
            role: userData.role,
            status: userData.status
          },
          profile: profileResult?.data || null,
          authUser: {
            id: authData.user.id,
            email: authData.user.email
          }
        }
      });

    } catch (error) {
      logger.error('Erreur lors de la création complète de l\'utilisateur:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création du compte'
      });
    }

  } catch (error) {
    logger.error('Erreur verifyRegistrationOTP:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * Créer un profil client
 */
const createClientProfile = async (userId, profileData) => {
  return await supabase
    .from('client_profiles')
    .insert({
      user_id: userId,
      first_name: profileData.firstName || '',
      last_name: profileData.lastName || '',
      date_of_birth: profileData.dateOfBirth || null,
      address: profileData.address || '',
      city: profileData.city || '',
      postal_code: profileData.postalCode || ''
    })
    .select()
    .single();
};

/**
 * Créer un profil chauffeur
 */
const createDriverProfile = async (userId, profileData) => {
  return await supabase
    .from('driver_profiles')
    .insert({
      user_id: userId,
      first_name: profileData.firstName || '',
      last_name: profileData.lastName || '',
      date_of_birth: profileData.dateOfBirth || null,
      license_number: profileData.licenseNumber || '',
      vehicle_type: profileData.vehicleType || '',
      vehicle_plate: profileData.vehiclePlate || '',
      vehicle_model: profileData.vehicleModel || ''
    })
    .select()
    .single();
};

/**
 * Créer un profil partenaire
 */
const createPartnerProfile = async (userId, profileData) => {
  return await supabase
    .from('partner_profiles')
    .insert({
      user_id: userId,
      business_name: profileData.businessName || '',
      business_type: profileData.businessType || '',
      contact_person: profileData.contactPerson || '',
      address: profileData.address || '',
      city: profileData.city || '',
      postal_code: profileData.postalCode || ''
    })
    .select()
    .single();
};

/**
 * Connexion utilisateur
 */
export const loginUser = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // Pour l'instant, utilisons Supabase Auth avec email/password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      logger.error('Erreur connexion:', error);
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects'
      });
    }

    // Récupérer les données utilisateur complètes
    const { data: userData } = await supabase
      .from('users')
      .select(`
        *,
        client_profiles (*),
        driver_profiles (*),
        partner_profiles (*)
      `)
      .eq('auth_user_id', data.user.id)
      .single();

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: userData,
        session: data.session
      }
    });

  } catch (error) {
    logger.error('Erreur loginUser:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * Obtenir le profil utilisateur
 */
export const getUserProfile = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }

    // Récupérer les données utilisateur complètes
    const { data: userData } = await supabase
      .from('users')
      .select(`
        *,
        client_profiles (*),
        driver_profiles (*),
        partner_profiles (*)
      `)
      .eq('auth_user_id', user.id)
      .single();

    res.json({
      success: true,
      data: userData
    });

  } catch (error) {
    logger.error('Erreur getUserProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

export default {
  sendRegistrationOTP,
  verifyRegistrationOTP,
  loginUser,
  getUserProfile
};