const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validationMiddleware');

const checkReadPermissions = async (req, res, next) => { next(); };

const checkWritePermissions = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Accès non autorisé',
      message: 'Seuls les administrateurs peuvent modifier les séances',
      debug: { userRole: req.user.role, requiredRoles: ['admin'], action: req.method }
    });
  }
  next();
};

// ============================================================
// ✅ ROUTES STATIQUES EN PREMIER
// ============================================================

/**
 * @swagger
 * /api/sessions/stats:
 *   get:
 *     summary: Statistiques de présence du jour
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date cible (YYYY-MM-DD), par défaut aujourd'hui
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalEleves:
 *                   type: number
 *                 presents:
 *                   type: number
 *                 absents:
 *                   type: number
 *                 enRetard:
 *                   type: number
 *                 annules:
 *                   type: number
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/stats', checkAuth, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

    const snap = await admin.firestore().collection('sessions')
      .where('scheduledDate', '>=', startOfDay)
      .where('scheduledDate', '<=', endOfDay)
      .get();

    const sessions = snap.docs.map(doc => doc.data());

    res.status(200).json({
      totalEleves: sessions.length,
      presents: sessions.filter(s => s.status === 'présent').length,
      absents: sessions.filter(s => s.status === 'absent').length,
      enRetard: sessions.filter(s => s.status === 'en_retard').length,
      annules: sessions.filter(s => s.status === 'annulé').length
    });
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

/**
 * @swagger
 * /api/sessions/dashboard-stats:
 *   get:
 *     summary: Statistiques du dashboard des séances
 *     description: Total, confirmées, en attente, annulées, aujourd'hui, cette semaine
 *     tags: [Sessions]
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
 *                 totalSessions:
 *                   type: number
 *                   example: 8
 *                 confirmedSessions:
 *                   type: number
 *                   example: 5
 *                 pendingSessions:
 *                   type: number
 *                   example: 2
 *                 cancelledSessions:
 *                   type: number
 *                   example: 1
 *                 todaySessions:
 *                   type: number
 *                   example: 3
 *                 thisWeekSessions:
 *                   type: number
 *                   example: 7
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/dashboard-stats', checkAuth, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const [monthlySnap, todaySnap, weekSnap] = await Promise.all([
      admin.firestore().collection('sessions').where('scheduledDate', '>=', startOfMonth).get(),
      admin.firestore().collection('sessions').where('scheduledDate', '>=', startOfDay).where('scheduledDate', '<=', endOfDay).get(),
      admin.firestore().collection('sessions').where('scheduledDate', '>=', startOfWeek).where('scheduledDate', '<=', endOfWeek).get()
    ]);

    const monthly = monthlySnap.docs.map(doc => doc.data());

    res.status(200).json({
      totalSessions: monthly.length,
      confirmedSessions: monthly.filter(s => s.status === 'confirmée').length,
      pendingSessions: monthly.filter(s => s.status === 'en_attente').length,
      cancelledSessions: monthly.filter(s => s.status === 'annulée').length,
      todaySessions: todaySnap.size,
      thisWeekSessions: weekSnap.size
    });
  } catch (error) {
    console.error('Erreur dashboard-stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

/**
 * @swagger
 * /api/sessions/upcoming:
 *   get:
 *     summary: Séances à venir avec pagination
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, confirmée, en_attente, annulée]
 *         description: Filtrer par statut
 *       - in: query
 *         name: instructorId
 *         schema:
 *           type: string
 *         description: Filtrer par instructeur
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, conduite, code, examen, examen_blanc, perfectionnement]
 *         description: Filtrer par type
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
 *         description: Liste des séances à venir
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/upcoming', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const { status, instructorId, type, page = 1, limit = 10 } = req.query;

    let query = admin.firestore().collection('sessions')
      .where('scheduledDate', '>=', new Date())
      .orderBy('scheduledDate', 'asc');

    if (status && status !== 'all') query = query.where('status', '==', status);
    if (instructorId && instructorId !== 'all') query = query.where('instructorId', '==', instructorId);
    if (type && type !== 'all') query = query.where('courseType', '==', type);

    const snap = await query.get();
    let sessions = snap.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, scheduledDate: data.scheduledDate?.toDate() };
    });

    const total = sessions.length;
    const paginatedSessions = sessions.slice((page - 1) * limit, page * parseInt(limit));

    const enriched = await Promise.all(paginatedSessions.map(async (session) => {
      const [studentDoc, instructorDoc] = await Promise.all([
        admin.firestore().collection('users').doc(session.studentId).get(),
        admin.firestore().collection('users').doc(session.instructorId).get()
      ]);
      const s = studentDoc.exists ? studentDoc.data() : null;
      const i = instructorDoc.exists ? instructorDoc.data() : null;
      return {
        id: session.id,
        student: { id: session.studentId, nom: s?.nom || 'Élève inconnu', email: s?.email || '', initials: s?.nom ? s.nom.split(' ').map(n => n[0]).join('').toUpperCase() : 'E' },
        instructor: { id: session.instructorId, nom: i?.nom || 'Instructeur inconnu' },
        type: session.courseType,
        date: session.scheduledDate,
        time: session.scheduledTime,
        duration: session.duration,
        status: session.status
      };
    }));

    res.status(200).json({
      sessions: enriched,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Erreur upcoming:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des séances' });
  }
});

/**
 * @swagger
 * /api/sessions/instructors:
 *   get:
 *     summary: Liste des instructeurs
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 instructors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       nom:
 *                         type: string
 *                       email:
 *                         type: string
 *       401:
 *         description: Token manquant ou invalide
 */
router.get('/instructors', checkAuth, async (req, res) => {
  try {
    const snap = await admin.firestore().collection('users').where('role', '==', 'instructeur').get();
    const instructors = snap.docs.map(doc => ({ id: doc.id, nom: doc.data().nom, email: doc.data().email }));
    res.status(200).json({ instructors });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des instructeurs' });
  }
});

/**
 * @swagger
 * /api/sessions/types:
 *   get:
 *     summary: Liste des types de séances
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Types récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 types:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       value:
 *                         type: string
 *                       label:
 *                         type: string
 *                       color:
 *                         type: string
 */
router.get('/types', checkAuth, async (req, res) => {
  res.status(200).json({
    types: [
      { value: 'conduite', label: 'Conduite', color: 'blue' },
      { value: 'code', label: 'Code', color: 'green' },
      { value: 'examen', label: 'Examen', color: 'red' },
      { value: 'évaluation', label: 'Évaluation', color: 'yellow' },
      { value: 'perfectionnement', label: 'Perfectionnement', color: 'purple' },
      { value: 'examen_blanc', label: 'Examen blanc', color: 'orange' }
    ]
  });
});

/**
 * @swagger
 * /api/sessions/me:
 *   get:
 *     summary: Séances de l'utilisateur connecté
 *     description: Retourne les séances de l'élève connecté, formatées pour la page "Mes séances"
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Nombre maximum de séances
 *     responses:
 *       200:
 *         description: Séances récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                         example: "Séance de conduite — Ville"
 *                       instructorName:
 *                         type: string
 *                         example: "Jean Martin"
 *                       date:
 *                         type: string
 *                         example: "lundi 15 mars"
 *                       time:
 *                         type: string
 *                         example: "09:00"
 *                       duration:
 *                         type: string
 *                         example: "1h"
 *                       type:
 *                         type: string
 *                         example: "Pratique"
 *                       status:
 *                         type: string
 *                         example: "À venir"
 *                       iconType:
 *                         type: string
 *                         example: "car"
 *                 totalCount:
 *                   type: number
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/me', checkAuth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const userId = req.user.uid;

    const snap = await admin.firestore().collection('sessions')
      .where('studentId', '==', userId)
      .orderBy('scheduledDate', 'desc')
      .limit(parseInt(limit))
      .get();

    const sessions = await Promise.all(snap.docs.map(async (doc) => {
      const data = doc.data();
      const instructorDoc = await admin.firestore().collection('users').doc(data.instructorId).get();
      const instructorData = instructorDoc.exists ? instructorDoc.data() : null;

      let iconType = 'book', typeLabel = 'Théorique';
      if (data.courseType === 'conduite') { iconType = 'car'; typeLabel = 'Pratique'; }
      else if (data.courseType === 'examen_blanc') { iconType = 'monitor'; typeLabel = 'En ligne'; }

      const now = new Date();
      const sessionDate = data.scheduledDate?.toDate?.() || new Date(data.scheduledDate);
      let statusLabel = 'À venir';
      if (data.status === 'présent' && sessionDate < now) statusLabel = 'Terminé';
      else if (data.status === 'absent') statusLabel = 'Absent';
      else if (data.status === 'annulée') statusLabel = 'Annulée';

      return {
        id: doc.id,
        title: data.courseTitle,
        instructorName: instructorData?.nom || 'Instructeur inconnu',
        date: sessionDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        time: data.scheduledTime,
        duration: `${data.duration}h`,
        type: typeLabel,
        status: statusLabel,
        iconType
      };
    }));

    res.status(200).json({ sessions, totalCount: sessions.length });
  } catch (error) {
    console.error('Erreur /me:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des séances' });
  }
});

/**
 * @swagger
 * /api/sessions/export/pdf:
 *   post:
 *     summary: Exporter les sessions en PDF (admin)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Export en cours de développement
 *       403:
 *         description: Accès non autorisé
 */
router.post('/export/pdf', checkAuth, checkWritePermissions, async (req, res) => {
  res.status(200).json({ message: 'Export PDF en cours de développement' });
});

/**
 * @swagger
 * /api/sessions/export/excel:
 *   post:
 *     summary: Exporter les sessions en Excel (admin)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Export en cours de développement
 *       403:
 *         description: Accès non autorisé
 */
router.post('/export/excel', checkAuth, checkWritePermissions, async (req, res) => {
  res.status(200).json({ message: 'Export Excel en cours de développement' });
});

// ============================================================
// ✅ ROUTES CRÉNEAUX (slots)
// ============================================================

/**
 * @swagger
 * /api/sessions/slots:
 *   post:
 *     summary: Créer un créneau disponible (admin)
 *     tags: [Sessions]
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
 *               - duration
 *               - courseType
 *               - instructorId
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-20"
 *               time:
 *                 type: string
 *                 example: "09:00"
 *               duration:
 *                 type: number
 *                 example: 1
 *               courseType:
 *                 type: string
 *                 enum: [conduite, code, examen, examen_blanc, perfectionnement]
 *               courseTitle:
 *                 type: string
 *                 example: "Séance de conduite — Ville"
 *               instructorId:
 *                 type: string
 *               location:
 *                 type: string
 *                 example: "Départ agence principale"
 *     responses:
 *       201:
 *         description: Créneau créé avec succès
 *       400:
 *         description: Champs requis manquants
 *       403:
 *         description: Accès non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/slots', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { date, time, duration, courseType, courseTitle, instructorId, location } = req.body;

    if (!date || !time || !duration || !courseType || !instructorId) {
      return res.status(400).json({ error: 'date, time, duration, courseType et instructorId sont requis' });
    }

    const slotData = {
      date: admin.firestore.Timestamp.fromDate(new Date(date)),
      time, duration, courseType,
      courseTitle: courseTitle || `Séance de ${courseType}`,
      instructorId,
      location: location || '',
      status: 'disponible',
      studentId: null,
      reservedAt: null,
      createdBy: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const slotRef = await admin.firestore().collection('slots').add(slotData);
    res.status(201).json({ message: 'Créneau créé avec succès', slotId: slotRef.id });
  } catch (error) {
    console.error('Erreur création créneau:', error);
    res.status(500).json({ error: 'Erreur lors de la création du créneau' });
  }
});

/**
 * @swagger
 * /api/sessions/slots:
 *   get:
 *     summary: Voir les créneaux disponibles
 *     description: |
 *       - **Élève / Instructeur** : voit uniquement les créneaux disponibles
 *       - **Admin** : voit tous les créneaux avec filtre optionnel par statut
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: courseType
 *         schema:
 *           type: string
 *         description: Filtrer par type de séance
 *       - in: query
 *         name: instructorId
 *         schema:
 *           type: string
 *         description: Filtrer par instructeur
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [disponible, réservé, annulé]
 *         description: Filtrer par statut (admin seulement)
 *     responses:
 *       200:
 *         description: Créneaux récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slots:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       date:
 *                         type: string
 *                         format: date-time
 *                       time:
 *                         type: string
 *                         example: "09:00"
 *                       duration:
 *                         type: number
 *                       courseType:
 *                         type: string
 *                       courseTitle:
 *                         type: string
 *                       instructor:
 *                         type: object
 *                       location:
 *                         type: string
 *                       status:
 *                         type: string
 *                 total:
 *                   type: number
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/slots', checkAuth, async (req, res) => {
  try {
    const { courseType, instructorId, status } = req.query;
    const isAdmin = req.user.role === 'admin';

    let query = admin.firestore().collection('slots')
      .where('date', '>=', admin.firestore.Timestamp.fromDate(new Date()));

    if (!isAdmin) {
      query = query.where('status', '==', 'disponible');
    } else if (status) {
      query = query.where('status', '==', status);
    }

    if (courseType && courseType !== 'all') query = query.where('courseType', '==', courseType);
    if (instructorId && instructorId !== 'all') query = query.where('instructorId', '==', instructorId);

    const slotsSnap = await query.orderBy('date', 'asc').get();

    const slots = await Promise.all(slotsSnap.docs.map(async (doc) => {
      const data = doc.data();
      const instructorDoc = await admin.firestore().collection('users').doc(data.instructorId).get();
      const instructorData = instructorDoc.exists ? instructorDoc.data() : null;
      return {
        id: doc.id,
        date: data.date?.toDate(),
        time: data.time,
        duration: data.duration,
        courseType: data.courseType,
        courseTitle: data.courseTitle,
        instructor: { id: data.instructorId, nom: instructorData?.nom || 'Instructeur inconnu' },
        location: data.location,
        status: data.status,
        studentId: data.studentId || null
      };
    }));

    res.status(200).json({ slots, total: slots.length });
  } catch (error) {
    console.error('Erreur récupération créneaux:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des créneaux' });
  }
});

/**
 * @swagger
 * /api/sessions/slots/{slotId}/reserve:
 *   post:
 *     summary: Réserver un créneau (élève)
 *     description: L'élève connecté réserve un créneau disponible. Transaction atomique — impossible de double-réserver.
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du créneau à réserver
 *     responses:
 *       201:
 *         description: Créneau réservé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Créneau réservé avec succès"
 *                 sessionId:
 *                   type: string
 *                 slotId:
 *                   type: string
 *       400:
 *         description: Créneau déjà réservé
 *       404:
 *         description: Créneau introuvable
 *       500:
 *         description: Erreur serveur
 */
router.post('/slots/:slotId/reserve', checkAuth, async (req, res) => {
  try {
    const { slotId } = req.params;
    const studentId = req.user.uid;
    const slotRef = admin.firestore().collection('slots').doc(slotId);

    const sessionId = await admin.firestore().runTransaction(async (transaction) => {
      const slotDoc = await transaction.get(slotRef);
      if (!slotDoc.exists) throw new Error('SLOT_NOT_FOUND');
      const slotData = slotDoc.data();
      if (slotData.status !== 'disponible') throw new Error('SLOT_ALREADY_RESERVED');

      const sessionRef = admin.firestore().collection('sessions').doc();
      transaction.set(sessionRef, {
        studentId, instructorId: slotData.instructorId,
        courseType: slotData.courseType, courseTitle: slotData.courseTitle,
        scheduledDate: slotData.date, scheduledTime: slotData.time,
        duration: slotData.duration, location: slotData.location,
        status: 'confirmée', slotId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      transaction.update(slotRef, {
        status: 'réservé', studentId,
        reservedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return sessionRef.id;
    });

    res.status(201).json({ message: 'Créneau réservé avec succès', sessionId, slotId });
  } catch (error) {
    if (error.message === 'SLOT_NOT_FOUND') return res.status(404).json({ error: 'Créneau introuvable' });
    if (error.message === 'SLOT_ALREADY_RESERVED') return res.status(400).json({ error: 'Ce créneau est déjà réservé' });
    console.error('Erreur réservation:', error);
    res.status(500).json({ error: 'Erreur lors de la réservation' });
  }
});

/**
 * @swagger
 * /api/sessions/slots/{slotId}:
 *   delete:
 *     summary: Supprimer un créneau (admin)
 *     description: Impossible de supprimer un créneau déjà réservé par un élève
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Créneau supprimé avec succès
 *       400:
 *         description: Créneau déjà réservé, suppression impossible
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         description: Créneau introuvable
 *       500:
 *         description: Erreur serveur
 */
router.delete('/slots/:slotId', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { slotId } = req.params;
    const slotDoc = await admin.firestore().collection('slots').doc(slotId).get();
    if (!slotDoc.exists) return res.status(404).json({ error: 'Créneau introuvable' });
    if (slotDoc.data().status === 'réservé') return res.status(400).json({ error: 'Impossible de supprimer un créneau déjà réservé' });

    await admin.firestore().collection('slots').doc(slotId).delete();
    res.status(200).json({ message: 'Créneau supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression créneau:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du créneau' });
  }
});

// ============================================================
// ✅ ROUTES COLLECTION (GET / et POST /)
// ============================================================

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: Liste des sessions avec filtres et pagination
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtrer par date (YYYY-MM-DD)
 *       - in: query
 *         name: instructorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [confirmée, présent, absent, en_retard, annulée]
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: upcoming
 *         schema:
 *           type: boolean
 *         description: Si true, retourne uniquement les sessions futures
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
 *         description: Liste des sessions récupérée avec succès
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const { date, instructorId, status, studentId, startDate, endDate, upcoming, page = 1, limit = 10 } = req.query;

    let query = admin.firestore().collection('sessions');

    if (upcoming === 'true') {
      query = query.where('scheduledDate', '>=', new Date());
    } else if (date) {
      const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
      query = query.where('scheduledDate', '>=', startOfDay);
    } else if (startDate && endDate) {
      query = query.where('scheduledDate', '>=', new Date(startDate)).where('scheduledDate', '<=', new Date(endDate));
    }

    if (instructorId) query = query.where('instructorId', '==', instructorId);
    if (status) query = query.where('status', '==', status);
    if (studentId) query = query.where('studentId', '==', studentId);

    const pageNum = parseInt(page), limitNum = parseInt(limit);
    const totalSnapshot = await query.get();
    const total = totalSnapshot.size;

    let allSnap;
    try { allSnap = await query.orderBy('scheduledDate', 'asc').orderBy('scheduledTime', 'asc').get(); }
    catch { allSnap = await query.get(); }

    const paginatedDocs = allSnap.docs.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const sessions = await Promise.all(paginatedDocs.map(async (doc) => {
      const data = doc.data();
      const [studentDoc, instructorDoc] = await Promise.all([
        admin.firestore().collection('users').doc(data.studentId).get(),
        admin.firestore().collection('users').doc(data.instructorId).get()
      ]);
      const s = studentDoc.exists ? studentDoc.data() : null;
      const i = instructorDoc.exists ? instructorDoc.data() : null;
      const progression = Math.min(((s?.theoreticalHours || 0) + (s?.practicalHours || 0)) / ((s?.theoreticalHoursMin || 40) + (s?.practicalHoursMin || 20)) * 100, 100);

      return {
        id: doc.id,
        student: { id: data.studentId, nom: s?.nom || 'Élève inconnu', nomComplet: s?.nomComplet || s?.nom || 'Élève inconnu', email: s?.email || '', initials: s?.nom ? s.nom.split(' ').map(n => n[0]).join('').toUpperCase() : 'E' },
        instructor: { id: data.instructorId, nom: i?.nom || 'Instructeur inconnu' },
        course: { type: data.courseType, title: data.courseTitle },
        schedule: { date: data.scheduledDate, time: data.scheduledTime },
        status: data.status,
        progression: Math.round(progression),
        actions: ['Détails', 'Modifier']
      };
    }));

    res.status(200).json({ sessions, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (error) {
    console.error('Erreur GET /sessions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des sessions', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Créer une session manuellement (admin)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentId
 *               - instructorId
 *               - courseType
 *               - scheduledDate
 *               - scheduledTime
 *               - duration
 *             properties:
 *               studentId:
 *                 type: string
 *               instructorId:
 *                 type: string
 *               courseType:
 *                 type: string
 *               courseTitle:
 *                 type: string
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               scheduledTime:
 *                 type: string
 *                 example: "09:00"
 *               duration:
 *                 type: number
 *               location:
 *                 type: string
 *     responses:
 *       201:
 *         description: Session créée avec succès
 *       403:
 *         description: Accès non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/', checkAuth, checkWritePermissions, validate(schemas.createSession), async (req, res) => {
  try {
    const sessionRef = await admin.firestore().collection('sessions').add({
      ...req.body,
      status: 'confirmée',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(201).json({ message: 'Session créée avec succès', sessionId: sessionRef.id });
  } catch (error) {
    console.error('Erreur création session:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la session' });
  }
});

// ============================================================
// ✅ ROUTES DYNAMIQUES EN DERNIER
// ============================================================

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   get:
 *     summary: Détails d'une session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 student:
 *                   type: object
 *                 instructor:
 *                   type: object
 *                 courseType:
 *                   type: string
 *                 courseTitle:
 *                   type: string
 *                 scheduledDate:
 *                   type: string
 *                 scheduledTime:
 *                   type: string
 *                 duration:
 *                   type: number
 *                 status:
 *                   type: string
 *                 location:
 *                   type: string
 *       404:
 *         description: Session introuvable
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/:sessionId', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionDoc = await admin.firestore().collection('sessions').doc(sessionId).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Session introuvable' });

    const data = sessionDoc.data();
    const [studentDoc, instructorDoc] = await Promise.all([
      admin.firestore().collection('users').doc(data.studentId).get(),
      admin.firestore().collection('users').doc(data.instructorId).get()
    ]);

    res.status(200).json({
      id: sessionDoc.id,
      student: studentDoc.exists ? studentDoc.data() : null,
      instructor: instructorDoc.exists ? instructorDoc.data() : null,
      courseType: data.courseType, courseTitle: data.courseTitle,
      scheduledDate: data.scheduledDate, scheduledTime: data.scheduledTime,
      actualStartTime: data.actualStartTime, actualEndTime: data.actualEndTime,
      duration: data.duration, status: data.status,
      notes: data.notes, location: data.location,
      createdAt: data.createdAt, updatedAt: data.updatedAt
    });
  } catch (error) {
    console.error('Erreur GET /:sessionId:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails' });
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}/status:
 *   patch:
 *     summary: Mettre à jour le statut d'une session (admin)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
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
 *                 enum: [confirmée, présent, absent, en_retard, annulée]
 *                 example: "présent"
 *               notes:
 *                 type: string
 *                 example: "Élève ponctuel"
 *               actualStartTime:
 *                 type: string
 *                 example: "09:05"
 *               actualEndTime:
 *                 type: string
 *                 example: "10:05"
 *     responses:
 *       200:
 *         description: Statut mis à jour avec succès
 *       404:
 *         description: Session introuvable
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.patch('/:sessionId/status', checkAuth, checkWritePermissions, validate(schemas.updateSessionStatus), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status, notes, actualStartTime, actualEndTime } = req.body;

    const sessionDoc = await admin.firestore().collection('sessions').doc(sessionId).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Session introuvable' });

    await admin.firestore().collection('sessions').doc(sessionId).update({
      status, notes: notes || null,
      actualStartTime: actualStartTime || null, actualEndTime: actualEndTime || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ message: 'Statut mis à jour avec succès', newStatus: status });
  } catch (error) {
    console.error('Erreur PATCH status:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}/presence:
 *   post:
 *     summary: Marquer la présence d'un élève (admin)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 example: "Élève présent et ponctuel"
 *               actualStartTime:
 *                 type: string
 *                 example: "09:00"
 *               actualEndTime:
 *                 type: string
 *                 example: "10:00"
 *     responses:
 *       200:
 *         description: Présence marquée avec succès
 *       404:
 *         description: Session introuvable
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/:sessionId/presence', checkAuth, checkWritePermissions, validate(schemas.addPresence), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes, actualStartTime, actualEndTime } = req.body || {};

    const sessionRef = admin.firestore().collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Session introuvable' });

    await sessionRef.update({
      status: 'présent', notes: notes || null,
      actualStartTime: actualStartTime || null, actualEndTime: actualEndTime || null,
      presenceMarkedAt: admin.firestore.FieldValue.serverTimestamp(),
      presenceMarkedBy: req.user.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ message: 'Présence ajoutée avec succès', sessionId, status: 'présent' });
  } catch (error) {
    console.error('Erreur présence:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout de la présence' });
  }
});

/**
 * @swagger
 * /api/sessions/{id}:
 *   put:
 *     summary: Modifier une séance (admin)
 *     tags: [Sessions]
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
 *     responses:
 *       200:
 *         description: Séance modifiée avec succès
 *       404:
 *         description: Séance introuvable
 *       403:
 *         description: Accès non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.put('/:id', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id } = req.params;
    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    await admin.firestore().collection('sessions').doc(id).update({ ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    const updated = await admin.firestore().collection('sessions').doc(id).get();
    res.status(200).json({ message: 'Séance modifiée avec succès', session: { id: updated.id, ...updated.data(), scheduledDate: updated.data().scheduledDate?.toDate() } });
  } catch (error) {
    console.error('Erreur PUT /:id:', error);
    res.status(500).json({ error: 'Erreur lors de la modification de la séance' });
  }
});

/**
 * @swagger
 * /api/sessions/{id}:
 *   delete:
 *     summary: Supprimer une séance (admin)
 *     tags: [Sessions]
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
 *         description: Séance supprimée avec succès
 *       404:
 *         description: Séance introuvable
 *       403:
 *         description: Accès non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.delete('/:id', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id } = req.params;
    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    await admin.firestore().collection('sessions').doc(id).delete();
    res.status(200).json({ message: 'Séance supprimée avec succès' });
  } catch (error) {
    console.error('Erreur DELETE /:id:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la séance' });
  }
});

module.exports = router;