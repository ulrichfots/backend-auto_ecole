const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); 

/**
 * @swagger
 * tags:
 * name: Auth
 * description: Endpoints d'authentification et gestion de compte
 */

/**
 * @swagger
 * /api/auth/login:
 * post:
 * summary: Connexion utilisateur
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - email
 * - password
 * properties:
 * email:
 * type: string
 * example: "admin@test.com"
 * password:
 * type: string
 * example: "password123"
 * responses:
 * 200:
 * description: Connexion réussie, retourne le token
 * 401:
 * description: Identifiants invalides
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/verify-token:
 * get:
 * summary: Vérifie la validité du token JWT
 * tags: [Auth]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Token valide
 * 401:
 * description: Token invalide ou expiré
 */
router.get('/verify-token', authController.verifyToken);

/**
 * @swagger
 * /api/auth/refresh-token:
 * post:
 * summary: Rafraîchir le token d'accès
 * tags: [Auth]
 * responses:
 * 200:
 * description: Nouveau token généré
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 * post:
 * summary: Déconnexion de l'utilisateur
 * tags: [Auth]
 * responses:
 * 200:
 * description: Déconnexion réussie
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /api/auth/forgot-password:
 * post:
 * summary: Demander une réinitialisation de mot de passe
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * email:
 * type: string
 * responses:
 * 200:
 * description: Email de réinitialisation envoyé
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/auth/createUser:
 * post:
 * summary: Créer un nouvel utilisateur (Admin uniquement)
 * tags: [Auth]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * email:
 * type: string
 * password:
 * type: string
 * role:
 * type: string
 * enum: [admin, instructeur, eleve]
 * responses:
 * 201:
 * description: Utilisateur créé avec succès
 * 403:
 * description: Droits insuffisants
 */
router.post('/createUser', authController.checkAdmin, authController.createUser);

module.exports = router;