export interface PriceCalculationParams {
  distance: number; // Distance en km
  deliveryMethod: 'moto' | 'vehicule' | 'cargo';
  isUrgent?: boolean;
  customPricePerKm?: number; // Tarif personnalisé par km (optionnel)
}

export interface PriceCalculationResult {
  basePrice: number; // Prix de base (km × tarif_km)
  urgencyFee: number; // Frais d'urgence
  totalPrice: number; // Prix total
  pricePerKm: number; // Tarif par km utilisé
  breakdown: {
    distance: number;
    pricePerKm: number;
    urgencyFee: number;
    total: number;
  };
}

// Tarifs par défaut par km selon le type de livraison (en XOF)
const DEFAULT_PRICE_PER_KM: Record<string, number> = {
  moto: 500, // 500 XOF/km pour moto
  vehicule: 800, // 800 XOF/km pour véhicule
  cargo: 1200, // 1200 XOF/km pour cargo
};

// Frais d'urgence (en pourcentage du prix de base)
const URGENCY_FEE_PERCENTAGE = 0.3; // 30% de frais supplémentaires

/**
 * Calcule le prix d'une livraison
 */
export function calculateDeliveryPrice(params: PriceCalculationParams): PriceCalculationResult {
  const { distance, deliveryMethod, isUrgent = false, customPricePerKm } = params;

  // Déterminer le tarif par km
  const pricePerKm = customPricePerKm || DEFAULT_PRICE_PER_KM[deliveryMethod] || DEFAULT_PRICE_PER_KM.moto;

  // Calculer le prix de base
  const basePrice = Math.round(distance * pricePerKm);

  // Calculer les frais d'urgence si applicable
  const urgencyFee = isUrgent ? Math.round(basePrice * URGENCY_FEE_PERCENTAGE) : 0;

  // Calculer le prix total
  const totalPrice = basePrice + urgencyFee;

  return {
    basePrice,
    urgencyFee,
    totalPrice,
    pricePerKm,
    breakdown: {
      distance: Math.round(distance * 100) / 100, // Arrondir à 2 décimales
      pricePerKm,
      urgencyFee,
      total: totalPrice,
    },
  };
}

/**
 * Obtient le tarif par km pour un type de livraison
 */
export function getPricePerKm(deliveryMethod: 'moto' | 'vehicule' | 'cargo'): number {
  return DEFAULT_PRICE_PER_KM[deliveryMethod] || DEFAULT_PRICE_PER_KM.moto;
}

/**
 * Valide les paramètres de calcul de prix
 */
export function validatePriceParams(params: PriceCalculationParams): { valid: boolean; error?: string } {
  if (!params.distance || params.distance <= 0) {
    return { valid: false, error: 'La distance doit être supérieure à 0' };
  }

  if (!params.deliveryMethod || !['moto', 'vehicule', 'cargo'].includes(params.deliveryMethod)) {
    return { valid: false, error: 'Méthode de livraison invalide' };
  }

  if (params.customPricePerKm !== undefined && params.customPricePerKm <= 0) {
    return { valid: false, error: 'Le tarif personnalisé par km doit être supérieur à 0' };
  }

  return { valid: true };
}

