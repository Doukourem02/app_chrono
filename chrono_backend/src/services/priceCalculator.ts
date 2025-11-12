export interface PriceCalculationParams {
  distance: number; 
  deliveryMethod: 'moto' | 'vehicule' | 'cargo';
  isUrgent?: boolean;
  customPricePerKm?: number; 
}

export interface PriceCalculationResult {
  basePrice: number; 
  urgencyFee: number; 
  totalPrice: number; 
  pricePerKm: number; 
  breakdown: {
    distance: number;
    pricePerKm: number;
    urgencyFee: number;
    total: number;
  };
}

const DEFAULT_PRICE_PER_KM: Record<string, number> = {
  moto: 500, 
  vehicule: 800, 
  cargo: 1200, 
};

const URGENCY_FEE_PERCENTAGE = 0.3; 

/**
 * Calcule le prix d'une livraison
 */
export function calculateDeliveryPrice(params: PriceCalculationParams): PriceCalculationResult {
  const { distance, deliveryMethod, isUrgent = false, customPricePerKm } = params;

  const pricePerKm = customPricePerKm || DEFAULT_PRICE_PER_KM[deliveryMethod] || DEFAULT_PRICE_PER_KM.moto;

  const basePrice = Math.round(distance * pricePerKm);

  const urgencyFee = isUrgent ? Math.round(basePrice * URGENCY_FEE_PERCENTAGE) : 0;

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

