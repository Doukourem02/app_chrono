import nodemailer, { Transporter } from 'nodemailer';
import { Vonage } from '@vonage/server-sdk';
import { OTP_TTL_MINUTES } from '../config/otpTtl.js';
import logger from '../utils/logger.js';
import {
  isTwilioSmsConfigured,
  sendOTPSMSTwilio,
} from './twilioSmsService.js';

let transporter: Transporter | null = null;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const createTransporter = (): Transporter => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

export const sendOTPEmail = async (
  email: string,
  otpCode: string,
  role: string = 'driver'
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    logger.info(`Envoi email OTP Gmail à ${email} pour rôle ${role}`);

    const minLabelHtml =
      OTP_TTL_MINUTES === 1 ? '1 minute' : `${OTP_TTL_MINUTES} minutes`;
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Code de vérification ${role}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border-radius: 10px;
              padding: 30px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #8B5CF6;
              margin-bottom: 10px;
            }
            .title {
              font-size: 20px;
              color: #333;
              margin-bottom: 20px;
            }
            .otp-code {
              background: #f0f0f0;
              border: 2px dashed #8B5CF6;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              font-size: 32px;
              font-weight: bold;
              color: #8B5CF6;
              letter-spacing: 5px;
              margin: 20px 0;
            }
            .instructions {
              color: #666;
              line-height: 1.6;
              margin-bottom: 20px;
            }
            .warning {
              background: #FEF3C7;
              border-left: 4px solid #F59E0B;
              padding: 10px;
              color: #92400E;
              font-size: 14px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #999;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Krono</div>
              <h1 class="title">Code de vérification ${role}</h1>
            </div>
            <p class="instructions">
              Bonjour,<br><br>
              Voici votre code de vérification pour accéder à votre compte ${role} :
            </p>
            <div class="otp-code">${otpCode}</div>
            <p class="instructions">
              Saisissez ce code dans l'application pour compléter votre authentification.
            </p>
            <div class="warning">
              Ce code expire dans <strong>${minLabelHtml}</strong> et ne peut être utilisé qu'une seule fois.
            </div>
            <div class="footer">
              Si vous n'avez pas demandé ce code, ignorez cet email.<br>
              © 2025 Krono — Service de livraison
            </div>
          </div>
        </body>
      </html>
    `;

    const textTemplate = `
Code de vérification Krono ${role}

Votre code de vérification est: ${otpCode}

Ce code expire dans ${minLabelHtml}. Si vous n'avez pas demandé ce code, ignorez cet email.
    `;

    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: email,
      subject: `Code de vérification ${role} - ${otpCode}`,
      html: htmlTemplate,
      text: textTemplate,
    };

    const result = await createTransporter().sendMail(mailOptions);

    logger.info('Email OTP envoyé avec succès:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    logger.error('Erreur envoi email Gmail:', error);
    return { success: false, error: error.message };
  }
};

function isVonageSmsConfigured(): boolean {
  return Boolean(
    process.env.VONAGE_API_KEY?.trim() && process.env.VONAGE_API_SECRET?.trim()
  );
}

async function sendOTPSMSVonage(
  phone: string,
  otpCode: string,
  role: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.VONAGE_API_KEY!.trim();
  const apiSecret = process.env.VONAGE_API_SECRET!.trim();
  const from = (process.env.VONAGE_FROM || 'Krono').trim();
  const vonage = new Vonage({ apiKey, apiSecret });
  const minShort = OTP_TTL_MINUTES === 1 ? '1 min' : `${OTP_TTL_MINUTES} min`;
  const message = `Votre code ${role} Krono : ${otpCode}. Valide ${minShort}. Ne partagez pas ce code.`;

  try {
    const response = await vonage.sms.send({
      to: phone,
      from,
      text: message,
    });
    const first = response.messages[0];
    if (first?.status === '0') {
      logger.info(`SMS OTP Vonage envoyé au ${phone}`);
      return { success: true, messageId: first['message-id'] };
    }
    const errText = first?.['error-text'] || 'Erreur Vonage SMS';
    logger.error('Vonage SMS:', errText);
    return { success: false, error: errText };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Erreur envoi SMS Vonage:', error);
    return { success: false, error: msg };
  }
}

/**
 * Envoie l’OTP par SMS : Twilio (recommandé, voir TWILIO_SMS_*), sinon Vonage, sinon
 * simulation en dev/test uniquement. En production sans fournisseur → échec explicite.
 */
export const sendOTPSMS = async (
  phone: string,
  otpCode: string,
  role: string = 'driver'
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    logger.info(`Envoi SMS OTP au ${phone} pour rôle ${role}`);

    if (isTwilioSmsConfigured()) {
      return await sendOTPSMSTwilio(phone, otpCode, role);
    }

    if (isVonageSmsConfigured()) {
      return await sendOTPSMSVonage(phone, otpCode, role);
    }

    if (process.env.NODE_ENV === 'production') {
      logger.error(
        'Aucun fournisseur SMS configuré. Définissez Twilio (TWILIO_SMS_FROM ou TWILIO_SMS_MESSAGING_SERVICE_SID + SID/token) ou Vonage (VONAGE_*).'
      );
      return {
        success: false,
        error:
          'SMS non configuré sur le serveur (Twilio SMS ou Vonage requis en production)',
      };
    }

    logger.warn(
      'SMS OTP simulé : aucune config Twilio SMS ni Vonage. Le code apparaît dans les logs / debug_code en dev.'
    );
    logger.debug(`
========================================
SMS OTP SIMULÉ (${role.toUpperCase()})
========================================
Au: ${phone}
Code: ${otpCode}
Expire dans ${OTP_TTL_MINUTES} min.
========================================
    `);

    return { success: true, messageId: 'sim-' + Date.now() };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Erreur envoi SMS:', error);
    return { success: false, error: msg };
  }
};

/** Lien magic / recovery généré par Supabase Admin — à envoyer quand le compte existe déjà (portail partenaire). */
export async function sendPartnerPortalMagicLinkEmail(
  to: string,
  actionLink: string,
  partnerName: string
): Promise<{ success: boolean; error?: string }> {
  if (!process.env.EMAIL_USER?.trim() || !process.env.EMAIL_PASS?.trim()) {
    logger.warn('[emailService] Partner portal: SMTP non configuré (EMAIL_USER / EMAIL_PASS)');
    return { success: false, error: 'smtp_not_configured' };
  }
  try {
    const fromName = process.env.EMAIL_FROM_NAME || 'Krono';
    const fromAddr = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER;
    const logoUrl = process.env.EMAIL_LOGO_URL || 'https://admin.kro-no-delivery.com/assets/chrono.png';
    const safePartnerName = escapeHtml(partnerName || 'votre entreprise');
    const safeActionLink = escapeHtml(actionLink);
    const safeLogoUrl = escapeHtml(logoUrl);
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Accès portail partenaire Krono</title>
        </head>
        <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:28px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
                  <tr>
                    <td style="padding:28px 28px 18px;">
                      <img src="${safeLogoUrl}" alt="Krono" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:contain;margin:0 0 14px;">
                      <div style="font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#7c3aed;">Krono</div>
                      <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;color:#111827;">Connexion au portail partenaire</h1>
                      <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#4b5563;">
                        Vous avez maintenant accès au portail partenaire Krono pour <strong style="color:#111827;">${safePartnerName}</strong>.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 28px 24px;">
                      <a href="${safeActionLink}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 18px;border-radius:8px;">
                        Ouvrir le portail
                      </a>
                      <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
                        Ce lien est personnel et à usage unique. Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
                      </p>
                      <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all;">${safeActionLink}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 28px;background:#fafafa;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280;">
                      Si vous n'avez pas demandé cet accès, vous pouvez ignorer cet email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>`;
    await createTransporter().sendMail({
      from: `${fromName} <${fromAddr}>`,
      to,
      subject: `Krono - Connexion au portail partenaire ${partnerName}`,
      html,
      text: `Portail partenaire Krono (${partnerName})\n\nConnexion : ${actionLink}\n`,
    });
    logger.info(`[emailService] Lien portail partenaire envoyé à ${to}`);
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[emailService] sendPartnerPortalMagicLinkEmail:', error);
    return { success: false, error: msg };
  }
}
