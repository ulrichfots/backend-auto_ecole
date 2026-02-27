const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); 

/**
 * @swagger
 * tags:
 * name: Auth
 * description: Endpoints d'authentification
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
 * description: Succès
 * 401:
 * description: Identifiants invalides
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/verify-token:
 * get:
 * summary: Vérifie le token
 * tags: [Auth]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Token valide
 */
router.get('/verify-token', authController.verifyToken);

/**
 * @swagger
 * /api/auth/forgot-password:
 * post:
 * summary: Mot de passe oublié
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
 * description: Email envoyé
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/auth/createUser:
 * post:
 * summary: Créer un utilisateur (Admin)
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
 * description: Créé
 */
router.post('/createUser', authController.checkAdmin, authController.createUser);

module.exports = router;