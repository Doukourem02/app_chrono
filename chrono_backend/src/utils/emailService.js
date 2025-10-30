import nodemailer from 'nodemailer'


const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, 
    },
  })
}

/**
 * Génère un template HTML pour l'email OTP
 * @param {string} otpCode - Code OTP à 6 chiffres
 * @param {string} brandName - Nom de la marque
 * @returns {string} Template HTML
 */
const generateOTPEmailTemplate = (otpCode, brandName = 'CHRONO') => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Code de vérification ${brandName}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 10px; margin-top: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .brand { color: #8B7CF6; font-size: 24px; font-weight: bold; }
            .title { color: #1F2937; font-size: 20px; margin: 20px 0; }
            .otp-code { background-color: #F3F0FF; border: 2px solid #8B7CF6; border-radius: 10px; padding: 20px; text-align: center; margin: 30px 0; }
            .code { font-size: 32px; font-weight: bold; color: #8B7CF6; letter-spacing: 8px; }
            .description { color: #6B7280; line-height: 1.6; margin: 20px 0; }
            .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 14px; text-align: center; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="brand">${brandName}</div>
                <h1 class="title">Code de vérification</h1>
            </div>
            
            <p class="description">
                Bonjour,<br><br>
                Voici votre code de vérification pour finaliser votre inscription :
            </p>
            
            <div class="otp-code">
                <div class="code">${otpCode}</div>
            </div>
            
            <p class="description">
                Saisissez ce code dans l'application pour confirmer votre adresse email.
                Ce code est valide pendant <strong>5 minutes</strong>.
            </p>
            
            <div class="warning">
                <strong>⚠️ Important :</strong> Ne partagez jamais ce code avec personne. 
                Notre équipe ne vous demandera jamais votre code de vérification.
            </div>
            
            <div class="footer">
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                <p>&copy; 2025 ${brandName}. Tous droits réservés.</p>
            </div>
        </div>
    </body>
    </html>
  `
}

/**
 * Envoie un email avec code OTP
 * @param {string} to - Adresse email destinataire
 * @param {string} otpCode - Code OTP à 6 chiffres  
 * @param {string} brandName - Nom de la marque
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export async function sendOTPEmail(to, otpCode, brandName = 'CHRONO') {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('Configuration email manquante. Vérifiez EMAIL_USER et EMAIL_PASS dans .env')
    }

    const transporter = createTransporter()
    
    // Vérifier la connexion SMTP
    await transporter.verify()
    
    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || brandName,
        address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER
      },
      to: to,
      subject: `Code de vérification ${brandName}: ${otpCode}`,
      html: generateOTPEmailTemplate(otpCode, brandName),
      text: `Votre code de vérification ${brandName} est: ${otpCode}. Ce code est valide pendant 5 minutes. Ne le partagez avec personne.`
    }

    const result = await transporter.sendMail(mailOptions)
    
    console.log(`📧 Email OTP envoyé à ${to}: ${otpCode}`)
    console.log('Message ID:', result.messageId)
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Code OTP envoyé par email avec succès'
    }
    
  } catch (error) {
    console.error('Erreur envoi email OTP:', error)
    throw new Error(`Erreur email: ${error.message}`)
  }
}

/**
 * Teste la configuration email
 * @returns {Promise<boolean>} True si la configuration fonctionne
 */
export async function testEmailConfig() {
  try {
    const transporter = createTransporter()
    await transporter.verify()
    console.log('✅ Configuration email OK')
    return true
  } catch (error) {
    console.error('❌ Erreur configuration email:', error.message)
    return false
  }
}