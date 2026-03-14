const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

// ============================================================
// ✅ CONFIGURATION CLOUDFLARE R2
// ============================================================
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY
  }
});

// ============================================================
// ✅ CONVERSION + UPLOAD IMAGE SUR R2
// ============================================================
const processAndUploadImage = async (file) => {
  const originalMime = file.mimetype;
  const allowedFormats = ['image/jpeg', 'image/png', 'image/webp'];

  let imageBuffer;
  let contentType;
  let ext;

  if (allowedFormats.includes(originalMime)) {
    // ✅ Format déjà compatible — on optimise juste la qualité
    if (originalMime === 'image/png') {
      imageBuffer = await sharp(file.buffer).png({ quality: 90 }).toBuffer();
      contentType = 'image/png';
      ext = 'png';
    } else if (originalMime === 'image/webp') {
      imageBuffer = await sharp(file.buffer).webp({ quality: 85 }).toBuffer();
      contentType = 'image/webp';
      ext = 'webp';
    } else {
      // jpeg
      imageBuffer = await sharp(file.buffer).jpeg({ quality: 85 }).toBuffer();
      contentType = 'image/jpeg';
      ext = 'jpg';
    }
  } else {
    // ✅ Format non compatible (gif, bmp, tiff, heic, avif...) → on convertit en JPEG
    console.log(`⚠️ Format ${originalMime} non compatible → conversion en JPEG`);
    imageBuffer = await sharp(file.buffer).jpeg({ quality: 85 }).toBuffer();
    contentType = 'image/jpeg';
    ext = 'jpg';
  }

  // ✅ Redimensionner si trop grande (max 1920px de large)
  const metadata = await sharp(imageBuffer).metadata();
  if (metadata.width > 1920) {
    imageBuffer = await sharp(imageBuffer)
      .resize({ width: 1920, withoutEnlargement: true })
      .toBuffer();
    console.log(`📐 Image redimensionnée à 1920px`);
  }

  const fileName = `news/${uuidv4()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
    Key: fileName,
    Body: imageBuffer,
    ContentType: contentType
  }));

  console.log(`✅ Image uploadée sur R2: ${fileName} (${contentType})`);
  return `${process.env.CLOUDFLARE_PUBLIC_URL}/${fileName}`;
};

// ============================================================
// ✅ CONFIGURATION MULTER
// ============================================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    // ✅ On accepte tous les formats image — on convertira si nécessaire
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers image sont autorisés'), false);
    }
  }
});

// ============================================================
// ✅ MIDDLEWARES
// ============================================================
const checkReadPermissions = async (req, res, next) => { next(); };

const checkWritePermissions = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Accès non autorisé',
      message: 'Seuls les administrateurs peuvent modifier les actualités'
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
 *     summary: Statistiques des actualités
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
 */
router.get('/stats', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const snap = await admin.firestore().collection('news').get();

    let totalArticles = 0, publishedArticles = 0, draftArticles = 0, scheduledArticles = 0, totalViews = 0;

    snap.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate();
      if (createdAt && createdAt >= startOfMonth) totalArticles++;
      if (data.status === 'published') publishedArticles++;
      else if (data.status === 'draft') draftArticles++;
      else if (data.status === 'scheduled') scheduledArticles++;
      totalViews += data.views || 0;
    });

    res.status(200).json({ totalArticles, publishedArticles, draftArticles, scheduledArticles, totalViews });
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ============================================================
// ✅ ROUTES COLLECTION
// ============================================================

/**
 * @swagger
 * /api/news:
 *   get:
 *     summary: Liste de toutes les actualités
 *     description: Retourne toutes les actualités sans restriction. Tout le monde voit tout.
 *     tags: [Actualités]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, published, draft, scheduled]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
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
 *         description: Liste récupérée avec succès
 */
router.get('/', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const { status, category, search, page = 1, limit = 10 } = req.query;

    let query = admin.firestore().collection('news');
    if (status && status !== 'all') query = query.where('status', '==', status);
    if (category && category !== 'all') query = query.where('category', '==', category);

    const snap = await query.orderBy('createdAt', 'desc').get();

    let articles = [];
    snap.forEach(doc => {
      const data = doc.data();
      if (search && !data.title.toLowerCase().includes(search.toLowerCase())) return;
      articles.push({
        id: doc.id, ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        publishedAt: data.publishedAt?.toDate(),
        scheduledAt: data.scheduledAt?.toDate()
      });
    });

    const total = articles.length;
    const paginatedArticles = articles.slice((page - 1) * limit, (page - 1) * limit + parseInt(limit));

    res.status(200).json({
      articles: paginatedArticles,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Erreur GET /news:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

/**
 * @swagger
 * /api/news:
 *   post:
 *     summary: Créer une actualité avec image (admin)
 *     description: |
 *       Crée une actualité. L'image est automatiquement :
 *       - **Convertie** en JPEG si le format n'est pas compatible (gif, bmp, tiff, heic...)
 *       - **Optimisée** (qualité 85%)
 *       - **Redimensionnée** si plus large que 1920px
 *       - **Uploadée** sur Cloudflare R2
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
 *                 default: published
 *               tags:
 *                 type: string
 *               allowComments:
 *                 type: boolean
 *               pinToTop:
 *                 type: boolean
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Tous formats image acceptés (jpeg, png, webp, gif, bmp, tiff, heic...)
 *     responses:
 *       201:
 *         description: Actualité créée avec succès
 *       400:
 *         description: Données invalides
 *       403:
 *         description: Accès non autorisé
 */
router.post('/', checkAuth, checkWritePermissions, upload.single('image'), async (req, res) => {
  try {
    const {
      title, excerpt, content, category,
      status = 'published', tags,
      allowComments = true, pinToTop = false,
      sendNotification = false, scheduledAt
    } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({ error: 'Titre, contenu et catégorie sont requis' });
    }

    // ✅ Traitement image — conversion auto si nécessaire
    let imageUrl = null;
    if (req.file) {
      try {
        imageUrl = await processAndUploadImage(req.file);
      } catch (uploadError) {
        console.error('❌ Erreur traitement image:', uploadError);
        return res.status(400).json({ error: 'Erreur lors du traitement de l\'image' });
      }
    }

    const articleData = {
      title,
      excerpt: excerpt || '',
      content,
      category,
      status,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      allowComments: allowComments === 'true' || allowComments === true,
      pinToTop: pinToTop === 'true' || pinToTop === true,
      sendNotification: sendNotification === 'true' || sendNotification === true,
      authorId: req.user.uid,
      authorName: req.user.nom || req.user.name || 'Admin',
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
    const created = await docRef.get();

    res.status(201).json({
      message: 'Actualité créée avec succès',
      article: {
        id: created.id, ...created.data(),
        createdAt: created.data().createdAt?.toDate(),
        updatedAt: created.data().updatedAt?.toDate()
      }
    });
  } catch (error) {
    console.error('Erreur POST /news:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ============================================================
// ✅ ROUTES DYNAMIQUES EN DERNIER
// ============================================================

/**
 * @swagger
 * /api/news/{id}:
 *   get:
 *     summary: Récupérer une actualité par ID
 *     description: Retourne le contenu complet d'une actualité. Accessible par tous sans restriction.
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
 *       404:
 *         description: Actualité non trouvée
 */
router.get('/:id', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const { id } = req.params;
    const articleDoc = await admin.firestore().collection('news').doc(id).get();
    if (!articleDoc.exists) return res.status(404).json({ error: 'Actualité non trouvée' });

    const data = articleDoc.data();
    res.status(200).json({
      id: articleDoc.id, ...data,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
      publishedAt: data.publishedAt?.toDate(),
      scheduledAt: data.scheduledAt?.toDate()
    });
  } catch (error) {
    console.error('Erreur GET /news/:id:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

/**
 * @swagger
 * /api/news/{id}:
 *   put:
 *     summary: Modifier une actualité (admin)
 *     description: Si une nouvelle image est fournie, elle est convertie et remplace l'ancienne sur Cloudflare R2.
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
 *       403:
 *         description: Accès non autorisé
 */
router.put('/:id', checkAuth, checkWritePermissions, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, excerpt, content, category, status, tags, allowComments, pinToTop, scheduledAt } = req.body;

    const articleDoc = await admin.firestore().collection('news').doc(id).get();
    if (!articleDoc.exists) return res.status(404).json({ error: 'Actualité non trouvée' });

    const articleData = articleDoc.data();
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
    if (tags !== undefined) updateData.tags = tags ? tags.split(',').map(t => t.trim()) : [];
    if (allowComments !== undefined) updateData.allowComments = allowComments === 'true' || allowComments === true;
    if (pinToTop !== undefined) updateData.pinToTop = pinToTop === 'true' || pinToTop === true;
    if (scheduledAt && status === 'scheduled') {
      updateData.scheduledAt = admin.firestore.Timestamp.fromDate(new Date(scheduledAt));
    }

    // ✅ Nouvelle image → conversion + upload sur R2
    if (req.file) {
      try {
        updateData.imageUrl = await processAndUploadImage(req.file);
      } catch (uploadError) {
        console.error('❌ Erreur traitement image:', uploadError);
        return res.status(400).json({ error: 'Erreur lors du traitement de l\'image' });
      }
    }

    await admin.firestore().collection('news').doc(id).update(updateData);
    const updated = await admin.firestore().collection('news').doc(id).get();

    res.status(200).json({
      message: 'Actualité modifiée avec succès',
      article: {
        id: updated.id, ...updated.data(),
        createdAt: updated.data().createdAt?.toDate(),
        updatedAt: updated.data().updatedAt?.toDate()
      }
    });
  } catch (error) {
    console.error('Erreur PUT /news/:id:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

/**
 * @swagger
 * /api/news/{id}:
 *   delete:
 *     summary: Supprimer une actualité (admin)
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
 *       403:
 *         description: Accès non autorisé
 */
router.delete('/:id', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id } = req.params;
    const articleDoc = await admin.firestore().collection('news').doc(id).get();
    if (!articleDoc.exists) return res.status(404).json({ error: 'Actualité non trouvée' });

    // ✅ Supprimer l'image de R2 si elle existe
    const imageUrl = articleDoc.data().imageUrl;
    if (imageUrl && process.env.CLOUDFLARE_PUBLIC_URL && imageUrl.includes(process.env.CLOUDFLARE_PUBLIC_URL)) {
      try {
        const fileName = imageUrl.replace(`${process.env.CLOUDFLARE_PUBLIC_URL}/`, '');
        await s3.send(new DeleteObjectCommand({
          Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
          Key: fileName
        }));
        console.log('✅ Image supprimée de R2:', fileName);
      } catch (deleteError) {
        console.error('⚠️ Erreur suppression image R2 (non bloquant):', deleteError);
      }
    }

    await admin.firestore().collection('news').doc(id).delete();
    res.status(200).json({ message: 'Actualité supprimée avec succès' });
  } catch (error) {
    console.error('Erreur DELETE /news/:id:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
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
    if (!articleDoc.exists) return res.status(404).json({ error: 'Actualité non trouvée' });

    await admin.firestore().collection('news').doc(id).update({
      views: admin.firestore.FieldValue.increment(1)
    });

    const updated = await admin.firestore().collection('news').doc(id).get();
    res.status(200).json({ message: 'Vue comptabilisée', views: updated.data().views });
  } catch (error) {
    console.error('Erreur view:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

module.exports = router;