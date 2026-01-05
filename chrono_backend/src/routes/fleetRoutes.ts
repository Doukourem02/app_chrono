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

const router: Router = express.Router();

// ============================================
// VÉHICULES
// ============================================
router.get('/vehicles', verifyAdminSupabase, getFleetVehicles);
router.get('/vehicles/:vehiclePlate', verifyAdminSupabase, getFleetVehicleDetails);
router.post('/vehicles', verifyAdminSupabase, createFleetVehicle);
router.put('/vehicles/:vehiclePlate', verifyAdminSupabase, updateFleetVehicle);

// ============================================
// RAVITAILLEMENT
// ============================================
router.post('/vehicles/:vehiclePlate/fuel', verifyAdminSupabase, addFuelLog);
router.get('/vehicles/:vehiclePlate/fuel', verifyAdminSupabase, getFuelLogs);

// ============================================
// MAINTENANCE
// ============================================
router.post('/vehicles/:vehiclePlate/maintenance', verifyAdminSupabase, createMaintenance);
router.put('/maintenance/:maintenanceId', verifyAdminSupabase, updateMaintenance);
router.get('/vehicles/:vehiclePlate/maintenance', verifyAdminSupabase, getMaintenanceHistory);

// ============================================
// DOCUMENTS
// ============================================
router.post('/vehicles/:vehiclePlate/documents/upload', verifyAdminSupabase, uploadVehicleDocumentImage);
router.post('/vehicles/:vehiclePlate/documents', verifyAdminSupabase, upsertVehicleDocument);
router.get('/vehicles/:vehiclePlate/documents', verifyAdminSupabase, getVehicleDocuments);
router.get('/documents/expiring', verifyAdminSupabase, getExpiringDocuments);

// ============================================
// STATISTIQUES FINANCIÈRES
// ============================================
router.get('/vehicles/:vehiclePlate/financial-summary', verifyAdminSupabase, getVehicleFinancialSummary);
router.post('/vehicles/:vehiclePlate/calculate-financial-summary', verifyAdminSupabase, calculateFinancialSummary);

// ============================================
// KILOMÉTRAGE
// ============================================
router.post('/delivery-mileage', logDeliveryMileage); // Pas besoin d'auth admin, appelé automatiquement après livraison
router.get('/vehicles/:vehiclePlate/mileage', verifyAdminSupabase, getMileageHistory);

export default router;

