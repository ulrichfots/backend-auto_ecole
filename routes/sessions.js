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
// ✅ STATUTS SÉANCES
// ============================================================
// en_attente_reservation  → admin a créé la séance, aucun élève ne s'est positionné
// en_attente_confirmation → un ou plusieurs élèves se sont positionnés, admin n'a pas encore validé
// confirmee               → admin a validé la réservation d'un élève
// annulee                 → séance annulée

// ============================================================
// ✅ ROUTES STATIQUES EN PREMIER
// ============================================================

/**
 * @swagger
 * /api/sessions/stats:
 *   get:
 *     summary: Statistiques des séances
 *     description: |
 *       - **?type=day** (défaut) → présences du jour
 *       - **?type=dashboard** → stats du mois en cours
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
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 */
router.get('/stats', checkAuth, async (req, res) => {
  try {
    const { type = 'day', date } = req.query;

    if (type === 'dashboard') {
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
        enAttenteReservation: monthly.filter(s => s.status === 'en_attente_reservation').length,
        enAttenteConfirmation: monthly.filter(s => s.status === 'en_attente_confirmation').length,
        confirmees: monthly.filter(s => s.status === 'confirmee').length,
        annulees: monthly.filter(s => s.status === 'annulee').length,
        todaySessions: todaySnap.size,
        thisWeekSessions: weekSnap.size
      });
    }

    // Stats du jour
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

    const snap = await admin.firestore().collection('sessions')
      .where('scheduledDate', '>=', startOfDay)
      .where('scheduledDate', '<=', endOfDay)
      .get();

    let totalEleves = 0, presents = 0, absents = 0, enRetard = 0, annules = 0;
    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data.courseCategory === 'theorique') {
        const students = data.students || [];
        totalEleves += students.length;
        presents += students.filter(s => s.presence === 'présent').length;
        absents += students.filter(s => s.presence === 'absent').length;
        enRetard += students.filter(s => s.presence === 'en_retard').length;
      } else {
        totalEleves++;
        if (data.status === 'présent') presents++;
        else if (data.status === 'absent') absents++;
        else if (data.status === 'en_retard') enRetard++;
        else if (data.status === 'annulee') annules++;
      }
    });

    res.status(200).json({ totalEleves, presents, absents, enRetard, annules });
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

/**
 * @swagger
 * /api/sessions/types:
 *   get:
 *     summary: Types, modes et durées de séances disponibles
 *     description: Retourne les types de séances, modes de livraison et options de durée pour les listes déroulantes
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
 *                 courseTypes:
 *                   type: array
 *                 deliveryModes:
 *                   type: array
 *                 dureeHeures:
 *                   type: array
 *                   description: Options heures pour liste déroulante (0 à 8)
 *                 dureeMinutes:
 *                   type: array
 *                   description: Options minutes pour liste déroulante (0, 15, 30, 45)
 *                 statuts:
 *                   type: array
 */
router.get('/types', checkAuth, async (req, res) => {
  res.status(200).json({
    courseTypes: [
      { value: 'code', label: 'Code de la route', category: 'theorique' },
      { value: 'conduite', label: 'Conduite', category: 'pratique' },
      { value: 'examen', label: 'Examen', category: 'pratique' },
      { value: 'examen_blanc', label: 'Examen blanc', category: 'theorique' },
      { value: 'perfectionnement', label: 'Perfectionnement', category: 'pratique' },
      { value: 'securite_routiere', label: 'Sécurité routière', category: 'theorique' }
    ],
    deliveryModes: [
      { value: 'presentiel', label: 'Présentiel' },
      { value: 'enligne', label: 'En ligne' }
    ],
    // ✅ Options pour les listes déroulantes de durée
    dureeHeures: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    dureeMinutes: [0, 15, 30, 45],
    statuts: [
      { value: 'en_attente_reservation', label: 'En attente de réservation', description: 'Séance créée, aucun élève positionné' },
      { value: 'en_attente_confirmation', label: 'En attente de confirmation', description: 'Élève(s) positionné(s), en attente de validation admin' },
      { value: 'confirmee', label: 'Confirmée', description: 'Admin a validé la réservation' },
      { value: 'annulee', label: 'Annulée', description: 'Séance annulée' }
    ]
  });
});

/**
 * @swagger
 * /api/sessions/me:
 *   get:
 *     summary: Séances de l'élève connecté
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
 */
router.get('/me', checkAuth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const userId = req.user.uid;

    const pratiquesSnap = await admin.firestore().collection('sessions')
      .where('studentId', '==', userId)
      .where('courseCategory', '==', 'pratique')
      .orderBy('scheduledDate', 'desc')
      .limit(parseInt(limit))
      .get();

    const theoriquesSnap = await admin.firestore().collection('sessions')
      .where('studentIds', 'array-contains', userId)
      .orderBy('scheduledDate', 'desc')
      .limit(parseInt(limit))
      .get();

    const allDocs = [...pratiquesSnap.docs, ...theoriquesSnap.docs];

    const sessions = await Promise.all(allDocs.map(async (doc) => {
      const data = doc.data();
      const instructorDoc = await admin.firestore().collection('users').doc(data.instructorId).get();
      const instructorData = instructorDoc.exists ? instructorDoc.data() : null;

      const sessionDate = data.scheduledDate?.toDate?.() || new Date(data.scheduledDate);
      const maCandidature = (data.candidats || []).find(c => c.studentId === userId);

      // Formater la durée
      const dureeLabel = formatDuree(data.durationHeures, data.durationMinutes);

      return {
        id: doc.id,
        title: data.courseTitle,
        courseCategory: data.courseCategory,
        deliveryMode: data.deliveryMode,
        instructorName: instructorData?.nom || 'Instructeur inconnu',
        date: sessionDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        time: data.scheduledTime,
        durationHeures: data.durationHeures || 0,
        durationMinutes: data.durationMinutes || 0,
        dureeLabel,
        status: data.status,
        maCandidature: maCandidature ? {
          heureChoisie: maCandidature.heureChoisie,
          status: maCandidature.status
        } : null,
        meetingLink: data.meetingLink || null
      };
    }));

    sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.status(200).json({ sessions, totalCount: sessions.length });
  } catch (error) {
    console.error('Erreur /me:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des séances' });
  }
});

// ============================================================
// ✅ FONCTION UTILITAIRE — FORMATER LA DURÉE
// ============================================================
const formatDuree = (heures = 0, minutes = 0) => {
  if (heures === 0 && minutes === 0) return '0min';
  if (heures === 0) return `${minutes}min`;
  if (minutes === 0) return `${heures}h`;
  return `${heures}h${minutes}`;
};

// ============================================================
// ✅ ROUTES COLLECTION
// ============================================================

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: Liste des séances avec filtres
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: courseCategory
 *         schema:
 *           type: string
 *           enum: [theorique, pratique]
 *       - in: query
 *         name: deliveryMode
 *         schema:
 *           type: string
 *           enum: [presentiel, enligne]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [en_attente_reservation, en_attente_confirmation, confirmee, annulee]
 *       - in: query
 *         name: upcoming
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
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
    const { courseCategory, deliveryMode, date, instructorId, status, upcoming, startDate, endDate, page = 1, limit = 10 } = req.query;

    let query = admin.firestore().collection('sessions');

    if (courseCategory) query = query.where('courseCategory', '==', courseCategory);
    if (deliveryMode) query = query.where('deliveryMode', '==', deliveryMode);
    if (instructorId) query = query.where('instructorId', '==', instructorId);
    if (status) query = query.where('status', '==', status);
    if (upcoming === 'true') query = query.where('scheduledDate', '>=', new Date());
    else if (date) { const s = new Date(date); s.setHours(0, 0, 0, 0); query = query.where('scheduledDate', '>=', s); }
    else if (startDate && endDate) query = query.where('scheduledDate', '>=', new Date(startDate)).where('scheduledDate', '<=', new Date(endDate));

    const pageNum = parseInt(page), limitNum = parseInt(limit);
    let allSnap;
    try { allSnap = await query.orderBy('scheduledDate', 'asc').get(); }
    catch { allSnap = await query.get(); }

    const total = allSnap.size;
    const paginatedDocs = allSnap.docs.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const sessions = await Promise.all(paginatedDocs.map(async (doc) => {
      const data = doc.data();
      const instructorDoc = await admin.firestore().collection('users').doc(data.instructorId).get();
      const instructorData = instructorDoc.exists ? instructorDoc.data() : null;

      return {
        id: doc.id,
        courseCategory: data.courseCategory,
        deliveryMode: data.deliveryMode,
        courseType: data.courseType,
        courseTitle: data.courseTitle,
        instructor: { id: data.instructorId, nom: instructorData?.nom || 'Instructeur inconnu' },
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        durationHeures: data.durationHeures || 0,
        durationMinutes: data.durationMinutes || 0,
        dureeLabel: formatDuree(data.durationHeures, data.durationMinutes),
        status: data.status,
        location: data.location || null,
        meetingLink: data.meetingLink || null,
        totalCandidats: (data.candidats || []).length,
        totalEnAttente: (data.candidats || []).filter(c => c.status === 'en_attente').length,
        totalAcceptes: (data.candidats || []).filter(c => c.status === 'accepte').length,
        totalEtudiantsInscrits: (data.students || []).length
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
 *     summary: Créer une séance (admin)
 *     description: |
 *       Crée une nouvelle séance. Le statut initial est automatiquement **en_attente_reservation**.
 *       La durée est définie en heures ET minutes séparément pour permettre des durées comme 1h30 ou 30min.
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
 *               - courseCategory
 *               - deliveryMode
 *               - courseType
 *               - instructorId
 *               - scheduledDate
 *               - scheduledTime
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
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               scheduledTime:
 *                 type: string
 *                 example: "09:00"
 *               durationHeures:
 *                 type: integer
 *                 example: 1
 *                 description: Nombre d'heures (0 si séance en minutes uniquement)
 *               durationMinutes:
 *                 type: integer
 *                 example: 30
 *                 description: Nombre de minutes (0, 15, 30 ou 45)
 *               location:
 *                 type: string
 *               meetingLink:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Séance créée avec succès
 *       400:
 *         description: Données invalides
 *       403:
 *         description: Accès non autorisé
 */
router.post('/', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const {
      courseCategory, deliveryMode, courseType, courseTitle,
      instructorId, scheduledDate, scheduledTime,
      durationHeures = 0, durationMinutes = 0,
      location, meetingLink, notes
    } = req.body;

    if (!courseCategory || !deliveryMode || !courseType || !instructorId || !scheduledDate || !scheduledTime) {
      return res.status(400).json({
        error: 'Champs requis manquants',
        required: ['courseCategory', 'deliveryMode', 'courseType', 'instructorId', 'scheduledDate', 'scheduledTime']
      });
    }

    // Vérifier qu'il y a au moins une durée
    if (durationHeures === 0 && durationMinutes === 0) {
      return res.status(400).json({ error: 'La durée doit être supérieure à 0 — renseigne durationHeures et/ou durationMinutes' });
    }

    const sessionData = {
      courseCategory,
      deliveryMode,
      courseType,
      courseTitle: courseTitle || `Séance de ${courseType}`,
      instructorId,
      scheduledDate: admin.firestore.Timestamp.fromDate(new Date(scheduledDate)),
      scheduledTime,
      durationHeures: parseInt(durationHeures) || 0,
      durationMinutes: parseInt(durationMinutes) || 0,
      dureeLabel: formatDuree(parseInt(durationHeures) || 0, parseInt(durationMinutes) || 0),
      location: location || null,
      meetingLink: meetingLink || null,
      notes: notes || null,
      // ✅ Statut initial — en attente de réservation
      status: 'en_attente_reservation',
      candidats: [],
      candidatIds: [],
      students: [],
      studentIds: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const sessionRef = await admin.firestore().collection('sessions').add(sessionData);
    res.status(201).json({
      message: 'Séance créée avec succès',
      sessionId: sessionRef.id,
      status: 'en_attente_reservation',
      dureeLabel: sessionData.dureeLabel
    });
  } catch (error) {
    console.error('Erreur POST /sessions:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la séance' });
  }
});

// ============================================================
// ✅ ROUTES CANDIDATURES
// ============================================================

/**
 * @swagger
 * /api/sessions/{id}/positionner:
 *   post:
 *     summary: L'élève se positionne sur une séance
 *     description: |
 *       L'élève choisit une heure et se positionne.
 *       Le statut de la séance passe automatiquement à **en_attente_confirmation**.
 *       Pas de restriction sur les heures — plusieurs élèves peuvent choisir la même heure.
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
 *             required:
 *               - heureChoisie
 *             properties:
 *               heureChoisie:
 *                 type: string
 *                 example: "09:00"
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Positionné avec succès, en attente de confirmation
 *       400:
 *         description: Déjà positionné sur cette séance
 *       404:
 *         description: Séance introuvable
 */
router.post('/:id/positionner', checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { heureChoisie, notes } = req.body;
    const studentId = req.user.uid;

    if (!heureChoisie) {
      return res.status(400).json({ error: 'heureChoisie est requis' });
    }

    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    const sessionData = sessionDoc.data();
    const candidatIds = sessionData.candidatIds || [];
    const candidats = sessionData.candidats || [];

    if (candidatIds.includes(studentId)) {
      return res.status(400).json({ error: 'Vous êtes déjà positionné sur cette séance' });
    }

    const studentDoc = await admin.firestore().collection('users').doc(studentId).get();
    const studentData = studentDoc.exists ? studentDoc.data() : null;

    const nouvelleCandidature = {
      studentId,
      nom: studentData?.nom || 'Élève inconnu',
      email: studentData?.email || '',
      heureChoisie,
      notes: notes || '',
      status: 'en_attente',
      ajoutePar: 'eleve',
      createdAt: new Date().toISOString()
    };

    await admin.firestore().collection('sessions').doc(id).update({
      candidats: [...candidats, nouvelleCandidature],
      candidatIds: [...candidatIds, studentId],
      // ✅ Statut passe à en_attente_confirmation
      status: 'en_attente_confirmation',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      message: 'Vous vous êtes positionné sur cette séance, en attente de confirmation',
      status: 'en_attente_confirmation',
      candidature: { status: 'en_attente', heureChoisie }
    });
  } catch (error) {
    console.error('Erreur POST /:id/positionner:', error);
    res.status(500).json({ error: 'Erreur lors du positionnement' });
  }
});

/**
 * @swagger
 * /api/sessions/{id}/candidats:
 *   get:
 *     summary: Récupérer les candidats d'une séance
 *     description: |
 *       - Sans filtre → tous les candidats
 *       - **?status=en_attente** → en attente de validation
 *       - **?status=accepte** → acceptés
 *       - **?status=refuse** → refusés
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [en_attente, accepte, refuse]
 *     responses:
 *       200:
 *         description: Candidats récupérés avec succès
 */
router.get('/:id/candidats', checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    const sessionData = sessionDoc.data();
    const allCandidats = sessionData.candidats || [];
    const candidats = status ? allCandidats.filter(c => c.status === status) : allCandidats;

    res.status(200).json({
      candidats,
      total: candidats.length,
      totalEnAttente: allCandidats.filter(c => c.status === 'en_attente').length,
      totalAcceptes: allCandidats.filter(c => c.status === 'accepte').length,
      totalRefuses: allCandidats.filter(c => c.status === 'refuse').length
    });
  } catch (error) {
    console.error('Erreur GET /:id/candidats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des candidats' });
  }
});

/**
 * @swagger
 * /api/sessions/{id}/candidats/ajouter:
 *   post:
 *     summary: Admin sélectionne directement un élève (admin)
 *     description: L'admin ajoute directement un élève — statut candidature "accepte" et séance "confirmee"
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
 *             required:
 *               - studentId
 *               - heureChoisie
 *             properties:
 *               studentId:
 *                 type: string
 *               heureChoisie:
 *                 type: string
 *                 example: "10:00"
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Élève ajouté avec succès
 *       400:
 *         description: Élève déjà sur cette séance
 *       404:
 *         description: Séance ou élève introuvable
 *       403:
 *         description: Accès non autorisé
 */
router.post('/:id/candidats/ajouter', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, heureChoisie, notes } = req.body;

    if (!studentId || !heureChoisie) {
      return res.status(400).json({ error: 'studentId et heureChoisie sont requis' });
    }

    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    const studentDoc = await admin.firestore().collection('users').doc(studentId).get();
    if (!studentDoc.exists) return res.status(404).json({ error: 'Élève introuvable' });

    const sessionData = sessionDoc.data();
    const studentData = studentDoc.data();
    const candidatIds = sessionData.candidatIds || [];
    const candidats = sessionData.candidats || [];
    const studentIds = sessionData.studentIds || [];
    const students = sessionData.students || [];

    if (candidatIds.includes(studentId)) {
      return res.status(400).json({ error: 'Cet élève est déjà sur cette séance' });
    }

    const nouvelleCandidature = {
      studentId,
      nom: studentData?.nom || 'Élève inconnu',
      email: studentData?.email || '',
      heureChoisie,
      notes: notes || '',
      status: 'accepte',
      ajoutePar: 'admin',
      accepteAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    const nouvelEtudiant = {
      studentId,
      status: 'confirmé',
      presence: null,
      heureChoisie,
      addedAt: new Date().toISOString(),
      addedBy: 'admin'
    };

    await admin.firestore().collection('sessions').doc(id).update({
      candidats: [...candidats, nouvelleCandidature],
      candidatIds: [...candidatIds, studentId],
      students: [...students, nouvelEtudiant],
      studentIds: [...studentIds, studentId],
      // ✅ Statut passe à confirmee
      status: 'confirmee',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({
      message: 'Élève ajouté et confirmé sur la séance',
      studentId,
      heureChoisie,
      status: 'confirmee'
    });
  } catch (error) {
    console.error('Erreur POST /:id/candidats/ajouter:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout de l\'élève' });
  }
});

/**
 * @swagger
 * /api/sessions/{id}/candidats/{studentId}/accepter:
 *   patch:
 *     summary: Admin accepte un élève positionné (admin)
 *     description: |
 *       - Statut candidature → **accepte**
 *       - Statut séance → **confirmee**
 *       - Élève ajouté automatiquement dans students
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Élève accepté avec succès
 *       404:
 *         description: Candidature introuvable
 *       403:
 *         description: Accès non autorisé
 */
router.patch('/:id/candidats/:studentId/accepter', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id, studentId } = req.params;

    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    const sessionData = sessionDoc.data();
    const candidats = sessionData.candidats || [];
    const students = sessionData.students || [];
    const studentIds = sessionData.studentIds || [];

    const candidatIndex = candidats.findIndex(c => c.studentId === studentId);
    if (candidatIndex === -1) return res.status(404).json({ error: 'Candidature introuvable' });
    if (candidats[candidatIndex].status === 'accepte') return res.status(400).json({ error: 'Cet élève est déjà accepté' });

    // ✅ Mettre à jour candidature
    candidats[candidatIndex].status = 'accepte';
    candidats[candidatIndex].accepteAt = new Date().toISOString();
    candidats[candidatIndex].acceptePar = req.user.uid;

    // ✅ Ajouter dans students
    if (!studentIds.includes(studentId)) {
      students.push({
        studentId,
        status: 'confirmé',
        presence: null,
        heureChoisie: candidats[candidatIndex].heureChoisie,
        addedAt: new Date().toISOString(),
        addedBy: req.user.uid
      });
      studentIds.push(studentId);
    }

    await admin.firestore().collection('sessions').doc(id).update({
      candidats,
      students,
      studentIds,
      // ✅ Statut séance → confirmee
      status: 'confirmee',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: 'Élève accepté — séance confirmée',
      studentId,
      candidatureStatus: 'accepte',
      sessionStatus: 'confirmee',
      heureChoisie: candidats[candidatIndex].heureChoisie
    });
  } catch (error) {
    console.error('Erreur PATCH /:id/candidats/:studentId/accepter:', error);
    res.status(500).json({ error: 'Erreur lors de l\'acceptation' });
  }
});

/**
 * @swagger
 * /api/sessions/{id}/candidats/{studentId}/refuser:
 *   patch:
 *     summary: Admin refuse un élève positionné (admin)
 *     description: |
 *       - Statut candidature → **refuse**
 *       - Si plus aucun candidat en attente → statut séance revient à **en_attente_reservation**
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: studentId
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
 *               motif:
 *                 type: string
 *                 example: "Créneau déjà complet"
 *     responses:
 *       200:
 *         description: Élève refusé
 *       404:
 *         description: Candidature introuvable
 *       403:
 *         description: Accès non autorisé
 */
router.patch('/:id/candidats/:studentId/refuser', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const { motif } = req.body || {};

    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    const sessionData = sessionDoc.data();
    const candidats = sessionData.candidats || [];

    const candidatIndex = candidats.findIndex(c => c.studentId === studentId);
    if (candidatIndex === -1) return res.status(404).json({ error: 'Candidature introuvable' });
    if (candidats[candidatIndex].status === 'refuse') return res.status(400).json({ error: 'Cet élève est déjà refusé' });

    candidats[candidatIndex].status = 'refuse';
    candidats[candidatIndex].motifRefus = motif || 'Aucun motif précisé';
    candidats[candidatIndex].refuseAt = new Date().toISOString();
    candidats[candidatIndex].refusePar = req.user.uid;

    // ✅ Si plus aucun candidat en attente → retour à en_attente_reservation
    const encoreEnAttente = candidats.filter(c => c.status === 'en_attente').length;
    const newStatus = encoreEnAttente > 0 ? 'en_attente_confirmation' : 'en_attente_reservation';

    await admin.firestore().collection('sessions').doc(id).update({
      candidats,
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: 'Élève refusé',
      studentId,
      candidatureStatus: 'refuse',
      sessionStatus: newStatus,
      motif: motif || 'Aucun motif précisé'
    });
  } catch (error) {
    console.error('Erreur PATCH /:id/candidats/:studentId/refuser:', error);
    res.status(500).json({ error: 'Erreur lors du refus' });
  }
});

// ============================================================
// ✅ ROUTES ÉLÈVES INSCRITS
// ============================================================

/**
 * @swagger
 * /api/sessions/{id}/students:
 *   get:
 *     summary: Lister les élèves inscrits/acceptés sur une séance
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
 *         description: Élèves récupérés avec succès
 */
router.get('/:id/students', checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    const sessionData = sessionDoc.data();
    const students = sessionData.students || [];

    const studentsEnriched = await Promise.all(students.map(async (s) => {
      const studentDoc = await admin.firestore().collection('users').doc(s.studentId).get();
      const studentData = studentDoc.exists ? studentDoc.data() : null;
      return {
        studentId: s.studentId,
        nom: studentData?.nom || s.nom || 'Élève inconnu',
        email: studentData?.email || s.email || '',
        heureChoisie: s.heureChoisie,
        status: s.status,
        presence: s.presence || null,
        presenceMarkedAt: s.presenceMarkedAt || null
      };
    }));

    res.status(200).json({ students: studentsEnriched, total: studentsEnriched.length });
  } catch (error) {
    console.error('Erreur GET /:id/students:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des élèves' });
  }
});

/**
 * @swagger
 * /api/sessions/{id}/students/{studentId}:
 *   patch:
 *     summary: Marquer la présence d'un élève (admin)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: studentId
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
 *               - presence
 *             properties:
 *               presence:
 *                 type: string
 *                 enum: [présent, absent, en_retard]
 *     responses:
 *       200:
 *         description: Présence marquée avec succès
 *       404:
 *         description: Élève non inscrit
 *       403:
 *         description: Accès non autorisé
 */
router.patch('/:id/students/:studentId', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const { presence } = req.body;

    const validPresences = ['présent', 'absent', 'en_retard'];
    if (!validPresences.includes(presence)) {
      return res.status(400).json({ error: 'Présence invalide', allowed: validPresences });
    }

    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    const sessionData = sessionDoc.data();
    const students = sessionData.students || [];

    const studentIndex = students.findIndex(s => s.studentId === studentId);
    if (studentIndex === -1) return res.status(404).json({ error: 'Élève non inscrit à cette séance' });

    students[studentIndex].presence = presence;
    students[studentIndex].presenceMarkedAt = new Date().toISOString();
    students[studentIndex].presenceMarkedBy = req.user.uid;

    await admin.firestore().collection('sessions').doc(id).update({
      students,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ message: `Présence marquée : ${presence}`, studentId, presence });
  } catch (error) {
    console.error('Erreur PATCH /:id/students/:studentId:', error);
    res.status(500).json({ error: 'Erreur lors du marquage de la présence' });
  }
});

// ============================================================
// ✅ ROUTES DYNAMIQUES SIMPLES
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
    const instructorDoc = await admin.firestore().collection('users').doc(data.instructorId).get();

    const studentsEnriched = await Promise.all((data.students || []).map(async (s) => {
      const studentDoc = await admin.firestore().collection('users').doc(s.studentId).get();
      const studentData = studentDoc.exists ? studentDoc.data() : null;
      return {
        studentId: s.studentId,
        nom: studentData?.nom || 'Élève inconnu',
        email: studentData?.email || '',
        heureChoisie: s.heureChoisie,
        status: s.status,
        presence: s.presence || null
      };
    }));

    res.status(200).json({
      id: sessionDoc.id,
      courseCategory: data.courseCategory,
      deliveryMode: data.deliveryMode,
      courseType: data.courseType,
      courseTitle: data.courseTitle,
      instructor: instructorDoc.exists ? { id: data.instructorId, ...instructorDoc.data() } : null,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      durationHeures: data.durationHeures || 0,
      durationMinutes: data.durationMinutes || 0,
      dureeLabel: formatDuree(data.durationHeures, data.durationMinutes),
      status: data.status,
      location: data.location || null,
      meetingLink: data.meetingLink || null,
      notes: data.notes || null,
      students: studentsEnriched,
      totalStudents: studentsEnriched.length,
      totalCandidats: (data.candidats || []).length,
      totalEnAttente: (data.candidats || []).filter(c => c.status === 'en_attente').length,
      totalAcceptes: (data.candidats || []).filter(c => c.status === 'accepte').length,
      totalRefuses: (data.candidats || []).filter(c => c.status === 'refuse').length,
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
 *                 enum: [en_attente_reservation, en_attente_confirmation, confirmee, annulee]
 *               notes:
 *                 type: string
 *               scheduledDate:
 *                 type: string
 *               scheduledTime:
 *                 type: string
 *               durationHeures:
 *                 type: integer
 *               durationMinutes:
 *                 type: integer
 *               location:
 *                 type: string
 *               meetingLink:
 *                 type: string
 *     responses:
 *       200:
 *         description: Séance mise à jour avec succès
 *       404:
 *         description: Séance introuvable
 *       403:
 *         description: Accès non autorisé
 */
router.patch('/:id', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, durationHeures, durationMinutes, ...rest } = req.body;

    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    const updateData = { ...rest, updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (durationHeures !== undefined) updateData.durationHeures = parseInt(durationHeures) || 0;
    if (durationMinutes !== undefined) updateData.durationMinutes = parseInt(durationMinutes) || 0;

    // Recalculer le label de durée
    const sessionData = sessionDoc.data();
    const newHeures = durationHeures !== undefined ? parseInt(durationHeures) || 0 : sessionData.durationHeures || 0;
    const newMinutes = durationMinutes !== undefined ? parseInt(durationMinutes) || 0 : sessionData.durationMinutes || 0;
    updateData.dureeLabel = formatDuree(newHeures, newMinutes);

    await admin.firestore().collection('sessions').doc(id).update(updateData);
    const updated = await admin.firestore().collection('sessions').doc(id).get();

    res.status(200).json({
      message: 'Séance mise à jour avec succès',
      session: { id: updated.id, ...updated.data() }
    });
  } catch (error) {
    console.error('Erreur PATCH /sessions/:id:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
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
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

module.exports = router;