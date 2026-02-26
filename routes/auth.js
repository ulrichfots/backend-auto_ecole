const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); 

// --- LOGIN ---
router.post('/login', authController.login);

// --- VÉRIFICATION TOKEN ---
router.get('/verify-token', authController.verifyToken);

// --- REFRESH TOKEN ---
router.post('/refresh-token', authController.refreshToken);

// --- LOGOUT ---
router.post('/logout', authController.logout);

// --- TACHES-42 : FORGOT PASSWORD ---
// C'est cette ligne qui manquait !
router.post('/forgot-password', authController.forgotPassword);

// --- TACHES-43 : CREATE USER ---
router.post('/createUser', authController.createUser);

module.exports = router;