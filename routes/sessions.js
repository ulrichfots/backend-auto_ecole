const express = require('express');
const router = express.Router();
const admin = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validationMiddleware');

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
router.get('/', checkAuth, async (req, res) => {
  try {
    const { date, instructorId, status, studentId, startDate, endDate } = req.query;
    
    let query = admin.firestore().collection('sessions');

    // Appliquer les filtres
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.where('scheduledDate', '>=', startOfDay).where('scheduledDate', '<=', endOfDay);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      query = query.where('scheduledDate', '>=', start).where('scheduledDate', '<=', end);
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

    const sessionsSnapshot = await query.orderBy('scheduledTime', 'asc').get();
    
    // Enrichir les données avec les informations des élèves et instructeurs
    const sessions = await Promise.all(sessionsSnapshot.docs.map(async (doc) => {
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
          nom: studentData?.nom || 'Élève inconnu',
          email: studentData?.email || '',
          initials: studentData?.nom ? studentData.nom.split(' ').map(name => name[0]).join('').toUpperCase() : 'E'
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

    res.status(200).json({ sessions });
  } catch (error) {
    console.error('Erreur récupération sessions:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des sessions' });
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
router.post('/', checkAuth, validate(schemas.createSession), async (req, res) => {
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
router.patch('/:sessionId/status', checkAuth, validate(schemas.updateSessionStatus), async (req, res) => {
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
router.get('/:sessionId', checkAuth, async (req, res) => {
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

module.exports = router;
