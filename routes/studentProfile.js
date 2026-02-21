const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validationMiddleware');

/**
 * @swagger
 * /api/student-profile/{uid}:
 *   get:
 *     summary: Récupérer le profil détaillé d'un élève
 *     tags: [Profil Élève]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: UID de l'élève
 *     responses:
 *       200:
 *         description: Profil élève récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentProfile'
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         description: Élève introuvable
 *       500:
 *         description: Erreur serveur
 */
router.get('/:uid', checkAuth, async (req, res) => {
  try {
    const { uid } = req.params;
    const currentUser = req.user.uid;

    // Vérifier les permissions
    const userDoc = await admin.firestore().collection('users').doc(currentUser).get();
    const userData = userDoc.data();
    
    if (!userData || (userData.role !== 'admin' && userData.role !== 'instructeur' && currentUser !== uid)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Récupérer le profil de l'élève
    const studentDoc = await admin.firestore().collection('users').doc(uid).get();
    
    if (!studentDoc.exists) {
      return res.status(404).json({ error: 'Élève introuvable' });
    }

    const studentData = studentDoc.data();
    
    // Vérifier que c'est bien un élève
    if (studentData.role !== 'eleve') {
      return res.status(400).json({ error: 'Cet utilisateur n\'est pas un élève' });
    }

    // Calculer la progression globale
    const progressionGlobale = Math.round(
      ((studentData.theoreticalHours || 0) + (studentData.practicalHours || 0)) / 
      ((studentData.theoreticalHoursMin || 40) + (studentData.practicalHoursMin || 20)) * 100
    );

    // Formater les données du profil
    const profile = {
      uid: uid,
      nom: studentData.nom || studentData.nomComplet || '',
      nomComplet: studentData.nomComplet || studentData.nom || '',
      email: studentData.email,
      statut: studentData.statut,
      dateInscription: studentData.createdAt,
      idEleve: uid.substring(0, 8), // ID court pour l'affichage
      progressionGlobale: Math.min(progressionGlobale, 100),
      coursTheoriques: {
        completed: studentData.theoreticalHours || 0,
        total: studentData.theoreticalHoursMin || 40
      },
      exercicesPratiques: {
        completed: studentData.practicalHours || 0,
        total: studentData.practicalHoursMin || 20
      },
      evaluations: {
        completed: 0, // À calculer depuis les évaluations
        total: 4
      },
      activiteRecente: [], // À remplir avec les activités récentes
      isFirstLogin: studentData.isFirstLogin || false,
      profileImageUrl: studentData.profileImageUrl,
      licenseType: studentData.licenseType || 'B',
      nextExam: studentData.nextExam,
      monitorComments: studentData.monitorComments || '',
      // Ajout des propriétés manquantes
      numeroPermis: studentData.numeroPermis || '',
      contactUrgence: studentData.contactUrgence || '',
      telephone: studentData.telephone || '',
      adresse: studentData.adresse || '',
      dateNaissance: studentData.dateNaissance || ''
    };

    res.status(200).json(profile);
  } catch (error) {
    console.error('Erreur récupération profil élève:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
});

/**
 * @swagger
 * /api/student-profile/{uid}:
 *   put:
 *     summary: Mettre à jour le profil d'un élève
 *     tags: [Profil Élève]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: UID de l'élève
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateStudentProfile'
 *     responses:
 *       200:
 *         description: Profil mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Profil mis à jour avec succès"
 *                 updatedFields:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         description: Élève introuvable
 *       500:
 *         description: Erreur serveur
 */
router.put('/:uid', checkAuth, validate(schemas.updateStudentProfile), async (req, res) => {
  try {
    const { uid } = req.params;
    const currentUser = req.user.uid;
    const updateData = req.body;

    console.log(`📝 Mise à jour profil élève ${uid} par ${currentUser}:`, updateData);

    // Vérifier les permissions
    const userDoc = await admin.firestore().collection('users').doc(currentUser).get();
    if (!userDoc.exists) {
      console.error(`❌ Utilisateur actuel non trouvé: ${currentUser}`);
      return res.status(404).json({ 
        error: 'Utilisateur non trouvé',
        debug: { currentUser, uid }
      });
    }

    const userData = userDoc.data();
    const hasPermission = userData.role === 'admin' || 
                         userData.role === 'instructeur' || 
                         currentUser === uid;
    
    if (!hasPermission) {
      console.error(`❌ Permissions insuffisantes: ${currentUser} (${userData.role}) → ${uid}`);
      return res.status(403).json({ 
        error: 'Accès non autorisé',
        debug: {
          currentUser,
          currentUserRole: userData.role,
          targetUser: uid,
          allowed: userData.role === 'admin' || userData.role === 'instructeur' || currentUser === uid
        }
      });
    }

    // Vérifier que l'élève existe
    const studentDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!studentDoc.exists) {
      console.error(`❌ Élève non trouvé: ${uid}`);
      return res.status(404).json({ 
        error: 'Élève introuvable',
        debug: { targetUser: uid }
      });
    }

    // Nettoyer les données (supprimer les champs vides)
    const cleanedData = {};
    Object.keys(updateData).forEach(key => {
      const value = updateData[key];
      if (value !== null && value !== undefined && value !== '') {
        cleanedData[key] = value;
      }
    });

    console.log(`🧹 Données nettoyées:`, cleanedData);

    // Mettre à jour le profil
    await admin.firestore().collection('users').doc(uid).update({
      ...cleanedData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const updatedFields = Object.keys(cleanedData);
    console.log(`✅ Profil mis à jour avec succès. Champs modifiés:`, updatedFields);

    res.status(200).json({
      message: 'Profil mis à jour avec succès',
      updatedFields: updatedFields,
      updatedCount: updatedFields.length
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour profil:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour du profil',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/student-profile/first-login/{uid}:
 *   post:
 *     summary: Gérer la première connexion d'un élève
 *     tags: [Profil Élève]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: UID de l'élève
 *     responses:
 *       200:
 *         description: Première connexion traitée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Première connexion effectuée avec succès"
 *                 statusChanged:
 *                   type: boolean
 *                   example: true
 *                 newStatus:
 *                   type: string
 *                   example: "actif"
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé
 *       404:
 *         description: Élève introuvable
 *       500:
 *         description: Erreur serveur
 */
router.post('/first-login/:uid', checkAuth, async (req, res) => {
  try {
    const { uid } = req.params;
    const currentUser = req.user.uid;

    // Vérifier que l'utilisateur peut effectuer cette action
    if (currentUser !== uid) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Vérifier que l'élève existe
    const studentDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!studentDoc.exists) {
      return res.status(404).json({ error: 'Élève introuvable' });
    }

    const studentData = studentDoc.data();

    // Vérifier si c'est bien la première connexion
    if (!studentData.isFirstLogin) {
      return res.status(200).json({
        message: 'Ce n\'est pas la première connexion',
        statusChanged: false,
        currentStatus: studentData.statut
      });
    }

    // Mettre à jour le statut et le flag
    await admin.firestore().collection('users').doc(uid).update({
      statut: 'actif',
      isFirstLogin: false,
      firstLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: 'Première connexion effectuée avec succès',
      statusChanged: true,
      newStatus: 'actif'
    });
  } catch (error) {
    console.error('Erreur première connexion:', error);
    res.status(500).json({ error: 'Erreur lors de la première connexion' });
  }
});

/**
 * @swagger
 * /api/student-profile/activity/{uid}:
 *   get:
 *     summary: Récupérer l'activité récente d'un élève
 *     tags: [Profil Élève]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *         description: UID de l'élève
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
 *                     $ref: '#/components/schemas/ActivityItem'
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/activity/:uid', checkAuth, async (req, res) => {
  try {
    const { uid } = req.params;
    const currentUser = req.user.uid;
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);

    // Vérifier les permissions
    const userDoc = await admin.firestore().collection('users').doc(currentUser).get();
    const userData = userDoc.data();
    
    if (!userData || (userData.role !== 'admin' && userData.role !== 'instructeur' && currentUser !== uid)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Récupérer les activités récentes (cours, tests, etc.)
    const activities = [];

    // Exemple d'activités (à adapter selon votre structure de données)
    const mockActivities = [
      {
        type: 'course_completed',
        description: 'Cours terminé: Introduction aux bases',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // Il y a 2 heures
        status: 'completed'
      },
      {
        type: 'exercise_submitted',
        description: 'Exercice soumis: Pratique avancée',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // Il y a 1 jour
        status: 'submitted'
      },
      {
        type: 'evaluation_pending',
        description: 'Évaluation en attente',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Il y a 3 jours
        status: 'pending'
      }
    ];

    // Trier par date et limiter
    const recentActivities = mockActivities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    res.status(200).json({ activities: recentActivities });
  } catch (error) {
    console.error('Erreur récupération activité:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'activité' });
  }
});

module.exports = router;
