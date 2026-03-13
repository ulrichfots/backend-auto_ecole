const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { validate, schemas } = require('../middlewares/validationMiddleware');
const { checkAuth } = require('../middlewares/authMiddleware');
const multer = require('multer');
const { uploadImageToStorage } = require('../firebase');

// Configuration multer pour l'upload d'images
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

// Middleware pour vérifier les permissions de lecture (tous les rôles connectés)
const checkReadPermissions = async (req, res, next) => {
  next();
};

// Middleware pour vérifier les permissions d'écriture (admin seulement)
const checkWritePermissions = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Accès non autorisé',
      message: 'Seuls les administrateurs peuvent modifier les actualités',
      debug: {
        userRole: req.user.role,
        requiredRoles: ['admin'],
        action: req.method
      }
    });
  }
  next();
};

// ============================================================
// ✅ ROUTES STATIQUES EN PREMIER
// ============================================================

/**
 * @swagger
 * /api/news/stats:
 *   get:
 *     summary: Récupérer les statistiques des actualités
 *     tags: [Actualités]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalArticles:
 *                   type: number
 *                 publishedArticles:
 *                   type: number
 *                 draftArticles:
 *                   type: number
 *                 scheduledArticles:
 *                   type: number
 *                 totalViews:
 *                   type: number
 *       401:
 *         description: Token invalide
 *       403:
 *         description: Accès non autorisé
 */
router.get('/stats', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const articlesSnapshot = await admin.firestore().collection('news').get();

    let totalArticles = 0;
    let publishedArticles = 0;
    let draftArticles = 0;
    let scheduledArticles = 0;
    let totalViews = 0;

    articlesSnapshot.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate();

      if (createdAt && createdAt >= startOfMonth) {
        totalArticles++;
      }

      switch (data.status) {
        case 'published': publishedArticles++; break;
        case 'draft': draftArticles++; break;
        case 'scheduled': scheduledArticles++; break;
      }

      totalViews += data.views || 0;
    });

    res.status(200).json({
      totalArticles,
      publishedArticles,
      draftArticles,
      scheduledArticles,
      totalViews
    });

  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

// ============================================================
// ✅ ROUTES COLLECTION (GET / et POST /)
// ============================================================

/**
 * @swagger
 * /api/news:
 *   get:
 *     summary: Récupérer la liste des actualités
 *     description: |
 *       - **Élève / Instructeur** : reçoit uniquement les actualités publiées (status=published), quel que soit le paramètre status envoyé
 *       - **Admin** : reçoit toutes les actualités, avec possibilité de filtrer par status (all, published, draft, scheduled)
 *     tags: [Actualités]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, published, draft, scheduled]
 *         description: Filtrer par statut (admin seulement, ignoré pour élève/instructeur)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrer par catégorie
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *         description: Filtrer par auteur (admin seulement)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Rechercher par titre
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Liste des actualités récupérée avec succès
 *       401:
 *         description: Token invalide
 *       403:
 *         description: Accès non autorisé
 */
router.get('/', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const { status, category, author, search, page = 1, limit = 10 } = req.query;
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin';

    let query = admin.firestore().collection('news');

    // ✅ FILTRE PAR RÔLE :
    // - Élève / Instructeur → toujours uniquement "published", le paramètre status est ignoré
    // - Admin → peut filtrer librement par status
    if (!isAdmin) {
      query = query.where('status', '==', 'published');
    } else {
      if (status && status !== 'all') {
        query = query.where('status', '==', status);
      }
    }

    // Filtre catégorie (tous les rôles)
    if (category && category !== 'all') {
      query = query.where('category', '==', category);
    }

    // Filtre auteur (admin seulement)
    if (isAdmin && author && author !== 'all') {
      query = query.where('authorId', '==', author);
    }

    const articlesSnapshot = await query.orderBy('createdAt', 'desc').get();

    let articles = [];
    articlesSnapshot.forEach(doc => {
      const data = doc.data();

      // Filtre recherche par titre
      if (search && !data.title.toLowerCase().includes(search.toLowerCase())) {
        return;
      }

      articles.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        publishedAt: data.publishedAt?.toDate(),
        scheduledAt: data.scheduledAt?.toDate()
      });
    });

    // Pagination
    const total = articles.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedArticles = articles.slice(startIndex, endIndex);

    res.status(200).json({
      articles: paginatedArticles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages
      }
    });

  } catch (error) {
    console.error('Erreur récupération actualités:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

/**
 * @swagger
 * /api/news:
 *   post:
 *     summary: Créer une nouvelle actualité (admin seulement)
 *     tags: [Actualités]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *               - category
 *             properties:
 *               title:
 *                 type: string
 *               excerpt:
 *                 type: string
 *               content:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [actualites, reglementation, promotions, conseils, technique, nouveau-centre]
 *               status:
 *                 type: string
 *                 enum: [draft, published, scheduled]
 *                 default: "draft"
 *               tags:
 *                 type: string
 *               allowComments:
 *                 type: boolean
 *               pinToTop:
 *                 type: boolean
 *               sendNotification:
 *                 type: boolean
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Actualité créée avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Token invalide
 *       403:
 *         description: Accès non autorisé
 */
router.post('/', checkAuth, checkWritePermissions, upload.single('image'), async (req, res) => {
  try {
    const {
      title, excerpt, content, category,
      status = 'draft', tags,
      allowComments = true, pinToTop = false,
      sendNotification = false, scheduledAt
    } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({ error: 'Titre, contenu et catégorie sont requis' });
    }

    let imageUrl = null;
    if (req.file) {
      try {
        imageUrl = await uploadImageToStorage(req.file);
      } catch (error) {
        console.error('Erreur upload image:', error);
        return res.status(400).json({ error: 'Erreur lors de l\'upload de l\'image' });
      }
    }

    const articleData = {
      title,
      excerpt: excerpt || '',
      content,
      category,
      status,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      allowComments: allowComments === 'true' || allowComments === true,
      pinToTop: pinToTop === 'true' || pinToTop === true,
      sendNotification: sendNotification === 'true' || sendNotification === true,
      authorId: req.user.uid,
      authorName: req.user.nom,
      views: 0,
      imageUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (scheduledAt && status === 'scheduled') {
      articleData.scheduledAt = admin.firestore.Timestamp.fromDate(new Date(scheduledAt));
    } else if (status === 'published') {
      articleData.publishedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    const docRef = await admin.firestore().collection('news').add(articleData);
    const createdArticle = await docRef.get();

    res.status(201).json({
      message: 'Actualité créée avec succès',
      article: {
        id: createdArticle.id,
        ...createdArticle.data(),
        createdAt: createdArticle.data().createdAt?.toDate(),
        updatedAt: createdArticle.data().updatedAt?.toDate(),
        publishedAt: createdArticle.data().publishedAt?.toDate(),
        scheduledAt: createdArticle.data().scheduledAt?.toDate()
      }
    });

  } catch (error) {
    console.error('Erreur création actualité:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

// ============================================================
// ✅ ROUTES DYNAMIQUES EN DERNIER (avec :id)
// ============================================================

/**
 * @swagger
 * /api/news/{id}:
 *   get:
 *     summary: Récupérer une actualité par ID
 *     description: |
 *       - **Élève / Instructeur** : accès uniquement aux actualités publiées
 *       - **Admin** : accès à toutes les actualités (published, draft, scheduled)
 *     tags: [Actualités]
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
 *         description: Actualité récupérée avec succès
 *       403:
 *         description: Accès non autorisé (article non publié)
 *       404:
 *         description: Actualité non trouvée
 *       401:
 *         description: Token invalide
 */
router.get('/:id', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;

    const articleDoc = await admin.firestore().collection('news').doc(id).get();
    if (!articleDoc.exists) {
      return res.status(404).json({ error: 'Actualité non trouvée' });
    }

    const data = articleDoc.data();

    // ✅ Élève / instructeur ne peuvent pas accéder aux brouillons ou planifiés
    if (userRole !== 'admin' && data.status !== 'published') {
      return res.status(403).json({ error: 'Cette actualité n\'est pas disponible' });
    }

    res.status(200).json({
      id: articleDoc.id,
      ...data,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
      publishedAt: data.publishedAt?.toDate(),
      scheduledAt: data.scheduledAt?.toDate()
    });

  } catch (error) {
    console.error('Erreur récupération actualité:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

/**
 * @swagger
 * /api/news/{id}:
 *   put:
 *     summary: Modifier une actualité (admin seulement)
 *     tags: [Actualités]
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
 *         description: Actualité modifiée avec succès
 *       404:
 *         description: Actualité non trouvée
 *       401:
 *         description: Token invalide
 *       403:
 *         description: Accès non autorisé
 */
router.put('/:id', checkAuth, checkWritePermissions, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, excerpt, content, category, status, tags, allowComments, pinToTop, scheduledAt } = req.body;

    const articleDoc = await admin.firestore().collection('news').doc(id).get();
    if (!articleDoc.exists) {
      return res.status(404).json({ error: 'Actualité non trouvée' });
    }

    const articleData = articleDoc.data();
    if (articleData.authorId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres actualités' });
    }

    const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    if (title) updateData.title = title;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (content) updateData.content = content;
    if (category) updateData.category = category;
    if (status) {
      updateData.status = status;
      if (status === 'published' && articleData.status !== 'published') {
        updateData.publishedAt = admin.firestore.FieldValue.serverTimestamp();
      }
    }
    if (tags !== undefined) {
      updateData.tags = tags ? tags.split(',').map(tag => tag.trim()) : [];
    }
    if (allowComments !== undefined) {
      updateData.allowComments = allowComments === 'true' || allowComments === true;
    }
    if (pinToTop !== undefined) {
      updateData.pinToTop = pinToTop === 'true' || pinToTop === true;
    }
    if (scheduledAt && status === 'scheduled') {
      updateData.scheduledAt = admin.firestore.Timestamp.fromDate(new Date(scheduledAt));
    }

    if (req.file) {
      try {
        updateData.imageUrl = await uploadImageToStorage(req.file);
      } catch (error) {
        console.error('Erreur upload image:', error);
        return res.status(400).json({ error: 'Erreur lors de l\'upload de l\'image' });
      }
    }

    await admin.firestore().collection('news').doc(id).update(updateData);

    const updatedDoc = await admin.firestore().collection('news').doc(id).get();
    res.status(200).json({
      message: 'Actualité modifiée avec succès',
      article: {
        id: updatedDoc.id,
        ...updatedDoc.data(),
        createdAt: updatedDoc.data().createdAt?.toDate(),
        updatedAt: updatedDoc.data().updatedAt?.toDate(),
        publishedAt: updatedDoc.data().publishedAt?.toDate(),
        scheduledAt: updatedDoc.data().scheduledAt?.toDate()
      }
    });

  } catch (error) {
    console.error('Erreur modification actualité:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

/**
 * @swagger
 * /api/news/{id}:
 *   delete:
 *     summary: Supprimer une actualité (admin seulement)
 *     tags: [Actualités]
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
 *         description: Actualité supprimée avec succès
 *       404:
 *         description: Actualité non trouvée
 *       401:
 *         description: Token invalide
 *       403:
 *         description: Accès non autorisé
 */
router.delete('/:id', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id } = req.params;

    const articleDoc = await admin.firestore().collection('news').doc(id).get();
    if (!articleDoc.exists) {
      return res.status(404).json({ error: 'Actualité non trouvée' });
    }

    const articleData = articleDoc.data();
    if (articleData.authorId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres actualités' });
    }

    await admin.firestore().collection('news').doc(id).delete();
    res.status(200).json({ message: 'Actualité supprimée avec succès' });

  } catch (error) {
    console.error('Erreur suppression actualité:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

/**
 * @swagger
 * /api/news/{id}/view:
 *   post:
 *     summary: Incrémenter le compteur de vues
 *     tags: [Actualités]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vue comptabilisée avec succès
 *       404:
 *         description: Actualité non trouvée
 */
router.post('/:id/view', async (req, res) => {
  try {
    const { id } = req.params;

    const articleDoc = await admin.firestore().collection('news').doc(id).get();
    if (!articleDoc.exists) {
      return res.status(404).json({ error: 'Actualité non trouvée' });
    }

    await admin.firestore().collection('news').doc(id).update({
      views: admin.firestore.FieldValue.increment(1)
    });

    const updatedDoc = await admin.firestore().collection('news').doc(id).get();
    res.status(200).json({ message: 'Vue comptabilisée', views: updatedDoc.data().views });

  } catch (error) {
    console.error('Erreur incrémentation vues:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

module.exports = router;