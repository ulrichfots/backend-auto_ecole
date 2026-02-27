require('dotenv').config();
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // On récupère le mot de passe depuis l'une ou l'autre des variables
    const password = (process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || '').trim();
    const user = (process.env.SMTP_USER || 'amenouveveyesu@gmail.com').trim();

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: password
      }
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
      to: 'amenouveveyesu@gmail.com', // Ton email admin
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

  // --- TEMPLATES ---
  generateStudentConfirmationTemplate(data) {
    const { nomComplet, dateDebut, heurePreferee, formation } = data;
    return `<html>...ton HTML...</html>`; // Garde ton HTML ici
  }

  generateAdminNotificationTemplate(data) {
    const { nomComplet, email, telephone, adresse, dateDebut, heurePreferee, formation } = data;
    return `<html>...ton HTML...</html>`; // Garde ton HTML ici
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