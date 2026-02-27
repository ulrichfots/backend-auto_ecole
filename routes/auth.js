
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); 

router.post('/login', authController.login);
router.get('/verify-token', authController.verifyToken);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/createUser', authController.checkAdmin, authController.createUser);

module.exports = router;