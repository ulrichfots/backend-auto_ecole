const express = require('express');
const multer = require('multer');
const { uploadImageToStorage, admin } = require('../firebase');
const router = express.Router();
const { createOrUpdateUser } = require('../services/userService');
const { validate, schemas } = require('../middlewares/validationMiddleware');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Uploader une image de profil
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *               - uid
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Fichier image (max 5MB)
 *               uid:
 *                 type: string
 *                 description: ID de l'utilisateur
 *                 example: "user123"
 *     responses:
 *       200:
 *         description: Image uploadée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imageUrl:
 *                   type: string
 *                   example: "https://storage.googleapis.com/bucket/profile_images/uuid.jpg"
 *       400:
 *         description: Fichier manquant ou UID manquant
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Aucun fichier envoyé"
 *       500:
 *         description: Erreur serveur
 */
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

    res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('Erreur upload:', error);
    if (error.message === 'Seules les images sont autorisées') {
      return res.status(400).json({ error: 'Seules les images sont autorisées' });
    }
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
