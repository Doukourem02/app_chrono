/** Aligné app client (DeliveryMethodBottomSheet) — id tarifaire → libellé livreur. */
export function driverFacingSpeedOptionLabel(
  speedOptionId: string | undefined | null
): string {
  const id = (speedOptionId || '').trim().toLowerCase();
  switch (id) {
    case 'express':
      return 'Express';
    case 'standard':
      return 'Standard';
    case 'scheduled':
      return 'Programmée';
    default:
      return id ? id.charAt(0).toUpperCase() + id.slice(1) : '—';
  }
}
