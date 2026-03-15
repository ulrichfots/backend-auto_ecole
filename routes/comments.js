const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const jwt = require('jsonwebtoken');
const { checkAuth } = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validationMiddleware');
const JWT_SECRET = process.env.JWT_SECRET || 'votre_cle_secrete_ici';

// ============================================================
// ✅ ROUTES STATIQUES EN PREMIER
// ============================================================

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Ajouter un commentaire ou une réponse (avec ou sans authentification)
 *     tags: [Commentaires]
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
 *                 example: "Très bon cours de conduite !"
 *               name:
 *                 type: string
 *                 example: "Marie Dubois"
 *               email:
 *                 type: string
 *                 example: "marie.dubois@example.com"
 *               parentId:
 *                 type: string
 *                 description: ID du commentaire parent si c'est une réponse
 *                 example: "abc123def456"
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Commentaire ajouté avec succès
 *       400:
 *         description: Données invalides
 *       500:
 *         description: Erreur serveur
 */
router.post('/', async (req, res) => {
  const { comment, name, email, parentId } = req.body;
  let uid = null;
  let userName = name;
  let userEmail = email;

  try {
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        let decodedToken = null;
        try {
          decodedToken = jwt.verify(token, JWT_SECRET);
        } catch (jwtError) {
          decodedToken = await admin.auth().verifyIdToken(token);
        }
        uid = decodedToken.uid;
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const userData = userDoc.data();
        userName = userData?.nom || userData?.name || 'Utilisateur';
        userEmail = userData?.email || decodedToken.email;
      } catch (authError) {
        console.log('Token invalide, utilisation comme utilisateur anonyme');
      }
    }

    if (!uid && (!name || !email)) {
      return res.status(400).json({ error: 'Nom et email requis pour les commentaires anonymes' });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ error: 'Le commentaire ne peut pas être vide' });
    }

    let parentCommentId = null;
    if (parentId) {
      const parentDoc = await admin.firestore().collection('comments').doc(parentId).get();
      if (!parentDoc.exists) {
        return res.status(404).json({ error: 'Commentaire parent introuvable' });
      }
      parentCommentId = parentId;
    }

    const initials = userName
      ? userName.split(' ').map(n => n[0]).join('').toUpperCase()
      : 'U';

    const commentRef = await admin.firestore().collection('comments').add({
      uid,
      name: userName,
      email: userEmail,
      comment,
      likes: 0,
      dislikes: 0,
      parentId: parentCommentId,
      initials,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      id: commentRef.id,
      message: 'Commentaire enregistré',
      initials,
      parentId: parentCommentId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur ajout commentaire' });
  }
});

/**
 * @swagger
 * /api/comments:
 *   get:
 *     summary: Récupérer les commentaires avec tri et filtrage
 *     tags: [Commentaires]
 *     parameters:
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [recent, oldest, popular]
 *           default: recent
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: includeReplies
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Liste des commentaires
 *       500:
 *         description: Erreur serveur
 */
router.get('/', async (req, res) => {
  try {
    const { sort = 'recent', limit = 50, includeReplies = 'true' } = req.query;
    const limitNum = parseInt(limit);
    const includeRepliesBool = includeReplies === 'true';

    // ✅ On récupère tout sans orderBy composé pour éviter les erreurs d'index
    const snapshot = await admin.firestore().collection('comments').get();

    let comments = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
      };
    });

    // ✅ Tri en JavaScript
    switch (sort) {
      case 'oldest':
        comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'popular':
        comments.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        break;
      default: // recent
        comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    const parentComments = comments.filter(c => !c.parentId).slice(0, limitNum);
    const replies = comments.filter(c => c.parentId);

    if (includeRepliesBool) {
      const commentsWithReplies = parentComments.map(parentComment => {
        const commentReplies = replies
          .filter(reply => reply.parentId === parentComment.id)
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return { ...parentComment, replies: commentReplies };
      });

      res.status(200).json({
        comments: commentsWithReplies,
        totalCount: comments.length,
        parentCommentsCount: parentComments.length
      });
    } else {
      res.status(200).json({
        comments: parentComments,
        totalCount: comments.length,
        parentCommentsCount: parentComments.length
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération des commentaires' });
  }
});

// ============================================================
// ✅ ROUTES DYNAMIQUES AVEC SOUS-ROUTES EN PREMIER (/:id/xxx)
// ============================================================

/**
 * @swagger
 * /api/comments/{id}/replies:
 *   get:
 *     summary: Récupérer les réponses d'un commentaire
 *     description: Retourne toutes les réponses d'un commentaire parent, triées par date
 *     tags: [Commentaires]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du commentaire parent
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [recent, oldest, popular]
 *           default: oldest
 *         description: Ordre de tri des réponses
 *     responses:
 *       200:
 *         description: Réponses récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 replies:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       comment:
 *                         type: string
 *                       likes:
 *                         type: number
 *                       parentId:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 count:
 *                   type: number
 *       404:
 *         description: Commentaire parent introuvable
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id/replies', async (req, res) => {
  try {
    const { id } = req.params;
    const { sort = 'oldest' } = req.query;

    // Vérifier que le commentaire parent existe
    const parentDoc = await admin.firestore().collection('comments').doc(id).get();
    if (!parentDoc.exists) {
      return res.status(404).json({ error: 'Commentaire parent introuvable' });
    }

    // ✅ On filtre uniquement par parentId, sans orderBy → pas besoin d'index composé
    const snapshot = await admin.firestore().collection('comments')
      .where('parentId', '==', id)
      .get();

    // ✅ Tri en JavaScript
    let replies = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
      };
    });

    switch (sort) {
      case 'popular':
        replies.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        break;
      case 'recent':
        replies.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      default: // oldest
        replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
    }

    res.status(200).json({ replies, count: replies.length });
  } catch (err) {
    console.error('Erreur GET /:id/replies:', err);
    res.status(500).json({ error: 'Erreur récupération des réponses' });
  }
});

/**
 * @swagger
 * /api/comments/{id}/vote-status:
 *   get:
 *     summary: Récupérer le statut de vote d'un utilisateur sur un commentaire
 *     tags: [Commentaires]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statut de vote récupéré
 *       401:
 *         description: Token manquant ou invalide
 *       404:
 *         description: Commentaire non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get('/:id/vote-status', checkAuth, async (req, res) => {
  try {
    const commentId = req.params.id;
    const uid = req.user.uid;

    const commentRef = admin.firestore().collection('comments').doc(commentId);
    const voteRef = commentRef.collection('votes').doc(uid);
    const voteSnap = await voteRef.get();

    if (!voteSnap.exists) {
      return res.status(200).json({ hasVoted: false, voteType: null, canVote: true });
    }

    const voteData = voteSnap.data();
    res.status(200).json({ hasVoted: true, voteType: voteData.type, canVote: true });
  } catch (err) {
    console.error('Erreur vote-status:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================================
// ✅ ROUTES DYNAMIQUES SIMPLES EN DERNIER (/:id)
// ============================================================

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
 *       400:
 *         description: Type de vote invalide
 *       401:
 *         description: Token manquant ou invalide
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

    let previousVote = null;
    if (voteSnap.exists) {
      previousVote = voteSnap.data().type;
    }

    // Annuler le vote si même type
    if (previousVote === type) {
      await commentRef.update({
        [type === 'like' ? 'likes' : 'dislikes']: admin.firestore.FieldValue.increment(-1)
      });
      await voteRef.delete();
      return res.status(200).json({ message: `Vote ${type} annulé`, action: 'removed', previousVote: type });
    }

    // Changer de vote
    if (previousVote && previousVote !== type) {
      await commentRef.update({
        [previousVote === 'like' ? 'likes' : 'dislikes']: admin.firestore.FieldValue.increment(-1),
        [type === 'like' ? 'likes' : 'dislikes']: admin.firestore.FieldValue.increment(1)
      });
      await voteRef.set({ type, timestamp: admin.firestore.FieldValue.serverTimestamp() });
      return res.status(200).json({ message: `Vote changé: ${previousVote} → ${type}`, action: 'changed', previousVote, newVote: type });
    }

    // Nouveau vote
    await commentRef.update({
      [type === 'like' ? 'likes' : 'dislikes']: admin.firestore.FieldValue.increment(1)
    });
    await voteRef.set({ type, timestamp: admin.firestore.FieldValue.serverTimestamp() });

    res.status(200).json({ message: `${type} enregistré`, action: 'added', newVote: type });
  } catch (err) {
    console.error('Erreur vote:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;