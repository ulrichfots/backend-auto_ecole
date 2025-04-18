const express = require('express');
const multer = require('multer');
const { uploadImageToStorage, admin } = require('../firebase');
const router = express.Router();
const { createOrUpdateUser } = require('../services/userService');

const upload = multer({ storage: multer.memoryStorage() });

// Route pour upload + update Firestore
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier envoyé.' });
    }

    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ error: 'UID utilisateur manquant.' });
    }

    const imageUrl = await uploadImageToStorage(req.file);

    await createOrUpdateUser(uid, {
        profileImageUrl: imageUrl,
      });

    // Mettre à jour Firestore après upload
    await admin.firestore().collection('users').doc(uid).update({
      profileImageUrl: imageUrl,
    });

    res.status(200).json({ imageUrl });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
