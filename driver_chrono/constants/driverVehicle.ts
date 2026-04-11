/** Types d’engin sélectionnables pour les livreurs Krono (flotte actuelle : moto uniquement). */
export function isDriverVehicleTypeSelectableOnKrono(id: string): boolean {
  return id === 'moto';
}

/**
 * Rappel vocal / sécurité selon le type d’engin (profil livreur ou, à défaut, méthode commande).
 * - moto → casque / visibilité
 * - cargo → fixation cargaison
 * - vehicule ou toute autre valeur → ceinture
 */
export function getSafetyReminderForVehicleType(
  vehicleType: string | null | undefined
): string {
  const t = String(vehicleType ?? '')
    .trim()
    .toLowerCase();
  if (t === 'moto') {
    return 'Privilégiez le casque homologué et la visibilité.';
  }
  if (t === 'cargo') {
    return 'Vérifiez la fixation de la cargaison avant de rouler.';
  }
  return 'Attachez votre ceinture de sécurité.';
}
