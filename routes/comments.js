const express = require('express');
const router = express.Router();
const admin = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');
const { validate, validateParams, schemas } = require('../middlewares/validationMiddleware');

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Ajouter un commentaire (avec ou sans authentification)
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
 *                 minLength: 1
 *                 maxLength: 500
 *                 example: "Très bon cours de conduite !"
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: "Marie Dubois"
 *                 description: "Nom de l'utilisateur (requis si pas authentifié)"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "marie.dubois@example.com"
 *                 description: "Email de l'utilisateur (requis si pas authentifié)"
 *               parentId:
 *                 type: string
 *                 example: "abc123def456"
 *                 description: "ID du commentaire parent pour une réponse"
 *     security:
 *       - bearerAuth: []
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
 *         description: Token manquant ou invalide (si pas de nom/email fourni)
 *       500:
 *         description: Erreur serveur
 */
router.post('/', async (req, res) => {
  const { comment, name, email, parentId } = req.body;
  let uid = null;
  let userName = name;
  let userEmail = email;

  try {
    // Si l'utilisateur est authentifié, utiliser ses informations
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        uid = decodedToken.uid;
        
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const userData = userDoc.data();
        userName = userData?.nom || userData?.name || "Utilisateur";
        userEmail = userData?.email || decodedToken.email;
      } catch (authError) {
        // Si le token est invalide, continuer comme utilisateur anonyme
        console.log('Token invalide, utilisation comme utilisateur anonyme');
      }
    }

    // Si pas authentifié et pas de nom/email fourni
    if (!uid && (!name || !email)) {
      return res.status(400).json({ 
        error: 'Nom et email requis pour les commentaires anonymes' 
      });
    }

    // Vérifier si c'est une réponse à un commentaire
    let parentCommentId = null;
    if (parentId) {
      const parentDoc = await admin.firestore().collection('comments').doc(parentId).get();
      if (!parentDoc.exists) {
        return res.status(404).json({ error: 'Commentaire parent introuvable' });
      }
      parentCommentId = parentId;
    }

    // Générer les initiales pour l'avatar
    const initials = userName ? userName.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';

    const commentData = {
      uid,
      name: userName,
      email: userEmail,
      comment,
      likes: 0,
      dislikes: 0,
      parentId: parentCommentId,
      initials,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const commentRef = await admin.firestore().collection('comments').add(commentData);

    res.status(200).json({ 
      id: commentRef.id, 
      message: 'Commentaire enregistré',
      initials 
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
 *         description: Type de tri
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Nombre maximum de commentaires à retourner
 *       - in: query
 *         name: includeReplies
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Inclure les réponses aux commentaires
 *     responses:
 *       200:
 *         description: Liste des commentaires
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 comments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       uid:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       comment:
 *                         type: string
 *                       likes:
 *                         type: number
 *                       dislikes:
 *                         type: number
 *                       parentId:
 *                         type: string
 *                         nullable: true
 *                       initials:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       replies:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             email:
 *                               type: string
 *                             comment:
 *                               type: string
 *                             likes:
 *                               type: number
 *                             dislikes:
 *                               type: number
 *                             initials:
 *                               type: string
 *                             createdAt:
 *                               type: string
 *                               format: date-time
 *                 totalCount:
 *                   type: number
 *                 parentCommentsCount:
 *                   type: number
 *       500:
 *         description: Erreur serveur
 */
router.get('/', async (req, res) => {
  try {
    const { sort = 'recent', limit = 50, includeReplies = 'true' } = req.query;
    const limitNum = parseInt(limit);
    const includeRepliesBool = includeReplies === 'true';

    let orderField = 'createdAt';
    let orderDirection = 'desc';

    switch (sort) {
      case 'oldest':
        orderDirection = 'asc';
        break;
      case 'popular':
        orderField = 'likes';
        orderDirection = 'desc';
        break;
      case 'recent':
      default:
        orderField = 'createdAt';
        orderDirection = 'desc';
        break;
    }

    // Récupérer tous les commentaires
    let snapshot;
    if (sort === 'popular') {
      // Pour le tri par popularité, on récupère d'abord par date puis on trie par likes
      snapshot = await admin.firestore().collection('comments')
        .orderBy('createdAt', 'desc')
        .get();
    } else {
      snapshot = await admin.firestore().collection('comments')
        .orderBy(orderField, orderDirection)
        .limit(limitNum)
        .get();
    }

    let comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Si tri par popularité, trier manuellement
    if (sort === 'popular') {
      comments = comments
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, limitNum);
    }

    // Séparer les commentaires principaux des réponses
    const parentComments = comments.filter(comment => !comment.parentId);
    const replies = comments.filter(comment => comment.parentId);

    // Si on doit inclure les réponses, les associer aux commentaires parents
    if (includeRepliesBool) {
      const commentsWithReplies = parentComments.map(parentComment => {
        const commentReplies = replies
          .filter(reply => reply.parentId === parentComment.id)
          .sort((a, b) => new Date(a.createdAt?.toDate?.() || a.createdAt) - new Date(b.createdAt?.toDate?.() || b.createdAt));
        
        return {
          ...parentComment,
          replies: commentReplies
        };
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
/**
 * @swagger
 * /api/comments/{id}/replies:
 *   get:
 *     summary: Récupérer les réponses d'un commentaire
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
 *           default: recent
 *         description: Type de tri des réponses
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
 *                       email:
 *                         type: string
 *                       comment:
 *                         type: string
 *                       likes:
 *                         type: number
 *                       dislikes:
 *                         type: number
 *                       initials:
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
    const { sort = 'recent' } = req.query;

    // Vérifier que le commentaire parent existe
    const parentDoc = await admin.firestore().collection('comments').doc(id).get();
    if (!parentDoc.exists) {
      return res.status(404).json({ error: 'Commentaire parent introuvable' });
    }

    // Récupérer les réponses
    let snapshot = await admin.firestore().collection('comments')
      .where('parentId', '==', id)
      .orderBy('createdAt', sort === 'oldest' ? 'asc' : 'desc')
      .get();

    let replies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Si tri par popularité
    if (sort === 'popular') {
      replies = replies.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }

    res.status(200).json({
      replies,
      count: replies.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération des réponses' });
  }
});

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
