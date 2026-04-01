import logger from '../utils/logger.js';

/** True when Twilio can send standard SMS (distinct from WhatsApp From). */
export function isTwilioSmsConfigured(): boolean {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_SMS_FROM?.trim();
  const ms = process.env.TWILIO_SMS_MESSAGING_SERVICE_SID?.trim();
  return Boolean(sid && token && (from || ms));
}

function normalizeToE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `+${digits}`;
}

/**
 * Envoie un SMS OTP via l’API REST Twilio (Messages).
 * Utilise les mêmes TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN que WhatsApp.
 * Requiert TWILIO_SMS_FROM (E.164, ex. +33612345678) ou TWILIO_SMS_MESSAGING_SERVICE_SID.
 */
export async function sendOTPSMSTwilio(
  phone: string,
  otpCode: string,
  role: string = 'client'
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromRaw = process.env.TWILIO_SMS_FROM?.trim();
  const messagingServiceSid = process.env.TWILIO_SMS_MESSAGING_SERVICE_SID?.trim();

  if (!accountSid || !authToken) {
    return { success: false, error: 'TWILIO_ACCOUNT_SID ou TWILIO_AUTH_TOKEN manquant' };
  }
  if (!fromRaw && !messagingServiceSid) {
    return {
      success: false,
      error:
        'TWILIO_SMS_FROM (numéro E.164) ou TWILIO_SMS_MESSAGING_SERVICE_SID requis pour les SMS',
    };
  }

  const to = normalizeToE164(phone);
  if (!to) {
    return { success: false, error: 'Numéro de téléphone invalide pour SMS' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams();

  if (messagingServiceSid) {
    body.set('MessagingServiceSid', messagingServiceSid);
  } else if (fromRaw) {
    const fromNorm = fromRaw.startsWith('+')
      ? fromRaw
      : `+${fromRaw.replace(/\D/g, '')}`;
    body.set('From', fromNorm);
  }

  body.set('To', to);
  const brand = process.env.TWILIO_SMS_BODY_BRAND?.trim() || 'Chrono';
  body.set(
    'Body',
    `${brand} — code ${role}: ${otpCode}. Valide 5 minutes. Ne partagez pas ce code.`
  );

  const auth = Buffer.from(`${accountSid}:${authToken}`, 'utf8').toString('base64');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = (await res.json()) as {
      sid?: string;
      message?: string;
      code?: number;
      more_info?: string;
    };

    if (!res.ok) {
      const err = data.message || data.more_info || `Twilio HTTP ${res.status}`;
      logger.error('Twilio SMS error:', err, data);
      return { success: false, error: err };
    }

    logger.info(`SMS OTP Twilio envoyé vers ${to}, sid=${data.sid}`);
    return { success: true, messageId: data.sid };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur réseau Twilio SMS';
    logger.error('Twilio SMS fetch error:', e);
    return { success: false, error: msg };
  }
}
