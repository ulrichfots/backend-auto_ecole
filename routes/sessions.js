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
        confirmedSessions: monthly.filter(s => s.status === 'confirmée').length,
        cancelledSessions: monthly.filter(s => s.status === 'annulée').length,
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
        // Compter par élève dans le tableau students
        const students = data.students || [];
        totalEleves += students.length;
        presents += students.filter(s => s.presence === 'présent').length;
        absents += students.filter(s => s.presence === 'absent').length;
        enRetard += students.filter(s => s.presence === 'en_retard').length;
      } else {
        // Pratique — un seul élève
        totalEleves++;
        if (data.status === 'présent') presents++;
        else if (data.status === 'absent') absents++;
        else if (data.status === 'en_retard') enRetard++;
        else if (data.status === 'annulée') annules++;
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
 *     summary: Types et modes de séances disponibles
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Types récupérés avec succès
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
    ]
  });
});

/**
 * @swagger
 * /api/sessions/me:
 *   get:
 *     summary: Séances confirmées de l'élève connecté
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

    // Séances pratiques — l'élève est dans studentId
    const pratiquesSnap = await admin.firestore().collection('sessions')
      .where('studentId', '==', userId)
      .where('courseCategory', '==', 'pratique')
      .orderBy('scheduledDate', 'desc')
      .limit(parseInt(limit))
      .get();

    // Séances théoriques — l'élève est dans le tableau students[]
    const theoriquesSnap = await admin.firestore().collection('sessions')
      .where('courseCategory', 'in', ['theorique'])
      .where('studentIds', 'array-contains', userId)
      .orderBy('scheduledDate', 'desc')
      .limit(parseInt(limit))
      .get();

    const allDocs = [...pratiquesSnap.docs, ...theoriquesSnap.docs];

    const sessions = await Promise.all(allDocs.map(async (doc) => {
      const data = doc.data();
      const instructorDoc = await admin.firestore().collection('users').doc(data.instructorId).get();
      const instructorData = instructorDoc.exists ? instructorDoc.data() : null;

      const now = new Date();
      const sessionDate = data.scheduledDate?.toDate?.() || new Date(data.scheduledDate);

      let statusLabel = 'À venir';
      if (data.courseCategory === 'theorique') {
        const myPresence = (data.students || []).find(s => s.studentId === userId)?.presence;
        if (myPresence === 'présent' && sessionDate < now) statusLabel = 'Terminé';
        else if (myPresence === 'absent') statusLabel = 'Absent';
        else if (myPresence === 'en_retard') statusLabel = 'En retard';
      } else {
        if (data.status === 'présent' && sessionDate < now) statusLabel = 'Terminé';
        else if (data.status === 'absent') statusLabel = 'Absent';
        else if (data.status === 'annulée') statusLabel = 'Annulée';
      }

      return {
        id: doc.id,
        title: data.courseTitle,
        courseCategory: data.courseCategory,
        deliveryMode: data.deliveryMode,
        instructorName: instructorData?.nom || 'Instructeur inconnu',
        date: sessionDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        time: data.scheduledTime,
        duration: `${data.duration}h`,
        status: statusLabel,
        meetingLink: data.meetingLink || null
      };
    }));

    // Trier par date
    sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

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
 *         name: upcoming
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
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

      // Pour les séances théoriques → enrichir le tableau students
      let studentsEnriched = [];
      if (data.courseCategory === 'theorique' && data.students?.length > 0) {
        studentsEnriched = await Promise.all(data.students.map(async (s) => {
          const studentDoc = await admin.firestore().collection('users').doc(s.studentId).get();
          const studentData = studentDoc.exists ? studentDoc.data() : null;
          return {
            studentId: s.studentId,
            nom: studentData?.nom || 'Élève inconnu',
            email: studentData?.email || '',
            status: s.status,
            presence: s.presence || null
          };
        }));
      }

      // Pour les séances pratiques → enrichir studentId
      let studentData = null;
      if (data.courseCategory === 'pratique' && data.studentId) {
        const studentDoc = await admin.firestore().collection('users').doc(data.studentId).get();
        if (studentDoc.exists) {
          studentData = { id: data.studentId, ...studentDoc.data() };
        }
      }

      return {
        id: doc.id,
        courseCategory: data.courseCategory,
        deliveryMode: data.deliveryMode,
        courseType: data.courseType,
        courseTitle: data.courseTitle,
        instructor: { id: data.instructorId, nom: instructorData?.nom || 'Instructeur inconnu' },
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        duration: data.duration,
        status: data.status,
        location: data.location || null,
        meetingLink: data.meetingLink || null,
        // Théorique
        students: data.courseCategory === 'theorique' ? studentsEnriched : undefined,
        totalStudents: data.courseCategory === 'theorique' ? studentsEnriched.length : undefined,
        // Pratique
        student: data.courseCategory === 'pratique' ? studentData : undefined,
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
 *     summary: Créer une séance (admin)
 *     description: |
 *       Crée une séance théorique ou pratique.
 *       - **Théorique** : plusieurs élèves peuvent être ajoutés via POST /api/sessions/:id/students
 *       - **Pratique** : un seul élève, heure spécifique
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
 *                 enum: [code, conduite, examen, examen_blanc, perfectionnement, securite_routiere]
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
 *               duration:
 *                 type: number
 *                 example: 2
 *               location:
 *                 type: string
 *                 description: Salle ou adresse (pour présentiel)
 *               meetingLink:
 *                 type: string
 *                 description: Lien visio (pour en ligne)
 *               studentId:
 *                 type: string
 *                 description: Requis si courseCategory = pratique
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
      instructorId, scheduledDate, scheduledTime, duration,
      location, meetingLink, studentId, notes
    } = req.body;

    if (!courseCategory || !deliveryMode || !courseType || !instructorId || !scheduledDate || !scheduledTime || !duration) {
      return res.status(400).json({
        error: 'Champs requis manquants',
        required: ['courseCategory', 'deliveryMode', 'courseType', 'instructorId', 'scheduledDate', 'scheduledTime', 'duration']
      });
    }

    if (courseCategory === 'pratique' && !studentId) {
      return res.status(400).json({ error: 'studentId est requis pour une séance pratique' });
    }

    const sessionData = {
      courseCategory,
      deliveryMode,
      courseType,
      courseTitle: courseTitle || `Séance de ${courseType}`,
      instructorId,
      scheduledDate: admin.firestore.Timestamp.fromDate(new Date(scheduledDate)),
      scheduledTime,
      duration,
      location: location || null,
      meetingLink: meetingLink || null,
      notes: notes || null,
      status: 'confirmée',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (courseCategory === 'pratique') {
      // Pratique — un seul élève
      sessionData.studentId = studentId;
    } else {
      // Théorique — tableau d'élèves vide au départ
      sessionData.students = [];
      sessionData.studentIds = []; // pour les requêtes array-contains
    }

    const sessionRef = await admin.firestore().collection('sessions').add(sessionData);
    res.status(201).json({ message: 'Séance créée avec succès', sessionId: sessionRef.id });
  } catch (error) {
    console.error('Erreur POST /sessions:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la séance' });
  }
});

// ============================================================
// ✅ ROUTES DYNAMIQUES — GESTION ÉLÈVES (THÉORIQUE)
// ============================================================

/**
 * @swagger
 * /api/sessions/{id}/students:
 *   post:
 *     summary: Ajouter un ou plusieurs élèves à une séance théorique (admin)
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
 *               - studentIds
 *             properties:
 *               studentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["uid1", "uid2", "uid3"]
 *                 description: Liste des IDs des élèves à ajouter
 *     responses:
 *       200:
 *         description: Élèves ajoutés avec succès
 *       400:
 *         description: Séance non théorique ou élève déjà inscrit
 *       404:
 *         description: Séance introuvable
 *       403:
 *         description: Accès non autorisé
 */
router.post('/:id/students', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id } = req.params;
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'studentIds doit être un tableau non vide' });
    }

    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    const sessionData = sessionDoc.data();
    if (sessionData.courseCategory !== 'theorique') {
      return res.status(400).json({ error: 'On ne peut ajouter plusieurs élèves qu\'à une séance théorique' });
    }

    const existingStudentIds = sessionData.studentIds || [];
    const existingStudents = sessionData.students || [];

    // Filtrer les élèves déjà inscrits
    const newStudentIds = studentIds.filter(sid => !existingStudentIds.includes(sid));
    const alreadyInscribed = studentIds.filter(sid => existingStudentIds.includes(sid));

    if (newStudentIds.length === 0) {
      return res.status(400).json({
        error: 'Tous ces élèves sont déjà inscrits à cette séance',
        alreadyInscribed
      });
    }

    // Ajouter les nouveaux élèves
    const newStudents = newStudentIds.map(sid => ({
      studentId: sid,
      status: 'confirmé',
      presence: null,
      addedAt: new Date().toISOString()
    }));

    await admin.firestore().collection('sessions').doc(id).update({
      students: [...existingStudents, ...newStudents],
      studentIds: [...existingStudentIds, ...newStudentIds],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: `${newStudentIds.length} élève(s) ajouté(s) avec succès`,
      added: newStudentIds,
      alreadyInscribed: alreadyInscribed.length > 0 ? alreadyInscribed : undefined
    });
  } catch (error) {
    console.error('Erreur POST /:id/students:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout des élèves' });
  }
});

/**
 * @swagger
 * /api/sessions/{id}/students/{studentId}:
 *   patch:
 *     summary: Marquer la présence d'un élève dans une séance théorique (admin)
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
 *                 example: "présent"
 *     responses:
 *       200:
 *         description: Présence marquée avec succès
 *       404:
 *         description: Séance ou élève introuvable
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
    if (studentIndex === -1) {
      return res.status(404).json({ error: 'Élève non inscrit à cette séance' });
    }

    students[studentIndex].presence = presence;
    students[studentIndex].presenceMarkedAt = new Date().toISOString();
    students[studentIndex].presenceMarkedBy = req.user.uid;

    await admin.firestore().collection('sessions').doc(id).update({
      students,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: `Présence marquée : ${presence}`,
      studentId,
      presence
    });
  } catch (error) {
    console.error('Erreur PATCH /:id/students/:studentId:', error);
    res.status(500).json({ error: 'Erreur lors du marquage de la présence' });
  }
});

/**
 * @swagger
 * /api/sessions/{id}/students/{studentId}:
 *   delete:
 *     summary: Retirer un élève d'une séance théorique (admin)
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
 *         description: Élève retiré avec succès
 *       404:
 *         description: Séance ou élève introuvable
 *       403:
 *         description: Accès non autorisé
 */
router.delete('/:id/students/:studentId', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id, studentId } = req.params;

    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    const sessionData = sessionDoc.data();
    const students = sessionData.students || [];
    const studentIds = sessionData.studentIds || [];

    if (!studentIds.includes(studentId)) {
      return res.status(404).json({ error: 'Élève non inscrit à cette séance' });
    }

    await admin.firestore().collection('sessions').doc(id).update({
      students: students.filter(s => s.studentId !== studentId),
      studentIds: studentIds.filter(sid => sid !== studentId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ message: 'Élève retiré de la séance avec succès', studentId });
  } catch (error) {
    console.error('Erreur DELETE /:id/students/:studentId:', error);
    res.status(500).json({ error: 'Erreur lors du retrait de l\'élève' });
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

    let studentsEnriched = [];
    if (data.courseCategory === 'theorique' && data.students?.length > 0) {
      studentsEnriched = await Promise.all(data.students.map(async (s) => {
        const studentDoc = await admin.firestore().collection('users').doc(s.studentId).get();
        const studentData = studentDoc.exists ? studentDoc.data() : null;
        return {
          studentId: s.studentId,
          nom: studentData?.nom || 'Élève inconnu',
          email: studentData?.email || '',
          status: s.status,
          presence: s.presence || null,
          presenceMarkedAt: s.presenceMarkedAt || null
        };
      }));
    }

    let studentData = null;
    if (data.courseCategory === 'pratique' && data.studentId) {
      const studentDoc = await admin.firestore().collection('users').doc(data.studentId).get();
      if (studentDoc.exists) studentData = { id: data.studentId, ...studentDoc.data() };
    }

    res.status(200).json({
      id: sessionDoc.id,
      courseCategory: data.courseCategory,
      deliveryMode: data.deliveryMode,
      courseType: data.courseType,
      courseTitle: data.courseTitle,
      instructor: instructorDoc.exists ? { id: data.instructorId, ...instructorDoc.data() } : null,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      duration: data.duration,
      status: data.status,
      location: data.location || null,
      meetingLink: data.meetingLink || null,
      notes: data.notes || null,
      // Théorique
      students: data.courseCategory === 'theorique' ? studentsEnriched : undefined,
      totalStudents: data.courseCategory === 'theorique' ? studentsEnriched.length : undefined,
      // Pratique
      student: data.courseCategory === 'pratique' ? studentData : undefined,
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
 *       Met à jour les infos générales d'une séance.
 *       Pour marquer la présence d'un élève théorique → PATCH /api/sessions/:id/students/:studentId
 *       Pour marquer la présence pratique → utiliser status: "présent"
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
 *               notes:
 *                 type: string
 *               scheduledDate:
 *                 type: string
 *               scheduledTime:
 *                 type: string
 *               duration:
 *                 type: number
 *               location:
 *                 type: string
 *               meetingLink:
 *                 type: string
 *               actualStartTime:
 *                 type: string
 *               actualEndTime:
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
    const { status, notes, actualStartTime, actualEndTime, ...rest } = req.body;

    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: 'Séance introuvable' });

    const updateData = { ...rest, updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (actualStartTime !== undefined) updateData.actualStartTime = actualStartTime;
    if (actualEndTime !== undefined) updateData.actualEndTime = actualEndTime;

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