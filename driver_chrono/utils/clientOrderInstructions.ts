/**
 * Consignes saisies côté client (livraison programmée / options) — stockées dans dropoff.details.
 * Clés alignées sur app_chrono (useMapNewOrder).
 */
export type ClientOrderInstructions = {
  thermalBag: boolean;
  courierNote: string;
  recipientMessage: string;
};

export function parseClientOrderInstructions(
  details: Record<string, unknown> | null | undefined
): ClientOrderInstructions | null {
  if (!details || typeof details !== 'object') return null;
  const thermalBag = details.thermal_bag === true;
  const courierNote =
    typeof details.courier_note === 'string' ? details.courier_note.trim() : '';
  const recipientMessage =
    typeof details.recipient_message === 'string' ? details.recipient_message.trim() : '';
  if (!thermalBag && !courierNote && !recipientMessage) return null;
  return { thermalBag, courierNote, recipientMessage };
}
