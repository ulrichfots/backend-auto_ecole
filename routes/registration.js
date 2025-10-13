const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const { v4: uuidv4 } = require('uuid');

// Simulation d'une base de données en mémoire (remplacer par Firebase ou autre BDD)
let registrations = [];

/**
 * @swagger
 * components:
 *   schemas:
 *     RegistrationData:
 *       type: object
 *       required:
 *         - nomComplet
 *         - email
 *         - telephone
 *         - adresse
 *         - dateNaissance
 *         - dateDebut
 *         - heurePreferee
 *         - formation
 *       properties:
 *         nomComplet:
 *           type: string
 *           example: "Jean Dupont"
 *           description: "Nom complet de l'étudiant"
 *         email:
 *           type: string
 *           format: email
 *           example: "jean.dupont@email.com"
 *           description: "Adresse email de l'étudiant"
 *         telephone:
 *           type: string
 *           example: "0123456789"
 *           description: "Numéro de téléphone"
 *         adresse:
 *           type: string
 *           example: "123 Rue de la Paix, 75001 Paris"
 *           description: "Adresse complète"
 *         dateNaissance:
 *           type: string
 *           format: date
 *           example: "1990-05-15"
 *           description: "Date de naissance"
 *         dateDebut:
 *           type: string
 *           format: date
 *           example: "2024-02-15"
 *           description: "Date de début souhaitée"
 *         heurePreferee:
 *           type: string
 *           example: "14:00"
 *           description: "Heure préférée"
 *         formation:
 *           type: string
 *           example: "Permis B - Formation complète"
 *           description: "Type de formation"
 *     
 *     RegistrationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Inscription enregistrée avec succès"
 *         registrationId:
 *           type: string
 *           example: "reg_123456789"
 *         emailsSent:
 *           type: object
 *           properties:
 *             student:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 messageId:
 *                   type: string
 *                   example: "email_123"
 *             admin:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 messageId:
 *                   type: string
 *                   example: "email_456"
 */

/**
 * @swagger
 * /api/registration:
 *   post:
 *     summary: Enregistre une nouvelle inscription d'étudiant
 *     description: Sauvegarde les données d'inscription et envoie les emails de confirmation
 *     tags: [Inscription]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegistrationData'
 *           example:
 *             nomComplet: "Jean Dupont"
 *             email: "jean.dupont@email.com"
 *             telephone: "0123456789"
 *             adresse: "123 Rue de la Paix, 75001 Paris"
 *             dateNaissance: "1990-05-15"
 *             dateDebut: "2024-02-15"
 *             heurePreferee: "14:00"
 *             formation: "Permis B - Formation complète"
 *     responses:
 *       201:
 *         description: Inscription enregistrée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegistrationResponse'
 *             example:
 *               success: true
 *               message: "Inscription enregistrée avec succès"
 *               registrationId: "reg_123456789"
 *               emailsSent:
 *                 student:
 *                   success: true
 *                   messageId: "email_123"
 *                 admin:
 *                   success: true
 *                   messageId: "email_456"
 *       400:
 *         description: Données d'inscription invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Données d'inscription invalides"
 *               details: ["Le champ 'nomComplet' est requis"]
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Erreur lors de l'enregistrement de l'inscription"
 */
router.post('/', async (req, res) => {
  try {
    const {
      nomComplet,
      email,
      telephone,
      adresse,
      dateNaissance,
      dateDebut,
      heurePreferee,
      formation
    } = req.body;

    // Validation des données requises
    const requiredFields = ['nomComplet', 'email', 'telephone', 'adresse', 'dateNaissance', 'dateDebut', 'heurePreferee', 'formation'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Données d\'inscription invalides',
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

    // Génération d'un ID unique pour l'inscription
    const registrationId = `reg_${uuidv4().replace(/-/g, '').substring(0, 12)}`;

    // Préparation des données d'inscription
    const registrationData = {
      id: registrationId,
      nomComplet,
      email,
      telephone,
      adresse,
      dateNaissance,
      dateDebut,
      heurePreferee,
      formation,
      createdAt: new Date().toISOString(),
      status: 'pending' // pending, confirmed, cancelled
    };

    // Sauvegarde de l'inscription (simulation - remplacer par Firebase)
    registrations.push(registrationData);
    console.log('Nouvelle inscription enregistrée:', registrationId);

    // Envoi des emails
    const emailsSent = {
      student: { success: false },
      admin: { success: false }
    };

    try {
      // Email de confirmation à l'étudiant
      const studentEmailResult = await emailService.sendConfirmationToStudent(registrationData);
      emailsSent.student = studentEmailResult;
    } catch (emailError) {
      console.error('Erreur envoi email étudiant:', emailError.message);
      emailsSent.student = { success: false, error: emailError.message };
    }

    try {
      // Email de notification à l'admin
      const adminEmailResult = await emailService.sendNotificationToAdmin(registrationData);
      emailsSent.admin = adminEmailResult;
    } catch (emailError) {
      console.error('Erreur envoi email admin:', emailError.message);
      emailsSent.admin = { success: false, error: emailError.message };
    }

    // Réponse de succès
    res.status(201).json({
      success: true,
      message: 'Inscription enregistrée avec succès',
      registrationId,
      emailsSent,
      registration: {
        id: registrationId,
        nomComplet,
        email,
        dateDebut,
        heurePreferee,
        formation,
        createdAt: registrationData.createdAt
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'inscription:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'enregistrement de l\'inscription',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

/**
 * @swagger
 * /api/registration:
 *   get:
 *     summary: Récupère la liste des inscriptions
 *     description: Retourne toutes les inscriptions enregistrées (pour l'administration)
 *     tags: [Inscription]
 *     responses:
 *       200:
 *         description: Liste des inscriptions récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 registrations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "reg_123456789"
 *                       nomComplet:
 *                         type: string
 *                         example: "Jean Dupont"
 *                       email:
 *                         type: string
 *                         example: "jean.dupont@email.com"
 *                       telephone:
 *                         type: string
 *                         example: "0123456789"
 *                       dateDebut:
 *                         type: string
 *                         example: "2024-02-15"
 *                       heurePreferee:
 *                         type: string
 *                         example: "14:00"
 *                       formation:
 *                         type: string
 *                         example: "Permis B - Formation complète"
 *                       status:
 *                         type: string
 *                         enum: [pending, confirmed, cancelled]
 *                         example: "pending"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-15T10:30:00Z"
 */
router.get('/', (req, res) => {
  try {
    // Retourner les inscriptions sans les données sensibles
    const publicRegistrations = registrations.map(reg => ({
      id: reg.id,
      nomComplet: reg.nomComplet,
      email: reg.email,
      telephone: reg.telephone,
      dateDebut: reg.dateDebut,
      heurePreferee: reg.heurePreferee,
      formation: reg.formation,
      status: reg.status,
      createdAt: reg.createdAt
    }));

    res.json({
      success: true,
      registrations: publicRegistrations,
      total: registrations.length
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des inscriptions:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des inscriptions',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

/**
 * @swagger
 * /api/registration/{id}:
 *   get:
 *     summary: Récupère une inscription par son ID
 *     description: Retourne les détails d'une inscription spécifique
 *     tags: [Inscription]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "reg_123456789"
 *         description: ID de l'inscription
 *     responses:
 *       200:
 *         description: Inscription trouvée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 registration:
 *                   $ref: '#/components/schemas/RegistrationData'
 *       404:
 *         description: Inscription non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Inscription non trouvée"
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const registration = registrations.find(reg => reg.id === id);

    if (!registration) {
      return res.status(404).json({
        error: 'Inscription non trouvée'
      });
    }

    res.json({
      success: true,
      registration
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'inscription:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération de l\'inscription',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

module.exports = router;
