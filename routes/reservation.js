const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');

const checkAdminOnly = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Accès non autorisé',
      message: 'Seuls les administrateurs peuvent effectuer cette action'
    });
  }
  next();
};

// ============================================================
// ✅ ROUTES STATIQUES EN PREMIER
// ============================================================

/**
 * @swagger
 * /api/reservations/me:
 *   get:
 *     summary: Réservations de l'élève connecté
 *     tags: [Réservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, en_cours, validee, refusee, annulee]
 *     responses:
 *       200:
 *         description: Réservations récupérées avec succès
 */
router.get('/me', checkAuth, async (req, res) => {
  try {
    const studentId = req.user.uid;
    const { status } = req.query;

    let query = admin.firestore().collection('reservations')
      .where('studentId', '==', studentId);

    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }

    const snap = await query.orderBy('createdAt', 'desc').get();

    const reservations = await Promise.all(snap.docs.map(async (doc) => {
      const data = doc.data();
      const instructorDoc = await admin.firestore().collection('users').doc(data.instructorId).get();
      const instructorData = instructorDoc.exists ? instructorDoc.data() : null;

      return {
        id: doc.id,
        date: data.date,
        time: data.time,
        courseCategory: data.courseCategory,
        deliveryMode: data.deliveryMode,
        courseType: data.courseType,
        courseTitle: data.courseTitle,
        duration: data.duration,
        instructor: { id: data.instructorId, nom: instructorData?.nom || 'Instructeur inconnu' },
        status: data.status,
        motifRefus: data.motifRefus || null,
        sessionId: data.sessionId || null,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      };
    }));

    res.status(200).json({ reservations, total: reservations.length });
  } catch (error) {
    console.error('Erreur GET /reservations/me:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des réservations' });
  }
});

// ============================================================
// ✅ ROUTES COLLECTION
// ============================================================

/**
 * @swagger
 * /api/reservations:
 *   get:
 *     summary: Toutes les réservations (admin)
 *     tags: [Réservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, en_cours, validee, refusee, annulee]
 *       - in: query
 *         name: courseCategory
 *         schema:
 *           type: string
 *           enum: [theorique, pratique]
 *       - in: query
 *         name: studentId
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
 *         description: Réservations récupérées avec succès
 *       403:
 *         description: Accès non autorisé
 */
router.get('/', checkAuth, checkAdminOnly, async (req, res) => {
  try {
    const { status, courseCategory, studentId, instructorId, page = 1, limit = 10 } = req.query;

    let query = admin.firestore().collection('reservations');

    if (status && status !== 'all') query = query.where('status', '==', status);
    if (courseCategory) query = query.where('courseCategory', '==', courseCategory);
    if (studentId) query = query.where('studentId', '==', studentId);
    if (instructorId) query = query.where('instructorId', '==', instructorId);

    const snap = await query.orderBy('createdAt', 'desc').get();
    const total = snap.size;
    const paginatedDocs = snap.docs.slice((page - 1) * limit, (page - 1) * limit + parseInt(limit));

    const reservations = await Promise.all(paginatedDocs.map(async (doc) => {
      const data = doc.data();
      const [studentDoc, instructorDoc] = await Promise.all([
        admin.firestore().collection('users').doc(data.studentId).get(),
        admin.firestore().collection('users').doc(data.instructorId).get()
      ]);
      const studentData = studentDoc.exists ? studentDoc.data() : null;
      const instructorData = instructorDoc.exists ? instructorDoc.data() : null;

      return {
        id: doc.id,
        student: { id: data.studentId, nom: studentData?.nom || 'Élève inconnu', email: studentData?.email || '' },
        instructor: { id: data.instructorId, nom: instructorData?.nom || 'Instructeur inconnu' },
        date: data.date,
        time: data.time,
        courseCategory: data.courseCategory,
        deliveryMode: data.deliveryMode,
        courseType: data.courseType,
        courseTitle: data.courseTitle,
        duration: data.duration,
        status: data.status,
        motifRefus: data.motifRefus || null,
        sessionId: data.sessionId || null,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      };
    }));

    res.status(200).json({
      reservations,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Erreur GET /reservations:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des réservations' });
  }
});

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: Créer une réservation (élève)
 *     description: |
 *       L'élève crée une demande de réservation.
 *       - **Pratique** : l'élève choisit sa date et heure → une séance individuelle sera créée si validée
 *       - **Théorique** : l'élève demande à rejoindre une session existante → il sera ajouté au groupe si validé
 *     tags: [Réservations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseCategory
 *               - deliveryMode
 *               - courseType
 *               - instructorId
 *               - date
 *               - time
 *               - duration
 *             properties:
 *               courseCategory:
 *                 type: string
 *                 enum: [theorique, pratique]
 *               deliveryMode:
 *                 type: string
 *                 enum: [presentiel, enligne]
 *               courseType:
 *                 type: string
 *               courseTitle:
 *                 type: string
 *               instructorId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-20"
 *               time:
 *                 type: string
 *                 example: "09:00"
 *               duration:
 *                 type: number
 *               sessionId:
 *                 type: string
 *                 description: ID de la séance théorique existante à rejoindre (si courseCategory = theorique)
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Réservation créée, en attente de validation
 *       400:
 *         description: Champs requis manquants
 *       401:
 *         description: Token invalide
 */
router.post('/', checkAuth, async (req, res) => {
  try {
    const {
      courseCategory, deliveryMode, courseType, courseTitle,
      instructorId, date, time, duration, sessionId, notes
    } = req.body;
    const studentId = req.user.uid;

    if (!courseCategory || !deliveryMode || !courseType || !instructorId || !date || !time || !duration) {
      return res.status(400).json({
        error: 'Champs requis manquants',
        required: ['courseCategory', 'deliveryMode', 'courseType', 'instructorId', 'date', 'time', 'duration']
      });
    }

    const reservationRef = await admin.firestore().collection('reservations').add({
      studentId,
      instructorId,
      courseCategory,
      deliveryMode,
      courseType,
      courseTitle: courseTitle || `Séance de ${courseType}`,
      date,
      time,
      duration,
      notes: notes || '',
      sessionId: sessionId || null, // séance théorique existante à rejoindre
      status: 'en_cours',
      motifRefus: null,
      createdSessionId: null, // rempli si admin valide (pratique)
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      message: 'Réservation créée avec succès, en attente de validation',
      reservationId: reservationRef.id,
      status: 'en_cours'
    });
  } catch (error) {
    console.error('Erreur POST /reservations:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la réservation' });
  }
});

// ============================================================
// ✅ ROUTES DYNAMIQUES EN DERNIER
// ============================================================

/**
 * @swagger
 * /api/reservations/{id}:
 *   get:
 *     summary: Détails d'une réservation
 *     tags: [Réservations]
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
 *         description: Réservation récupérée avec succès
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         description: Réservation introuvable
 */
router.get('/:id', checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const reservationDoc = await admin.firestore().collection('reservations').doc(id).get();
    if (!reservationDoc.exists) return res.status(404).json({ error: 'Réservation introuvable' });

    const data = reservationDoc.data();

    if (req.user.role !== 'admin' && data.studentId !== req.user.uid) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const [studentDoc, instructorDoc] = await Promise.all([
      admin.firestore().collection('users').doc(data.studentId).get(),
      admin.firestore().collection('users').doc(data.instructorId).get()
    ]);

    res.status(200).json({
      id: reservationDoc.id,
      student: studentDoc.exists ? { id: data.studentId, ...studentDoc.data() } : null,
      instructor: instructorDoc.exists ? { id: data.instructorId, ...instructorDoc.data() } : null,
      courseCategory: data.courseCategory,
      deliveryMode: data.deliveryMode,
      courseType: data.courseType,
      courseTitle: data.courseTitle,
      date: data.date,
      time: data.time,
      duration: data.duration,
      notes: data.notes,
      sessionId: data.sessionId || null,
      status: data.status,
      motifRefus: data.motifRefus || null,
      createdSessionId: data.createdSessionId || null,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate()
    });
  } catch (error) {
    console.error('Erreur GET /reservations/:id:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la réservation' });
  }
});

/**
 * @swagger
 * /api/reservations/{id}/status:
 *   patch:
 *     summary: Changer le statut d'une réservation
 *     description: |
 *       - **Admin valide (validee)** :
 *         - Si **pratique** → crée une nouvelle séance individuelle dans `sessions`
 *         - Si **théorique** → ajoute l'élève à la séance existante (`sessionId`)
 *       - **Admin refuse (refusee)** → enregistre le motif de refus
 *       - **Élève annule (annulee)** → annule sa propre réservation
 *     tags: [Réservations]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [validee, refusee, annulee]
 *               motifRefus:
 *                 type: string
 *     responses:
 *       200:
 *         description: Statut mis à jour avec succès
 *       400:
 *         description: Statut invalide ou réservation déjà traitée
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         description: Réservation introuvable
 */
router.patch('/:id/status', checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, motifRefus } = req.body;
    const isAdmin = req.user.role === 'admin';

    const validStatuses = ['validee', 'refusee', 'annulee'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide', allowed: validStatuses });
    }

    if (!isAdmin && status !== 'annulee') {
      return res.status(403).json({ error: 'Un élève peut uniquement annuler sa réservation' });
    }

    if (isAdmin && status === 'annulee') {
      return res.status(403).json({ error: 'L\'admin doit valider ou refuser, pas annuler' });
    }

    const reservationDoc = await admin.firestore().collection('reservations').doc(id).get();
    if (!reservationDoc.exists) return res.status(404).json({ error: 'Réservation introuvable' });

    const reservationData = reservationDoc.data();

    if (!isAdmin && reservationData.studentId !== req.user.uid) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    if (reservationData.status !== 'en_cours') {
      return res.status(400).json({
        error: 'Cette réservation a déjà été traitée',
        currentStatus: reservationData.status
      });
    }

    const updateData = { status, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    let createdSessionId = null;

    if (status === 'validee') {
      if (reservationData.courseCategory === 'pratique') {
        // ✅ Pratique → créer une nouvelle séance individuelle
        const sessionRef = admin.firestore().collection('sessions').doc();
        await sessionRef.set({
          courseCategory: 'pratique',
          deliveryMode: reservationData.deliveryMode,
          courseType: reservationData.courseType,
          courseTitle: reservationData.courseTitle,
          studentId: reservationData.studentId,
          instructorId: reservationData.instructorId,
          scheduledDate: admin.firestore.Timestamp.fromDate(new Date(reservationData.date)),
          scheduledTime: reservationData.time,
          duration: reservationData.duration,
          notes: reservationData.notes || '',
          status: 'confirmée',
          reservationId: id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        createdSessionId = sessionRef.id;
        updateData.createdSessionId = createdSessionId;

      } else if (reservationData.courseCategory === 'theorique' && reservationData.sessionId) {
        // ✅ Théorique → ajouter l'élève à la séance existante
        const sessionDoc = await admin.firestore().collection('sessions').doc(reservationData.sessionId).get();
        if (sessionDoc.exists) {
          const sessionData = sessionDoc.data();
          const students = sessionData.students || [];
          const studentIds = sessionData.studentIds || [];

          if (!studentIds.includes(reservationData.studentId)) {
            students.push({
              studentId: reservationData.studentId,
              status: 'confirmé',
              presence: null,
              addedAt: new Date().toISOString(),
              reservationId: id
            });
            studentIds.push(reservationData.studentId);

            await admin.firestore().collection('sessions').doc(reservationData.sessionId).update({
              students,
              studentIds,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
          createdSessionId = reservationData.sessionId;
          updateData.createdSessionId = createdSessionId;
        }
      }
    }

    if (status === 'refusee') {
      updateData.motifRefus = motifRefus || 'Aucun motif fourni';
    }

    await admin.firestore().collection('reservations').doc(id).update(updateData);

    const messages = {
      validee: reservationData.courseCategory === 'pratique'
        ? 'Réservation validée, séance individuelle créée avec succès'
        : 'Réservation validée, élève ajouté à la séance',
      refusee: 'Réservation refusée',
      annulee: 'Réservation annulée avec succès'
    };

    res.status(200).json({
      message: messages[status],
      status,
      ...(createdSessionId && { sessionId: createdSessionId })
    });
  } catch (error) {
    console.error('Erreur PATCH /reservations/:id/status:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

module.exports = router;