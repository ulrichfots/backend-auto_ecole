const express = require('express');
const router = express.Router();
const admin = require('../firebase');

// Middleware pour vérifier si l'utilisateur est un administrateur
const checkAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send('Token non fourni');
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Vérifier le rôle admin dans Firestore
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).send('Accès non autorisé');
    }
    
    next();
  } catch (error) {
    res.status(401).send('Non autorisé');
  }
};

// Route protégée pour la création d'utilisateur (admin uniquement)
router.post('/createUser', checkAdmin, async (req, res) => {
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
