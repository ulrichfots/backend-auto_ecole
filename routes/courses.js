const express = require("express");
const admin = require("../firebase");
const { validate, schemas } = require('../middlewares/validationMiddleware');
const { checkAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * /api/courses:
 *   post:
 *     summary: Créer un nouveau cours
 *     tags: [Cours]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - instructorId
 *               - schedule
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: "Cours de conduite niveau 1"
 *               instructorId:
 *                 type: string
 *                 example: "instructor123"
 *               schedule:
 *                 type: string
 *                 example: "2024-01-15 10:00"
 *     responses:
 *       200:
 *         description: Cours créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "course123"
 *       400:
 *         description: Données invalides
 *       500:
 *         description: Erreur serveur
 */
router.post("/", validate(schemas.course), async (req, res) => {
    const { title, instructorId, schedule } = req.body;

    try {
        const courseRef = await admin.firestore().collection("courses").add({
            title,
            instructorId,
            schedule,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({ id: courseRef.id });
    } catch (error) {
        console.error('Erreur création cours:', error);
        res.status(500).json({ error: 'Erreur lors de la création du cours' });
    }
});

/**
 * @swagger
 * /api/courses:
 *   get:
 *     summary: Récupérer tous les cours
 *     tags: [Cours]
 *     responses:
 *       200:
 *         description: Liste des cours
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   instructorId:
 *                     type: string
 *                   schedule:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       500:
 *         description: Erreur serveur
 */
router.get("/", async (req, res) => {
    try {
        const snapshot = await admin.firestore().collection("courses").get();
        const courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(courses);
    } catch (error) {
        console.error('Erreur récupération cours:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des cours' });
    }
});

/**
 * @swagger
 * /api/courses/upcoming:
 *   get:
 *     summary: Récupérer les prochains cours d'un élève
 *     tags: [Cours]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Prochains cours récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 upcomingCourses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "course123"
 *                       title:
 *                         type: string
 *                         example: "Conduite"
 *                       type:
 *                         type: string
 *                         enum: [code, conduite, autoroute]
 *                         example: "conduite"
 *                       schedule:
 *                         type: string
 *                         example: "2024-01-15 14:00"
 *                       instructorName:
 *                         type: string
 *                         example: "Marie Dubois"
 *                       status:
 *                         type: string
 *                         enum: [scheduled, confirmed, completed]
 *                         example: "scheduled"
 *                       timeUntil:
 *                         type: string
 *                         example: "Aujourd'hui 14:00"
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/upcoming', checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // Vérifier que l'utilisateur est un élève
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'eleve') {
      return res.status(403).json({ error: 'Accès réservé aux élèves' });
    }

    // Récupérer les cours à venir pour cet élève
    const now = new Date();
    const upcomingSnapshot = await admin.firestore()
      .collection('courses')
      .where('studentId', '==', uid)
      .where('schedule', '>=', now.toISOString())
      .orderBy('schedule', 'asc')
      .limit(5)
      .get();

    const upcomingCourses = upcomingSnapshot.docs.map(doc => {
      const data = doc.data();
      const scheduleDate = new Date(data.schedule);
      
      // Formater la date pour l'affichage
      let timeUntil;
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (scheduleDate.toDateString() === today.toDateString()) {
        timeUntil = `Aujourd'hui ${scheduleDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
      } else if (scheduleDate.toDateString() === tomorrow.toDateString()) {
        timeUntil = `Demain ${scheduleDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        timeUntil = scheduleDate.toLocaleDateString('fr-FR', { 
          day: '2-digit', 
          month: '2-digit',
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }

      return {
        id: doc.id,
        title: data.title,
        type: data.type || 'conduite',
        schedule: data.schedule,
        instructorName: data.instructorName || 'Instructeur',
        status: data.status || 'scheduled',
        timeUntil: timeUntil
      };
    });

    res.status(200).json({ upcomingCourses });
  } catch (error) {
    console.error('Erreur récupération cours à venir:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des cours à venir' });
  }
});

/**
 * @swagger
 * /api/courses/student/{studentId}:
 *   get:
 *     summary: Récupérer tous les cours d'un élève
 *     tags: [Cours]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de l'élève
 *     responses:
 *       200:
 *         description: Cours de l'élève récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 courses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Course'
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/student/:studentId', checkAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    const uid = req.user.uid;
    
    // Vérifier que l'utilisateur peut accéder à ces données
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    const userData = userDoc.data();
    
    if (!userData || (userData.role !== 'admin' && userData.role !== 'instructeur' && uid !== studentId)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const coursesSnapshot = await admin.firestore()
      .collection('courses')
      .where('studentId', '==', studentId)
      .orderBy('schedule', 'desc')
      .get();

    const courses = coursesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json({ courses });
  } catch (error) {
    console.error('Erreur récupération cours élève:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des cours' });
  }
});

module.exports = router;