/**
 * Méthodes de livraison disponibles pour les clients dans l’app Krono.
 * Véhicule et cargo sont désactivés côté UI tant que la flotte n’offre que la moto.
 */
export function isDeliveryMethodEnabledForClient(id: string): boolean {
  return id === 'moto';
}
