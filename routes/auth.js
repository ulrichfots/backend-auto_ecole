const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Endpoints d'authentification
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@test.com"
 *               password:
 *                 type: string
 *                 example: "MotDePasse123"
 *     responses:
 *       200:
 *         description: Succès
 *       401:
 *         description: Email ou mot de passe incorrect
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/verify-token:
 *   get:
 *     summary: Vérifie le token JWT
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token valide
 *       403:
 *         description: Token invalide ou expiré
 */
router.get('/verify-token', authController.verifyToken);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Rafraîchit le token JWT
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Nouveau token généré
 *       401:
 *         description: Refresh token invalide
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Déconnexion utilisateur
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Mot de passe oublié
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@test.com"
 *     responses:
 *       200:
 *         description: Email de réinitialisation envoyé
 *       404:
 *         description: Utilisateur non trouvé
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/auth/createUser:
 *   post:
 *     summary: Crée un nouvel utilisateur (admin uniquement)
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "nouveluser@test.com"
 *               password:
 *                 type: string
 *                 example: "MotDePasse123"
 *               role:
 *                 type: string
 *                 example: "user"
 *     responses:
 *       201:
 *         description: Utilisateur créé
 *       400:
 *         description: Données invalides
 *       403:
 *         description: Non autorisé
 */
router.post('/createUser', authController.checkAdmin, authController.createUser);

module.exports = router;