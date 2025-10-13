const express = require('express');
const router = express.Router();
const admin = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');
const { validate, validateParams, schemas } = require('../middlewares/validationMiddleware');

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Ajouter un commentaire
 *     tags: [Commentaires]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 example: "Très bon cours de conduite !"
 *     responses:
 *       200:
 *         description: Commentaire ajouté avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "abc123def456"
 *                 message:
 *                   type: string
 *                   example: "Commentaire enregistré"
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.post('/', checkAuth, validate(schemas.comment), async (req, res) => {
  const { comment } = req.body;
  const uid = req.user.uid;

  try {
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    const nom = userDoc.data()?.nom ?? "Utilisateur";

    const commentRef = await admin.firestore().collection('comments').add({
      uid,
      name: nom,
      comment,
      likes: 0,
      dislikes: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ id: commentRef.id, message: 'Commentaire enregistré' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur ajout commentaire' });
  }
});

/**
 * @swagger
 * /api/comments:
 *   get:
 *     summary: Récupérer tous les commentaires
 *     tags: [Commentaires]
 *     responses:
 *       200:
 *         description: Liste des commentaires
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   uid:
 *                     type: string
 *                   name:
 *                     type: string
 *                   comment:
 *                     type: string
 *                   likes:
 *                     type: number
 *                   dislikes:
 *                     type: number
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       500:
 *         description: Erreur serveur
 */
router.get('/', async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('comments').orderBy('createdAt', 'desc').get();
    const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération des commentaires' });
  }
});

/**
 * @swagger
 * /api/comments/{id}:
 *   patch:
 *     summary: Voter pour un commentaire (like/dislike)
 *     tags: [Commentaires]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du commentaire
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [like, dislike]
 *                 example: "like"
 *     responses:
 *       200:
 *         description: Vote enregistré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "✅ like enregistré"
 *       400:
 *         description: Type de vote invalide
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Déjà voté pour ce commentaire
 *       500:
 *         description: Erreur serveur
 */
router.patch('/:id', checkAuth, validate(schemas.vote), async (req, res) => {
  const { type } = req.body;
  const commentId = req.params.id;
  const uid = req.user.uid;

  try {
    const commentRef = admin.firestore().collection('comments').doc(commentId);
    const voteRef = commentRef.collection('votes').doc(uid);
    const voteSnap = await voteRef.get();

    if (voteSnap.exists) {
      return res.status(403).json({ error: 'Vous avez déjà voté ce commentaire.' });
    }

    // Mise à jour du compteur
    const field = type === 'like' ? 'likes' : 'dislikes';
    await commentRef.update({
      [field]: admin.firestore.FieldValue.increment(1),
    });

    // Enregistrement du vote
    await voteRef.set({
      type,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ message: `✅ ${type} enregistré` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
