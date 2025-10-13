const express = require('express');
const router = express.Router();
const admin = require('../firebase');
const { validate, schemas } = require('../middlewares/validationMiddleware');

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
