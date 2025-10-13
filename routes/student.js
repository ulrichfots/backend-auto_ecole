const express = require('express');
const router = express.Router();
const admin = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * /api/student/progress:
 *   get:
 *     summary: Récupérer la progression d'un élève
 *     tags: [Élève]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Progression récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 progress:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category:
 *                         type: string
 *                         example: "Code théorique"
 *                       type:
 *                         type: string
 *                         enum: [code, conduite, autoroute]
 *                         example: "code"
 *                       percentage:
 *                         type: number
 *                         example: 75
 *                       completedHours:
 *                         type: number
 *                         example: 30
 *                       totalHours:
 *                         type: number
 *                         example: 40
 *                       color:
 *                         type: string
 *                         example: "green"
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès réservé aux élèves
 *       500:
 *         description: Erreur serveur
 */
router.get('/progress', checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // Vérifier que l'utilisateur est un élève
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'eleve') {
      return res.status(403).json({ error: 'Accès réservé aux élèves' });
    }

    // Récupérer les cours terminés de l'élève
    const completedCoursesSnapshot = await admin.firestore()
      .collection('courses')
      .where('studentId', '==', uid)
      .where('status', '==', 'completed')
      .get();

    const completedCourses = completedCoursesSnapshot.docs.map(doc => doc.data());

    // Calculer la progression par catégorie
    const progressData = {
      code: { hours: 0, total: 40 },
      conduite: { hours: 0, total: 50 },
      autoroute: { hours: 0, total: 20 }
    };

    // Compter les heures par type
    completedCourses.forEach(course => {
      const type = course.type || 'conduite';
      const duration = course.duration || 1; // 1 heure par défaut
      if (progressData[type]) {
        progressData[type].hours += duration;
      }
    });

    // Formater les données de progression
    const progress = [
      {
        category: 'Code théorique',
        type: 'code',
        percentage: Math.min(Math.round((progressData.code.hours / progressData.code.total) * 100), 100),
        completedHours: progressData.code.hours,
        totalHours: progressData.code.total,
        color: 'green'
      },
      {
        category: 'Conduite pratique',
        type: 'conduite',
        percentage: Math.min(Math.round((progressData.conduite.hours / progressData.conduite.total) * 100), 100),
        completedHours: progressData.conduite.hours,
        totalHours: progressData.conduite.total,
        color: 'blue'
      },
      {
        category: 'Conduite autoroute',
        type: 'autoroute',
        percentage: Math.min(Math.round((progressData.autoroute.hours / progressData.autoroute.total) * 100), 100),
        completedHours: progressData.autoroute.hours,
        totalHours: progressData.autoroute.total,
        color: 'orange'
      }
    ];

    res.status(200).json({ progress });
  } catch (error) {
    console.error('Erreur récupération progression:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la progression' });
  }
});

/**
 * @swagger
 * /api/student/statistics:
 *   get:
 *     summary: Récupérer les statistiques d'un élève
 *     tags: [Élève]
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
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     totalHours:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: number
 *                           example: 28
 *                         label:
 *                           type: string
 *                           example: "Heures totales"
 *                     codeTests:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: number
 *                           example: 12
 *                         label:
 *                           type: string
 *                           example: "Tests code"
 *                     drivingHours:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: number
 *                           example: 16
 *                         label:
 *                           type: string
 *                           example: "H. conduite"
 *                     successRate:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: number
 *                           example: 85
 *                         label:
 *                           type: string
 *                           example: "Réussite"
 *                         unit:
 *                           type: string
 *                           example: "%"
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès réservé aux élèves
 *       500:
 *         description: Erreur serveur
 */
router.get('/statistics', checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // Vérifier que l'utilisateur est un élève
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'eleve') {
      return res.status(403).json({ error: 'Accès réservé aux élèves' });
    }

    // Récupérer tous les cours de l'élève
    const coursesSnapshot = await admin.firestore()
      .collection('courses')
      .where('studentId', '==', uid)
      .get();

    const courses = coursesSnapshot.docs.map(doc => doc.data());

    // Récupérer les tests de l'élève
    const testsSnapshot = await admin.firestore()
      .collection('tests')
      .where('studentId', '==', uid)
      .get();

    const tests = testsSnapshot.docs.map(doc => doc.data());

    // Calculer les statistiques
    const totalHours = courses.reduce((sum, course) => sum + (course.duration || 1), 0);
    const drivingHours = courses
      .filter(course => course.type === 'conduite' || course.type === 'autoroute')
      .reduce((sum, course) => sum + (course.duration || 1), 0);
    
    const codeTests = tests.filter(test => test.type === 'code').length;
    const passedTests = tests.filter(test => test.result === 'passed').length;
    const successRate = tests.length > 0 ? Math.round((passedTests / tests.length) * 100) : 0;

    const statistics = {
      totalHours: {
        value: totalHours,
        label: 'Heures totales'
      },
      codeTests: {
        value: codeTests,
        label: 'Tests code'
      },
      drivingHours: {
        value: drivingHours,
        label: 'H. conduite'
      },
      successRate: {
        value: successRate,
        label: 'Réussite',
        unit: '%'
      }
    };

    res.status(200).json({ statistics });
  } catch (error) {
    console.error('Erreur récupération statistiques:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

/**
 * @swagger
 * /api/student/activity:
 *   get:
 *     summary: Récupérer l'activité récente d'un élève
 *     tags: [Élève]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 *         description: Nombre maximum d'activités à retourner
 *     responses:
 *       200:
 *         description: Activité récente récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activities:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "activity123"
 *                       type:
 *                         type: string
 *                         enum: [test_passed, lesson_completed, lesson_scheduled]
 *                         example: "test_passed"
 *                       title:
 *                         type: string
 *                         example: "Test code réussi"
 *                       description:
 *                         type: string
 *                         example: "Code test successful"
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       timeAgo:
 *                         type: string
 *                         example: "Il y a 2 heures"
 *                       icon:
 *                         type: string
 *                         example: "check"
 *                       color:
 *                         type: string
 *                         example: "green"
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès réservé aux élèves
 *       500:
 *         description: Erreur serveur
 */
router.get('/activity', checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    
    // Vérifier que l'utilisateur est un élève
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'eleve') {
      return res.status(403).json({ error: 'Accès réservé aux élèves' });
    }

    // Récupérer les cours récents
    const coursesSnapshot = await admin.firestore()
      .collection('courses')
      .where('studentId', '==', uid)
      .orderBy('schedule', 'desc')
      .limit(limit)
      .get();

    // Récupérer les tests récents
    const testsSnapshot = await admin.firestore()
      .collection('tests')
      .where('studentId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const activities = [];

    // Traiter les cours
    coursesSnapshot.docs.forEach(doc => {
      const course = doc.data();
      const timestamp = course.schedule ? new Date(course.schedule) : new Date();
      const timeAgo = getTimeAgo(timestamp);
      
      let activityType, title, description, icon, color;
      
      if (course.status === 'completed') {
        activityType = 'lesson_completed';
        title = 'Cours de conduite terminé';
        description = 'Driving lesson finished';
        icon = 'minus';
        color = 'blue';
      } else if (course.status === 'scheduled') {
        activityType = 'lesson_scheduled';
        title = 'Cours programmé';
        description = 'Scheduled lesson';
        icon = 'dot';
        color = 'orange';
      }

      activities.push({
        id: doc.id,
        type: activityType,
        title,
        description,
        timestamp: timestamp.toISOString(),
        timeAgo,
        icon,
        color
      });
    });

    // Traiter les tests
    testsSnapshot.docs.forEach(doc => {
      const test = doc.data();
      const timestamp = test.createdAt ? test.createdAt.toDate() : new Date();
      const timeAgo = getTimeAgo(timestamp);
      
      activities.push({
        id: doc.id,
        type: 'test_passed',
        title: test.result === 'passed' ? 'Test code réussi' : 'Test code échoué',
        description: 'Code test successful',
        timestamp: timestamp.toISOString(),
        timeAgo,
        icon: 'check',
        color: test.result === 'passed' ? 'green' : 'red'
      });
    });

    // Trier par timestamp et limiter
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    activities.splice(limit);

    res.status(200).json({ activities });
  } catch (error) {
    console.error('Erreur récupération activité:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'activité récente' });
  }
});

/**
 * @swagger
 * /api/student/objectives:
 *   get:
 *     summary: Récupérer les objectifs d'un élève
 *     tags: [Élève]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Objectifs récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 objectives:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "objective123"
 *                       title:
 *                         type: string
 *                         example: "Examen théorique"
 *                       description:
 *                         type: string
 *                         example: "Theoretical exam"
 *                       type:
 *                         type: string
 *                         enum: [theoretical_exam, practical_exam, license_obtained]
 *                         example: "theoretical_exam"
 *                       targetDate:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-01-25T00:00:00.000Z"
 *                       status:
 *                         type: string
 *                         enum: [pending, scheduled, completed]
 *                         example: "scheduled"
 *                       displayDate:
 *                         type: string
 *                         example: "Prévu le 25 janvier 2024"
 *                       icon:
 *                         type: string
 *                         example: "check"
 *                       color:
 *                         type: string
 *                         example: "green"
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès réservé aux élèves
 *       500:
 *         description: Erreur serveur
 */
router.get('/objectives', checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // Vérifier que l'utilisateur est un élève
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'eleve') {
      return res.status(403).json({ error: 'Accès réservé aux élèves' });
    }

    // Récupérer les objectifs de l'élève
    const objectivesSnapshot = await admin.firestore()
      .collection('objectives')
      .where('studentId', '==', uid)
      .orderBy('targetDate', 'asc')
      .get();

    const objectives = objectivesSnapshot.docs.map(doc => {
      const data = doc.data();
      const targetDate = data.targetDate ? data.targetDate.toDate() : new Date();
      
      let displayDate;
      if (data.status === 'completed') {
        displayDate = 'Terminé';
      } else if (data.targetDate) {
        displayDate = `Prévu le ${targetDate.toLocaleDateString('fr-FR', { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric' 
        })}`;
      } else {
        displayDate = 'Objectif: mars 2024';
      }

      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        type: data.type,
        targetDate: targetDate.toISOString(),
        status: data.status,
        displayDate,
        icon: data.status === 'completed' ? 'check' : 'clock',
        color: data.status === 'completed' ? 'green' : 'yellow'
      };
    });

    res.status(200).json({ objectives });
  } catch (error) {
    console.error('Erreur récupération objectifs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des objectifs' });
  }
});

// Fonction utilitaire pour calculer le temps écoulé
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) {
    return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  } else if (diffMinutes > 0) {
    return `Il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  } else {
    return 'À l\'instant';
  }
}

module.exports = router;
