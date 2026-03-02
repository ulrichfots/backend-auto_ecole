const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { checkAuth, checkAdmin } = require('../middlewares/authMiddleware');

/**
 * 🔓 ROUTES PUBLIQUES
 */

// Login
router.post('/login', authController.login);

// Mot de passe oublié
router.post('/forgot-password', authController.forgotPassword);

/**
 * 🔐 ROUTES PROTÉGÉES
 */

// Vérifier token
router.get('/verify-token', checkAuth, authController.verifyToken);

// Rafraîchir token
router.post('/refresh-token', checkAuth, authController.refreshToken);

// Logout
router.post('/logout', checkAuth, authController.logout);

/**
 * 👑 ROUTES ADMIN
 */

// Créer un utilisateur (admin uniquement)
router.post(
  '/createUser',
  checkAuth,
  checkAdmin,
  authController.createUser
);

module.exports = router;