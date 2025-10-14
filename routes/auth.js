const express = require('express');
const router = express.Router();
const admin = require('../firebase');
const { validate, schemas } = require('../middlewares/validationMiddleware');
const emailService = require('../services/emailService');
const crypto = require('crypto');

// Middleware pour vérifier si l'utilisateur est un administrateur
const checkAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token non fourni' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Vérifier le rôle admin dans Firestore
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token invalide' });
  }
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     description: Authentifie un utilisateur avec email et mot de passe
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "utilisateur@example.com"
 *                 description: "Adresse email de l'utilisateur"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "motdepasse123"
 *                 description: "Mot de passe de l'utilisateur"
 *               rememberMe:
 *                 type: boolean
 *                 example: true
 *                 description: "Se souvenir de l'utilisateur (optionnel)"
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Connexion réussie"
 *                 user:
 *                   type: object
 *                   properties:
 *                     uid:
 *                       type: string
 *                       example: "abc123def456"
 *                     email:
 *                       type: string
 *                       example: "utilisateur@example.com"
 *                     nom:
 *                       type: string
 *                       example: "Jean Dupont"
 *                     role:
 *                       type: string
 *                       enum: [admin, instructeur, eleve]
 *                       example: "eleve"
 *                       description: "Rôle de l'utilisateur dans le système"
 *                     statut:
 *                       type: string
 *                       example: "actif"
 *                     isFirstLogin:
 *                       type: boolean
 *                       example: false
 *                     profileImageUrl:
 *                       type: string
 *                       nullable: true
 *                       example: "https://example.com/profile.jpg"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                   description: "Token JWT pour l'authentification"
 *                 expiresIn:
 *                   type: string
 *                   example: "1h"
 *                   description: "Durée de validité du token"
 *       400:
 *         description: Données de connexion invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Email ou mot de passe incorrect
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Email ou mot de passe incorrect"
 *       403:
 *         description: Compte suspendu ou en attente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Votre compte est en attente de validation"
 *                 status:
 *                   type: string
 *                   example: "en attente"
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', async (req, res) => {
  const { email, password, rememberMe } = req.body;

  try {
    // Vérifier les données d'entrée
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email et mot de passe requis'
      });
    }

    // Valider le format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Format d\'email invalide'
      });
    }

    // Vérifier que le mot de passe a au moins 6 caractères
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Récupérer l'utilisateur depuis Firestore
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return res.status(401).json({
        error: 'Email ou mot de passe incorrect'
      });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    // Vérifier le statut du compte
    if (userData.statut === 'suspendu') {
      return res.status(403).json({
        error: 'Votre compte a été suspendu. Contactez l\'administration.'
      });
    }

    if (userData.statut === 'en attente') {
      return res.status(403).json({
        error: 'Votre compte est en attente de validation',
        status: 'en attente'
      });
    }

    // Générer un token personnalisé avec Firebase Admin
    const customToken = await admin.auth().createCustomToken(userDoc.id, {
      role: userData.role,
      email: userData.email
    });

    // Calculer la durée d'expiration du token
    const expiresIn = rememberMe ? '7d' : '1d';

    // Retourner les informations utilisateur (avec le rôle inclus)
    res.status(200).json({
      message: 'Connexion réussie',
      user: {
        uid: userDoc.id,
        email: userData.email,
        nom: userData.nom,
        role: userData.role, // ✅ Rôle inclus dans la réponse
        statut: userData.statut,
        isFirstLogin: userData.isFirstLogin || false,
        profileImageUrl: userData.profileImageUrl || null
      },
      token: customToken,
      expiresIn: expiresIn
    });

  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

/**
 * @swagger
 * /api/auth/createUser:
 *   post:
 *     summary: Créer un nouvel utilisateur (Admin uniquement)
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - nom
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "utilisateur@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "motdepasse123"
 *               nom:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "Jean Dupont"
 *               role:
 *                 type: string
 *                 enum: [admin, instructeur, eleve]
 *                 example: "eleve"
 *     responses:
 *       200:
 *         description: Utilisateur créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Utilisateur créé avec succès"
 *                 userId:
 *                   type: string
 *                   example: "abc123def456"
 *       400:
 *         description: Erreur de validation ou de création
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Données invalides"
 *                 details:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé (pas admin)
 */
router.post('/createUser', checkAdmin, validate(schemas.createUser), async (req, res) => {
  const { email, password, nom, role } = req.body;

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
    });

    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email,
      nom,
      role,
      statut: 'en attente', // Statut par défaut
      isFirstLogin: true, // Flag pour la première connexion
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      profileImageUrl: null,
      // Champs spécifiques aux élèves
      theoreticalHours: 0,
      practicalHours: 0,
      theoreticalHoursMin: 40, // Minimum requis
      practicalHoursMin: 20, // Minimum requis
      licenseType: 'B', // Type de permis par défaut
      nextExam: null,
      monitorComments: ''
    });

    res.status(200).json({
      message: 'Utilisateur créé avec succès',
      userId: userRecord.uid
    });
  } catch (error) {
    console.error('Erreur création utilisateur:', error);
    res.status(400).json({
      error: 'Erreur lors de la création du compte',
      details: error.message
    });
  }
});

module.exports = router;
