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
 *     description: Retourne toutes les réservations de l'élève connecté avec leur statut
 *     tags: [Réservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, en_cours, validee, refusee, annulee]
 *         description: Filtrer par statut
 *     responses:
 *       200:
 *         description: Réservations récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reservations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       date:
 *                         type: string
 *                         example: "2026-03-20"
 *                       time:
 *                         type: string
 *                         example: "09:00"
 *                       courseType:
 *                         type: string
 *                         example: "conduite"
 *                       instructor:
 *                         type: object
 *                       status:
 *                         type: string
 *                         enum: [en_cours, validee, refusee, annulee]
 *                       motifRefus:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: number
 *       401:
 *         description: Token invalide
 *       500:
 *         description: Erreur serveur
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
 *     description: Retourne toutes les réservations des élèves. Réservé à l'admin pour la gestion sur le dashboard.
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
 *         name: studentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: instructorId
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
 *       500:
 *         description: Erreur serveur
 */
router.get('/', checkAuth, checkAdminOnly, async (req, res) => {
  try {
    const { status, studentId, instructorId, page = 1, limit = 10 } = req.query;

    let query = admin.firestore().collection('reservations');

    if (status && status !== 'all') query = query.where('status', '==', status);
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
 *       L'élève connecté crée une demande de réservation en choisissant une date, une heure et un type de séance.
 *       Le statut est automatiquement **en_cours** en attendant la validation de l'admin.
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
 *               - date
 *               - time
 *               - courseType
 *               - instructorId
 *               - duration
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-20"
 *               time:
 *                 type: string
 *                 example: "09:00"
 *               courseType:
 *                 type: string
 *                 enum: [conduite, code, examen, examen_blanc, perfectionnement]
 *               courseTitle:
 *                 type: string
 *                 example: "Séance de conduite — Ville"
 *               instructorId:
 *                 type: string
 *               duration:
 *                 type: number
 *                 example: 1
 *               notes:
 *                 type: string
 *                 example: "Première séance sur autoroute"
 *     responses:
 *       201:
 *         description: Réservation créée, en attente de validation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Réservation créée avec succès, en attente de validation"
 *                 reservationId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: "en_cours"
 *       400:
 *         description: Champs requis manquants
 *       401:
 *         description: Token invalide
 *       500:
 *         description: Erreur serveur
 */
router.post('/', checkAuth, async (req, res) => {
  try {
    const { date, time, courseType, courseTitle, instructorId, duration, notes } = req.body;
    const studentId = req.user.uid;

    if (!date || !time || !courseType || !instructorId || !duration) {
      return res.status(400).json({
        error: 'Champs requis manquants',
        required: ['date', 'time', 'courseType', 'instructorId', 'duration']
      });
    }

    const reservationRef = await admin.firestore().collection('reservations').add({
      studentId,
      instructorId,
      date,
      time,
      courseType,
      courseTitle: courseTitle || `Séance de ${courseType}`,
      duration,
      notes: notes || '',
      status: 'en_cours',  // en_cours | validee | refusee | annulee
      sessionId: null,     // rempli automatiquement quand admin valide
      motifRefus: null,    // rempli si admin refuse
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
 *       401:
 *         description: Token invalide
 */
router.get('/:id', checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const reservationDoc = await admin.firestore().collection('reservations').doc(id).get();
    if (!reservationDoc.exists) return res.status(404).json({ error: 'Réservation introuvable' });

    const data = reservationDoc.data();

    // Élève accède uniquement à ses propres réservations
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
      date: data.date,
      time: data.time,
      courseType: data.courseType,
      courseTitle: data.courseTitle,
      duration: data.duration,
      notes: data.notes,
      status: data.status,
      motifRefus: data.motifRefus || null,
      sessionId: data.sessionId || null,
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
 *       - **Admin** : peut valider (`validee`) ou refuser (`refusee`)
 *         - Si `validee` → une séance est **automatiquement créée** dans `sessions` avec statut `confirmée`
 *         - Si `refusee` → un motif de refus peut être précisé
 *       - **Élève** : peut uniquement annuler (`annulee`) sa propre réservation
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
 *                 example: "validee"
 *               motifRefus:
 *                 type: string
 *                 example: "Instructeur non disponible ce jour"
 *     responses:
 *       200:
 *         description: Statut mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Réservation validée, séance créée avec succès"
 *                 status:
 *                   type: string
 *                 sessionId:
 *                   type: string
 *                   description: ID de la séance créée (uniquement si validee)
 *       400:
 *         description: Statut invalide ou réservation déjà traitée
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         description: Réservation introuvable
 *       500:
 *         description: Erreur serveur
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

    // Élève peut seulement annuler
    if (!isAdmin && status !== 'annulee') {
      return res.status(403).json({ error: 'Un élève peut uniquement annuler sa réservation' });
    }

    // Admin ne peut pas annuler
    if (isAdmin && status === 'annulee') {
      return res.status(403).json({ error: 'L\'admin doit valider ou refuser, pas annuler' });
    }

    const reservationDoc = await admin.firestore().collection('reservations').doc(id).get();
    if (!reservationDoc.exists) return res.status(404).json({ error: 'Réservation introuvable' });

    const reservationData = reservationDoc.data();

    // Élève accède uniquement à sa propre réservation
    if (!isAdmin && reservationData.studentId !== req.user.uid) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Réservation déjà traitée
    if (reservationData.status !== 'en_cours') {
      return res.status(400).json({
        error: 'Cette réservation a déjà été traitée',
        currentStatus: reservationData.status
      });
    }

    const updateData = { status, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    let sessionId = null;

    // ✅ Admin valide → créer la séance automatiquement
    if (status === 'validee') {
      const sessionRef = admin.firestore().collection('sessions').doc();
      await sessionRef.set({
        studentId: reservationData.studentId,
        instructorId: reservationData.instructorId,
        courseType: reservationData.courseType,
        courseTitle: reservationData.courseTitle,
        scheduledDate: admin.firestore.Timestamp.fromDate(new Date(reservationData.date)),
        scheduledTime: reservationData.time,
        duration: reservationData.duration,
        notes: reservationData.notes || '',
        status: 'confirmée',
        reservationId: id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      sessionId = sessionRef.id;
      updateData.sessionId = sessionId;
    }

    // ✅ Admin refuse → enregistrer le motif
    if (status === 'refusee') {
      updateData.motifRefus = motifRefus || 'Aucun motif fourni';
    }

    await admin.firestore().collection('reservations').doc(id).update(updateData);

    const messages = {
      validee: 'Réservation validée, séance créée avec succès',
      refusee: 'Réservation refusée',
      annulee: 'Réservation annulée avec succès'
    };

    res.status(200).json({
      message: messages[status],
      status,
      ...(sessionId && { sessionId })
    });
  } catch (error) {
    console.error('Erreur PATCH /reservations/:id/status:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

module.exports = router;