/**
 * Consignes saisies côté client (livraison programmée / options) — stockées dans dropoff.details.
 * Clés alignées sur app_chrono (useMapNewOrder).
 */
export type ClientOrderInstructions = {
  thermalBag: boolean;
  courierNote: string;
  recipientMessage: string;
  /** Mode programmé — créneau indiqué par le client (ex. à partir de 10h) */
  scheduledWindowNote: string;
};

/** API / resync peuvent renvoyer `dropoff.details` comme objet ou chaîne JSON. */
export function normalizeDropoffDetails(details: unknown): Record<string, unknown> | null {
  if (details == null) return null;
  if (typeof details === 'object' && !Array.isArray(details)) {
    return details as Record<string, unknown>;
  }
  if (typeof details === 'string') {
    const t = details.trim();
    if (!t) return null;
    try {
      const parsed = JSON.parse(t) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function parseClientOrderInstructions(
  details: Record<string, unknown> | string | null | undefined
): ClientOrderInstructions | null {
  const obj = normalizeDropoffDetails(details);
  if (!obj) return null;
  const thermalBag = obj.thermal_bag === true;
  const courierNote =
    typeof obj.courier_note === 'string' ? obj.courier_note.trim() : '';
  const recipientMessage =
    typeof obj.recipient_message === 'string' ? obj.recipient_message.trim() : '';
  const scheduledWindowNote =
    typeof obj.scheduled_window_note === 'string'
      ? obj.scheduled_window_note.trim()
      : '';
  if (!thermalBag && !courierNote && !recipientMessage && !scheduledWindowNote) return null;
  return { thermalBag, courierNote, recipientMessage, scheduledWindowNote };
}
