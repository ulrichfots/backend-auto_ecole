const express = require('express');
const router = express.Router();
const admin = require('../app');

// Exemple route de création d'utilisateur
router.post('/createUser', async (req, res) => {
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

    res.status(200).send('Utilisateur créé avec succès');
  } catch (error) {
    res.status(400).send('Erreur lors de la création du compte');
  }
});

module.exports = router; 
