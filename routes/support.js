const express = require('express');
const router = express.Router();
const admin = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');
const emailService = require('../services/emailService');

/**
 * @swagger
 * /api/support/contact:
 *   post:
 *     summary: Envoyer un message de contact au support
 *     tags: [Support]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nomComplet
 *               - email
 *               - sujet
 *               - message
 *             properties:
 *               nomComplet:
 *                 type: string
 *                 example: "Marie Dubois"
 *                 description: "Nom complet de l'expéditeur"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "marie.dubois@example.com"
 *                 description: "Adresse email de l'expéditeur"
 *               telephone:
 *                 type: string
 *                 example: "06 12 34 56 78"
 *                 description: "Numéro de téléphone (optionnel)"
 *               sujet:
 *                 type: string
 *                 example: "Question sur mon inscription"
 *                 description: "Sujet du message"
 *               priorite:
 *                 type: string
 *                 enum: [Faible, Normale, Élevée, Urgente]
 *                 default: "Normale"
 *                 example: "Normale"
 *                 description: "Priorité du message"
 *               message:
 *                 type: string
 *                 example: "Bonjour, j'aimerais savoir..."
 *                 description: "Contenu du message"
 *     responses:
 *       200:
 *         description: Message envoyé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Message envoyé avec succès"
 *                 ticketId:
 *                   type: string
 *                   example: "TICKET_123456"
 *                 responseTime:
 *                   type: string
 *                   example: "Réponse sous 24h"
 *       400:
 *         description: Données invalides
 *       500:
 *         description: Erreur serveur
 */
router.post('/contact', async (req, res) => {
  try {
    const { nomComplet, email, telephone, sujet, priorite = 'Normale', message } = req.body;

    // Validation des données requises
    const requiredFields = ['nomComplet', 'email', 'sujet', 'message'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Données invalides',
        details: missingFields.map(field => `Le champ '${field}' est requis`)
      });
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Format d\'email invalide'
      });
    }

    // Génération d'un ID de ticket unique
    const ticketId = `TICKET_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Préparation des données du ticket
    const ticketData = {
      id: ticketId,
      nomComplet,
      email,
      telephone: telephone || null,
      sujet,
      priorite,
      message,
      status: 'nouveau',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Sauvegarde du ticket dans Firestore
    await admin.firestore().collection('support_tickets').doc(ticketId).set(ticketData);

    // Envoi de l'email de notification à l'équipe support
    try {
      const emailData = {
        to: process.env.SUPPORT_EMAIL || 'support@auto-ecole.fr',
        subject: `[${priorite}] Nouveau ticket de support - ${sujet}`,
        html: `
          <h2>Nouveau ticket de support reçu</h2>
          <p><strong>Ticket ID:</strong> ${ticketId}</p>
          <p><strong>Priorité:</strong> ${priorite}</p>
          <p><strong>Expéditeur:</strong> ${nomComplet}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${telephone ? `<p><strong>Téléphone:</strong> ${telephone}</p>` : ''}
          <p><strong>Sujet:</strong> ${sujet}</p>
          <p><strong>Message:</strong></p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
            ${message.replace(/\n/g, '<br>')}
          </div>
          <hr>
          <p><small>Ce ticket a été créé automatiquement depuis le formulaire de contact.</small></p>
        `
      };

      await emailService.sendEmail(emailData);
    } catch (emailError) {
      console.error('Erreur envoi email support:', emailError);
      // On continue même si l'email échoue
    }

    // Envoi d'un email de confirmation à l'expéditeur
    try {
      const confirmationEmail = {
        to: email,
        subject: 'Confirmation de réception - Votre message a été reçu',
        html: `
          <h2>Votre message a été reçu</h2>
          <p>Bonjour ${nomComplet},</p>
          <p>Nous avons bien reçu votre message concernant : <strong>${sujet}</strong></p>
          <p><strong>Numéro de ticket:</strong> ${ticketId}</p>
          <p><strong>Priorité:</strong> ${priorite}</p>
          <p>Notre équipe vous répondra dans les plus brefs délais.</p>
          <hr>
          <p><strong>Votre message:</strong></p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
            ${message.replace(/\n/g, '<br>')}
          </div>
          <hr>
          <p><small>Auto École - Service Client<br>
          Email: support@auto-ecole.fr<br>
          Téléphone: 01 23 45 67 89</small></p>
        `
      };

      await emailService.sendEmail(confirmationEmail);
    } catch (emailError) {
      console.error('Erreur envoi email confirmation:', emailError);
      // On continue même si l'email de confirmation échoue
    }

    res.status(200).json({
      message: 'Message envoyé avec succès',
      ticketId,
      responseTime: 'Réponse sous 24h'
    });
  } catch (error) {
    console.error('Erreur envoi message support:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
  }
});

/**
 * @swagger
 * /api/support/tickets:
 *   get:
 *     summary: Récupérer les tickets de support de l'utilisateur connecté
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [tous, nouveau, en_cours, résolu, fermé]
 *           default: tous
 *         description: Filtrer par statut
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Nombre maximum de tickets à retourner
 *     responses:
 *       200:
 *         description: Tickets récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tickets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "TICKET_123456"
 *                       sujet:
 *                         type: string
 *                         example: "Question sur mon inscription"
 *                       priorite:
 *                         type: string
 *                         example: "Normale"
 *                       status:
 *                         type: string
 *                         example: "nouveau"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 totalCount:
 *                   type: number
 *                   example: 3
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/tickets', checkAuth, async (req, res) => {
  try {
    const { status = 'tous', limit = 20 } = req.query;
    const userId = req.user.uid;
    const limitNum = parseInt(limit);

    // Récupérer l'email de l'utilisateur
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    let query = admin.firestore()
      .collection('support_tickets')
      .where('email', '==', userData.email)
      .orderBy('createdAt', 'desc');

    // Appliquer le filtre de statut si spécifié
    if (status !== 'tous') {
      query = query.where('status', '==', status);
    }

    const ticketsSnapshot = await query.limit(limitNum).get();
    
    const tickets = ticketsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        sujet: data.sujet,
        priorite: data.priorite,
        status: data.status,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      };
    });

    res.status(200).json({
      tickets,
      totalCount: tickets.length
    });
  } catch (error) {
    console.error('Erreur récupération tickets:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des tickets' });
  }
});

/**
 * @swagger
 * /api/support/faq:
 *   get:
 *     summary: Récupérer la liste des questions fréquemment posées
 *     tags: [Support]
 *     parameters:
 *       - in: query
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [tous, inscription, cours, paiement, technique]
 *           default: tous
 *         description: Filtrer par catégorie
 *     responses:
 *       200:
 *         description: FAQ récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 faq:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FAQItem'
 *       500:
 *         description: Erreur serveur
 */
router.get('/faq', async (req, res) => {
  try {
    const { category = 'tous' } = req.query;

    // Pour cette démo, on retourne des FAQ statiques
    // En production, vous pourriez les stocker dans Firestore
    let faqData = [
      {
        id: 'faq_001',
        question: 'Comment s\'inscrire à un cours de conduite ?',
        reponse: 'Pour vous inscrire, rendez-vous sur notre site web, remplissez le formulaire d\'inscription en ligne ou contactez-nous directement par téléphone au 01 23 45 67 89.',
        category: 'inscription',
        order: 1
      },
      {
        id: 'faq_002',
        question: 'Quels sont les documents nécessaires pour l\'inscription ?',
        reponse: 'Vous devez fournir : une pièce d\'identité, une photo d\'identité, un justificatif de domicile, et si vous êtes mineur, une autorisation parentale.',
        category: 'inscription',
        order: 2
      },
      {
        id: 'faq_003',
        question: 'Comment réserver une leçon de conduite ?',
        reponse: 'Vous pouvez réserver vos leçons directement depuis votre espace élève en ligne, ou en nous contactant par téléphone. Les créneaux sont disponibles du lundi au samedi.',
        category: 'cours',
        order: 3
      },
      {
        id: 'faq_004',
        question: 'Quels sont les modes de paiement acceptés ?',
        reponse: 'Nous acceptons les paiements par carte bancaire, virement bancaire, chèque et espèces. Vous pouvez également régler en plusieurs fois.',
        category: 'paiement',
        order: 4
      },
      {
        id: 'faq_005',
        question: 'Que faire si j\'ai un problème technique sur le site ?',
        reponse: 'Si vous rencontrez un problème technique, contactez notre support technique par email à support@auto-ecole.fr ou par téléphone. Nous vous aiderons rapidement.',
        category: 'technique',
        order: 5
      }
    ];

    // Filtrer par catégorie si spécifié
    if (category !== 'tous') {
      faqData = faqData.filter(item => item.category === category);
    }

    res.status(200).json({ faq: faqData });
  } catch (error) {
    console.error('Erreur récupération FAQ:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la FAQ' });
  }
});

/**
 * @swagger
 * /api/support/info:
 *   get:
 *     summary: Récupérer les informations de contact du support
 *     tags: [Support]
 *     responses:
 *       200:
 *         description: Informations de contact récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContactInfo'
 *       500:
 *         description: Erreur serveur
 */
router.get('/info', async (req, res) => {
  try {
    const contactInfo = {
      contact: {
        telephone: {
          number: '01 23 45 67 89',
          hours: 'Lundi - Vendredi : 8h00 - 18h00'
        },
        email: {
          address: 'support@auto-ecole.fr',
          responseTime: 'Réponse sous 24h'
        },
        address: {
          location: '123 Rue de la Paix, 75001 Paris',
          hours: 'Lun-Ven: 8h-18h, Sam: 9h-16h'
        }
      }
    };

    res.status(200).json(contactInfo);
  } catch (error) {
    console.error('Erreur récupération info contact:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des informations de contact' });
  }
});

module.exports = router;
