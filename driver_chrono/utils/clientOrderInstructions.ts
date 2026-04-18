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

function readTrimmedString(obj: Record<string, unknown>, snake: string, camel: string): string {
  const raw = obj[snake] ?? obj[camel];
  return typeof raw === 'string' ? raw.trim() : '';
}

export function parseClientOrderInstructions(
  details: Record<string, unknown> | string | null | undefined
): ClientOrderInstructions | null {
  const obj = normalizeDropoffDetails(details);
  if (!obj) return null;
  const thermalBag = obj.thermal_bag === true || obj.thermalBag === true;
  const courierNote = readTrimmedString(obj, 'courier_note', 'courierNote');
  const recipientMessage = readTrimmedString(obj, 'recipient_message', 'recipientMessage');
  const scheduledWindowNote = readTrimmedString(
    obj,
    'scheduled_window_note',
    'scheduledWindowNote'
  );
  if (!thermalBag && !courierNote && !recipientMessage && !scheduledWindowNote) return null;
  return { thermalBag, courierNote, recipientMessage, scheduledWindowNote };
}
