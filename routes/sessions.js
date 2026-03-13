const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validationMiddleware');

const checkReadPermissions = async (req, res, next) => {
  next();
};

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

router.get('/stats', checkAuth, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

    const sessionsSnapshot = await admin.firestore().collection('sessions')
      .where('scheduledDate', '>=', startOfDay)
      .where('scheduledDate', '<=', endOfDay)
      .get();

    const sessions = sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.status(200).json({
      totalEleves: sessions.length,
      presents: sessions.filter(s => s.status === 'présent').length,
      absents: sessions.filter(s => s.status === 'absent').length,
      enRetard: sessions.filter(s => s.status === 'en_retard').length,
      annules: sessions.filter(s => s.status === 'annulé').length
    });
  } catch (error) {
    console.error('Erreur récupération statistiques sessions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

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
    console.error('Erreur récupération stats dashboard:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

router.get('/upcoming', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const { status, instructorId, type, search, page = 1, limit = 10 } = req.query;

    let query = admin.firestore().collection('sessions')
      .where('scheduledDate', '>=', new Date())
      .orderBy('scheduledDate', 'asc');

    if (status && status !== 'all') query = query.where('status', '==', status);
    if (instructorId && instructorId !== 'all') query = query.where('instructorId', '==', instructorId);
    if (type && type !== 'all') query = query.where('courseType', '==', type);

    const sessionsSnapshot = await query.get();
    let sessions = sessionsSnapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, scheduledDate: data.scheduledDate?.toDate(), createdAt: data.createdAt?.toDate() };
    });

    const total = sessions.length;
    const startIndex = (page - 1) * limit;
    const paginatedSessions = sessions.slice(startIndex, startIndex + parseInt(limit));

    const enriched = await Promise.all(paginatedSessions.map(async (session) => {
      const [studentDoc, instructorDoc] = await Promise.all([
        admin.firestore().collection('users').doc(session.studentId).get(),
        admin.firestore().collection('users').doc(session.instructorId).get()
      ]);
      const studentData = studentDoc.exists ? studentDoc.data() : null;
      const instructorData = instructorDoc.exists ? instructorDoc.data() : null;
      return {
        id: session.id,
        student: {
          id: session.studentId,
          nom: studentData?.nom || 'Élève inconnu',
          email: studentData?.email || '',
          initials: studentData?.nom ? studentData.nom.split(' ').map(n => n[0]).join('').toUpperCase() : 'E'
        },
        instructor: { id: session.instructorId, nom: instructorData?.nom || 'Instructeur inconnu' },
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
    console.error('Erreur récupération séances à venir:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des séances' });
  }
});

router.get('/instructors', checkAuth, async (req, res) => {
  try {
    const snap = await admin.firestore().collection('users').where('role', '==', 'instructeur').get();
    const instructors = snap.docs.map(doc => ({ id: doc.id, nom: doc.data().nom, email: doc.data().email }));
    res.status(200).json({ instructors });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des instructeurs' });
  }
});

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
    console.error('Erreur récupération séances utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des séances' });
  }
});

router.post('/export/pdf', checkAuth, checkWritePermissions, async (req, res) => {
  res.status(200).json({ message: 'Export PDF en cours de développement' });
});

router.post('/export/excel', checkAuth, checkWritePermissions, async (req, res) => {
  res.status(200).json({ message: 'Export Excel en cours de développement' });
});

// ============================================================
// ✅ ROUTES CRÉNEAUX (slots) — Admin crée, élève réserve
// ============================================================

/**
 * @swagger
 * /api/sessions/slots:
 *   post:
 *     summary: Créer un créneau disponible (admin)
 *     description: L'admin crée un créneau horaire que les élèves pourront réserver
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
 *                 example: "conduite"
 *               courseTitle:
 *                 type: string
 *                 example: "Séance de conduite — Ville"
 *               instructorId:
 *                 type: string
 *                 example: "uid_instructeur"
 *               location:
 *                 type: string
 *                 example: "Départ agence principale"
 *     responses:
 *       201:
 *         description: Créneau créé avec succès
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
      time,
      duration,
      courseType,
      courseTitle: courseTitle || `Séance de ${courseType}`,
      instructorId,
      location: location || '',
      status: 'disponible', // disponible | réservé | annulé
      studentId: null,
      reservedAt: null,
      createdBy: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const slotRef = await admin.firestore().collection('slots').add(slotData);

    res.status(201).json({
      message: 'Créneau créé avec succès',
      slotId: slotRef.id,
      slot: { id: slotRef.id, ...slotData, date: new Date(date) }
    });
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
 *       - **Élève / Instructeur** : voit uniquement les créneaux disponibles (status=disponible)
 *       - **Admin** : voit tous les créneaux avec filtre optionnel
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
 *         description: Liste des créneaux récupérée avec succès
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

    // Élève/instructeur → seulement les créneaux disponibles
    if (!isAdmin) {
      query = query.where('status', '==', 'disponible');
    } else if (status) {
      query = query.where('status', '==', status);
    }

    if (courseType && courseType !== 'all') {
      query = query.where('courseType', '==', courseType);
    }
    if (instructorId && instructorId !== 'all') {
      query = query.where('instructorId', '==', instructorId);
    }

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
        instructor: {
          id: data.instructorId,
          nom: instructorData?.nom || 'Instructeur inconnu'
        },
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
 *     description: L'élève connecté réserve un créneau disponible. La réservation est atomique — impossible de double-réserver.
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

    // Transaction atomique — anti double-réservation
    const sessionId = await admin.firestore().runTransaction(async (transaction) => {
      const slotDoc = await transaction.get(slotRef);

      if (!slotDoc.exists) {
        throw new Error('SLOT_NOT_FOUND');
      }

      const slotData = slotDoc.data();

      if (slotData.status !== 'disponible') {
        throw new Error('SLOT_ALREADY_RESERVED');
      }

      // Créer la session dans la collection sessions
      const sessionRef = admin.firestore().collection('sessions').doc();
      transaction.set(sessionRef, {
        studentId,
        instructorId: slotData.instructorId,
        courseType: slotData.courseType,
        courseTitle: slotData.courseTitle,
        scheduledDate: slotData.date,
        scheduledTime: slotData.time,
        duration: slotData.duration,
        location: slotData.location,
        status: 'confirmée',
        slotId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Marquer le créneau comme réservé
      transaction.update(slotRef, {
        status: 'réservé',
        studentId,
        reservedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return sessionRef.id;
    });

    res.status(201).json({
      message: 'Créneau réservé avec succès',
      sessionId,
      slotId
    });

  } catch (error) {
    if (error.message === 'SLOT_NOT_FOUND') {
      return res.status(404).json({ error: 'Créneau introuvable' });
    }
    if (error.message === 'SLOT_ALREADY_RESERVED') {
      return res.status(400).json({ error: 'Ce créneau est déjà réservé' });
    }
    console.error('Erreur réservation créneau:', error);
    res.status(500).json({ error: 'Erreur lors de la réservation' });
  }
});

/**
 * @swagger
 * /api/sessions/slots/{slotId}:
 *   delete:
 *     summary: Supprimer un créneau (admin)
 *     description: Supprime un créneau. Impossible si déjà réservé par un élève.
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
 *         description: Impossible de supprimer un créneau déjà réservé
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
    if (!slotDoc.exists) {
      return res.status(404).json({ error: 'Créneau introuvable' });
    }

    if (slotDoc.data().status === 'réservé') {
      return res.status(400).json({ error: 'Impossible de supprimer un créneau déjà réservé par un élève' });
    }

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

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const totalSnapshot = await query.get();
    const total = totalSnapshot.size;

    let allSnap;
    try {
      allSnap = await query.orderBy('scheduledDate', 'asc').orderBy('scheduledTime', 'asc').get();
    } catch {
      allSnap = await query.get();
    }

    const paginatedDocs = allSnap.docs.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const sessions = await Promise.all(paginatedDocs.map(async (doc) => {
      const data = doc.data();
      const [studentDoc, instructorDoc] = await Promise.all([
        admin.firestore().collection('users').doc(data.studentId).get(),
        admin.firestore().collection('users').doc(data.instructorId).get()
      ]);
      const studentData = studentDoc.exists ? studentDoc.data() : null;
      const instructorData = instructorDoc.exists ? instructorDoc.data() : null;

      const progression = Math.min(
        ((studentData?.theoreticalHours || 0) + (studentData?.practicalHours || 0)) /
        ((studentData?.theoreticalHoursMin || 40) + (studentData?.practicalHoursMin || 20)) * 100, 100
      );

      return {
        id: doc.id,
        student: {
          id: data.studentId,
          nom: studentData?.nom || 'Élève inconnu',
          nomComplet: studentData?.nomComplet || studentData?.nom || 'Élève inconnu',
          email: studentData?.email || '',
          initials: studentData?.nom ? studentData.nom.split(' ').map(n => n[0]).join('').toUpperCase() : 'E'
        },
        instructor: { id: data.instructorId, nom: instructorData?.nom || 'Instructeur inconnu' },
        course: { type: data.courseType, title: data.courseTitle },
        schedule: { date: data.scheduledDate, time: data.scheduledTime },
        status: data.status,
        progression: Math.round(progression),
        actions: ['Détails', 'Modifier']
      };
    }));

    res.status(200).json({
      sessions,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    console.error('Erreur récupération sessions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des sessions', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

router.post('/', checkAuth, checkWritePermissions, validate(schemas.createSession), async (req, res) => {
  try {
    const sessionData = req.body;
    const sessionRef = await admin.firestore().collection('sessions').add({
      ...sessionData,
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
      courseType: data.courseType,
      courseTitle: data.courseTitle,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      duration: data.duration,
      status: data.status,
      notes: data.notes,
      location: data.location,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  } catch (error) {
    console.error('Erreur récupération détails session:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails' });
  }
});

router.patch('/:sessionId/status', checkAuth, checkWritePermissions, validate(schemas.updateSessionStatus), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status, notes, actualStartTime, actualEndTime } = req.body;

    const sessionDoc = await admin.firestore().collection('sessions').doc(sessionId).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Session introuvable' });

    await admin.firestore().collection('sessions').doc(sessionId).update({
      status, notes: notes || null, actualStartTime: actualStartTime || null,
      actualEndTime: actualEndTime || null, updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ message: 'Statut mis à jour avec succès', newStatus: status });
  } catch (error) {
    console.error('Erreur mise à jour statut:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

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
    console.error('Erreur ajout présence:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout de la présence' });
  }
});

router.put('/:id', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id } = req.params;
    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    await admin.firestore().collection('sessions').doc(id).update({
      ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const updated = await admin.firestore().collection('sessions').doc(id).get();
    res.status(200).json({
      message: 'Séance modifiée avec succès',
      session: { id: updated.id, ...updated.data(), scheduledDate: updated.data().scheduledDate?.toDate() }
    });
  } catch (error) {
    console.error('Erreur modification séance:', error);
    res.status(500).json({ error: 'Erreur lors de la modification de la séance' });
  }
});

router.delete('/:id', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id } = req.params;
    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    await admin.firestore().collection('sessions').doc(id).delete();
    res.status(200).json({ message: 'Séance supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression séance:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la séance' });
  }
});

module.exports = router;