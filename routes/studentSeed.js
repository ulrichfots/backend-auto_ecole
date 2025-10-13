const express = require('express');
const router = express.Router();
const admin = require('../firebase');

/**
 * @swagger
 * /api/seed/student-test-data:
 *   post:
 *     summary: Créer des données de test pour le dashboard élève
 *     tags: [Seed Data]
 *     description: Crée des cours, tests et objectifs de test pour un élève
 *     responses:
 *       200:
 *         description: Données de test élève créées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Données de test élève créées avec succès"
 *                 createdData:
 *                   type: object
 *                   properties:
 *                     courses:
 *                       type: number
 *                       example: 10
 *                     tests:
 *                       type: number
 *                       example: 5
 *                     objectives:
 *                       type: number
 *                       example: 2
 *       500:
 *         description: Erreur serveur
 */
router.post('/student-test-data', async (req, res) => {
  try {
    // ID d'élève de test
    const testStudentId = 'test-student-123';

    // Créer des cours de test
    const testCourses = [
      { title: 'Cours de code', type: 'code', status: 'completed', duration: 1 },
      { title: 'Conduite en ville', type: 'conduite', status: 'completed', duration: 1 },
      { title: 'Cours de conduite', type: 'conduite', status: 'completed', duration: 1 },
      { title: 'Conduite sur autoroute', type: 'autoroute', status: 'completed', duration: 1 },
      { title: 'Révision code', type: 'code', status: 'scheduled', duration: 1 },
      { title: 'Conduite pratique', type: 'conduite', status: 'scheduled', duration: 1 },
      { title: 'Test de conduite', type: 'conduite', status: 'scheduled', duration: 1 },
      { title: 'Cours avancé', type: 'conduite', status: 'completed', duration: 1 },
      { title: 'Préparation examen', type: 'code', status: 'completed', duration: 1 },
      { title: 'Dernier cours', type: 'conduite', status: 'completed', duration: 1 }
    ];

    // Créer des tests de test
    const testTests = [
      { type: 'code', result: 'passed', score: 35 },
      { type: 'code', result: 'passed', score: 38 },
      { type: 'code', result: 'failed', score: 28 },
      { type: 'code', result: 'passed', score: 37 },
      { type: 'code', result: 'passed', score: 39 }
    ];

    // Créer des objectifs de test
    const testObjectives = [
      { 
        title: 'Examen théorique', 
        description: 'Theoretical exam',
        type: 'theoretical_exam',
        status: 'scheduled',
        targetDate: new Date('2024-01-25')
      },
      { 
        title: 'Examen pratique', 
        description: 'Practical exam',
        type: 'practical_exam',
        status: 'pending',
        targetDate: new Date('2024-03-15')
      }
    ];

    const batch = admin.firestore().batch();
    let courseCount = 0;
    let testCount = 0;
    let objectiveCount = 0;

    // Ajouter les cours
    testCourses.forEach((courseData, index) => {
      const courseRef = admin.firestore().collection('courses').doc();
      const scheduleDate = new Date();
      scheduleDate.setDate(scheduleDate.getDate() - (10 - index)); // Dates réparties sur 10 jours
      
      batch.set(courseRef, {
        ...courseData,
        studentId: testStudentId,
        instructorId: 'test-instructor-123',
        instructorName: index % 2 === 0 ? 'Marie Dubois' : 'Pierre Martin',
        schedule: scheduleDate.toISOString(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      courseCount++;
    });

    // Ajouter les tests
    testTests.forEach((testData, index) => {
      const testRef = admin.firestore().collection('tests').doc();
      const testDate = new Date();
      testDate.setDate(testDate.getDate() - (5 - index));
      
      batch.set(testRef, {
        ...testData,
        studentId: testStudentId,
        createdAt: admin.firestore.Timestamp.fromDate(testDate)
      });
      testCount++;
    });

    // Ajouter les objectifs
    testObjectives.forEach(objectiveData => {
      const objectiveRef = admin.firestore().collection('objectives').doc();
      batch.set(objectiveRef, {
        ...objectiveData,
        studentId: testStudentId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      objectiveCount++;
    });

    await batch.commit();

    res.status(200).json({
      message: 'Données de test élève créées avec succès',
      createdData: {
        courses: courseCount,
        tests: testCount,
        objectives: objectiveCount
      },
      note: `Utilisez l'ID "${testStudentId}" pour tester les routes élève`
    });
  } catch (error) {
    console.error('Erreur création données test élève:', error);
    res.status(500).json({ error: 'Erreur lors de la création des données de test élève' });
  }
});

/**
 * @swagger
 * /api/seed/clear-student-test-data:
 *   delete:
 *     summary: Supprimer les données de test élève
 *     tags: [Seed Data]
 *     description: Supprime toutes les données de test pour les élèves
 *     responses:
 *       200:
 *         description: Données de test élève supprimées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Données de test élève supprimées avec succès"
 *                 deletedData:
 *                   type: object
 *                   properties:
 *                     courses:
 *                       type: number
 *                       example: 10
 *                     tests:
 *                       type: number
 *                       example: 5
 *                     objectives:
 *                       type: number
 *                       example: 2
 *       500:
 *         description: Erreur serveur
 */
router.delete('/clear-student-test-data', async (req, res) => {
  try {
    const batch = admin.firestore().batch();
    let deletedCount = 0;

    // Supprimer les cours de test
    const coursesSnapshot = await admin.firestore()
      .collection('courses')
      .where('studentId', '==', 'test-student-123')
      .get();
    
    coursesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Supprimer les tests de test
    const testsSnapshot = await admin.firestore()
      .collection('tests')
      .where('studentId', '==', 'test-student-123')
      .get();
    
    testsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    // Supprimer les objectifs de test
    const objectivesSnapshot = await admin.firestore()
      .collection('objectives')
      .where('studentId', '==', 'test-student-123')
      .get();
    
    objectivesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    await batch.commit();

    res.status(200).json({
      message: 'Données de test élève supprimées avec succès',
      deletedData: deletedCount
    });
  } catch (error) {
    console.error('Erreur suppression données test élève:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression des données de test élève' });
  }
});

module.exports = router;
