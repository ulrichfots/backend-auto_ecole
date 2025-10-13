const express = require('express');
const router = express.Router();
const admin = require('../firebase');

/**
 * @swagger
 * /api/seed/test-data:
 *   post:
 *     summary: Créer des données de test pour le dashboard
 *     tags: [Seed Data]
 *     description: Crée des utilisateurs de test pour démonstration du dashboard
 *     responses:
 *       200:
 *         description: Données de test créées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Données de test créées avec succès"
 *                 createdUsers:
 *                   type: number
 *                   example: 15
 *       500:
 *         description: Erreur serveur
 */
router.post('/test-data', async (req, res) => {
  try {
    const testUsers = [
      // Moniteurs
      { nom: 'Pierre Martin', email: 'pierre.martin@autoecole.fr', role: 'instructeur', status: 'active' },
      { nom: 'Marie Dubois', email: 'marie.dubois@autoecole.fr', role: 'instructeur', status: 'active' },
      { nom: 'Jean Bernard', email: 'jean.bernard@autoecole.fr', role: 'instructeur', status: 'active' },
      { nom: 'Sophie Laurent', email: 'sophie.laurent@autoecole.fr', role: 'instructeur', status: 'active' },
      { nom: 'Thomas Moreau', email: 'thomas.moreau@autoecole.fr', role: 'instructeur', status: 'active' },
      
      // Élèves récents
      { nom: 'Jean Martin', email: 'jean.martin@autoecole.fr', role: 'eleve', status: 'active' },
      { nom: 'Sophie Laurent', email: 'sophie.laurent@email.fr', role: 'eleve', status: 'pending' },
      { nom: 'Pierre Durand', email: 'pierre.durand@email.fr', role: 'eleve', status: 'active' },
      { nom: 'Emma Rousseau', email: 'emma.rousseau@email.fr', role: 'eleve', status: 'active' },
      { nom: 'Lucas Petit', email: 'lucas.petit@email.fr', role: 'eleve', status: 'active' },
      
      // En attente
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
      
      // Créer des dates aléatoires pour simuler des créations récentes
      const randomDays = Math.floor(Math.random() * 30); // 0-29 jours
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
      message: 'Données de test créées avec succès',
      createdUsers: createdCount,
      note: 'Ces données permettront de tester le dashboard avec des statistiques réalistes'
    });
  } catch (error) {
    console.error('Erreur création données test:', error);
    res.status(500).json({ error: 'Erreur lors de la création des données de test' });
  }
});

/**
 * @swagger
 * /api/seed/clear-test-data:
 *   delete:
 *     summary: Supprimer les données de test
 *     tags: [Seed Data]
 *     description: Supprime tous les utilisateurs de test créés
 *     responses:
 *       200:
 *         description: Données de test supprimées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Données de test supprimées avec succès"
 *                 deletedUsers:
 *                   type: number
 *                   example: 15
 *       500:
 *         description: Erreur serveur
 */
router.delete('/clear-test-data', async (req, res) => {
  try {
    const usersSnapshot = await admin.firestore().collection('users').get();
    
    const batch = admin.firestore().batch();
    let deletedCount = 0;

    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      // Supprimer seulement les utilisateurs de test (ceux avec des emails de test)
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
      message: 'Données de test supprimées avec succès',
      deletedUsers: deletedCount
    });
  } catch (error) {
    console.error('Erreur suppression données test:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression des données de test' });
  }
});

module.exports = router;
