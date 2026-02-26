const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); 
const { checkAuth } = require('../middlewares/authMiddleware');

// --- TACHES-41 : LOGIN ---
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


router.post('/login', authController.login);

// --- VÉRIFICATION TOKEN ---
router.get('/verify-token', authController.verifyToken);

// --- DEBUG TOKEN ---
router.get('/debug-token', authController.debugToken);

// --- REFRESH TOKEN ---
router.post('/refresh-token', authController.refreshToken);

// --- LOGOUT ---
router.post('/logout', authController.logout);

// --- TACHES-42 : FORGOT PASSWORD ---
router.post('/forgot-password', authController.forgotPassword);

// --- TACHES-43 : CREATE USER (Admin seulement) ---
//  checkAdmin ici pour la sécurité
router.post('/createUser', authController.checkAdmin, authController.createUser);

module.exports = router;