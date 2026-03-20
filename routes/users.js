const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { checkAuth, checkAdmin } = require('../middlewares/authMiddleware');

function sanitizeUser(uid, data) {
  return {
    uid,
    nom: data.nom || data.nomComplet || '',
    email: data.email || '',
    role: data.role || '',
    statut: data.statut || '',
    telephone: data.telephone || '',
    adresse: data.adresse || '',
    dateNaissance: data.dateNaissance || '',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

function validateRoleFields({ email, password, nom }) {
  if (!email || !password || !nom) return 'email, password et nom sont obligatoires';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'format email invalide';
  if (password.length < 6) return 'le mot de passe doit contenir au moins 6 caractères';
  return null;
}

// ============================================================
// ✅ ROUTES PROFIL
// ============================================================

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Récupérer le profil de l'utilisateur connecté
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     uid:
 *                       type: string
 *                     nom:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     statut:
 *                       type: string
 *       404:
 *         description: Utilisateur introuvable
 */
router.get('/me', checkAuth, async (req, res) => {
  try {
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Utilisateur introuvable' });
    return res.status(200).json({ user: sanitizeUser(userDoc.id, userDoc.data()) });
  } catch (error) {
    console.error('Erreur profil me:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/users/dashboard:
 *   get:
 *     summary: Accès dashboard admin
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Accès autorisé
 *       403:
 *         description: Accès non autorisé
 */
router.get('/dashboard', checkAuth, checkAdmin, async (req, res) => {
  return res.status(200).json({ message: 'Accès dashboard autorisé', role: req.user.role });
});

// ============================================================
// ✅ ROUTES INSTRUCTEURS
// ============================================================

/**
 * @swagger
 * /api/users/instructors:
 *   get:
 *     summary: Liste de tous les instructeurs (admin)
 *     tags: [Instructeurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Rechercher par nom ou email
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Liste récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       uid:
 *                         type: string
 *                       nom:
 *                         type: string
 *                       email:
 *                         type: string
 *                       statut:
 *                         type: string
 *                       telephone:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     total:
 *                       type: number
 *                     totalPages:
 *                       type: number
 *       403:
 *         description: Accès non autorisé
 */
router.get('/instructors', checkAuth, checkAdmin, async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const snapshot = await admin.firestore().collection('users').where('role', '==', 'instructeur').get();
    let users = snapshot.docs.map((doc) => sanitizeUser(doc.id, doc.data()));

    if (search) {
      const q = String(search).toLowerCase();
      users = users.filter((u) => u.nom.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }

    users.sort((a, b) => {
      const aTime = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    const total = users.length;
    const start = (pageNum - 1) * limitNum;
    const items = users.slice(start, start + limitNum);

    return res.status(200).json({
      users: items,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    console.error('Erreur liste instructeurs:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/users/instructors/{uid}:
 *   get:
 *     summary: Détails d'un instructeur (admin)
 *     tags: [Instructeurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Instructeur récupéré avec succès
 *       404:
 *         description: Instructeur introuvable
 *       403:
 *         description: Accès non autorisé
 */
router.get('/instructors/:uid', checkAuth, checkAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const doc = await admin.firestore().collection('users').doc(uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'Instructeur introuvable' });
    const data = doc.data();
    if (data.role !== 'instructeur') return res.status(400).json({ error: 'Cet utilisateur n\'est pas un instructeur' });
    return res.status(200).json({ user: sanitizeUser(doc.id, data) });
  } catch (error) {
    console.error('Erreur détail instructeur:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/users/instructors:
 *   post:
 *     summary: Créer un compte instructeur (admin)
 *     tags: [Instructeurs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - nom
 *             properties:
 *               email:
 *                 type: string
 *                 example: "instructeur@autoecole.com"
 *               password:
 *                 type: string
 *                 example: "MotDePasse123"
 *               nom:
 *                 type: string
 *                 example: "Jean Martin"
 *               telephone:
 *                 type: string
 *                 example: "+237 6XX XXX XXX"
 *               adresse:
 *                 type: string
 *               dateNaissance:
 *                 type: string
 *               statut:
 *                 type: string
 *                 enum: [actif, suspendu, en attente]
 *                 default: actif
 *     responses:
 *       201:
 *         description: Instructeur créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     uid:
 *                       type: string
 *                     email:
 *                       type: string
 *                     nom:
 *                       type: string
 *                     role:
 *                       type: string
 *                     statut:
 *                       type: string
 *       400:
 *         description: Données invalides
 *       403:
 *         description: Accès non autorisé
 */
router.post('/instructors', checkAuth, checkAdmin, async (req, res) => {
  try {
    const { email, password, nom, telephone, adresse, dateNaissance, statut } = req.body;
    const validationError = validateRoleFields({ email, password, nom });
    if (validationError) return res.status(400).json({ error: validationError });

    const userRecord = await admin.auth().createUser({ email, password, displayName: nom });

    const userData = {
      email, nom,
      role: 'instructeur',
      statut: statut || 'actif',
      isFirstLogin: true,
      telephone: telephone || '',
      adresse: adresse || '',
      dateNaissance: dateNaissance || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await admin.firestore().collection('users').doc(userRecord.uid).set(userData);

    return res.status(201).json({
      message: 'Instructeur créé avec succès',
      user: { uid: userRecord.uid, email, nom, role: 'instructeur', statut: userData.statut }
    });
  } catch (error) {
    console.error('Erreur création instructeur:', error);
    return res.status(400).json({ error: 'Erreur création instructeur', details: error.message });
  }
});

/**
 * @swagger
 * /api/users/instructors/{uid}:
 *   put:
 *     summary: Modifier un instructeur (admin)
 *     tags: [Instructeurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom:
 *                 type: string
 *               email:
 *                 type: string
 *               telephone:
 *                 type: string
 *               adresse:
 *                 type: string
 *               dateNaissance:
 *                 type: string
 *               statut:
 *                 type: string
 *                 enum: [actif, suspendu, en attente]
 *     responses:
 *       200:
 *         description: Instructeur modifié avec succès
 *       404:
 *         description: Instructeur introuvable
 *       403:
 *         description: Accès non autorisé
 */
router.put('/instructors/:uid', checkAuth, checkAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const payload = req.body || {};

    const docRef = admin.firestore().collection('users').doc(uid);
    const existingDoc = await docRef.get();
    if (!existingDoc.exists) return res.status(404).json({ error: 'Instructeur introuvable' });

    const existing = existingDoc.data();
    if (existing.role !== 'instructeur') return res.status(400).json({ error: 'Cet utilisateur n\'est pas un instructeur' });

    const allowedFields = ['nom', 'telephone', 'adresse', 'dateNaissance', 'statut', 'email'];
    const updates = {};
    allowedFields.forEach((field) => { if (payload[field] !== undefined) updates[field] = payload[field]; });

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Aucune donnée à modifier' });

    if (updates.email && updates.email !== existing.email) {
      await admin.auth().updateUser(uid, { email: updates.email });
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await docRef.update(updates);

    return res.status(200).json({ message: 'Instructeur modifié avec succès', updatedFields: Object.keys(updates) });
  } catch (error) {
    console.error('Erreur update instructeur:', error);
    return res.status(400).json({ error: 'Erreur modification instructeur', details: error.message });
  }
});

/**
 * @swagger
 * /api/users/instructors/{uid}:
 *   delete:
 *     summary: Supprimer un instructeur (admin)
 *     tags: [Instructeurs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Instructeur supprimé avec succès
 *       404:
 *         description: Instructeur introuvable
 *       403:
 *         description: Accès non autorisé
 */
router.delete('/instructors/:uid', checkAuth, checkAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const docRef = admin.firestore().collection('users').doc(uid);
    const existingDoc = await docRef.get();
    if (!existingDoc.exists) return res.status(404).json({ error: 'Instructeur introuvable' });

    const existing = existingDoc.data();
    if (existing.role !== 'instructeur') return res.status(400).json({ error: 'Cet utilisateur n\'est pas un instructeur' });

    await docRef.delete();
    try { await admin.auth().deleteUser(uid); }
    catch (authError) { if (authError.code !== 'auth/user-not-found') throw authError; }

    return res.status(200).json({ message: 'Instructeur supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression instructeur:', error);
    return res.status(400).json({ error: 'Erreur suppression instructeur', details: error.message });
  }
});

module.exports = router;