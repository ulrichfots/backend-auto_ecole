const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { checkAuth, checkAdmin } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Endpoints d'authentification
 */

/**
 * 🔓 ROUTES PUBLIQUES
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     tags: [Auth]
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
 * /api/auth/forgot-password:
 *   post:
 *     summary: Mot de passe oublié
 *     tags: [Auth]
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
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * 🔐 ROUTES PROTÉGÉES
 */

/**
 * @swagger
 * /api/auth/verify-token:
 *   get:
 *     summary: Vérifie le token JWT
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token valide
 *       401:
 *         description: Token manquant ou invalide
 */
router.get('/verify-token', checkAuth, authController.verifyToken);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Rafraîchit le token JWT
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Nouveau token généré
 *       401:
 *         description: Token invalide
 */
router.post('/refresh-token', checkAuth, authController.refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Déconnexion utilisateur
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 */
router.post('/logout', checkAuth, authController.logout);

/**
 * 👑 ROUTES ADMIN
 */

/**
 * @swagger
 * /api/auth/createUser:
 *   post:
 *     summary: Crée un nouvel utilisateur (admin uniquement)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
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
 *                 example: "admin"
 *     responses:
 *       201:
 *         description: Utilisateur créé
 *       403:
 *         description: Non autorisé
 */
router.post('/createUser', checkAuth, checkAdmin, authController.createUser);

module.exports = router;