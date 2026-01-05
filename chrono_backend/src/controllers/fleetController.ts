import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { supabaseAdmin } from '../config/supabase.js';

// ============================================
// Types pour la gestion de flotte
// ============================================
interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// ============================================
// VÉHICULES - CRUD
// ============================================

/**
 * GET /api/fleet/vehicles
 * Récupère tous les véhicules de la flotte
 */
export const getFleetVehicles = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const vehicleType = req.query.vehicleType as string | undefined;
    const search = req.query.search as string | undefined;

    let query = `
      SELECT 
        fv.*,
        dp.first_name as driver_first_name,
        dp.last_name as driver_last_name,
        dp.email as driver_email,
        dp.phone as driver_phone,
        u.email as driver_user_email
      FROM fleet_vehicles fv
      LEFT JOIN driver_profiles dp ON fv.current_driver_id = dp.user_id
      LEFT JOIN users u ON fv.current_driver_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND fv.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (vehicleType) {
      query += ` AND fv.vehicle_type = $${paramIndex}`;
      params.push(vehicleType);
      paramIndex++;
    }

    if (search) {
      query += ` AND (
        fv.vehicle_plate ILIKE $${paramIndex} OR
        fv.vehicle_brand ILIKE $${paramIndex} OR
        fv.vehicle_model ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY fv.created_at DESC`;

    const result = await (pool as any).query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Erreur récupération véhicules:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des véhicules',
      error: error.message,
    });
  }
};

/**
 * GET /api/fleet/vehicles/:vehiclePlate
 * Récupère les détails d'un véhicule
 */
export const getFleetVehicleDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vehiclePlate } = req.params;

    // Récupérer les infos du véhicule
    const vehicleQuery = `
      SELECT 
        fv.*,
        dp.first_name as driver_first_name,
        dp.last_name as driver_last_name,
        dp.email as driver_email,
        dp.phone as driver_phone,
        u.email as driver_user_email
      FROM fleet_vehicles fv
      LEFT JOIN driver_profiles dp ON fv.current_driver_id = dp.user_id
      LEFT JOIN users u ON fv.current_driver_id = u.id
      WHERE fv.vehicle_plate = $1
    `;

    const vehicleResult = await (pool as any).query(vehicleQuery, [vehiclePlate]);

    if (vehicleResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Véhicule non trouvé',
      });
      return;
    }

    const vehicle = vehicleResult.rows[0];

    // Récupérer les statistiques financières (dernière période)
    const financialQuery = `
      SELECT * FROM vehicle_financial_summary
      WHERE vehicle_plate = $1
      ORDER BY period_end DESC
      LIMIT 1
    `;
    const financialResult = await (pool as any).query(financialQuery, [vehiclePlate]);

    // Récupérer les documents
    const documentsQuery = `
      SELECT * FROM vehicle_documents
      WHERE vehicle_plate = $1
      ORDER BY document_type, expiry_date
    `;
    const documentsResult = await (pool as any).query(documentsQuery, [vehiclePlate]);

    // Récupérer les maintenances récentes
    const maintenanceQuery = `
      SELECT * FROM vehicle_maintenance
      WHERE vehicle_plate = $1
      ORDER BY scheduled_date DESC, created_at DESC
      LIMIT 10
    `;
    const maintenanceResult = await (pool as any).query(maintenanceQuery, [vehiclePlate]);

    // Récupérer les ravitaillements récents
    const fuelQuery = `
      SELECT * FROM vehicle_fuel_logs
      WHERE vehicle_plate = $1
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const fuelResult = await (pool as any).query(fuelQuery, [vehiclePlate]);

    res.json({
      success: true,
      data: {
        vehicle,
        financial: financialResult.rows[0] || null,
        documents: documentsResult.rows,
        maintenance: maintenanceResult.rows,
        fuelLogs: fuelResult.rows,
      },
    });
  } catch (error: any) {
    logger.error('Erreur récupération détails véhicule:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des détails du véhicule',
      error: error.message,
    });
  }
};

/**
 * POST /api/fleet/vehicles
 * Crée un nouveau véhicule dans la flotte
 */
export const createFleetVehicle = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const {
      vehicle_plate,
      vehicle_type,
      vehicle_brand,
      vehicle_model,
      vehicle_color,
      fuel_type,
      current_driver_id,
      purchase_date,
      purchase_price,
      current_odometer,
    } = req.body;

    if (!vehicle_plate || !vehicle_type) {
      res.status(400).json({
        success: false,
        message: 'La plaque et le type de véhicule sont requis',
      });
      return;
    }

    // Vérifier si le véhicule existe déjà
    const checkQuery = 'SELECT id FROM fleet_vehicles WHERE vehicle_plate = $1';
    const checkResult = await (pool as any).query(checkQuery, [vehicle_plate]);

    if (checkResult.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: 'Un véhicule avec cette plaque existe déjà',
      });
      return;
    }

    const insertQuery = `
      INSERT INTO fleet_vehicles (
        vehicle_plate, vehicle_type, vehicle_brand, vehicle_model, vehicle_color,
        fuel_type, current_driver_id, purchase_date, purchase_price, current_odometer
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await (pool as any).query(insertQuery, [
      vehicle_plate,
      vehicle_type,
      vehicle_brand || null,
      vehicle_model || null,
      vehicle_color || null,
      fuel_type || null,
      current_driver_id || null,
      purchase_date || null,
      purchase_price || null,
      current_odometer || 0,
    ]);

    logger.info(`Véhicule créé: ${vehicle_plate}`, { created_by: req.user?.id });

    res.status(201).json({
      success: true,
      message: 'Véhicule créé avec succès',
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur création véhicule:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du véhicule',
      error: error.message,
    });
  }
};

/**
 * PUT /api/fleet/vehicles/:vehiclePlate
 * Met à jour un véhicule
 */
export const updateFleetVehicle = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { vehiclePlate } = req.params;
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = [
      'vehicle_type',
      'vehicle_brand',
      'vehicle_model',
      'vehicle_color',
      'fuel_type',
      'current_driver_id',
      'purchase_date',
      'purchase_price',
      'current_odometer',
      'status',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour',
      });
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(vehiclePlate);

    const updateQuery = `
      UPDATE fleet_vehicles
      SET ${updates.join(', ')}
      WHERE vehicle_plate = $${paramIndex}
      RETURNING *
    `;

    const result = await (pool as any).query(updateQuery, values);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Véhicule non trouvé',
      });
      return;
    }

    logger.info(`Véhicule mis à jour: ${vehiclePlate}`, { updated_by: req.user?.id });

    res.json({
      success: true,
      message: 'Véhicule mis à jour avec succès',
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur mise à jour véhicule:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du véhicule',
      error: error.message,
    });
  }
};

// ============================================
// RAVITAILLEMENT (CARBURANT/ÉLECTRICITÉ)
// ============================================

/**
 * POST /api/fleet/vehicles/:vehiclePlate/fuel
 * Enregistre un ravitaillement
 */
export const addFuelLog = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { vehiclePlate } = req.params;
    const {
      driver_id,
      fuel_type,
      quantity,
      unit_price,
      odometer_before,
      odometer_after,
      station_location,
      notes,
    } = req.body;

    if (!fuel_type || !quantity || !unit_price) {
      res.status(400).json({
        success: false,
        message: 'Le type de carburant, la quantité et le prix unitaire sont requis',
      });
      return;
    }

    const total_cost = quantity * unit_price;

    const insertQuery = `
      INSERT INTO vehicle_fuel_logs (
        vehicle_plate, driver_id, fuel_type, quantity, unit_price, total_cost,
        odometer_before, odometer_after, station_location, notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const result = await (pool as any).query(insertQuery, [
      vehiclePlate,
      driver_id || null,
      fuel_type,
      quantity,
      unit_price,
      total_cost,
      odometer_before || null,
      odometer_after || null,
      station_location || null,
      notes || null,
      req.user?.id || null,
    ]);

    logger.info(`Ravitaillement enregistré pour ${vehiclePlate}`, {
      fuel_type,
      quantity,
      created_by: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: 'Ravitaillement enregistré avec succès',
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur enregistrement ravitaillement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du ravitaillement',
      error: error.message,
    });
  }
};

/**
 * GET /api/fleet/vehicles/:vehiclePlate/fuel
 * Récupère l'historique des ravitaillements
 */
export const getFuelLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vehiclePlate } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const query = `
      SELECT 
        vfl.*,
        dp.first_name as driver_first_name,
        dp.last_name as driver_last_name
      FROM vehicle_fuel_logs vfl
      LEFT JOIN driver_profiles dp ON vfl.driver_id = dp.user_id
      WHERE vfl.vehicle_plate = $1
      ORDER BY vfl.created_at DESC
      LIMIT $2
    `;

    const result = await (pool as any).query(query, [vehiclePlate, limit]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Erreur récupération historique ravitaillement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique',
      error: error.message,
    });
  }
};

// ============================================
// MAINTENANCE
// ============================================

/**
 * POST /api/fleet/vehicles/:vehiclePlate/maintenance
 * Crée une maintenance planifiée
 */
export const createMaintenance = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { vehiclePlate } = req.params;
    const {
      maintenance_type,
      description,
      scheduled_date,
      odometer_at_maintenance,
      cost,
      service_provider,
      invoice_url,
      documents,
      notes,
    } = req.body;

    if (!maintenance_type || !scheduled_date) {
      res.status(400).json({
        success: false,
        message: 'Le type de maintenance et la date prévue sont requis',
      });
      return;
    }

    const insertQuery = `
      INSERT INTO vehicle_maintenance (
        vehicle_plate, maintenance_type, description, scheduled_date,
        odometer_at_maintenance, cost, service_provider, invoice_url,
        documents, notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const result = await (pool as any).query(insertQuery, [
      vehiclePlate,
      maintenance_type,
      description || null,
      scheduled_date,
      odometer_at_maintenance || null,
      cost || 0,
      service_provider || null,
      invoice_url || null,
      documents ? JSON.stringify(documents) : null,
      notes || null,
      req.user?.id || null,
    ]);

    logger.info(`Maintenance créée pour ${vehiclePlate}`, {
      maintenance_type,
      scheduled_date,
      created_by: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: 'Maintenance créée avec succès',
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur création maintenance:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la maintenance',
      error: error.message,
    });
  }
};

/**
 * PUT /api/fleet/maintenance/:maintenanceId
 * Met à jour une maintenance
 */
export const updateMaintenance = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { maintenanceId } = req.params;
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = [
      'maintenance_type',
      'description',
      'scheduled_date',
      'completed_date',
      'odometer_at_maintenance',
      'cost',
      'service_provider',
      'invoice_url',
      'documents',
      'status',
      'notes',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'documents') {
          updates.push(`${field} = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(req.body[field]));
        } else {
          updates.push(`${field} = $${paramIndex}`);
          values.push(req.body[field]);
        }
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour',
      });
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(maintenanceId);

    const updateQuery = `
      UPDATE vehicle_maintenance
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await (pool as any).query(updateQuery, values);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Maintenance non trouvée',
      });
      return;
    }

    logger.info(`Maintenance mise à jour: ${maintenanceId}`, { updated_by: req.user?.id });

    res.json({
      success: true,
      message: 'Maintenance mise à jour avec succès',
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur mise à jour maintenance:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la maintenance',
      error: error.message,
    });
  }
};

/**
 * GET /api/fleet/vehicles/:vehiclePlate/maintenance
 * Récupère l'historique des maintenances
 */
export const getMaintenanceHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vehiclePlate } = req.params;
    const status = req.query.status as string | undefined;

    let query = `
      SELECT * FROM vehicle_maintenance
      WHERE vehicle_plate = $1
    `;

    const params: any[] = [vehiclePlate];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY scheduled_date DESC, created_at DESC`;

    const result = await (pool as any).query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Erreur récupération historique maintenance:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique',
      error: error.message,
    });
  }
};

// ============================================
// DOCUMENTS LÉGAUX
// ============================================

/**
 * POST /api/fleet/vehicles/:vehiclePlate/documents/upload
 * Upload une image de document vers Supabase Storage
 */
export const uploadVehicleDocumentImage = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { vehiclePlate } = req.params;
    const { document_type, imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64) {
      res.status(400).json({
        success: false,
        message: 'Image base64 requise',
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

    // Vérifier la taille (max 10MB pour les documents)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxSize) {
      res.status(400).json({
        success: false,
        message: 'Image trop grande. Taille maximum: 10MB',
      });
      return;
    }

    // Déterminer l'extension du fichier
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/gif' ? 'gif' : 'jpg';
    const fileName = `${vehiclePlate}-${document_type}-${Date.now()}.${ext}`;
    const filePath = `vehicle-documents/${fileName}`;

    // Upload vers Supabase Storage (créer le bucket si nécessaire)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('vehicle-documents')
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: true,
        contentType: mimeType,
      });

    if (uploadError) {
      logger.error('Erreur upload document:', uploadError);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'upload de l\'image',
        error: uploadError.message,
      });
      return;
    }

    // Obtenir l'URL publique
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('vehicle-documents')
      .getPublicUrl(filePath);

    logger.info(`Document ${document_type} uploadé pour ${vehiclePlate}`, {
      filePath,
      publicUrl,
      uploaded_by: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Document uploadé avec succès',
      data: {
        document_url: publicUrl,
      },
    });
  } catch (error: any) {
    logger.error('Erreur upload document:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload du document',
      error: error.message,
    });
  }
};

/**
 * POST /api/fleet/vehicles/:vehiclePlate/documents
 * Crée ou met à jour un document légal
 */
export const upsertVehicleDocument = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { vehiclePlate } = req.params;
    const {
      document_type,
      document_number,
      issue_date,
      expiry_date,
      document_url,
      imageBase64,
      mimeType,
      is_valid,
      notes,
    } = req.body;

    if (!document_type) {
      res.status(400).json({
        success: false,
        message: 'Le type de document est requis',
      });
      return;
    }

    let finalDocumentUrl = document_url;

    // Si une image base64 est fournie, l'uploader d'abord
    if (imageBase64 && !document_url) {
      if (!supabaseAdmin) {
        res.status(500).json({
          success: false,
          message: 'Supabase non configuré',
        });
        return;
      }

      try {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (buffer.length > maxSize) {
          res.status(400).json({
            success: false,
            message: 'Image trop grande. Taille maximum: 10MB',
          });
          return;
        }

        const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/gif' ? 'gif' : 'jpg';
        const fileName = `${vehiclePlate}-${document_type}-${Date.now()}.${ext}`;
        const filePath = `vehicle-documents/${fileName}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('vehicle-documents')
          .upload(filePath, buffer, {
            cacheControl: '3600',
            upsert: true,
            contentType: mimeType || 'image/jpeg',
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('vehicle-documents')
          .getPublicUrl(filePath);

        finalDocumentUrl = publicUrl;
      } catch (uploadError: any) {
        logger.error('Erreur upload image document:', uploadError);
        res.status(500).json({
          success: false,
          message: 'Erreur lors de l\'upload de l\'image',
          error: uploadError.message,
        });
        return;
      }
    }

    const upsertQuery = `
      INSERT INTO vehicle_documents (
        vehicle_plate, document_type, document_number, issue_date,
        expiry_date, document_url, is_valid, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (vehicle_plate, document_type)
      DO UPDATE SET
        document_number = EXCLUDED.document_number,
        issue_date = EXCLUDED.issue_date,
        expiry_date = EXCLUDED.expiry_date,
        document_url = EXCLUDED.document_url,
        is_valid = EXCLUDED.is_valid,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await (pool as any).query(upsertQuery, [
      vehiclePlate,
      document_type,
      document_number || null,
      issue_date || null,
      expiry_date || null,
      finalDocumentUrl || null,
      is_valid !== undefined ? is_valid : true,
      notes || null,
    ]);

    logger.info(`Document ${document_type} créé/mis à jour pour ${vehiclePlate}`, {
      created_by: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Document enregistré avec succès',
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur enregistrement document:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du document',
      error: error.message,
    });
  }
};

/**
 * GET /api/fleet/vehicles/:vehiclePlate/documents
 * Récupère tous les documents d'un véhicule
 */
export const getVehicleDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vehiclePlate } = req.params;

    const query = `
      SELECT * FROM vehicle_documents
      WHERE vehicle_plate = $1
      ORDER BY document_type, expiry_date
    `;

    const result = await (pool as any).query(query, [vehiclePlate]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Erreur récupération documents:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des documents',
      error: error.message,
    });
  }
};

/**
 * GET /api/fleet/documents/expiring
 * Récupère les documents expirant bientôt
 */
export const getExpiringDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    const query = `
      SELECT 
        vd.*,
        fv.vehicle_type,
        fv.vehicle_brand,
        fv.vehicle_model
      FROM vehicle_documents vd
      JOIN fleet_vehicles fv ON vd.vehicle_plate = fv.vehicle_plate
      WHERE vd.expiry_date IS NOT NULL
        AND vd.expiry_date <= CURRENT_DATE + INTERVAL '${days} days'
        AND vd.expiry_date >= CURRENT_DATE
      ORDER BY vd.expiry_date ASC
    `;

    const result = await (pool as any).query(query);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Erreur récupération documents expirant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des documents expirant',
      error: error.message,
    });
  }
};

// ============================================
// STATISTIQUES FINANCIÈRES
// ============================================

/**
 * GET /api/fleet/vehicles/:vehiclePlate/financial-summary
 * Récupère le résumé financier d'un véhicule
 */
export const getVehicleFinancialSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vehiclePlate } = req.params;
    const periodStart = req.query.periodStart as string | undefined;
    const periodEnd = req.query.periodEnd as string | undefined;

    let query = `
      SELECT * FROM vehicle_financial_summary
      WHERE vehicle_plate = $1
    `;

    const params: any[] = [vehiclePlate];
    let paramIndex = 2;

    if (periodStart) {
      query += ` AND period_start >= $${paramIndex}`;
      params.push(periodStart);
      paramIndex++;
    }

    if (periodEnd) {
      query += ` AND period_end <= $${paramIndex}`;
      params.push(periodEnd);
      paramIndex++;
    }

    query += ` ORDER BY period_end DESC`;

    const result = await (pool as any).query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Erreur récupération résumé financier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du résumé financier',
      error: error.message,
    });
  }
};

/**
 * POST /api/fleet/vehicles/:vehiclePlate/calculate-financial-summary
 * Calcule et enregistre le résumé financier pour une période
 */
export const calculateFinancialSummary = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { vehiclePlate } = req.params;
    const { periodStart, periodEnd } = req.body;

    if (!periodStart || !periodEnd) {
      res.status(400).json({
        success: false,
        message: 'Les dates de début et de fin de période sont requises',
      });
      return;
    }

    // Calculer les revenus (somme des commandes complétées)
    const revenueQuery = `
      SELECT COALESCE(SUM(o.price_cfa), 0) as total_revenue,
             COUNT(*) as total_deliveries
      FROM orders o
      JOIN delivery_mileage_logs dml ON o.id = dml.order_id
      WHERE dml.vehicle_plate = $1
        AND o.status = 'completed'
        AND o.completed_at >= $2
        AND o.completed_at <= $3
    `;

    const revenueResult = await (pool as any).query(revenueQuery, [
      vehiclePlate,
      periodStart,
      periodEnd,
    ]);

    const total_revenue = parseFloat(revenueResult.rows[0]?.total_revenue || 0);
    const total_deliveries = parseInt(revenueResult.rows[0]?.total_deliveries || 0);

    // Calculer les coûts de carburant
    const fuelCostQuery = `
      SELECT COALESCE(SUM(total_cost), 0) as total_fuel_cost
      FROM vehicle_fuel_logs
      WHERE vehicle_plate = $1
        AND created_at >= $2
        AND created_at <= $3
    `;

    const fuelCostResult = await (pool as any).query(fuelCostQuery, [
      vehiclePlate,
      periodStart,
      periodEnd,
    ]);

    const total_fuel_cost = parseFloat(fuelCostResult.rows[0]?.total_fuel_cost || 0);

    // Calculer les coûts de maintenance
    const maintenanceCostQuery = `
      SELECT COALESCE(SUM(cost), 0) as total_maintenance_cost
      FROM vehicle_maintenance
      WHERE vehicle_plate = $1
        AND status = 'completed'
        AND completed_date >= $2
        AND completed_date <= $3
    `;

    const maintenanceCostResult = await (pool as any).query(maintenanceCostQuery, [
      vehiclePlate,
      periodStart,
      periodEnd,
    ]);

    const total_maintenance_cost = parseFloat(maintenanceCostResult.rows[0]?.total_maintenance_cost || 0);

    // Calculer la distance totale
    const distanceQuery = `
      SELECT COALESCE(SUM(distance_km), 0) as total_distance_km
      FROM delivery_mileage_logs
      WHERE vehicle_plate = $1
        AND created_at >= $2
        AND created_at <= $3
    `;

    const distanceResult = await (pool as any).query(distanceQuery, [
      vehiclePlate,
      periodStart,
      periodEnd,
    ]);

    const total_distance_km = parseFloat(distanceResult.rows[0]?.total_distance_km || 0);

    // Calculer le profit net et le ROI
    const total_costs = total_fuel_cost + total_maintenance_cost;
    const net_profit = total_revenue - total_costs;
    const roi_percentage = total_costs > 0 ? ((net_profit / total_costs) * 100) : null;

    // Insérer ou mettre à jour le résumé
    const upsertQuery = `
      INSERT INTO vehicle_financial_summary (
        vehicle_plate, period_start, period_end,
        total_revenue, total_fuel_cost, total_maintenance_cost,
        total_distance_km, total_deliveries, net_profit, roi_percentage
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (vehicle_plate, period_start, period_end)
      DO UPDATE SET
        total_revenue = EXCLUDED.total_revenue,
        total_fuel_cost = EXCLUDED.total_fuel_cost,
        total_maintenance_cost = EXCLUDED.total_maintenance_cost,
        total_distance_km = EXCLUDED.total_distance_km,
        total_deliveries = EXCLUDED.total_deliveries,
        net_profit = EXCLUDED.net_profit,
        roi_percentage = EXCLUDED.roi_percentage,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await (pool as any).query(upsertQuery, [
      vehiclePlate,
      periodStart,
      periodEnd,
      total_revenue,
      total_fuel_cost,
      total_maintenance_cost,
      total_distance_km,
      total_deliveries,
      net_profit,
      roi_percentage,
    ]);

    logger.info(`Résumé financier calculé pour ${vehiclePlate}`, {
      period: `${periodStart} - ${periodEnd}`,
      net_profit,
      roi_percentage,
    });

    res.json({
      success: true,
      message: 'Résumé financier calculé avec succès',
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur calcul résumé financier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul du résumé financier',
      error: error.message,
    });
  }
};

// ============================================
// KILOMÉTRAGE
// ============================================

/**
 * Fonction helper pour enregistrer automatiquement le kilométrage après une livraison
 * Cette fonction est appelée automatiquement quand une livraison est complétée
 */
export const autoLogDeliveryMileage = async (
  orderId: string,
  driverId: string,
  distanceKm: number | null | undefined,
  revenue: number | null | undefined
): Promise<void> => {
  try {
    // Vérifier que la distance existe
    if (!distanceKm || distanceKm <= 0) {
      logger.debug(`[autoLogDeliveryMileage] Pas de distance pour commande ${orderId}, skip`);
      return;
    }

    // Récupérer le profil du livreur pour avoir vehicle_plate
    const driverProfileQuery = await (pool as any).query(
      `SELECT vehicle_plate FROM driver_profiles WHERE user_id = $1 AND vehicle_plate IS NOT NULL`,
      [driverId]
    );

    if (driverProfileQuery.rows.length === 0 || !driverProfileQuery.rows[0].vehicle_plate) {
      logger.debug(`[autoLogDeliveryMileage] Pas de vehicle_plate pour driver ${driverId}, skip`);
      return;
    }

    const vehiclePlate = driverProfileQuery.rows[0].vehicle_plate;

    // Récupérer le kilométrage actuel du véhicule
    const vehicleQuery = await (pool as any).query(
      `SELECT current_odometer FROM fleet_vehicles WHERE vehicle_plate = $1`,
      [vehiclePlate]
    );

    const currentOdometer = vehicleQuery.rows.length > 0 
      ? (vehicleQuery.rows[0].current_odometer || 0)
      : 0;

    // Calculer le nouveau kilométrage
    const newOdometer = currentOdometer + distanceKm;

    // Vérifier si un enregistrement existe déjà pour cette commande
    const existingQuery = await (pool as any).query(
      `SELECT id FROM delivery_mileage_logs WHERE order_id = $1`,
      [orderId]
    );

    if (existingQuery.rows.length > 0) {
      logger.debug(`[autoLogDeliveryMileage] Enregistrement existe déjà pour commande ${orderId}, skip`);
      return;
    }

    // Enregistrer dans delivery_mileage_logs
    const insertQuery = `
      INSERT INTO delivery_mileage_logs (
        order_id, vehicle_plate, driver_id, distance_km,
        odometer_before, odometer_after, revenue_generated
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await (pool as any).query(insertQuery, [
      orderId,
      vehiclePlate,
      driverId,
      distanceKm,
      currentOdometer,
      newOdometer,
      revenue || 0,
    ]);

    logger.info(`[autoLogDeliveryMileage] Kilométrage enregistré automatiquement pour livraison ${orderId}`, {
      vehicle_plate: vehiclePlate,
      distance_km: distanceKm,
      odometer_before: currentOdometer,
      odometer_after: newOdometer,
    });

    // Le trigger SQL mettra à jour automatiquement current_odometer dans fleet_vehicles
  } catch (error: any) {
    // Ne pas bloquer la livraison si l'enregistrement échoue
    logger.error('[autoLogDeliveryMileage] Erreur enregistrement kilométrage automatique:', error);
  }
};

/**
 * POST /api/fleet/delivery-mileage
 * Enregistre le kilométrage après une livraison (route API manuelle)
 */
export const logDeliveryMileage = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      order_id,
      vehicle_plate,
      driver_id,
      distance_km,
      odometer_before,
      odometer_after,
      fuel_consumed,
      battery_used_percent,
      revenue_generated,
    } = req.body;

    if (!order_id || !vehicle_plate || !distance_km) {
      res.status(400).json({
        success: false,
        message: 'order_id, vehicle_plate et distance_km sont requis',
      });
      return;
    }

    const insertQuery = `
      INSERT INTO delivery_mileage_logs (
        order_id, vehicle_plate, driver_id, distance_km,
        odometer_before, odometer_after, fuel_consumed,
        battery_used_percent, revenue_generated
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await (pool as any).query(insertQuery, [
      order_id,
      vehicle_plate,
      driver_id || null,
      distance_km,
      odometer_before || null,
      odometer_after || null,
      fuel_consumed || null,
      battery_used_percent || null,
      revenue_generated || null,
    ]);

    logger.info(`Kilométrage enregistré pour livraison ${order_id}`, {
      vehicle_plate,
      distance_km,
    });

    res.status(201).json({
      success: true,
      message: 'Kilométrage enregistré avec succès',
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur enregistrement kilométrage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement du kilométrage',
      error: error.message,
    });
  }
};

/**
 * GET /api/fleet/vehicles/:vehiclePlate/mileage
 * Récupère l'historique du kilométrage
 */
export const getMileageHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vehiclePlate } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const query = `
      SELECT 
        dml.*,
        o.id as order_id_full,
        o.status as order_status,
        o.created_at as order_created_at
      FROM delivery_mileage_logs dml
      LEFT JOIN orders o ON dml.order_id = o.id
      WHERE dml.vehicle_plate = $1
      ORDER BY dml.created_at DESC
      LIMIT $2
    `;

    const result = await (pool as any).query(query, [vehiclePlate, limit]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('Erreur récupération historique kilométrage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique',
      error: error.message,
    });
  }
};

