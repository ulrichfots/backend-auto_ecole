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

// Middleware pour vérifier si l'utilisateur est admin ou instructeur
const checkAdminOrInstructor = async (req, res, next) => {
  // Le middleware checkAuth a déjà vérifié l'authentification
  // Il nous reste juste à vérifier le rôle
  if (!['admin', 'instructeur'].includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Accès non autorisé',
      message: 'Seuls les administrateurs et instructeurs peuvent accéder à cette fonctionnalité',
      debug: {
        userRole: req.user.role,
        requiredRoles: ['admin', 'instructeur']
      }
    });
  }
  
  next();
};

// Middleware pour vérifier les permissions de lecture/écriture
const checkReadPermissions = async (req, res, next) => {
  // Tous les utilisateurs authentifiés peuvent lire
  next();
};

const checkWritePermissions = async (req, res, next) => {
  // Seuls les admins et instructeurs peuvent écrire
  if (!['admin', 'instructeur'].includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Accès non autorisé',
      message: 'Seuls les administrateurs et instructeurs peuvent modifier les actualités',
      debug: {
        userRole: req.user.role,
        requiredRoles: ['admin', 'instructeur'],
        action: req.method
      }
    });
  }
  
  next();
};

/**
 * @swagger
 * /api/news/stats:
 *   get:
 *     summary: Récupérer les statistiques des actualités
 *     description: Retourne les statistiques générales des actualités (total, publiés, brouillons, vues)
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
 *                   example: 5
 *                   description: "Nombre total d'articles ce mois"
 *                 publishedArticles:
 *                   type: number
 *                   example: 3
 *                   description: "Nombre d'articles publiés"
 *                 draftArticles:
 *                   type: number
 *                   example: 1
 *                   description: "Nombre d'articles en brouillon"
 *                 scheduledArticles:
 *                   type: number
 *                   example: 1
 *                   description: "Nombre d'articles programmés"
 *                 totalViews:
 *                   type: number
 *                   example: 869
 *                   description: "Nombre total de vues ce mois"
 *       401:
 *         description: Token invalide
 *       403:
 *         description: Accès non autorisé
 */
router.get('/stats', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Récupérer tous les articles
    const articlesSnapshot = await admin.firestore()
      .collection('news')
      .get();

    let totalArticles = 0;
    let publishedArticles = 0;
    let draftArticles = 0;
    let scheduledArticles = 0;
    let totalViews = 0;

    articlesSnapshot.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate();
      
      // Compter les articles de ce mois
      if (createdAt && createdAt >= startOfMonth) {
        totalArticles++;
      }

      // Compter par statut
      switch (data.status) {
        case 'published':
          publishedArticles++;
          break;
        case 'draft':
          draftArticles++;
          break;
        case 'scheduled':
          scheduledArticles++;
          break;
      }

      // Additionner les vues
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

/**
 * @swagger
 * /api/news:
 *   get:
 *     summary: Récupérer la liste des actualités avec filtres
 *     description: Retourne la liste paginée des actualités avec possibilité de filtrer par statut, catégorie, auteur et recherche
 *     tags: [Actualités]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, published, draft, scheduled]
 *         description: Filtrer par statut
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrer par catégorie
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *         description: Filtrer par auteur
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
 *         description: Numéro de page
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Nombre d'articles par page
 *     responses:
 *       200:
 *         description: Liste des actualités récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 articles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NewsArticle'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: number
 *                       example: 1
 *                     limit:
 *                       type: number
 *                       example: 10
 *                     total:
 *                       type: number
 *                       example: 25
 *                     totalPages:
 *                       type: number
 *                       example: 3
 *       401:
 *         description: Token invalide
 *       403:
 *         description: Accès non autorisé
 */
router.get('/', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const { status, category, author, search, page = 1, limit = 10 } = req.query;
    
    let query = admin.firestore().collection('news');

    // Appliquer les filtres
    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }
    
    if (category && category !== 'all') {
      query = query.where('category', '==', category);
    }
    
    if (author && author !== 'all') {
      query = query.where('authorId', '==', author);
    }

    // Récupérer tous les articles pour la recherche et la pagination
    const articlesSnapshot = await query.orderBy('createdAt', 'desc').get();
    
    let articles = [];
    articlesSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Filtrer par recherche si spécifié
      if (search && !data.title.toLowerCase().includes(search.toLowerCase())) {
        return;
      }
      
      articles.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        publishedAt: data.publishedAt?.toDate()
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
 *     summary: Créer une nouvelle actualité
 *     description: Crée une nouvelle actualité avec titre, contenu, image et paramètres
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
 *                 example: "Nouvelle réglementation du code de la route 2024"
 *                 description: "Titre de l'actualité"
 *               excerpt:
 *                 type: string
 *                 example: "Les nouvelles règles du code de la route entrent en vigueur ce mois-ci."
 *                 description: "Extrait de l'actualité"
 *               content:
 *                 type: string
 *                 example: "Le contenu complet de l'actualité avec formatage HTML..."
 *                 description: "Contenu principal de l'actualité"
 *               category:
 *                 type: string
 *                 enum: [actualites, reglementation, promotions, conseils, technique, nouveau-centre]
 *                 example: "reglementation"
 *                 description: "Catégorie de l'actualité"
 *               status:
 *                 type: string
 *                 enum: [draft, published, scheduled]
 *                 default: "draft"
 *                 description: "Statut de publication"
 *               tags:
 *                 type: string
 *                 example: "permis, code, formation"
 *                 description: "Tags séparés par des virgules"
 *               allowComments:
 *                 type: boolean
 *                 default: true
 *                 description: "Permettre les commentaires"
 *               pinToTop:
 *                 type: boolean
 *                 default: false
 *                 description: "Épingler en haut de la liste"
 *               sendNotification:
 *                 type: boolean
 *                 default: false
 *                 description: "Envoyer une notification par email"
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: "Date de publication programmée"
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: "Image principale de l'actualité"
 *     responses:
 *       201:
 *         description: Actualité créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Actualité créée avec succès"
 *                 article:
 *                   $ref: '#/components/schemas/NewsArticle'
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
      title,
      excerpt,
      content,
      category,
      status = 'draft',
      tags,
      allowComments = true,
      pinToTop = false,
      sendNotification = false,
      scheduledAt
    } = req.body;

    // Validation des données requises
    if (!title || !content || !category) {
      return res.status(400).json({
        error: 'Titre, contenu et catégorie sont requis'
      });
    }

    let imageUrl = null;
    
    // Traitement de l'image si fournie
    if (req.file) {
      try {
        imageUrl = await uploadImageToStorage(req.file);
      } catch (error) {
        console.error('Erreur upload image:', error);
        return res.status(400).json({
          error: 'Erreur lors de l\'upload de l\'image'
        });
      }
    }

    // Préparer les données de l'article
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

    // Ajouter la date de publication programmée si spécifiée
    if (scheduledAt && status === 'scheduled') {
      articleData.scheduledAt = admin.firestore.Timestamp.fromDate(new Date(scheduledAt));
    } else if (status === 'published') {
      articleData.publishedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    // Sauvegarder l'article
    const docRef = await admin.firestore().collection('news').add(articleData);
    
    // Récupérer l'article créé
    const createdArticle = await docRef.get();
    const article = {
      id: createdArticle.id,
      ...createdArticle.data(),
      createdAt: createdArticle.data().createdAt?.toDate(),
      updatedAt: createdArticle.data().updatedAt?.toDate(),
      publishedAt: createdArticle.data().publishedAt?.toDate(),
      scheduledAt: createdArticle.data().scheduledAt?.toDate()
    };

    res.status(201).json({
      message: 'Actualité créée avec succès',
      article
    });

  } catch (error) {
    console.error('Erreur création actualité:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

/**
 * @swagger
 * /api/news/{id}:
 *   get:
 *     summary: Récupérer une actualité par ID
 *     description: Retourne les détails d'une actualité spécifique
 *     tags: [Actualités]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'actualité
 *     responses:
 *       200:
 *         description: Actualité récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NewsArticle'
 *       404:
 *         description: Actualité non trouvée
 *       401:
 *         description: Token invalide
 *       403:
 *         description: Accès non autorisé
 */
router.get('/:id', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const { id } = req.params;
    
    const articleDoc = await admin.firestore().collection('news').doc(id).get();
    
    if (!articleDoc.exists) {
      return res.status(404).json({
        error: 'Actualité non trouvée'
      });
    }

    const article = {
      id: articleDoc.id,
      ...articleDoc.data(),
      createdAt: articleDoc.data().createdAt?.toDate(),
      updatedAt: articleDoc.data().updatedAt?.toDate(),
      publishedAt: articleDoc.data().publishedAt?.toDate(),
      scheduledAt: articleDoc.data().scheduledAt?.toDate()
    };

    res.status(200).json(article);

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
 *     summary: Modifier une actualité
 *     description: Met à jour une actualité existante
 *     tags: [Actualités]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'actualité
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: "Titre de l'actualité"
 *               excerpt:
 *                 type: string
 *                 description: "Extrait de l'actualité"
 *               content:
 *                 type: string
 *                 description: "Contenu principal de l'actualité"
 *               category:
 *                 type: string
 *                 description: "Catégorie de l'actualité"
 *               status:
 *                 type: string
 *                 description: "Statut de publication"
 *               tags:
 *                 type: string
 *                 description: "Tags séparés par des virgules"
 *               allowComments:
 *                 type: boolean
 *                 description: "Permettre les commentaires"
 *               pinToTop:
 *                 type: boolean
 *                 description: "Épingler en haut de la liste"
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: "Date de publication programmée"
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: "Nouvelle image principale"
 *     responses:
 *       200:
 *         description: Actualité modifiée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Actualité modifiée avec succès"
 *                 article:
 *                   $ref: '#/components/schemas/NewsArticle'
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
    const {
      title,
      excerpt,
      content,
      category,
      status,
      tags,
      allowComments,
      pinToTop,
      scheduledAt
    } = req.body;

    // Vérifier que l'article existe
    const articleDoc = await admin.firestore().collection('news').doc(id).get();
    if (!articleDoc.exists) {
      return res.status(404).json({
        error: 'Actualité non trouvée'
      });
    }

    // Vérifier que l'utilisateur est l'auteur ou un admin
    const articleData = articleDoc.data();
    if (articleData.authorId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Vous ne pouvez modifier que vos propres actualités'
      });
    }

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Mettre à jour les champs fournis
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

    // Traitement de la nouvelle image si fournie
    if (req.file) {
      try {
        const imageUrl = await uploadImageToStorage(req.file);
        updateData.imageUrl = imageUrl;
      } catch (error) {
        console.error('Erreur upload image:', error);
        return res.status(400).json({
          error: 'Erreur lors de l\'upload de l\'image'
        });
      }
    }

    // Mettre à jour l'article
    await admin.firestore().collection('news').doc(id).update(updateData);
    
    // Récupérer l'article mis à jour
    const updatedDoc = await admin.firestore().collection('news').doc(id).get();
    const article = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data().createdAt?.toDate(),
      updatedAt: updatedDoc.data().updatedAt?.toDate(),
      publishedAt: updatedDoc.data().publishedAt?.toDate(),
      scheduledAt: updatedDoc.data().scheduledAt?.toDate()
    };

    res.status(200).json({
      message: 'Actualité modifiée avec succès',
      article
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
 *     summary: Supprimer une actualité
 *     description: Supprime définitivement une actualité
 *     tags: [Actualités]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'actualité
 *     responses:
 *       200:
 *         description: Actualité supprimée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Actualité supprimée avec succès"
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

    // Vérifier que l'article existe
    const articleDoc = await admin.firestore().collection('news').doc(id).get();
    if (!articleDoc.exists) {
      return res.status(404).json({
        error: 'Actualité non trouvée'
      });
    }

    // Vérifier que l'utilisateur est l'auteur ou un admin
    const articleData = articleDoc.data();
    if (articleData.authorId !== req.user.uid && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Vous ne pouvez supprimer que vos propres actualités'
      });
    }

    // Supprimer l'article
    await admin.firestore().collection('news').doc(id).delete();

    res.status(200).json({
      message: 'Actualité supprimée avec succès'
    });

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
 *     description: Incrémente le nombre de vues d'une actualité
 *     tags: [Actualités]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'actualité
 *     responses:
 *       200:
 *         description: Vue comptabilisée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Vue comptabilisée"
 *                 views:
 *                   type: number
 *                   example: 246
 *       404:
 *         description: Actualité non trouvée
 */
router.post('/:id/view', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'article existe
    const articleDoc = await admin.firestore().collection('news').doc(id).get();
    if (!articleDoc.exists) {
      return res.status(404).json({
        error: 'Actualité non trouvée'
      });
    }

    // Incrémenter le compteur de vues
    await admin.firestore().collection('news').doc(id).update({
      views: admin.firestore.FieldValue.increment(1)
    });

    // Récupérer le nouveau nombre de vues
    const updatedDoc = await admin.firestore().collection('news').doc(id).get();
    const views = updatedDoc.data().views;

    res.status(200).json({
      message: 'Vue comptabilisée',
      views
    });

  } catch (error) {
    console.error('Erreur incrémentation vues:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
  }
});

module.exports = router;
