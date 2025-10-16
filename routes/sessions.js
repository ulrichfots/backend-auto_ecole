const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validationMiddleware');

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
      message: 'Seuls les administrateurs et instructeurs peuvent modifier les séances',
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
 * /api/sessions/stats:
 *   get:
 *     summary: Récupérer les statistiques de présence des sessions
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date pour filtrer les statistiques (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionStats'
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/stats', checkAuth, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    // Récupérer les sessions pour la date spécifiée
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const sessionsSnapshot = await admin.firestore()
      .collection('sessions')
      .where('scheduledDate', '>=', startOfDay)
      .where('scheduledDate', '<=', endOfDay)
      .get();

    const sessions = sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculer les statistiques
    const stats = {
      totalEleves: sessions.length,
      presents: sessions.filter(s => s.status === 'présent').length,
      absents: sessions.filter(s => s.status === 'absent').length,
      enRetard: sessions.filter(s => s.status === 'en_retard').length,
      annules: sessions.filter(s => s.status === 'annulé').length
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Erreur récupération statistiques sessions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: Récupérer la liste des sessions avec filtres
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
 *         description: Filtrer par instructeur
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [présent, absent, en_retard, annulé]
 *         description: Filtrer par statut
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *         description: Filtrer par élève
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début pour la plage
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin pour la plage
 *     responses:
 *       200:
 *         description: Liste des sessions récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Session'
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const { date, instructorId, status, studentId, startDate, endDate, upcoming, page = 1, limit = 10 } = req.query;
    
    console.log(`📅 Récupération sessions avec paramètres:`, {
      date, instructorId, status, studentId, startDate, endDate, upcoming, page, limit
    });
    
    let query = admin.firestore().collection('sessions');

    // Appliquer les filtres de date
    let dateFilter = null;
    
    if (upcoming === 'true') {
      // Filtrer pour les séances à venir (depuis maintenant)
      dateFilter = new Date();
    } else if (date) {
      // Filtrer pour une date spécifique
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Si upcoming=true ET date sont présents, prendre la date la plus récente
      if (upcoming === 'true') {
        dateFilter = new Date(Math.max(new Date(), startOfDay));
      } else {
        dateFilter = startOfDay;
      }
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      query = query.where('scheduledDate', '>=', start).where('scheduledDate', '<=', end);
    }
    
    // Appliquer le filtre de date si défini
    if (dateFilter) {
      query = query.where('scheduledDate', '>=', dateFilter);
    }

    if (instructorId) {
      query = query.where('instructorId', '==', instructorId);
    }
    if (status) {
      query = query.where('status', '==', status);
    }
    if (studentId) {
      query = query.where('studentId', '==', studentId);
    }

    // Ajouter la pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Compter le total d'abord pour la pagination
    const totalSnapshot = await query.get();
    const total = totalSnapshot.size;
    
    // Récupérer les sessions avec pagination (Firestore ne supporte pas offset)
    // Pour l'instant, on récupère tout et on pagine côté serveur
    let allSessionsSnapshot;
    try {
      allSessionsSnapshot = await query
        .orderBy('scheduledDate', 'asc')
        .orderBy('scheduledTime', 'asc')
        .get();
    } catch (orderError) {
      console.error('❌ Erreur lors du tri par scheduledDate/scheduledTime:', orderError);
      
      // Essayer sans le tri si les champs n'existent pas
      console.log('🔄 Tentative de récupération sans tri...');
      allSessionsSnapshot = await query.get();
    }
    
    // Pagination côté serveur
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedDocs = allSessionsSnapshot.docs.slice(startIndex, endIndex);
    
    // Enrichir les données avec les informations des élèves et instructeurs
    const sessions = await Promise.all(paginatedDocs.map(async (doc) => {
      const sessionData = doc.data();
      
      // Récupérer les données de l'élève
      const studentDoc = await admin.firestore().collection('users').doc(sessionData.studentId).get();
      const studentData = studentDoc.exists ? studentDoc.data() : null;
      
      // Récupérer les données de l'instructeur
      const instructorDoc = await admin.firestore().collection('users').doc(sessionData.instructorId).get();
      const instructorData = instructorDoc.exists ? instructorDoc.data() : null;

      // Calculer la progression de l'élève
      const progression = Math.min(
        ((studentData?.theoreticalHours || 0) + (studentData?.practicalHours || 0)) / 
        ((studentData?.theoreticalHoursMin || 40) + (studentData?.practicalHoursMin || 20)) * 100, 
        100
      );

      return {
        id: doc.id,
        student: {
          id: sessionData.studentId,
          nom: studentData?.nom || studentData?.nomComplet || 'Élève inconnu',
          nomComplet: studentData?.nomComplet || studentData?.nom || 'Élève inconnu',
          email: studentData?.email || '',
          initials: (studentData?.nom || studentData?.nomComplet) ? (studentData.nom || studentData.nomComplet).split(' ').map(name => name[0]).join('').toUpperCase() : 'E'
        },
        instructor: {
          id: sessionData.instructorId,
          nom: instructorData?.nom || 'Instructeur inconnu'
        },
        course: {
          type: sessionData.courseType,
          title: sessionData.courseTitle
        },
        schedule: {
          date: sessionData.scheduledDate,
          time: sessionData.scheduledTime
        },
        status: sessionData.status,
        progression: Math.round(progression),
        actions: ['Détails', 'Modifier']
      };
    }));

    console.log(`✅ Sessions retournées: ${sessions.length}`);
    res.status(200).json({
      sessions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('❌ Erreur récupération sessions:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des sessions',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Créer une nouvelle session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSession'
 *     responses:
 *       200:
 *         description: Session créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Session créée avec succès"
 *                 sessionId:
 *                   type: string
 *                   example: "session123"
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.post('/', checkAuth, checkWritePermissions, validate(schemas.createSession), async (req, res) => {
  try {
    const sessionData = req.body;
    
    // Vérifier que l'utilisateur a les permissions (admin ou instructeur)
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    
    if (!userData || (userData.role !== 'admin' && userData.role !== 'instructeur')) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Créer la session avec le statut par défaut "présent"
    const sessionRef = await admin.firestore().collection('sessions').add({
      ...sessionData,
      status: 'présent', // Statut par défaut
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: 'Session créée avec succès',
      sessionId: sessionRef.id
    });
  } catch (error) {
    console.error('Erreur création session:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la session' });
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}/status:
 *   patch:
 *     summary: Mettre à jour le statut d'une session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSessionStatus'
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
 *                   example: "Statut mis à jour avec succès"
 *                 newStatus:
 *                   type: string
 *                   example: "absent"
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Token manquant ou invalide
 *       404:
 *         description: Session introuvable
 *       500:
 *         description: Erreur serveur
 */
router.patch('/:sessionId/status', checkAuth, checkWritePermissions, validate(schemas.updateSessionStatus), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status, notes, actualStartTime, actualEndTime } = req.body;
    
    // Vérifier que l'utilisateur a les permissions
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    
    if (!userData || (userData.role !== 'admin' && userData.role !== 'instructeur')) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Vérifier que la session existe
    const sessionDoc = await admin.firestore().collection('sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session introuvable' });
    }

    // Mettre à jour le statut
    await admin.firestore().collection('sessions').doc(sessionId).update({
      status,
      notes: notes || null,
      actualStartTime: actualStartTime || null,
      actualEndTime: actualEndTime || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: 'Statut mis à jour avec succès',
      newStatus: status
    });
  } catch (error) {
    console.error('Erreur mise à jour statut:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   get:
 *     summary: Récupérer les détails d'une session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la session
 *     responses:
 *       200:
 *         description: Détails de la session récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionDetails'
 *       401:
 *         description: Token manquant ou invalide
 *       404:
 *         description: Session introuvable
 *       500:
 *         description: Erreur serveur
 */
router.get('/:sessionId', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sessionDoc = await admin.firestore().collection('sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session introuvable' });
    }

    const sessionData = sessionDoc.data();
    
    // Enrichir avec les données de l'élève et de l'instructeur
    const [studentDoc, instructorDoc] = await Promise.all([
      admin.firestore().collection('users').doc(sessionData.studentId).get(),
      admin.firestore().collection('users').doc(sessionData.instructorId).get()
    ]);

    const sessionDetails = {
      id: sessionDoc.id,
      student: studentDoc.exists ? studentDoc.data() : null,
      instructor: instructorDoc.exists ? instructorDoc.data() : null,
      courseType: sessionData.courseType,
      courseTitle: sessionData.courseTitle,
      scheduledDate: sessionData.scheduledDate,
      scheduledTime: sessionData.scheduledTime,
      actualStartTime: sessionData.actualStartTime,
      actualEndTime: sessionData.actualEndTime,
      duration: sessionData.duration,
      status: sessionData.status,
      notes: sessionData.notes,
      location: sessionData.location,
      createdAt: sessionData.createdAt,
      updatedAt: sessionData.updatedAt
    };

    res.status(200).json(sessionDetails);
  } catch (error) {
    console.error('Erreur récupération détails session:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails' });
  }
});

/**
 * @swagger
 * /api/sessions/export/pdf:
 *   post:
 *     summary: Exporter les sessions en PDF
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filters:
 *                 $ref: '#/components/schemas/SessionFilters'
 *               title:
 *                 type: string
 *                 example: "Rapport de présence - Janvier 2024"
 *     responses:
 *       200:
 *         description: PDF généré avec succès
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.post('/export/pdf', checkAuth, async (req, res) => {
  try {
    // Vérifier les permissions
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    
    if (!userData || (userData.role !== 'admin' && userData.role !== 'instructeur')) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const { filters, title } = req.body;
    
    // Pour l'instant, retourner un message indiquant que l'export PDF n'est pas encore implémenté
    res.status(200).json({
      message: 'Export PDF en cours de développement',
      filters,
      title
    });
  } catch (error) {
    console.error('Erreur export PDF:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export PDF' });
  }
});

/**
 * @swagger
 * /api/sessions/dashboard-stats:
 *   get:
 *     summary: Récupérer les statistiques du dashboard des séances
 *     description: Retourne les statistiques spécifiques au dashboard (total, confirmées, en attente, annulées, aujourd'hui, cette semaine)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques du dashboard récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: 'object'
 *               properties:
 *                 totalSessions:
 *                   type: 'number'
 *                   example: 8
 *                   description: 'Nombre total de séances'
 *                 confirmedSessions:
 *                   type: 'number'
 *                   example: 5
 *                   description: 'Nombre de séances confirmées'
 *                 pendingSessions:
 *                   type: 'number'
 *                   example: 2
 *                   description: 'Nombre de séances en attente'
 *                 cancelledSessions:
 *                   type: 'number'
 *                   example: 1
 *                   description: 'Nombre de séances annulées ce mois'
 *                 todaySessions:
 *                   type: 'number'
 *                   example: 0
 *                   description: 'Nombre de séances aujourd hui'
 *                 thisWeekSessions:
 *                   type: 'number'
 *                   example: 0
 *                   description: 'Nombre de séances cette semaine'
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/dashboard-stats', checkAuth, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Début de la semaine (lundi)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Récupérer toutes les séances du mois
    const monthlySessionsSnapshot = await admin.firestore()
      .collection('sessions')
      .where('scheduledDate', '>=', startOfMonth)
      .get();

    // Récupérer les séances d'aujourd'hui
    const todaySessionsSnapshot = await admin.firestore()
      .collection('sessions')
      .where('scheduledDate', '>=', startOfDay)
      .where('scheduledDate', '<=', endOfDay)
      .get();

    // Récupérer les séances de cette semaine
    const weekSessionsSnapshot = await admin.firestore()
      .collection('sessions')
      .where('scheduledDate', '>=', startOfWeek)
      .where('scheduledDate', '<=', endOfWeek)
      .get();

    const monthlySessions = monthlySessionsSnapshot.docs.map(doc => doc.data());
    const todaySessions = todaySessionsSnapshot.docs.map(doc => doc.data());
    const weekSessions = weekSessionsSnapshot.docs.map(doc => doc.data());

    // Calculer les statistiques
    const stats = {
      totalSessions: monthlySessions.length,
      confirmedSessions: monthlySessions.filter(s => s.status === 'confirmée').length,
      pendingSessions: monthlySessions.filter(s => s.status === 'en_attente').length,
      cancelledSessions: monthlySessions.filter(s => s.status === 'annulée').length,
      todaySessions: todaySessions.length,
      thisWeekSessions: weekSessions.length
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Erreur récupération stats dashboard:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

/**
 * @swagger
 * /api/sessions/upcoming:
 *   get:
 *     summary: Récupérer les séances à venir avec pagination
 *     description: Retourne la liste des séances à venir avec pagination et filtres
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
 *           enum: [all, conduite, code, examen, évaluation, perfectionnement]
 *         description: Filtrer par type de séance
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Rechercher par nom d'élève ou email
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
 *         description: Nombre de séances par page
 *     responses:
 *       200:
 *         description: Liste des séances à venir récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UpcomingSession'
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
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/upcoming', checkAuth, checkReadPermissions, async (req, res) => {
  try {
    const { status, instructorId, type, search, page = 1, limit = 10 } = req.query;
    
    let query = admin.firestore().collection('sessions')
      .where('scheduledDate', '>=', new Date())
      .orderBy('scheduledDate', 'asc');

    // Appliquer les filtres
    if (status && status !== 'all') {
      query = query.where('status', '==', status);
    }
    
    if (instructorId && instructorId !== 'all') {
      query = query.where('instructorId', '==', instructorId);
    }
    
    if (type && type !== 'all') {
      query = query.where('courseType', '==', type);
    }

    const sessionsSnapshot = await query.get();
    
    let sessions = [];
    sessionsSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Filtrer par recherche si spécifié
      if (search) {
        // Note: La recherche par nom/email nécessiterait des jointures
        // Pour l'instant, on retourne toutes les séances
      }
      
      sessions.push({
        id: doc.id,
        ...data,
        scheduledDate: data.scheduledDate?.toDate(),
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      });
    });

    // Pagination
    const total = sessions.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    const paginatedSessions = sessions.slice(startIndex, endIndex);

    // Enrichir avec les données des élèves et instructeurs
    const enrichedSessions = await Promise.all(paginatedSessions.map(async (session) => {
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
          nom: studentData?.nom || studentData?.nomComplet || 'Élève inconnu',
          nomComplet: studentData?.nomComplet || studentData?.nom || 'Élève inconnu',
          email: studentData?.email || '',
          initials: (studentData?.nom || studentData?.nomComplet) ? (studentData.nom || studentData.nomComplet).split(' ').map(name => name[0]).join('').toUpperCase() : 'E'
        },
        instructor: {
          id: session.instructorId,
          nom: instructorData?.nom || 'Instructeur inconnu'
        },
        type: session.courseType,
        date: session.scheduledDate,
        time: session.scheduledTime,
        duration: session.duration,
        status: session.status
      };
    }));

    res.status(200).json({
      sessions: enrichedSessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages
      }
    });

  } catch (error) {
    console.error('Erreur récupération séances à venir:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des séances' });
  }
});

/**
 * @swagger
 * /api/sessions/instructors:
 *   get:
 *     summary: Récupérer la liste des instructeurs
 *     description: Retourne la liste des instructeurs pour les filtres
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des instructeurs récupérée avec succès
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
 *                         example: "instructor123"
 *                       nom:
 *                         type: string
 *                         example: "Jean Martin"
 *                       email:
 *                         type: string
 *                         example: "jean.martin@autoecole.fr"
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/instructors', checkAuth, async (req, res) => {
  try {
    const instructorsSnapshot = await admin.firestore()
      .collection('users')
      .where('role', '==', 'instructeur')
      .get();

    const instructors = instructorsSnapshot.docs.map(doc => ({
      id: doc.id,
      nom: doc.data().nom,
      email: doc.data().email
    }));

    res.status(200).json({ instructors });
  } catch (error) {
    console.error('Erreur récupération instructeurs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des instructeurs' });
  }
});

/**
 * @swagger
 * /api/sessions/types:
 *   get:
 *     summary: Récupérer la liste des types de séances
 *     description: Retourne la liste des types de séances disponibles
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des types récupérée avec succès
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
 *                         example: "conduite"
 *                       label:
 *                         type: string
 *                         example: "Conduite"
 *                       color:
 *                         type: string
 *                         example: "blue"
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/types', checkAuth, async (req, res) => {
  try {
    const types = [
      { value: 'conduite', label: 'Conduite', color: 'blue' },
      { value: 'code', label: 'Code', color: 'green' },
      { value: 'examen', label: 'Examen', color: 'red' },
      { value: 'évaluation', label: 'Évaluation', color: 'yellow' },
      { value: 'perfectionnement', label: 'Perfectionnement', color: 'purple' }
    ];

    res.status(200).json({ types });
  } catch (error) {
    console.error('Erreur récupération types:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des types' });
  }
});

/**
 * @swagger
 * /api/sessions/{id}:
 *   put:
 *     summary: Modifier une séance
 *     description: Met à jour une séance existante
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la séance
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSession'
 *     responses:
 *       200:
 *         description: Séance modifiée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Séance modifiée avec succès"
 *                 session:
 *                   $ref: '#/components/schemas/Session'
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         description: Séance introuvable
 *       500:
 *         description: Erreur serveur
 */
router.put('/:id', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Vérifier que l'utilisateur a les permissions
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    
    if (!userData || (userData.role !== 'admin' && userData.role !== 'instructeur')) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Vérifier que la séance existe
    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Séance introuvable' });
    }

    // Mettre à jour la séance
    await admin.firestore().collection('sessions').doc(id).update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Récupérer la séance mise à jour
    const updatedDoc = await admin.firestore().collection('sessions').doc(id).get();
    const session = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      scheduledDate: updatedDoc.data().scheduledDate?.toDate(),
      createdAt: updatedDoc.data().createdAt?.toDate(),
      updatedAt: updatedDoc.data().updatedAt?.toDate()
    };

    res.status(200).json({
      message: 'Séance modifiée avec succès',
      session
    });

  } catch (error) {
    console.error('Erreur modification séance:', error);
    res.status(500).json({ error: 'Erreur lors de la modification de la séance' });
  }
});

/**
 * @swagger
 * /api/sessions/{id}:
 *   delete:
 *     summary: Supprimer une séance
 *     description: Supprime définitivement une séance
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la séance
 *     responses:
 *       200:
 *         description: Séance supprimée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Séance supprimée avec succès"
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         description: Séance introuvable
 *       500:
 *         description: Erreur serveur
 */
router.delete('/:id', checkAuth, checkWritePermissions, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur a les permissions
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    
    if (!userData || (userData.role !== 'admin' && userData.role !== 'instructeur')) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Vérifier que la séance existe
    const sessionDoc = await admin.firestore().collection('sessions').doc(id).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Séance introuvable' });
    }

    // Supprimer la séance
    await admin.firestore().collection('sessions').doc(id).delete();

    res.status(200).json({
      message: 'Séance supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression séance:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la séance' });
  }
});

/**
 * @swagger
 * /api/sessions/export/excel:
 *   post:
 *     summary: Exporter les sessions en Excel
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filters:
 *                 $ref: '#/components/schemas/SessionFilters'
 *               title:
 *                 type: string
 *                 example: "Rapport de présence - Janvier 2024"
 *     responses:
 *       200:
 *         description: Fichier Excel généré avec succès
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.post('/export/excel', checkAuth, async (req, res) => {
  try {
    // Vérifier les permissions
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    
    if (!userData || (userData.role !== 'admin' && userData.role !== 'instructeur')) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const { filters, title } = req.body;
    
    // Pour l'instant, retourner un message indiquant que l'export Excel n'est pas encore implémenté
    res.status(200).json({
      message: 'Export Excel en cours de développement',
      filters,
      title
    });
  } catch (error) {
    console.error('Erreur export Excel:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export Excel' });
  }
});

/**
 * @swagger
 * /api/sessions/me:
 *   get:
 *     summary: Récupérer les séances de l'utilisateur connecté
 *     description: Retourne les séances de l'utilisateur connecté avec format adapté pour la page "Mes séances"
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Nombre maximum de séances à retourner
 *     responses:
 *       200:
 *         description: Séances de l'utilisateur récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserSession'
 *                 totalCount:
 *                   type: number
 *                   example: 4
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/me', checkAuth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const userId = req.user.uid;
    const limitNum = parseInt(limit);

    // Récupérer les séances de l'utilisateur
    const sessionsSnapshot = await admin.firestore()
      .collection('sessions')
      .where('studentId', '==', userId)
      .orderBy('scheduledDate', 'desc')
      .limit(limitNum)
      .get();

    const sessions = await Promise.all(sessionsSnapshot.docs.map(async (doc) => {
      const sessionData = doc.data();
      
      // Récupérer les données de l'instructeur
      const instructorDoc = await admin.firestore().collection('users').doc(sessionData.instructorId).get();
      const instructorData = instructorDoc.exists ? instructorDoc.data() : null;

      // Déterminer le type d'icône
      let iconType = 'book'; // défaut
      let typeLabel = 'Théorique';
      
      switch (sessionData.courseType) {
        case 'conduite':
          iconType = 'car';
          typeLabel = 'Pratique';
          break;
        case 'code':
          iconType = 'book';
          typeLabel = 'Théorique';
          break;
        case 'examen_blanc':
          iconType = 'monitor';
          typeLabel = 'En ligne';
          break;
        default:
          iconType = 'book';
          typeLabel = 'Théorique';
      }

      // Déterminer le statut
      let statusLabel = 'À venir';
      const now = new Date();
      const sessionDate = sessionData.scheduledDate?.toDate?.() || new Date(sessionData.scheduledDate);
      
      if (sessionData.status === 'présent' && sessionDate < now) {
        statusLabel = 'Terminé';
      } else if (sessionData.status === 'absent') {
        statusLabel = 'Absent';
      } else if (sessionDate >= now) {
        statusLabel = 'À venir';
      }

      // Formater la date en français
      const dateOptions = { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      };
      const formattedDate = sessionDate.toLocaleDateString('fr-FR', dateOptions);

      return {
        id: doc.id,
        title: sessionData.courseTitle,
        instructorName: instructorData?.nom || 'Instructeur inconnu',
        date: formattedDate,
        time: sessionData.scheduledTime,
        duration: `${sessionData.duration}h`,
        type: typeLabel,
        status: statusLabel,
        iconType: iconType
      };
    }));

    res.status(200).json({
      sessions,
      totalCount: sessions.length
    });
  } catch (error) {
    console.error('Erreur récupération séances utilisateur:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des séances' });
  }
});

module.exports = router;
