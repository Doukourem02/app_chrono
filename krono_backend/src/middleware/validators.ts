import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

export const validateCreateOrder = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    pickup: Joi.object({
      address: Joi.string().required().messages({
        'string.empty': 'L\'adresse de prise en charge est requise',
        'any.required': 'L\'adresse de prise en charge est requise'
      }),
      coordinates: Joi.object({
        latitude: Joi.number()
          .min(-90)
          .max(90)
          .required()
          .custom((value, helpers) => {
            if (!Number.isFinite(value)) {
              return helpers.error('number.base');
            }
            return value;
          })
          .messages({
            'number.base': 'La latitude doit être un nombre valide',
            'number.min': 'La latitude doit être entre -90 et 90',
            'number.max': 'La latitude doit être entre -90 et 90',
            'any.required': 'La latitude est requise'
          }),
        longitude: Joi.number()
          .min(-180)
          .max(180)
          .required()
          .custom((value, helpers) => {
            if (!Number.isFinite(value)) {
              return helpers.error('number.base');
            }
            return value;
          })
          .messages({
            'number.base': 'La longitude doit être un nombre valide',
            'number.min': 'La longitude doit être entre -180 et 180',
            'number.max': 'La longitude doit être entre -180 et 180',
            'any.required': 'La longitude est requise'
          })
      }).required()
    }).required(),
    dropoff: Joi.object({
      address: Joi.string().required().messages({
        'string.empty': 'L\'adresse de livraison est requise',
        'any.required': 'L\'adresse de livraison est requise'
      }),
      coordinates: Joi.object({
        latitude: Joi.number()
          .min(-90)
          .max(90)
          .required()
          .custom((value, helpers) => {
            if (!Number.isFinite(value)) {
              return helpers.error('number.base');
            }
            return value;
          })
          .messages({
            'number.base': 'La latitude doit être un nombre valide',
            'number.min': 'La latitude doit être entre -90 et 90',
            'number.max': 'La latitude doit être entre -90 et 90',
            'any.required': 'La latitude est requise'
          }),
        longitude: Joi.number()
          .min(-180)
          .max(180)
          .required()
          .custom((value, helpers) => {
            if (!Number.isFinite(value)) {
              return helpers.error('number.base');
            }
            return value;
          })
          .messages({
            'number.base': 'La longitude doit être un nombre valide',
            'number.min': 'La longitude doit être entre -180 et 180',
            'number.max': 'La longitude doit être entre -180 et 180',
            'any.required': 'La longitude est requise'
          })
      }).required()
    }).required(),
    deliveryMethod: Joi.string().valid('moto', 'vehicule', 'cargo').required().messages({
      'any.only': 'La méthode de livraison doit être moto, vehicule ou cargo',
      'any.required': 'La méthode de livraison est requise'
    }),
    userInfo: Joi.object({
      name: Joi.string().optional(),
      avatar: Joi.string().uri().optional(),
      rating: Joi.number().min(0).max(5).optional(),
      phone: Joi.string().optional()
    }).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: error.details.map(d => d.message)
    });
    return;
  }
  next();
};

export const validateRegister = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'L\'email doit être valide',
      'any.required': 'L\'email est requis'
    }),
    password: Joi.string().min(6).optional().messages({
      'string.min': 'Le mot de passe doit contenir au moins 6 caractères'
    }),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional().messages({
      'string.pattern.base': 'Le numéro de téléphone doit être au format international'
    }),
    role: Joi.string().valid('client', 'driver', 'admin').default('client').messages({
      'any.only': 'Le rôle doit être client, driver ou admin'
    }),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: error.details.map(d => d.message)
    });
    return;
  }
  next();
};

export const validateLogin = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'L\'email doit être valide',
      'any.required': 'L\'email est requis'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Le mot de passe est requis'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: error.details.map(d => d.message)
    });
    return;
  }
  next();
};

/** Compacte espaces / tirets ; le corps doit être en E.164 (+indicatif…, 8–15 chiffres après +). */
function compactE164PhoneBody(req: Request): void {
  if (req.body && typeof req.body.phone === 'string') {
    req.body.phone = req.body.phone.trim().replace(/[\s().-]/g, '');
  }
}

const e164PhoneSchema = Joi.string()
  .pattern(/^\+[1-9]\d{6,14}$/)
  .required()
  .messages({
    'string.pattern.base':
      'Numéro au format E.164 : + puis chiffres uniquement, ex. +2250504343424',
    'any.required': 'Le numéro de téléphone est requis',
    'string.empty': 'Le numéro de téléphone est requis',
  });

export const validateSendOTP = (req: Request, res: Response, next: NextFunction): void => {
  compactE164PhoneBody(req);
  const schema = Joi.object({
    email: Joi.string().email().optional().allow('').messages({
      'string.email': 'L\'email doit être valide',
    }),
    phone: e164PhoneSchema,
    otpMethod: Joi.string().valid('sms', 'whatsapp').default('sms').messages({
      'any.only': 'La méthode OTP doit être sms ou whatsapp',
    }),
    role: Joi.string().valid('client', 'driver', 'admin').default('client').messages({
      'any.only': 'Le rôle doit être client, driver ou admin'
    })
  });

  const { error, value } = schema.validate(req.body, { allowUnknown: true });
  if (error) {
    res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: error.details.map(d => d.message)
    });
    return;
  }
  Object.assign(req.body, value);
  next();
};

export const validateVerifyOTP = (req: Request, res: Response, next: NextFunction): void => {
  compactE164PhoneBody(req);
  const schema = Joi.object({
    email: Joi.string().email().optional().allow('').messages({
      'string.email': 'L\'email doit être valide',
    }),
    phone: e164PhoneSchema,
    otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
      'string.length': 'Le code OTP doit contenir 6 chiffres',
      'string.pattern.base': 'Le code OTP doit contenir uniquement des chiffres',
      'any.required': 'Le code OTP est requis'
    }),
    method: Joi.string().valid('sms', 'whatsapp').optional(),
    role: Joi.string().valid('client', 'driver', 'admin').default('client').messages({
      'any.only': 'Le rôle doit être client, driver ou admin'
    })
  });

  const { error, value } = schema.validate(req.body, { allowUnknown: true });
  if (error) {
    res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: error.details.map(d => d.message)
    });
    return;
  }
  Object.assign(req.body, value);
  next();
};

export const validateDriverStatus = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    is_online: Joi.boolean().optional(),
    is_available: Joi.boolean().optional(),
    current_latitude: Joi.number().min(-90).max(90).optional().messages({
      'number.base': 'La latitude doit être un nombre',
      'number.min': 'La latitude doit être entre -90 et 90',
      'number.max': 'La latitude doit être entre -90 et 90'
    }),
    current_longitude: Joi.number().min(-180).max(180).optional().messages({
      'number.base': 'La longitude doit être un nombre',
      'number.min': 'La longitude doit être entre -180 et 180',
      'number.max': 'La longitude doit être entre -180 et 180'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: error.details.map(d => d.message)
    });
    return;
  }
  next();
};

export const validateDeliveryStatus = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    status: Joi.string().valid('accepted', 'enroute', 'picked_up', 'completed', 'cancelled').required().messages({
      'any.only': 'Le statut doit être accepted, enroute, picked_up, completed ou cancelled',
      'any.required': 'Le statut est requis'
    }),
    location: Joi.object({
      latitude: Joi.number().min(-90).max(90).optional(),
      longitude: Joi.number().min(-180).max(180).optional()
    }).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: error.details.map(d => d.message)
    });
    return;
  }
  next();
};

export const validateRefreshToken = (req: Request, res: Response, next: NextFunction): void => {
  const schema = Joi.object({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Le refresh token est requis'
    })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: error.details.map(d => d.message)
    });
    return;
  }
  next();
};
