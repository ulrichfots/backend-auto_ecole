const express = require('express');
const router = express.Router();
const admin = require('../firebase');

/**
 * @swagger
 * /api/seed/session-test-data:
 *   post:
 *     summary: Créer des données de test pour les sessions
 *     tags: [Seed Data]
 *     description: Crée des sessions de test avec différents statuts pour démonstration
 *     responses:
 *       200:
 *         description: Données de test sessions créées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Données de test sessions créées avec succès"
 *                 createdSessions:
 *                   type: number
 *                   example: 6
 *       500:
 *         description: Erreur serveur
 */
router.post('/session-test-data', async (req, res) => {
  try {
    // Données de test pour les sessions
    const testSessions = [
      {
        studentId: 'test-student-1',
        instructorId: 'test-instructor-1',
        courseType: 'conduite',
        courseTitle: 'Conduite pratique',
        scheduledDate: new Date(),
        scheduledTime: '09:00',
        duration: 1.5,
        status: 'présent',
        location: 'Auto-école Centre',
        notes: 'Premier cours de conduite'
      },
      {
        studentId: 'test-student-2',
        instructorId: 'test-instructor-2',
        courseType: 'code',
        courseTitle: 'Code de la route',
        scheduledDate: new Date(),
        scheduledTime: '10:30',
        duration: 1,
        status: 'absent',
        location: 'Auto-école Centre',
        notes: 'Élève absent sans excuse'
      },
      {
        studentId: 'test-student-3',
        instructorId: 'test-instructor-1',
        courseType: 'conduite',
        courseTitle: 'Conduite pratique',
        scheduledDate: new Date(),
        scheduledTime: '14:00',
        duration: 1.5,
        status: 'présent',
        location: 'Auto-école Centre',
        notes: 'Cours de perfectionnement'
      },
      {
        studentId: 'test-student-4',
        instructorId: 'test-instructor-3',
        courseType: 'examen_blanc',
        courseTitle: 'Examen blanc',
        scheduledDate: new Date(),
        scheduledTime: '15:30',
        duration: 2,
        status: 'en_retard',
        location: 'Auto-école Centre',
        notes: 'Élève en retard de 15 minutes'
      },
      {
        studentId: 'test-student-5',
        instructorId: 'test-instructor-2',
        courseType: 'conduite',
        courseTitle: 'Conduite pratique',
        scheduledDate: new Date(),
        scheduledTime: '16:00',
        duration: 1.5,
        status: 'présent',
        location: 'Auto-école Centre',
        notes: 'Cours normal'
      },
      {
        studentId: 'test-student-6',
        instructorId: 'test-instructor-1',
        courseType: 'code',
        courseTitle: 'Code de la route',
        scheduledDate: new Date(),
        scheduledTime: '17:30',
        duration: 1,
        status: 'annulé',
        location: 'Auto-école Centre',
        notes: 'Session annulée par l\'élève'
      }
    ];

    const batch = admin.firestore().batch();
    let createdCount = 0;

    // Créer les sessions
    for (const sessionData of testSessions) {
      const sessionRef = admin.firestore().collection('sessions').doc();
      
      batch.set(sessionRef, {
        ...sessionData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      createdCount++;
    }

    // Créer des utilisateurs de test si nécessaire
    const testUsers = [
      {
        id: 'test-student-1',
        nom: 'Marie Dubois',
        email: 'marie.dubois@email.com',
        role: 'eleve',
        statut: 'actif',
        theoreticalHours: 30,
        practicalHours: 15,
        theoreticalHoursMin: 40,
        practicalHoursMin: 20
      },
      {
        id: 'test-student-2',
        nom: 'Pierre Lefebvre',
        email: 'pierre.lefebvre@email.com',
        role: 'eleve',
        statut: 'actif',
        theoreticalHours: 18,
        practicalHours: 9,
        theoreticalHoursMin: 40,
        practicalHoursMin: 20
      },
      {
        id: 'test-student-3',
        nom: 'Julie Moreau',
        email: 'julie.moreau@email.com',
        role: 'eleve',
        statut: 'actif',
        theoreticalHours: 36,
        practicalHours: 18,
        theoreticalHoursMin: 40,
        practicalHoursMin: 20
      },
      {
        id: 'test-student-4',
        nom: 'Thomas Roux',
        email: 'thomas.roux@email.com',
        role: 'eleve',
        statut: 'actif',
        theoreticalHours: 24,
        practicalHours: 12,
        theoreticalHoursMin: 40,
        practicalHoursMin: 20
      },
      {
        id: 'test-student-5',
        nom: 'Emma Petit',
        email: 'emma.petit@email.com',
        role: 'eleve',
        statut: 'actif',
        theoreticalHours: 12,
        practicalHours: 6,
        theoreticalHoursMin: 40,
        practicalHoursMin: 20
      },
      {
        id: 'test-student-6',
        nom: 'Lucas Blanc',
        email: 'lucas.blanc@email.com',
        role: 'eleve',
        statut: 'actif',
        theoreticalHours: 6,
        practicalHours: 3,
        theoreticalHoursMin: 40,
        practicalHoursMin: 20
      },
      {
        id: 'test-instructor-1',
        nom: 'Jean Martin',
        email: 'jean.martin@autoecole.fr',
        role: 'instructeur',
        statut: 'actif'
      },
      {
        id: 'test-instructor-2',
        nom: 'Sophie Bernard',
        email: 'sophie.bernard@autoecole.fr',
        role: 'instructeur',
        statut: 'actif'
      },
      {
        id: 'test-instructor-3',
        nom: 'Michel Durand',
        email: 'michel.durand@autoecole.fr',
        role: 'instructeur',
        statut: 'actif'
      }
    ];

    // Créer les utilisateurs de test
    for (const userData of testUsers) {
      const userRef = admin.firestore().collection('users').doc(userData.id);
      batch.set(userRef, {
        ...userData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isFirstLogin: false
      });
    }

    await batch.commit();

    res.status(200).json({
      message: 'Données de test sessions créées avec succès',
      createdSessions: createdCount,
      note: 'Utilisez ces données pour tester le dashboard de présence'
    });
  } catch (error) {
    console.error('Erreur création données test sessions:', error);
    res.status(500).json({ error: 'Erreur lors de la création des données de test sessions' });
  }
});

/**
 * @swagger
 * /api/seed/clear-session-test-data:
 *   delete:
 *     summary: Supprimer les données de test des sessions
 *     tags: [Seed Data]
 *     description: Supprime toutes les sessions et utilisateurs de test
 *     responses:
 *       200:
 *         description: Données de test sessions supprimées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Données de test sessions supprimées avec succès"
 *                 deletedSessions:
 *                   type: number
 *                   example: 6
 *                 deletedUsers:
 *                   type: number
 *                   example: 9
 *       500:
 *         description: Erreur serveur
 */
router.delete('/clear-session-test-data', async (req, res) => {
  try {
    const batch = admin.firestore().batch();
    let deletedSessions = 0;
    let deletedUsers = 0;

    // Supprimer les sessions de test
    const sessionsSnapshot = await admin.firestore().collection('sessions').get();
    sessionsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedSessions++;
    });

    // Supprimer les utilisateurs de test
    const testUserIds = [
      'test-student-1', 'test-student-2', 'test-student-3', 
      'test-student-4', 'test-student-5', 'test-student-6',
      'test-instructor-1', 'test-instructor-2', 'test-instructor-3'
    ];

    for (const userId of testUserIds) {
      const userRef = admin.firestore().collection('users').doc(userId);
      batch.delete(userRef);
      deletedUsers++;
    }

    await batch.commit();

    res.status(200).json({
      message: 'Données de test sessions supprimées avec succès',
      deletedSessions,
      deletedUsers
    });
  } catch (error) {
    console.error('Erreur suppression données test sessions:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression des données de test sessions' });
  }
});

module.exports = router;
