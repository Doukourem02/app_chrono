import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

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
    console.log(`📧 Envoi email OTP Gmail à ${email} pour rôle ${role}`);

    // Template HTML pour l'email OTP
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Code de vérification ${role}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #8B5CF6; margin-bottom: 10px; }
            .title { font-size: 20px; color: #333; margin-bottom: 20px; }
            .otp-code { background: #f0f0f0; border: 2px dashed #8B5CF6; border-radius: 8px; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #8B5CF6; letter-spacing: 5px; margin: 20px 0; }
            .instructions { color: #666; line-height: 1.6; margin-bottom: 20px; }
            .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 10px; color: #92400E; font-size: 14px; }
            .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🚗 ChronoDelivery</div>
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
              ⚠️ Ce code expire dans <strong>5 minutes</strong> et ne peut être utilisé qu'une seule fois.
            </div>
            
            <div class="footer">
              Si vous n'avez pas demandé ce code, ignorez cet email.<br>
              © 2025 ChronoDelivery - Service de livraison
            </div>
          </div>
        </body>
      </html>
    `;

    // Version texte pour les clients qui ne supportent pas HTML
    const textTemplate = `
Code de vérification ChronoDelivery ${role}

Votre code de vérification est: ${otpCode}

Ce code expire dans 5 minutes.

Si vous n'avez pas demandé ce code, ignorez cet email.
    `;

    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: email,
      subject: `🚗 Code de vérification ${role} - ${otpCode}`,
      html: htmlTemplate,
      text: textTemplate,
    };

    const result = await createTransporter().sendMail(mailOptions);

    console.log('✅ Email OTP envoyé avec succès:', result.messageId);
    return { success: true, messageId: result.messageId };

  } catch (error: any) {
    console.error('❌ Erreur envoi email Gmail:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 📱 SERVICE D'ENVOI SMS (Simulation pour le moment)
 * 
 * Pour intégrer un vrai service SMS :
 * - Twilio : npm install twilio
 * - Vonage : npm install @vonage/server-sdk
 * - AWS SNS : npm install @aws-sdk/client-sns
 */
export const sendOTPSMS = async (
  phone: string,
  otpCode: string,
  role: string = 'driver'
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    console.log(`📱 Envoi SMS OTP au ${phone} pour rôle ${role}`);
    
    // TODO: Intégrer un vrai service SMS
    console.log(`
      ========================================
      📱 SMS OTP pour ${role.toUpperCase()}
      ========================================
      Au: ${phone}
      
      ChronoDelivery ${role}
      Code: ${otpCode}
      Expire dans 5 min.
      ========================================
    `);

    // Simulation de succès
    return { success: true, messageId: 'sim-' + Date.now() };

  } catch (error: any) {
    console.error('❌ Erreur envoi SMS:', error);
    return { success: false, error: error.message };
  }
};

