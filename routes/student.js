const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { checkAuth, checkAdmin } = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validationMiddleware');

// ============================================================
// ✅ FONCTION UTILITAIRE
// ============================================================
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  else if (diffHours > 0) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  else if (diffMinutes > 0) return `Il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  else return 'À l\'instant';
}

// ============================================================
// ✅ ROUTES
// ============================================================

/**
 * @swagger
 * /api/student/all:
 *   get:
 *     summary: Retourner la liste complète des élèves (admin)
 *     tags: [Élève]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste complète des élèves récupérée avec succès
 */
router.get('/all', checkAuth, checkAdmin, async (req, res) => {
  try {
    const snapshot = await admin.firestore()
      .collection('users')
      .where('role', '==', 'eleve')
      .get();

    const students = snapshot.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt && typeof data.createdAt.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : null;

      return {
        id: doc.id,
        nom: data.nom || data.nomComplet || '',
        email: data.email || '',
        role: data.role || 'eleve',
        statut: data.statut || data.status || '',
        createdAt
      };
    });

    return res.status(200).json({ students });
  } catch (error) {
    console.error('Erreur récupération liste des élèves:', error);
    return res.status(500).json({ error: 'Erreur lors de la récupération de la liste des élèves' });
  }
});

/**
 * @swagger
 * /api/student/progress:
 *   get:
 *     summary: Progression de l'élève basée sur ses séances
 *     description: |
 *       Calcule la progression de l'élève en comptant les heures de séances
 *       où sa présence a été marquée comme **présent** dans la collection sessions.
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
 *                       type:
 *                         type: string
 *                       percentage:
 *                         type: number
 *                       completedHours:
 *                         type: number
 *                       totalHours:
 *                         type: number
 *                       color:
 *                         type: string
 */
router.get('/progress', checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'eleve') {
      return res.status(403).json({ error: 'Accès réservé aux élèves' });
    }

    // ✅ Récupérer les séances pratiques de l'élève (studentId direct)
    const pratiquesSnap = await admin.firestore()
      .collection('sessions')
      .where('studentId', '==', uid)
      .where('courseCategory', '==', 'pratique')
      .get();

    // ✅ Récupérer les séances théoriques de l'élève (dans students[])
    const theoriquesSnap = await admin.firestore()
      .collection('sessions')
      .where('studentIds', 'array-contains', uid)
      .get();

    const progressData = {
      theorique: { hours: 0, total: 40 },
      conduite: { hours: 0, total: 50 },
      examen: { hours: 0, total: 10 }
    };

    // Compter heures théoriques — l'élève doit être marqué présent
    theoriquesSnap.docs.forEach(doc => {
      const data = doc.data();
      const myPresence = (data.students || []).find(s => s.studentId === uid);
      if (myPresence?.presence === 'présent') {
        const heures = (data.durationHeures || 0) + ((data.durationMinutes || 0) / 60);
        progressData.theorique.hours += heures;
      }
    });

    // Compter heures pratiques — status présent
    pratiquesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'présent') {
        const heures = (data.durationHeures || 0) + ((data.durationMinutes || 0) / 60);
        if (data.courseType === 'examen') {
          progressData.examen.hours += heures;
        } else {
          progressData.conduite.hours += heures;
        }
      }
    });

    const progress = [
      {
        category: 'Cours théoriques',
        type: 'theorique',
        percentage: Math.min(Math.round((progressData.theorique.hours / progressData.theorique.total) * 100), 100),
        completedHours: Math.round(progressData.theorique.hours * 10) / 10,
        totalHours: progressData.theorique.total,
        color: 'green'
      },
      {
        category: 'Conduite pratique',
        type: 'conduite',
        percentage: Math.min(Math.round((progressData.conduite.hours / progressData.conduite.total) * 100), 100),
        completedHours: Math.round(progressData.conduite.hours * 10) / 10,
        totalHours: progressData.conduite.total,
        color: 'blue'
      },
      {
        category: 'Examens',
        type: 'examen',
        percentage: Math.min(Math.round((progressData.examen.hours / progressData.examen.total) * 100), 100),
        completedHours: Math.round(progressData.examen.hours * 10) / 10,
        totalHours: progressData.examen.total,
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
 *     summary: Statistiques de l'élève basées sur ses séances
 *     description: Calcule les statistiques depuis la collection sessions
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
 *                     totalSessions:
 *                       type: object
 *                     drivingHours:
 *                       type: object
 *                     successRate:
 *                       type: object
 */
router.get('/statistics', checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'eleve') {
      return res.status(403).json({ error: 'Accès réservé aux élèves' });
    }

    // ✅ Séances pratiques
    const pratiquesSnap = await admin.firestore()
      .collection('sessions')
      .where('studentId', '==', uid)
      .where('courseCategory', '==', 'pratique')
      .get();

    // ✅ Séances théoriques
    const theoriquesSnap = await admin.firestore()
      .collection('sessions')
      .where('studentIds', 'array-contains', uid)
      .get();

    let totalHeures = 0;
    let drivingHeures = 0;
    let totalSeances = 0;
    let seancesPresent = 0;

    // Théoriques
    theoriquesSnap.docs.forEach(doc => {
      const data = doc.data();
      const myPresence = (data.students || []).find(s => s.studentId === uid);
      totalSeances++;
      if (myPresence?.presence === 'présent') {
        seancesPresent++;
        totalHeures += (data.durationHeures || 0) + ((data.durationMinutes || 0) / 60);
      }
    });

    // Pratiques
    pratiquesSnap.docs.forEach(doc => {
      const data = doc.data();
      totalSeances++;
      if (data.status === 'présent') {
        seancesPresent++;
        const heures = (data.durationHeures || 0) + ((data.durationMinutes || 0) / 60);
        totalHeures += heures;
        drivingHeures += heures;
      }
    });

    const successRate = totalSeances > 0 ? Math.round((seancesPresent / totalSeances) * 100) : 0;

    res.status(200).json({
      statistics: {
        totalHours: {
          value: Math.round(totalHeures * 10) / 10,
          label: 'Heures totales'
        },
        totalSessions: {
          value: totalSeances,
          label: 'Séances totales'
        },
        drivingHours: {
          value: Math.round(drivingHeures * 10) / 10,
          label: 'H. conduite'
        },
        successRate: {
          value: successRate,
          label: 'Taux de présence',
          unit: '%'
        }
      }
    });
  } catch (error) {
    console.error('Erreur récupération statistiques:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

/**
 * @swagger
 * /api/student/activity:
 *   get:
 *     summary: Activité récente de l'élève basée sur ses séances
 *     description: Retourne les dernières séances de l'élève depuis la collection sessions
 *     tags: [Élève]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Activité récente récupérée avec succès
 */
router.get('/activity', checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);

    console.log(`🔍 Récupération activité pour l'utilisateur: ${uid}`);

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    if (userDoc.data().role !== 'eleve') return res.status(403).json({ error: 'Accès réservé aux élèves' });

    const activities = [];

    // ✅ Séances pratiques récentes
    try {
      const pratiquesSnap = await admin.firestore()
        .collection('sessions')
        .where('studentId', '==', uid)
        .where('courseCategory', '==', 'pratique')
        .orderBy('scheduledDate', 'desc')
        .limit(limit)
        .get();

      pratiquesSnap.docs.forEach(doc => {
        const data = doc.data();
        const timestamp = data.scheduledDate?.toDate() || new Date();
        const timeAgo = getTimeAgo(timestamp);

        let activityType, title, icon, color;

        if (data.status === 'présent') {
          activityType = 'lesson_completed';
          title = `Séance de ${data.courseType} terminée`;
          icon = 'check';
          color = 'green';
        } else if (data.status === 'confirmee') {
          activityType = 'lesson_scheduled';
          title = `Séance de ${data.courseType} confirmée`;
          icon = 'dot';
          color = 'blue';
        } else if (data.status === 'en_attente_confirmation') {
          activityType = 'lesson_pending';
          title = `Séance de ${data.courseType} en attente`;
          icon = 'clock';
          color = 'orange';
        } else {
          activityType = 'lesson_scheduled';
          title = `Séance de ${data.courseType || 'conduite'}`;
          icon = 'dot';
          color = 'orange';
        }

        activities.push({
          id: doc.id,
          type: activityType,
          title,
          description: data.courseTitle || title,
          timestamp: timestamp.toISOString(),
          timeAgo,
          icon,
          color
        });
      });
    } catch (error) {
      console.error('❌ Erreur séances pratiques:', error);
    }

    // ✅ Séances théoriques récentes
    try {
      const theoriquesSnap = await admin.firestore()
        .collection('sessions')
        .where('studentIds', 'array-contains', uid)
        .orderBy('scheduledDate', 'desc')
        .limit(limit)
        .get();

      theoriquesSnap.docs.forEach(doc => {
        const data = doc.data();
        const timestamp = data.scheduledDate?.toDate() || new Date();
        const timeAgo = getTimeAgo(timestamp);
        const myPresence = (data.students || []).find(s => s.studentId === uid);

        let activityType, title, icon, color;

        if (myPresence?.presence === 'présent') {
          activityType = 'lesson_completed';
          title = `Cours théorique terminé`;
          icon = 'check';
          color = 'green';
        } else {
          activityType = 'lesson_scheduled';
          title = `Cours théorique programmé`;
          icon = 'dot';
          color = 'blue';
        }

        activities.push({
          id: doc.id,
          type: activityType,
          title,
          description: data.courseTitle || title,
          timestamp: timestamp.toISOString(),
          timeAgo,
          icon,
          color
        });
      });
    } catch (error) {
      console.error('❌ Erreur séances théoriques:', error);
    }

    // Trier par date et limiter
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, limit);

    console.log(`✅ Activités retournées: ${limitedActivities.length}`);
    res.status(200).json({ activities: limitedActivities });
  } catch (error) {
    console.error('❌ Erreur récupération activité:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'activité récente' });
  }
});

/**
 * @swagger
 * /api/student/objectives:
 *   get:
 *     summary: Objectifs de l'élève
 *     description: Retourne les objectifs de l'élève basés sur ses séances à venir
 *     tags: [Élève]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Objectifs récupérés avec succès
 */
router.get('/objectives', checkAuth, async (req, res) => {
  try {
    const uid = req.user.uid;

    console.log(`🎯 Récupération objectifs pour l'utilisateur: ${uid}`);

    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    if (userDoc.data().role !== 'eleve') return res.status(403).json({ error: 'Accès réservé aux élèves' });

    const objectives = [];

    // ✅ Prochaine séance pratique → objectif à venir
    try {
      const now = new Date();
      const prochainePratiqueSnap = await admin.firestore()
        .collection('sessions')
        .where('studentId', '==', uid)
        .where('courseCategory', '==', 'pratique')
        .where('status', '==', 'confirmee')
        .where('scheduledDate', '>=', now)
        .orderBy('scheduledDate', 'asc')
        .limit(1)
        .get();

      if (!prochainePratiqueSnap.empty) {
        const doc = prochainePratiqueSnap.docs[0];
        const data = doc.data();
        const targetDate = data.scheduledDate?.toDate();

        objectives.push({
          id: doc.id,
          title: `Séance de ${data.courseType}`,
          description: data.courseTitle || `Séance de ${data.courseType}`,
          type: 'practical_session',
          targetDate: targetDate?.toISOString(),
          status: 'scheduled',
          displayDate: targetDate ? `Prévu le ${targetDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à ${data.scheduledTime}` : 'Date à confirmer',
          icon: 'car',
          color: 'blue'
        });
      }
    } catch (error) {
      console.error('❌ Erreur prochaine séance:', error);
    }

    // ✅ Prochain cours théorique
    try {
      const now = new Date();
      const prochaineTheoriqueSnap = await admin.firestore()
        .collection('sessions')
        .where('studentIds', 'array-contains', uid)
        .where('status', '==', 'confirmee')
        .where('scheduledDate', '>=', now)
        .orderBy('scheduledDate', 'asc')
        .limit(1)
        .get();

      if (!prochaineTheoriqueSnap.empty) {
        const doc = prochaineTheoriqueSnap.docs[0];
        const data = doc.data();
        const targetDate = data.scheduledDate?.toDate();

        objectives.push({
          id: `theorique-${doc.id}`,
          title: `Cours théorique`,
          description: data.courseTitle || 'Cours théorique',
          type: 'theoretical_session',
          targetDate: targetDate?.toISOString(),
          status: 'scheduled',
          displayDate: targetDate ? `Prévu le ${targetDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à ${data.scheduledTime}` : 'Date à confirmer',
          icon: 'book',
          color: 'green'
        });
      }
    } catch (error) {
      console.error('❌ Erreur prochain cours théorique:', error);
    }

    // Si aucun objectif → message par défaut
    if (objectives.length === 0) {
      objectives.push({
        id: 'default-obj',
        title: 'Aucune séance à venir',
        description: 'Réservez une séance pour commencer',
        type: 'no_session',
        targetDate: null,
        status: 'pending',
        displayDate: 'Pas de séance programmée',
        icon: 'clock',
        color: 'yellow'
      });
    }

    console.log(`✅ Objectifs retournés: ${objectives.length}`);
    res.status(200).json({ objectives });
  } catch (error) {
    console.error('❌ Erreur récupération objectifs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des objectifs' });
  }
});

/**
 * @swagger
 * /api/student/{uid}:
 *   put:
 *     summary: Modifier un élève (admin ou instructeur)
 *     tags: [Élève]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Élève modifié avec succès
 *       403:
 *         description: Accès réservé aux administrateurs et instructeurs
 *       404:
 *         description: Élève introuvable
 */
router.put('/:uid', checkAuth, validate(schemas.updateStudentProfile), async (req, res) => {
  try {
    const { uid } = req.params;
    const requesterUid = req.user.uid;

    const requesterDoc = await admin.firestore().collection('users').doc(requesterUid).get();
    const requesterData = requesterDoc.exists ? requesterDoc.data() : null;

    if (!requesterData || (requesterData.role !== 'admin' && requesterData.role !== 'instructeur')) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs et instructeurs' });
    }

    const studentRef = admin.firestore().collection('users').doc(uid);
    const studentDoc = await studentRef.get();
    if (!studentDoc.exists) return res.status(404).json({ error: 'Élève introuvable' });
    if (studentDoc.data().role !== 'eleve') return res.status(400).json({ error: 'Cet utilisateur n\'est pas un élève' });

    const updateData = { ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    await studentRef.update(updateData);

    const updatedDoc = await studentRef.get();
    const updatedData = updatedDoc.data();

    return res.status(200).json({
      message: 'Élève modifié avec succès',
      student: {
        uid: updatedDoc.id,
        nom: updatedData.nom || '',
        email: updatedData.email || '',
        role: updatedData.role || 'eleve',
        statut: updatedData.statut || '',
        telephone: updatedData.telephone || '',
        adresse: updatedData.adresse || '',
        licenseType: updatedData.licenseType || 'B'
      }
    });
  } catch (error) {
    console.error('Erreur modification élève:', error);
    return res.status(500).json({ error: 'Erreur lors de la modification de l\'élève' });
  }
});

module.exports = router;