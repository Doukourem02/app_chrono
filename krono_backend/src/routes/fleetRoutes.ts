import express, { Router } from 'express';
import {
  getFleetVehicles,
  getFleetVehicleDetails,
  createFleetVehicle,
  updateFleetVehicle,
  addFuelLog,
  getFuelLogs,
  createMaintenance,
  updateMaintenance,
  getMaintenanceHistory,
  uploadVehicleDocumentImage,
  upsertVehicleDocument,
  getVehicleDocuments,
  getExpiringDocuments,
  getVehicleFinancialSummary,
  calculateFinancialSummary,
  logDeliveryMileage,
  getMileageHistory,
} from '../controllers/fleetController.js';
import { verifyAdminSupabase } from '../middleware/verifyAdminSupabase.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router: Router = express.Router();

// Véhicules
router.get('/vehicles', verifyAdminSupabase, getFleetVehicles);
router.get('/vehicles/:vehiclePlate', verifyAdminSupabase, getFleetVehicleDetails);
router.post('/vehicles', verifyAdminSupabase, createFleetVehicle);
router.put('/vehicles/:vehiclePlate', verifyAdminSupabase, updateFleetVehicle);

// Ravitaillement
router.post('/vehicles/:vehiclePlate/fuel', verifyAdminSupabase, addFuelLog);
router.get('/vehicles/:vehiclePlate/fuel', verifyAdminSupabase, getFuelLogs);

// Maintenance
router.post('/vehicles/:vehiclePlate/maintenance', verifyAdminSupabase, createMaintenance);
router.put('/maintenance/:maintenanceId', verifyAdminSupabase, updateMaintenance);
router.get('/vehicles/:vehiclePlate/maintenance', verifyAdminSupabase, getMaintenanceHistory);

// Documents
router.post('/vehicles/:vehiclePlate/documents/upload', verifyAdminSupabase, uploadVehicleDocumentImage);
router.post('/vehicles/:vehiclePlate/documents', verifyAdminSupabase, upsertVehicleDocument);
router.get('/vehicles/:vehiclePlate/documents', verifyAdminSupabase, getVehicleDocuments);
router.get('/documents/expiring', verifyAdminSupabase, getExpiringDocuments);

// Statistiques financières
router.get('/vehicles/:vehiclePlate/financial-summary', verifyAdminSupabase, getVehicleFinancialSummary);
router.post('/vehicles/:vehiclePlate/calculate-financial-summary', verifyAdminSupabase, calculateFinancialSummary);

// Kilométrage
router.post('/delivery-mileage', verifyJWT, logDeliveryMileage); // Appelé après livraison ; auth requise (pas besoin d'être admin)
router.get('/vehicles/:vehiclePlate/mileage', verifyAdminSupabase, getMileageHistory);

export default router;

