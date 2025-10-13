require('dotenv').config();
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true pour 465, false pour autres ports
      auth: {
        user: process.env.SMTP_USER || 'amenouveveyesu@gmail.com',
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD
      }
    });
  }

  /**
   * Envoie un email de confirmation à l'étudiant
   * @param {Object} registrationData - Données d'inscription
   * @param {string} registrationData.nomComplet - Nom complet de l'étudiant
   * @param {string} registrationData.email - Email de l'étudiant
   * @param {string} registrationData.dateDebut - Date de début
   * @param {string} registrationData.heurePreferee - Heure préférée
   * @param {string} registrationData.formation - Formation sélectionnée
   */
  async sendConfirmationToStudent(registrationData) {
    const { nomComplet, email, dateDebut, heurePreferee, formation } = registrationData;
    
    const mailOptions = {
      from: `"Auto École" <${process.env.SMTP_USER || 'amenouveveyesu@gmail.com'}>`,
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
      console.log('Email de confirmation envoyé à l\'étudiant:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Erreur envoi email étudiant:', error);
      throw error;
    }
  }

  /**
   * Envoie un email de notification à l'administrateur
   * @param {Object} registrationData - Données d'inscription
   */
  async sendNotificationToAdmin(registrationData) {
    const { nomComplet, email, telephone, adresse, dateDebut, heurePreferee, formation } = registrationData;
    
    const mailOptions = {
      from: `"Auto École" <${process.env.SMTP_USER || 'amenouveveyesu@gmail.com'}>`,
      to: 'amenouveveyesu@gmail.com',
      subject: `Nouvelle inscription - ${nomComplet}`,
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
      console.log('Email de notification envoyé à l\'admin:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Erreur envoi email admin:', error);
      throw error;
    }
  }

  /**
   * Génère le template HTML pour l'email de confirmation étudiant
   */
  generateStudentConfirmationTemplate(data) {
    const { nomComplet, dateDebut, heurePreferee, formation } = data;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e3a8a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .highlight { color: #1e3a8a; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Inscription Confirmée !</h1>
          <p>Auto École - Votre formation est réservée</p>
        </div>
        
        <div class="content">
          <p>Bonjour <span class="highlight">${nomComplet}</span>,</p>
          
          <p>Nous vous confirmons votre inscription à l'auto-école. Votre rendez-vous est bien enregistré.</p>
          
          <div class="info-box">
            <h3>📅 Détails de votre rendez-vous</h3>
            <p><strong>Date :</strong> ${dateDebut}</p>
            <p><strong>Heure :</strong> ${heurePreferee}</p>
            <p><strong>Formation :</strong> ${formation}</p>
          </div>
          
          <p>Nous vous contacterons dans les plus brefs délais pour finaliser les modalités de votre formation.</p>
          
          <p>En attendant, n'hésitez pas à nous contacter si vous avez des questions.</p>
          
          <p>Cordialement,<br>
          <strong>L'équipe Auto École</strong></p>
        </div>
        
        <div class="footer">
          <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Génère le template HTML pour l'email de notification admin
   */
  generateAdminNotificationTemplate(data) {
    const { nomComplet, email, telephone, adresse, dateDebut, heurePreferee, formation } = data;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .highlight { color: #dc2626; font-weight: bold; }
        .contact-info { background: #fef2f2; padding: 15px; border-radius: 4px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 Nouvelle Inscription</h1>
          <p>Auto École - Action requise</p>
        </div>
        
        <div class="content">
          <p>Une nouvelle inscription a été effectuée sur le site de l'auto-école.</p>
          
          <div class="info-box">
            <h3>👤 Informations personnelles</h3>
            <div class="contact-info">
              <p><strong>Nom complet :</strong> ${nomComplet}</p>
              <p><strong>Email :</strong> ${email}</p>
              <p><strong>Téléphone :</strong> ${telephone}</p>
              <p><strong>Adresse :</strong> ${adresse}</p>
            </div>
          </div>
          
          <div class="info-box">
            <h3>📅 Planning demandé</h3>
            <p><strong>Date de début :</strong> ${dateDebut}</p>
            <p><strong>Heure préférée :</strong> ${heurePreferee}</p>
          </div>
          
          <div class="info-box">
            <h3>🚗 Formation sélectionnée</h3>
            <p><strong>Type :</strong> ${formation}</p>
          </div>
          
          <p><strong>Action requise :</strong> Contacter l'étudiant pour confirmer le rendez-vous et finaliser l'inscription.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Vérifie la configuration email
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('Configuration email vérifiée avec succès');
      return true;
    } catch (error) {
      console.error('Erreur de configuration email:', error);
      return false;
    }
  }
}

module.exports = new EmailService();
