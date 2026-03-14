const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');

const checkWritePermissions = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Accès non autorisé',
      message: 'Seuls les administrateurs peuvent modifier les séances'
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
 *     summary: Statistiques des séances
 *     description: |
 *       Retourne les statistiques selon le type demandé :
 *       - **?type=day** (défaut) → présences du jour (presents, absents, en_retard, annules)
 *       - **?type=dashboard** → stats du mois en cours (total, confirmées, aujourd'hui, cette semaine)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [day, dashboard]
 *           default: day
 *         description: Type de statistiques
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date cible pour type=day (YYYY-MM-DD), par défaut aujourd'hui
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: |
 *                 Pour type=day: { totalEleves, presents, absents, enRetard, annules }
 *                 Pour type=dashboard: { totalSessions, confirmedSessions, pendingSessions, cancelledSessions, todaySessions, thisWeekSessions }
 *       401:
 *         description: Token invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/stats', checkAuth, async (req, res) => {
  try {
    const { type = 'day', date } = req.query;

    if (type === 'dashboard') {
      // ✅ Stats dashboard — mois en cours
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
      const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() + 1); startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6); endOfWeek.setHours(23, 59, 59, 999);

      const [monthlySnap, todaySnap, weekSnap] = await Promise.all([
        admin.firestore().collection('sessions').where('scheduledDate', '>=', startOfMonth).get(),
        admin.firestore().collection('sessions').where('scheduledDate', '>=', startOfDay).where('scheduledDate', '<=', endOfDay).get(),
        admin.firestore().collection('sessions').where('scheduledDate', '>=', startOfWeek).where('scheduledDate', '<=', endOfWeek).get()
      ]);

      const monthly = monthlySnap.docs.map(doc => doc.data());
      return res.status(200).json({
        totalSessions: monthly.length,
        confirmedSessions: monthly.filter(s => s.status === 'confirmée').length,
        pendingSessions: monthly.filter(s => s.status === 'en_attente').length,
        cancelledSessions: monthly.filter(s => s.status === 'annulée').length,
        todaySessions: todaySnap.size,
        thisWeekSessions: weekSnap.size
      });
    }

    // ✅ Stats du jour — présences
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
 *     summary: Séances confirmées de l'élève connecté
 *     description: Retourne les séances de l'élève connecté, créées après validation d'une réservation
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
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
 *                       instructorName:
 *                         type: string
 *                       date:
 *                         type: string
 *                       time:
 *                         type: string
 *                       duration:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [Pratique, Théorique, En ligne]
 *                       status:
 *                         type: string
 *                         enum: [À venir, Terminé, Absent, Annulée]
 *                 totalCount:
 *                   type: number
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

// ============================================================
// ✅ ROUTES COLLECTION
// ============================================================

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: Liste des séances avec filtres et pagination
 *     description: |
 *       Filtres disponibles via query params :
 *       - **upcoming=true** → séances futures uniquement
 *       - **date=YYYY-MM-DD** → séances d'un jour précis
 *       - **startDate + endDate** → séances sur une période
 *       - **status** → filtrer par statut
 *       - **studentId** → séances d'un élève
 *       - **instructorId** → séances d'un instructeur
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: upcoming
 *         schema:
 *           type: boolean
 *         description: Si true, retourne uniquement les séances futures
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [confirmée, présent, absent, en_retard, annulée]
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
 *         description: Liste récupérée avec succès
 */
router.get('/', checkAuth, async (req, res) => {
  try {
    const { date, instructorId, status, studentId, startDate, endDate, upcoming, page = 1, limit = 10 } = req.query;
    let query = admin.firestore().collection('sessions');

    if (upcoming === 'true') query = query.where('scheduledDate', '>=', new Date());
    else if (date) { const s = new Date(date); s.setHours(0, 0, 0, 0); query = query.where('scheduledDate', '>=', s); }
    else if (startDate && endDate) query = query.where('scheduledDate', '>=', new Date(startDate)).where('scheduledDate', '<=', new Date(endDate));

    if (instructorId) query = query.where('instructorId', '==', instructorId);
    if (status) query = query.where('status', '==', status);
    if (studentId) query = query.where('studentId', '==', studentId);

    const pageNum = parseInt(page), limitNum = parseInt(limit);
    let allSnap;
    try { allSnap = await query.orderBy('scheduledDate', 'asc').get(); }
    catch { allSnap = await query.get(); }

    const total = allSnap.size;
    const paginatedDocs = allSnap.docs.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const sessions = await Promise.all(paginatedDocs.map(async (doc) => {
      const data = doc.data();
      const [studentDoc, instructorDoc] = await Promise.all([
        admin.firestore().collection('users').doc(data.studentId).get(),
        admin.firestore().collection('users').doc(data.instructorId).get()
      ]);
      const s = studentDoc.exists ? studentDoc.data() : null;
      const i = instructorDoc.exists ? instructorDoc.data() : null;

      return {
        id: doc.id,
        student: { id: data.studentId, nom: s?.nom || 'Élève inconnu', email: s?.email || '' },
        instructor: { id: data.instructorId, nom: i?.nom || 'Instructeur inconnu' },
        courseType: data.courseType,
        courseTitle: data.courseTitle,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        duration: data.duration,
        status: data.status,
        reservationId: data.reservationId || null
      };
    }));

    res.status(200).json({
      sessions,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    console.error('Erreur GET /sessions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des sessions' });
  }
});

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Créer une séance manuellement (admin)
 *     description: Crée une séance directement sans passer par une réservation
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
 *                 enum: [conduite, code, examen, examen_blanc, perfectionnement]
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
 *                 example: 1
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Séance créée avec succès
 *       403:
 *         description: Accès non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const sessionRef = await admin.firestore().collection('sessions').add({
      ...req.body,
      status: 'confirmée',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(201).json({ message: 'Séance créée avec succès', sessionId: sessionRef.id });
  } catch (error) {
    console.error('Erreur POST /sessions:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la séance' });
  }
});

// ============================================================
// ✅ ROUTES DYNAMIQUES EN DERNIER
// ============================================================

/**
 * @swagger
 * /api/sessions/{id}:
 *   get:
 *     summary: Détails d'une séance
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
 *         description: Détails récupérés avec succès
 *       404:
 *         description: Séance introuvable
 */
router.get('/:id', checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    const data = sessionDoc.data();
    const [studentDoc, instructorDoc] = await Promise.all([
      admin.firestore().collection('users').doc(data.studentId).get(),
      admin.firestore().collection('users').doc(data.instructorId).get()
    ]);

    res.status(200).json({
      id: sessionDoc.id,
      student: studentDoc.exists ? { id: data.studentId, ...studentDoc.data() } : null,
      instructor: instructorDoc.exists ? { id: data.instructorId, ...instructorDoc.data() } : null,
      courseType: data.courseType,
      courseTitle: data.courseTitle,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      duration: data.duration,
      status: data.status,
      notes: data.notes || null,
      actualStartTime: data.actualStartTime || null,
      actualEndTime: data.actualEndTime || null,
      reservationId: data.reservationId || null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  } catch (error) {
    console.error('Erreur GET /sessions/:id:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails' });
  }
});

/**
 * @swagger
 * /api/sessions/{id}:
 *   patch:
 *     summary: Mettre à jour une séance (admin)
 *     description: |
 *       Met à jour le statut et/ou les informations d'une séance.
 *       Pour marquer la présence, utiliser **status: "présent"**.
 *       Statuts disponibles : confirmée | présent | absent | en_retard | annulée
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
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [confirmée, présent, absent, en_retard, annulée]
 *                 example: "présent"
 *               notes:
 *                 type: string
 *                 example: "Élève ponctuel, bonne séance"
 *               actualStartTime:
 *                 type: string
 *                 example: "09:05"
 *               actualEndTime:
 *                 type: string
 *                 example: "10:05"
 *               courseTitle:
 *                 type: string
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               scheduledTime:
 *                 type: string
 *               duration:
 *                 type: number
 *     responses:
 *       200:
 *         description: Séance mise à jour avec succès
 *       404:
 *         description: Séance introuvable
 *       403:
 *         description: Accès non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.patch('/:id', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, actualStartTime, actualEndTime, ...rest } = req.body;

    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    const updateData = {
      ...rest,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (actualStartTime !== undefined) updateData.actualStartTime = actualStartTime;
    if (actualEndTime !== undefined) updateData.actualEndTime = actualEndTime;

    // ✅ Si on marque présent → enregistrer qui a marqué et quand
    if (status === 'présent') {
      updateData.presenceMarkedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.presenceMarkedBy = req.user.uid;
    }

    await admin.firestore().collection('sessions').doc(id).update(updateData);

    const updated = await admin.firestore().collection('sessions').doc(id).get();
    res.status(200).json({
      message: 'Séance mise à jour avec succès',
      session: { id: updated.id, ...updated.data() }
    });
  } catch (error) {
    console.error('Erreur PATCH /sessions/:id:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la séance' });
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
 */
router.delete('/:id', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id } = req.params;
    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    await admin.firestore().collection('sessions').doc(id).delete();
    res.status(200).json({ message: 'Séance supprimée avec succès' });
  } catch (error) {
    console.error('Erreur DELETE /sessions/:id:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la séance' });
  }
});

module.exports = router;