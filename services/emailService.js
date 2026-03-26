require('dotenv').config();
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    const password = (process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || '').trim();
    const user = (process.env.SMTP_USER || 'amenouveveyesu@gmail.com').trim();
    const port = parseInt(process.env.SMTP_PORT || '587', 10);

    // ✅ Config dynamique: Port 587 (TLS) ou 465 (SSL)
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: port,
      secure: port === 465, // true pour port 465 (SSL), false pour 587 (TLS)
      auth: {
        user: user,
        pass: password
      },
      connectionTimeout: 10000, // 10 secondes timeout
      socketTimeout: 10000
    });
  }

  async sendConfirmationToStudent(registrationData) {
    const { nomComplet, email, dateDebut, heurePreferee, formation } = registrationData;
    
    const mailOptions = {
      from: `"Auto École" <${this.transporter.options.auth.user}>`,
      to: email,
      subject: 'Confirmation de votre inscription - Auto École',
      html: this.generateStudentConfirmationTemplate({
        nomComplet,
        dateDebut,
        heurePreferee,
        formation
      })
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email étudiant envoyé:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Erreur email étudiant:', error.message);
      throw error;
    }
  }

  async sendNotificationToAdmin(registrationData) {
    const { nomComplet, email, telephone, adresse, dateDebut, heurePreferee, formation } = registrationData;
    
    const mailOptions = {
      from: `"Auto École" <${this.transporter.options.auth.user}>`,
      to: 'amenouveveyesu@gmail.com',
      subject: `🚨 Nouvelle inscription - ${nomComplet}`,
      html: this.generateAdminNotificationTemplate({
        nomComplet,
        email,
        telephone,
        adresse,
        dateDebut,
        heurePreferee,
        formation
      })
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email admin envoyé:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Erreur email admin:', error.message);
      throw error;
    }
  }

  async sendResetPasswordEmail(email, resetLink) {
    const mailOptions = {
      from: `"Auto École" <${this.transporter.options.auth.user}>`,
      to: email,
      subject: 'Réinitialisation de votre mot de passe - Auto École',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e3a8a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1>Réinitialisation de mot de passe</h1>
          </div>
          <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Bonjour,</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Auto École.</p>
            <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Réinitialiser mon mot de passe</a>
            </div>
            <p>Ce lien expirera bientôt. Si vous n'avez pas demandé ce changement, ignorez cet email.</p>
            <p>Cordialement,<br>L'équipe Auto École</p>
          </div>
        </div>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email reset envoyé:', result.messageId);
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur email reset:', error.message);
      throw error;
    }
  }

  generateStudentConfirmationTemplate(data) {
    const { nomComplet, dateDebut, heurePreferee, formation } = data;
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e3a8a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">🚗 Confirmation d'inscription</h1>
        </div>
        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Bonjour <strong>${nomComplet}</strong>,</p>
          <p>Merci de votre inscription à nos services de formation de conduite !</p>
          <div style="background: #f0f9ff; border-left: 4px solid #1e3a8a; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #1e3a8a;">Détails de votre inscription :</h3>
            <p><strong>📅 Date souhaitée :</strong> ${dateDebut}</p>
            <p><strong>🕐 Heure préférée :</strong> ${heurePreferee}</p>
            <p><strong>📚 Formation :</strong> ${formation}</p>
          </div>
          <p>Nous avons bien reçu votre demande d'inscription. Un responsable de l'auto-école vous contactera très bientôt pour confirmer votre rendez-vous.</p>
          <p style="color: #666; font-size: 13px;">✏️ <strong>Important :</strong> Vérifiez votre dossier de spam si vous ne recevez pas de confirmation dans les 24 heures.</p>
          <p>Cordialement,<br><strong>L'équipe Auto-École</strong></p>
        </div>
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">© Auto-École 2026</p>
      </div>
    `;
  }

  generateAdminNotificationTemplate(data) {
    const { nomComplet, email, telephone, adresse, dateDebut, heurePreferee, formation } = data;
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">🚨 Nouvelle inscription reçue</h1>
        </div>
        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p><strong>Une nouvelle inscription a été enregistrée dans le système.</strong></p>
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #dc2626;">Informations de l'inscrit :</h3>
            <p><strong>👤 Nom :</strong> ${nomComplet}</p>
            <p><strong>📧 Email :</strong> ${email}</p>
            <p><strong>📱 Téléphone :</strong> ${telephone}</p>
            <p><strong>📍 Adresse :</strong> ${adresse}</p>
          </div>
          <div style="background: #f0f9ff; border-left: 4px solid #1e3a8a; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #1e3a8a;">Détails du rendez-vous demandé :</h3>
            <p><strong>📅 Date :</strong> ${dateDebut}</p>
            <p><strong>🕐 Heure :</strong> ${heurePreferee}</p>
            <p><strong>📚 Formation :</strong> ${formation}</p>
          </div>
          <p style="color: #666; font-size: 13px;">⏰ <strong>Action requise :</strong> Connectez-vous à votre tableau de bord pour valider ou refuser cette inscription.</p>
          <p>Cordialement,<br><strong>Système Auto-École</strong></p>
        </div>
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">© Auto-École 2026</p>
      </div>
    `;
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('🚀 SMTP prêt à envoyer des messages');
      return true;
    } catch (error) {
      console.error('❌ SMTP non configuré:', error.message);
      return false;
    }
  }
}

module.exports = new EmailService();