const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const { v4: uuidv4 } = require('uuid');
const admin = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');

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
 *         role:
 *           type: string
 *           enum: [admin, instructeur, eleve]
 *           default: eleve
 *           example: "eleve"
 *           description: "Rôle de l'utilisateur (par défaut: eleve)"
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
 *         userAccount:
 *           type: object
 *           properties:
 *             created:
 *               type: boolean
 *               example: true
 *               description: "Indique si un compte utilisateur a été créé"
 *             uid:
 *               type: string
 *               example: "user123"
 *               description: "ID unique de l'utilisateur créé"
 *             role:
 *               type: string
 *               enum: [admin, instructeur, eleve]
 *               example: "eleve"
 *               description: "Rôle de l'utilisateur créé"
 *             statut:
 *               type: string
 *               example: "actif"
 *               description: "Statut du compte utilisateur"
 *             isFirstLogin:
 *               type: boolean
 *               example: true
 *               description: "Indique si c'est la première connexion"
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
 *             role: "eleve"
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
 *               userAccount:
 *                 created: true
 *                 uid: "user123"
 *                 role: "eleve"
 *                 statut: "actif"
 *                 isFirstLogin: true
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
      status: 'pending', // pending, confirmed, cancelled
      role: req.body.role || 'eleve' // Rôle par défaut: eleve
    };

    // Sauvegarde de l'inscription (simulation - remplacer par Firebase)
    registrations.push(registrationData);
    console.log('Nouvelle inscription enregistrée:', registrationId);

    // Créer un compte utilisateur avec le rôle spécifié
    let userCreated = false;
    let userData = null;
    
    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUserQuery = await admin.firestore()
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (existingUserQuery.empty) {
        // Créer un nouvel utilisateur
        const newUserRef = admin.firestore().collection('users').doc();
        
        userData = {
          uid: newUserRef.id,
          email: email,
          nomComplet: nomComplet,
          telephone: telephone,
          adresse: adresse,
          dateNaissance: dateNaissance,
          role: registrationData.role,
          statut: 'actif',
          isFirstLogin: true,
          theoreticalHours: 0,
          practicalHours: 0,
          licenseType: 'B',
          formation: formation,
          registrationId: registrationId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await newUserRef.set(userData);
        userCreated = true;
        console.log('Compte utilisateur créé avec le rôle:', registrationData.role);
      } else {
        console.log('Utilisateur existe déjà avec cet email');
        const existingUser = existingUserQuery.docs[0];
        userData = existingUser.data();
        userData.uid = existingUser.id;
      }
    } catch (userError) {
      console.error('Erreur lors de la création du compte utilisateur:', userError);
      // L'inscription continue même si la création du compte échoue
    }

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
        role: registrationData.role,
        createdAt: registrationData.createdAt
      },
      userAccount: {
        created: userCreated,
        uid: userData?.uid || null,
        role: userData?.role || null,
        statut: userData?.statut || null,
        isFirstLogin: userData?.isFirstLogin || false
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

/**
 * @swagger
 * /api/registration/with-roles:
 *   get:
 *     summary: Récupère la liste des inscriptions avec les rôles des utilisateurs
 *     description: Retourne toutes les inscriptions enregistrées avec les informations de rôle des utilisateurs associés (pour l'administration)
 *     tags: [Inscription]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [tous, pending, confirmed, cancelled]
 *           default: tous
 *         description: Filtrer par statut d'inscription
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [tous, admin, instructeur, eleve]
 *           default: tous
 *         description: Filtrer par rôle utilisateur
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Nombre maximum d'inscriptions à retourner
 *     responses:
 *       200:
 *         description: Liste des inscriptions avec rôles récupérée avec succès
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
 *                     $ref: '#/components/schemas/RegistrationWithRole'
 *                 total:
 *                   type: number
 *                   example: 25
 *                 filteredCount:
 *                   type: number
 *                   example: 15
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé (pas admin)
 *       500:
 *         description: Erreur serveur
 */
router.get('/with-roles', checkAuth, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    
    if (!userData || userData.role !== 'admin') {
      return res.status(403).json({ error: 'Accès non autorisé. Seuls les administrateurs peuvent accéder à cette fonctionnalité.' });
    }

    const { status = 'tous', role = 'tous', limit = 50 } = req.query;
    const limitNum = parseInt(limit);

    // Récupérer tous les utilisateurs pour avoir leurs rôles
    const usersSnapshot = await admin.firestore().collection('users').get();
    const users = {};
    
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      users[userData.email] = {
        uid: doc.id,
        role: userData.role,
        statut: userData.statut,
        isFirstLogin: userData.isFirstLogin,
        createdAt: userData.createdAt
      };
    });

    // Filtrer les inscriptions
    let filteredRegistrations = registrations;

    // Appliquer les filtres
    if (status !== 'tous') {
      filteredRegistrations = filteredRegistrations.filter(reg => reg.status === status);
    }

    if (role !== 'tous') {
      filteredRegistrations = filteredRegistrations.filter(reg => {
        const userRole = users[reg.email]?.role;
        return userRole === role;
      });
    }

    // Limiter le nombre de résultats
    const limitedRegistrations = filteredRegistrations.slice(0, limitNum);

    // Enrichir les inscriptions avec les données utilisateur
    const enrichedRegistrations = limitedRegistrations.map(reg => ({
      id: reg.id,
      nomComplet: reg.nomComplet,
      email: reg.email,
      telephone: reg.telephone,
      dateDebut: reg.dateDebut,
      heurePreferee: reg.heurePreferee,
      formation: reg.formation,
      status: reg.status,
      createdAt: reg.createdAt,
      userRole: users[reg.email] || null
    }));

    res.status(200).json({
      success: true,
      registrations: enrichedRegistrations,
      total: registrations.length,
      filteredCount: filteredRegistrations.length,
      filters: {
        status,
        role,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des inscriptions avec rôles:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des inscriptions',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

/**
 * @swagger
 * /api/registration/{id}/user-info:
 *   get:
 *     summary: Récupère les informations utilisateur pour une inscription
 *     description: Retourne les détails de l'utilisateur associé à une inscription spécifique
 *     tags: [Inscription]
 *     security:
 *       - bearerAuth: []
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
 *         description: Informations utilisateur récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 registration:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "reg_123456789"
 *                     nomComplet:
 *                       type: string
 *                       example: "Jean Dupont"
 *                     email:
 *                       type: string
 *                       example: "jean.dupont@email.com"
 *                     formation:
 *                       type: string
 *                       example: "Permis B - Formation complète"
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 userInfo:
 *                   $ref: '#/components/schemas/UserInfo'
 *                 hasAccount:
 *                   type: boolean
 *                   example: true
 *                   description: "Indique si l'utilisateur a un compte dans le système"
 *       404:
 *         description: Inscription non trouvée
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé (pas admin)
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id/user-info', checkAuth, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    
    if (!userData || userData.role !== 'admin') {
      return res.status(403).json({ error: 'Accès non autorisé. Seuls les administrateurs peuvent accéder à cette fonctionnalité.' });
    }

    const { id } = req.params;
    const registration = registrations.find(reg => reg.id === id);

    if (!registration) {
      return res.status(404).json({
        error: 'Inscription non trouvée'
      });
    }

    // Récupérer les informations de l'utilisateur associé
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('email', '==', registration.email)
      .limit(1)
      .get();

    let userInfo = null;
    let hasAccount = false;

    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      hasAccount = true;
      
      userInfo = {
        uid: userDoc.id,
        role: userData.role,
        statut: userData.statut,
        isFirstLogin: userData.isFirstLogin,
        theoreticalHours: userData.theoreticalHours || 0,
        practicalHours: userData.practicalHours || 0,
        licenseType: userData.licenseType || 'B',
        createdAt: userData.createdAt
      };
    }

    res.status(200).json({
      success: true,
      registration: {
        id: registration.id,
        nomComplet: registration.nomComplet,
        email: registration.email,
        formation: registration.formation,
        status: registration.status,
        createdAt: registration.createdAt
      },
      userInfo,
      hasAccount
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des informations utilisateur:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des informations utilisateur',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

/**
 * @swagger
 * /api/registration/create-user:
 *   post:
 *     summary: Créer un compte utilisateur avec un rôle spécifique
 *     description: Crée directement un compte utilisateur avec un rôle défini (pour les administrateurs)
 *     tags: [Inscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nomComplet
 *               - email
 *               - role
 *             properties:
 *               nomComplet:
 *                 type: string
 *                 example: "Jean Dupont"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jean.dupont@email.com"
 *               telephone:
 *                 type: string
 *                 example: "0123456789"
 *               adresse:
 *                 type: string
 *                 example: "123 Rue de la Paix, 75001 Paris"
 *               dateNaissance:
 *                 type: string
 *                 format: date
 *                 example: "1990-05-15"
 *               role:
 *                 type: string
 *                 enum: [admin, instructeur, eleve]
 *                 example: "instructeur"
 *                 description: "Rôle de l'utilisateur à créer"
 *               formation:
 *                 type: string
 *                 example: "Permis B - Formation complète"
 *               licenseType:
 *                 type: string
 *                 enum: [A, B, C, D]
 *                 default: B
 *                 example: "B"
 *           example:
 *             nomComplet: "Marie Instructeur"
 *             email: "marie.instructeur@auto-ecole.fr"
 *             telephone: "0987654321"
 *             adresse: "456 Avenue des Instructeurs, 75002 Paris"
 *             dateNaissance: "1985-03-20"
 *             role: "instructeur"
 *             formation: "Formation Instructeur"
 *             licenseType: "B"
 *     responses:
 *       201:
 *         description: Compte utilisateur créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Compte utilisateur créé avec succès"
 *                 user:
 *                   type: object
 *                   properties:
 *                     uid:
 *                       type: string
 *                       example: "user123"
 *                     email:
 *                       type: string
 *                       example: "marie.instructeur@auto-ecole.fr"
 *                     nomComplet:
 *                       type: string
 *                       example: "Marie Instructeur"
 *                     role:
 *                       type: string
 *                       example: "instructeur"
 *                     statut:
 *                       type: string
 *                       example: "actif"
 *                     isFirstLogin:
 *                       type: boolean
 *                       example: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Données invalides ou utilisateur existe déjà
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé (pas admin)
 *       500:
 *         description: Erreur serveur
 */
router.post('/create-user', checkAuth, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    
    if (!userData || userData.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès non autorisé. Seuls les administrateurs peuvent créer des comptes utilisateur.' 
      });
    }

    const {
      nomComplet,
      email,
      telephone,
      adresse,
      dateNaissance,
      role,
      formation,
      licenseType = 'B'
    } = req.body;

    // Validation des données requises
    const requiredFields = ['nomComplet', 'email', 'role'];
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

    // Validation du rôle
    const validRoles = ['admin', 'instructeur', 'eleve'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Rôle invalide',
        details: `Le rôle doit être l'un des suivants: ${validRoles.join(', ')}`
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUserQuery = await admin.firestore()
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!existingUserQuery.empty) {
      return res.status(400).json({
        error: 'Utilisateur existe déjà',
        details: 'Un utilisateur avec cet email existe déjà dans le système'
      });
    }

    // Créer le nouvel utilisateur
    const newUserRef = admin.firestore().collection('users').doc();
    
    const userData = {
      uid: newUserRef.id,
      email: email,
      nomComplet: nomComplet,
      telephone: telephone || '',
      adresse: adresse || '',
      dateNaissance: dateNaissance || '',
      role: role,
      statut: 'actif',
      isFirstLogin: true,
      theoreticalHours: 0,
      practicalHours: 0,
      licenseType: licenseType,
      formation: formation || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await newUserRef.set(userData);
    console.log('Compte utilisateur créé:', newUserRef.id, 'avec le rôle:', role);

    res.status(201).json({
      success: true,
      message: 'Compte utilisateur créé avec succès',
      user: {
        uid: newUserRef.id,
        email: userData.email,
        nomComplet: userData.nomComplet,
        role: userData.role,
        statut: userData.statut,
        isFirstLogin: userData.isFirstLogin,
        createdAt: userData.createdAt
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création du compte utilisateur:', error);
    res.status(500).json({
      error: 'Erreur lors de la création du compte utilisateur',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

module.exports = router;
