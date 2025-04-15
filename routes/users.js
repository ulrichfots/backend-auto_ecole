const express = require('express');
const router = express.Router();
const admin = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');

// Exemple de route accessible uniquement par les élèves
router.get('/dashboard', checkAuth, async (req, res) => {
  const uid = req.user.uid;

  const userDoc = await admin.firestore().collection('users').doc(uid).get();

  if (!userDoc.exists) {
    return res.status(404).send('Utilisateur introuvable');
  }

  const userData = userDoc.data();

  if (userData.role !== 'eleve') {
    return res.status(403).send('Accès réservé aux élèves');
  }

  res.status(200).json({
    message: 'Bienvenue sur le dashboard élève',
    user: userData,
  });
});

module.exports = router;
