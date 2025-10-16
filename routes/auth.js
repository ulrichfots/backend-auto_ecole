const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { validate, schemas } = require('../middlewares/validationMiddleware');
const { checkAuth } = require('../middlewares/authMiddleware');
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
        nom: userData.nom || userData.nomComplet || '',
        nomComplet: userData.nomComplet || userData.nom || '',
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
 * /api/auth/verify-token:
 *   get:
 *     summary: Vérifier la validité d'un token
 *     description: Vérifie si un token d'authentification est valide et retourne les informations utilisateur
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token valide
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
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
 *                     statut:
 *                       type: string
 *                       example: "actif"
 *                     isFirstLogin:
 *                       type: boolean
 *                       example: false
 *                     profileImageUrl:
 *                       type: string
 *                       nullable: true
 *       401:
 *         description: Token invalide
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Token invalide"
 */
router.get('/verify-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        valid: false,
        error: 'Token non fourni'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Récupérer les informations utilisateur depuis Firestore
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      return res.status(401).json({
        valid: false,
        error: 'Utilisateur non trouvé'
      });
    }

    const userData = userDoc.data();

    res.status(200).json({
      valid: true,
      user: {
        uid: userDoc.id,
        email: userData.email,
        nom: userData.nom || userData.nomComplet || '',
        nomComplet: userData.nomComplet || userData.nom || '',
        role: userData.role,
        statut: userData.statut,
        isFirstLogin: userData.isFirstLogin || false,
        profileImageUrl: userData.profileImageUrl || null
      }
    });

  } catch (error) {
    console.error('Erreur vérification token:', error);
    res.status(401).json({
      valid: false,
      error: 'Token invalide'
    });
  }
});

/**
 * @swagger
 * /api/auth/debug-token:
 *   get:
 *     summary: Debug du token d'authentification
 *     description: Endpoint de diagnostic pour analyser les problèmes de token
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informations de debug du token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokenInfo:
 *                   type: object
 *                   description: "Informations décodées du token"
 *                 userInfo:
 *                   type: object
 *                   description: "Informations utilisateur depuis Firestore"
 *                 debug:
 *                   type: object
 *                   description: "Informations de debug"
 *       401:
 *         description: Token invalide ou manquant
 */

/**
 * @swagger
 * /api/auth/test-token-compatibility:
 *   get:
 *     summary: Test de compatibilité des tokens
 *     description: Teste si le serveur accepte les custom tokens et ID tokens
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test de compatibilité réussi
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
 *                   example: "Token accepté avec succès"
 *                 tokenType:
 *                   type: string
 *                   enum: [idToken, customToken]
 *                   example: "customToken"
 *                 user:
 *                   type: object
 *                   description: "Informations utilisateur"
 *       401:
 *         description: Token invalide ou manquant
 */
router.get('/debug-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Aucun header Authorization fourni',
        debug: {
          hasAuthHeader: false,
          authHeader: null
        }
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Format Authorization incorrect (doit commencer par "Bearer ")',
        debug: {
          hasAuthHeader: true,
          authHeader: authHeader,
          expectedFormat: 'Bearer <token>'
        }
      });
    }

    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({
        error: 'Token manquant après "Bearer "',
        debug: {
          hasAuthHeader: true,
          authHeader: authHeader,
          extractedToken: null
        }
      });
    }

    // Tenter de décoder le token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (verifyError) {
      return res.status(401).json({
        error: 'Token invalide ou expiré',
        debug: {
          hasAuthHeader: true,
          authHeader: authHeader,
          extractedToken: token.substring(0, 20) + '...',
          verifyError: verifyError.message,
          tokenType: 'ID Token attendu'
        }
      });
    }

    // Récupérer les informations utilisateur
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      return res.status(401).json({
        error: 'Utilisateur non trouvé dans Firestore',
        debug: {
          hasAuthHeader: true,
          extractedToken: token.substring(0, 20) + '...',
          decodedToken: {
            uid: decodedToken.uid,
            email: decodedToken.email,
            iat: decodedToken.iat,
            exp: decodedToken.exp
          },
          userExists: false
        }
      });
    }

    const userData = userDoc.data();

    res.status(200).json({
      success: true,
      tokenInfo: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        issuedAt: new Date(decodedToken.iat * 1000).toISOString(),
        expiresAt: new Date(decodedToken.exp * 1000).toISOString(),
        isExpired: Date.now() > decodedToken.exp * 1000
      },
      userInfo: {
        uid: userDoc.id,
        email: userData.email,
        nom: userData.nom || userData.nomComplet || '',
        nomComplet: userData.nomComplet || userData.nom || '',
        role: userData.role,
        statut: userData.statut,
        isFirstLogin: userData.isFirstLogin || false
      },
      debug: {
        hasAuthHeader: true,
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20) + '...',
        userExists: true,
        tokenType: 'ID Token valide'
      }
    });

  } catch (error) {
    console.error('Erreur debug token:', error);
    res.status(500).json({
      error: 'Erreur interne lors du debug',
      debug: {
        errorMessage: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});

router.get('/test-token-compatibility', checkAuth, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Token accepté avec succès',
      tokenType: req.user.tokenType || 'unknown',
      user: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        nom: req.user.nom
      },
      debug: {
        tokenLength: req.headers.authorization?.split('Bearer ')[1]?.length || 0,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erreur test compatibilité:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du test de compatibilité'
    });
  }
});

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Rafraîchir le token d'authentification
 *     description: Génère un nouveau token d'authentification pour l'utilisateur
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rememberMe:
 *                 type: boolean
 *                 example: true
 *                 description: "Se souvenir de l'utilisateur pour un token longue durée"
 *     responses:
 *       200:
 *         description: Token rafraîchi avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Token rafraîchi avec succès"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 expiresIn:
 *                   type: string
 *                   example: "1h"
 *       401:
 *         description: Token invalide
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token invalide"
 */
router.post('/refresh-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        error: 'Token non fourni'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Récupérer les informations utilisateur
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      return res.status(401).json({
        error: 'Utilisateur non trouvé'
      });
    }

    const userData = userDoc.data();
    const { rememberMe } = req.body;

    // Générer un nouveau token
    const customToken = await admin.auth().createCustomToken(decodedToken.uid, {
      role: userData.role,
      email: userData.email
    });

    const expiresIn = rememberMe ? '7d' : '1d';

    res.status(200).json({
      message: 'Token rafraîchi avec succès',
      token: customToken,
      expiresIn: expiresIn
    });

  } catch (error) {
    console.error('Erreur refresh token:', error);
    res.status(401).json({
      error: 'Token invalide'
    });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Déconnexion utilisateur
 *     description: Déconnecte l'utilisateur (côté client, le token sera invalidé)
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Déconnexion réussie"
 *       401:
 *         description: Token invalide
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Token invalide"
 */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        error: 'Token non fourni'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    await admin.auth().verifyIdToken(token);

    // Note: Firebase ne permet pas d'invalider les tokens côté serveur
    // La déconnexion se fait côté client en supprimant le token du stockage local
    
    res.status(200).json({
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    console.error('Erreur logout:', error);
    res.status(401).json({
      error: 'Token invalide'
    });
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Demande de réinitialisation de mot de passe
 *     description: Envoie un email de réinitialisation de mot de passe à l'utilisateur
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "utilisateur@example.com"
 *                 description: "Adresse email de l'utilisateur"
 *     responses:
 *       200:
 *         description: Email de réinitialisation envoyé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Email de réinitialisation envoyé"
 *                 email:
 *                   type: string
 *                   example: "utilisateur@example.com"
 *                 expiresIn:
 *                   type: string
 *                   example: "10 minutes"
 *       400:
 *         description: Email invalide ou utilisateur non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Email invalide"
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Erreur interne du serveur"
 */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    // Vérifier les données d'entrée
    if (!email) {
      return res.status(400).json({
        error: 'Email requis'
      });
    }

    // Valider le format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Format d\'email invalide'
      });
    }

    // Vérifier si l'utilisateur existe
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return res.status(400).json({
        error: 'Aucun compte trouvé avec cette adresse email'
      });
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    // Générer un token de réinitialisation sécurisé
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Sauvegarder le token dans Firestore
    await admin.firestore().collection('password_reset_tokens').doc(resetToken).set({
      userId: userDoc.id,
      email: email,
      expiresAt: expiresAt,
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Envoyer l'email de réinitialisation
    await emailService.sendPasswordResetEmail(email, resetToken, userData.nom || userData.nomComplet || 'Utilisateur');

    res.status(200).json({
      message: 'Email de réinitialisation envoyé',
      email: email,
      expiresIn: '10 minutes'
    });

  } catch (error) {
    console.error('Erreur forgot password:', error);
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
