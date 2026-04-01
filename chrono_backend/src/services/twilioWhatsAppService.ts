import logger from '../utils/logger.js';

function normalizeE164Digits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits;
}

/** Adresse Twilio `whatsapp:+E164` (sans espaces). */
export function toWhatsAppAddress(phone: string): string {
  const digits = normalizeE164Digits(phone);
  if (digits.length < 8) {
    throw new Error('Numéro de téléphone invalide pour WhatsApp');
  }
  return `whatsapp:+${digits}`;
}

export async function sendOTPWhatsApp(
  phone: string,
  otpCode: string,
  role: string = 'client'
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim();
  const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID?.trim();
  const messagingServiceSid = process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID?.trim();

  if (!accountSid || !authToken) {
    const msg = 'TWILIO_ACCOUNT_SID ou TWILIO_AUTH_TOKEN manquant';
    logger.error(msg);
    return { success: false, error: msg };
  }

  if (!from && !messagingServiceSid) {
    const msg =
      'TWILIO_WHATSAPP_FROM (ex. whatsapp:+1…) ou TWILIO_WHATSAPP_MESSAGING_SERVICE_SID requis';
    logger.error(msg);
    return { success: false, error: msg };
  }

  let to: string;
  try {
    to = toWhatsAppAddress(phone);
  } catch (e: any) {
    return { success: false, error: e.message || 'Numéro invalide' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams();

  if (messagingServiceSid) {
    body.set('MessagingServiceSid', messagingServiceSid);
  } else if (from) {
    const fromNorm = from.startsWith('whatsapp:')
      ? from
      : `whatsapp:+${from.replace(/\D/g, '')}`;
    body.set('From', fromNorm);
  }

  body.set('To', to);

  if (contentSid) {
    body.set('ContentSid', contentSid);
    const extraVars = process.env.TWILIO_WHATSAPP_CONTENT_VARIABLES_JSON?.trim();
    let variables: Record<string, string> = { '1': otpCode };
    if (extraVars) {
      try {
        const parsed = JSON.parse(extraVars) as Record<string, string>;
        variables = { ...variables, ...parsed, '1': otpCode };
      } catch {
        logger.warn('TWILIO_WHATSAPP_CONTENT_VARIABLES_JSON invalide, ignoré');
      }
    }
    body.set('ContentVariables', JSON.stringify(variables));
  } else {
    const brand = process.env.TWILIO_WHATSAPP_BODY_BRAND || 'Krono';
    body.set(
      'Body',
      `${brand} — code ${role}: ${otpCode}. Valide 5 minutes. Ne partagez ce code avec personne.`
    );
  }

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
      const err =
        data.message || data.more_info || `Twilio HTTP ${res.status}`;
      logger.error('Twilio WhatsApp error:', err, data);
      return { success: false, error: err };
    }

    logger.info(`WhatsApp OTP envoyé vers ${to}, sid=${data.sid}`);
    return { success: true, messageId: data.sid };
  } catch (e: any) {
    logger.error('Twilio WhatsApp fetch error:', e);
    return { success: false, error: e.message || 'Erreur réseau Twilio' };
  }
}
