const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');

// ============================================================
// ✅ SEED UTILISATEURS (dashboard)
// ============================================================

router.post('/test-data', async (req, res) => {
  try {
    const testUsers = [
      { nom: 'Pierre Martin', email: 'pierre.martin@autoecole.fr', role: 'instructeur', status: 'active' },
      { nom: 'Marie Dubois', email: 'marie.dubois@autoecole.fr', role: 'instructeur', status: 'active' },
      { nom: 'Jean Bernard', email: 'jean.bernard@autoecole.fr', role: 'instructeur', status: 'active' },
      { nom: 'Sophie Laurent', email: 'sophie.laurent@autoecole.fr', role: 'instructeur', status: 'active' },
      { nom: 'Thomas Moreau', email: 'thomas.moreau@autoecole.fr', role: 'instructeur', status: 'active' },
      { nom: 'Jean Martin', email: 'jean.martin@autoecole.fr', role: 'eleve', status: 'active' },
      { nom: 'Sophie Laurent', email: 'sophie.laurent@email.fr', role: 'eleve', status: 'pending' },
      { nom: 'Pierre Durand', email: 'pierre.durand@email.fr', role: 'eleve', status: 'active' },
      { nom: 'Emma Rousseau', email: 'emma.rousseau@email.fr', role: 'eleve', status: 'active' },
      { nom: 'Lucas Petit', email: 'lucas.petit@email.fr', role: 'eleve', status: 'active' },
      { nom: 'Claire Moreau', email: 'claire.moreau@email.fr', role: 'eleve', status: 'pending' },
      { nom: 'Antoine Blanc', email: 'antoine.blanc@email.fr', role: 'eleve', status: 'pending' },
      { nom: 'Julie Noir', email: 'julie.noir@email.fr', role: 'eleve', status: 'pending' },
      { nom: 'Marc Rouge', email: 'marc.rouge@email.fr', role: 'instructeur', status: 'pending' },
      { nom: 'Laura Vert', email: 'laura.vert@email.fr', role: 'eleve', status: 'pending' },
    ];

    const batch = admin.firestore().batch();
    let createdCount = 0;

    for (const userData of testUsers) {
      const userRef = admin.firestore().collection('users').doc();
      const randomDays = Math.floor(Math.random() * 30);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - randomDays);

      batch.set(userRef, {
        ...userData,
        isActive: userData.status === 'active',
        createdAt: admin.firestore.Timestamp.fromDate(createdAt),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      createdCount++;
    }

    await batch.commit();

    res.status(200).json({
      message: 'Données de test utilisateurs créées avec succès',
      createdUsers: createdCount
    });
  } catch (error) {
    console.error('Erreur création données test:', error);
    res.status(500).json({ error: 'Erreur lors de la création des données de test' });
  }
});

router.delete('/clear-test-data', async (req, res) => {
  try {
    const usersSnapshot = await admin.firestore().collection('users').get();
    const batch = admin.firestore().batch();
    let deletedCount = 0;

    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      if (userData.email && (
        userData.email.includes('@autoecole.fr') ||
        userData.email.includes('@email.fr')
      )) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    });

    await batch.commit();

    res.status(200).json({
      message: 'Données de test utilisateurs supprimées avec succès',
      deletedUsers: deletedCount
    });
  } catch (error) {
    console.error('Erreur suppression données test:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression des données de test' });
  }
});

// ============================================================
// ✅ SEED SESSIONS (dev front)
// ============================================================

router.post('/session-test-data', async (req, res) => {
  try {
    const testSessions = [
      {
        studentId: 'test-student-1',
        instructorId: 'test-instructor-1',
        courseType: 'conduite',
        courseTitle: 'Conduite pratique — Ville',
        scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // demain
        scheduledTime: '09:00',
        duration: 1.5,
        status: 'confirmée',
        location: 'Départ agence principale',
        notes: 'Premier cours de conduite',
        slotId: 'slot_test_1'
      },
      {
        studentId: 'test-student-1',
        instructorId: 'test-instructor-1',
        courseType: 'conduite',
        courseTitle: 'Conduite pratique — Autoroute',
        scheduledDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // dans 5 jours
        scheduledTime: '14:00',
        duration: 1.5,
        status: 'confirmée',
        location: 'Départ agence principale',
        notes: '',
        slotId: 'slot_test_2'
      },
      {
        studentId: 'test-student-2',
        instructorId: 'test-instructor-2',
        courseType: 'code',
        courseTitle: 'Code de la route — Révisions',
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // dans 2 jours
        scheduledTime: '10:30',
        duration: 1,
        status: 'confirmée',
        location: 'Salle de code',
        notes: '',
        slotId: 'slot_test_3'
      },
      {
        studentId: 'test-student-2',
        instructorId: 'test-instructor-1',
        courseType: 'conduite',
        courseTitle: 'Conduite pratique — Créneau',
        scheduledDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // il y a 2 jours
        scheduledTime: '08:00',
        duration: 1,
        status: 'annulée',
        location: 'Parking centre commercial',
        notes: 'Annulée par l\'élève',
        slotId: 'slot_test_4'
      },
      {
        studentId: 'test-student-3',
        instructorId: 'test-instructor-2',
        courseType: 'conduite',
        courseTitle: 'Conduite pratique — Nuit',
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // dans 7 jours
        scheduledTime: '19:00',
        duration: 1,
        status: 'confirmée',
        location: 'Départ agence principale',
        notes: '',
        slotId: 'slot_test_5'
      },
      {
        studentId: 'test-student-3',
        instructorId: 'test-instructor-1',
        courseType: 'examen_blanc',
        courseTitle: 'Examen blanc — Simulation permis',
        scheduledDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // dans 10 jours
        scheduledTime: '08:30',
        duration: 2,
        status: 'confirmée',
        location: 'Départ agence principale',
        notes: '',
        slotId: 'slot_test_6'
      }
    ];

    const testUsers = [
      { id: 'test-student-1', nom: 'Marie Dubois', email: 'marie.dubois@email.com', role: 'eleve', statut: 'actif', theoreticalHours: 30, practicalHours: 15, theoreticalHoursMin: 40, practicalHoursMin: 20 },
      { id: 'test-student-2', nom: 'Pierre Lefebvre', email: 'pierre.lefebvre@email.com', role: 'eleve', statut: 'actif', theoreticalHours: 18, practicalHours: 9, theoreticalHoursMin: 40, practicalHoursMin: 20 },
      { id: 'test-student-3', nom: 'Julie Moreau', email: 'julie.moreau@email.com', role: 'eleve', statut: 'actif', theoreticalHours: 36, practicalHours: 18, theoreticalHoursMin: 40, practicalHoursMin: 20 },
      { id: 'test-instructor-1', nom: 'Jean Martin', email: 'jean.martin@autoecole.fr', role: 'instructeur', statut: 'actif' },
      { id: 'test-instructor-2', nom: 'Sophie Bernard', email: 'sophie.bernard@autoecole.fr', role: 'instructeur', statut: 'actif' }
    ];

    const batch = admin.firestore().batch();

    for (const sessionData of testSessions) {
      const sessionRef = admin.firestore().collection('sessions').doc();
      batch.set(sessionRef, {
        ...sessionData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    for (const userData of testUsers) {
      const { id, ...data } = userData;
      const userRef = admin.firestore().collection('users').doc(id);
      batch.set(userRef, {
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isFirstLogin: false
      });
    }

    await batch.commit();

    res.status(200).json({
      message: 'Sessions de test créées avec succès',
      createdSessions: testSessions.length,
      createdUsers: testUsers.length
    });
  } catch (error) {
    console.error('Erreur création sessions test:', error);
    res.status(500).json({ error: 'Erreur lors de la création des sessions de test' });
  }
});

router.delete('/clear-session-test-data', async (req, res) => {
  try {
    const batch = admin.firestore().batch();
    let deletedSessions = 0;

    const sessionsSnapshot = await admin.firestore().collection('sessions').get();
    sessionsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedSessions++;
    });

    const testUserIds = ['test-student-1', 'test-student-2', 'test-student-3', 'test-instructor-1', 'test-instructor-2'];
    for (const userId of testUserIds) {
      batch.delete(admin.firestore().collection('users').doc(userId));
    }

    await batch.commit();

    res.status(200).json({
      message: 'Sessions de test supprimées avec succès',
      deletedSessions
    });
  } catch (error) {
    console.error('Erreur suppression sessions test:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression des sessions de test' });
  }
});

module.exports = router;