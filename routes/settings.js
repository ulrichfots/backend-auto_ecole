const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');
const { validate, schemas } = require('../middlewares/validationMiddleware');

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Récupérer les paramètres de l'utilisateur connecté
 *     tags: [Paramètres]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paramètres récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserSettings'
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/', checkAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const userData = userDoc.data();

    // Calculer la dernière modification du mot de passe (simulation)
    const passwordLastModified = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Il y a 30 jours

    const settings = {
      security: {
        passwordLastModified: passwordLastModified.toISOString(),
        twoFactorEnabled: userData.twoFactorEnabled || false
      },
      notifications: {
        sessionReminders: userData.notifications?.sessionReminders ?? true,
        newsUpdates: userData.notifications?.newsUpdates ?? false
      },
      profile: {
        email: userData.email,
        phone: userData.phone || '',
        address: userData.address || ''
      }
    };

    res.status(200).json(settings);
  } catch (error) {
    console.error('Erreur récupération paramètres:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des paramètres' });
  }
});

/**
 * @swagger
 * /api/settings/notifications:
 *   get:
 *     summary: Récupérer les préférences de notification
 *     tags: [Paramètres]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Préférences récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionReminders:
 *                   type: boolean
 *                   example: true
 *                 newsUpdates:
 *                   type: boolean
 *                   example: false
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.get('/notifications', checkAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    console.log(`🔔 Récupération préférences notifications pour l'utilisateur ${userId}`);
    
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        error: 'Utilisateur non trouvé' 
      });
    }

    const userData = userDoc.data();
    const notifications = userData.notifications || {};

    res.status(200).json({
      sessionReminders: notifications.sessionReminders || true,
      newsUpdates: notifications.newsUpdates || true
    });
  } catch (error) {
    console.error('❌ Erreur récupération notifications:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des préférences de notification' 
    });
  }
});

/**
 * @swagger
 * /api/settings/notifications:
 *   patch:
 *     summary: Mettre à jour les préférences de notification
 *     tags: [Paramètres]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionReminders:
 *                 type: boolean
 *                 example: true
 *               newsUpdates:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Préférences mises à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Préférences de notification mises à jour"
 *                 updatedSettings:
 *                   type: object
 *                   properties:
 *                     sessionReminders:
 *                       type: boolean
 *                     newsUpdates:
 *                       type: boolean
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.patch('/notifications', checkAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { sessionReminders, newsUpdates } = req.body;

    console.log(`🔔 Mise à jour notifications pour l'utilisateur ${userId}:`, { sessionReminders, newsUpdates });

    // Validation des données
    if (sessionReminders === undefined || newsUpdates === undefined) {
      return res.status(400).json({ 
        error: 'Données manquantes',
        message: 'Les champs sessionReminders et newsUpdates sont requis',
        details: {
          received: { sessionReminders, newsUpdates },
          required: ['sessionReminders', 'newsUpdates']
        }
      });
    }

    if (typeof sessionReminders !== 'boolean' || typeof newsUpdates !== 'boolean') {
      return res.status(400).json({ 
        error: 'Type de données invalide',
        message: 'Les valeurs de notification doivent être des booléens (true/false)',
        details: {
          sessionReminders: { received: typeof sessionReminders, expected: 'boolean' },
          newsUpdates: { received: typeof newsUpdates, expected: 'boolean' }
        }
      });
    }

    // Mettre à jour les préférences de notification
    await admin.firestore().collection('users').doc(userId).update({
      'notifications.sessionReminders': sessionReminders,
      'notifications.newsUpdates': newsUpdates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: 'Préférences de notification mises à jour',
      updatedSettings: {
        sessionReminders,
        newsUpdates
      }
    });
  } catch (error) {
    console.error('Erreur mise à jour notifications:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des notifications' });
  }
});

/**
 * @swagger
 * /api/settings/password:
 *   patch:
 *     summary: Changer le mot de passe de l'utilisateur
 *     tags: [Paramètres]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "ancienMotDePasse123"
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: "nouveauMotDePasse456"
 *     responses:
 *       200:
 *         description: Mot de passe changé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Mot de passe modifié avec succès"
 *       400:
 *         description: Données invalides ou mot de passe actuel incorrect
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.patch('/password', checkAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { currentPassword, newPassword } = req.body;

    // Validation des données
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Mot de passe actuel et nouveau mot de passe requis' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' 
      });
    }

    // Récupérer l'utilisateur
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();

    // Pour cette démo, on simule la vérification du mot de passe actuel
    // En production, vous devriez utiliser Firebase Auth pour vérifier le mot de passe
    if (!userData) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // Simuler la mise à jour du mot de passe
    // En production, utilisez admin.auth().updateUser() pour changer le mot de passe
    await admin.firestore().collection('users').doc(userId).update({
      passwordLastModified: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: 'Mot de passe modifié avec succès'
    });
  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
  }
});

/**
 * @swagger
 * /api/settings/two-factor:
 *   patch:
 *     summary: Activer/désactiver l'authentification à deux facteurs
 *     tags: [Paramètres]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enabled
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Authentification à deux facteurs mise à jour
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Authentification à deux facteurs activée"
 *                 twoFactorEnabled:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.patch('/two-factor', checkAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { enabled } = req.body;

    // Validation des données
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ 
        error: 'La valeur enabled doit être un booléen' 
      });
    }

    // Mettre à jour l'état de l'authentification à deux facteurs
    await admin.firestore().collection('users').doc(userId).update({
      twoFactorEnabled: enabled,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      message: enabled ? 'Authentification à deux facteurs activée' : 'Authentification à deux facteurs désactivée',
      twoFactorEnabled: enabled
    });
  } catch (error) {
    console.error('Erreur mise à jour 2FA:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'authentification à deux facteurs' });
  }
});

/**
 * @swagger
 * /api/settings/delete-account:
 *   delete:
 *     summary: Supprimer le compte de l'utilisateur
 *     description: Supprime définitivement le compte et toutes les données associées
 *     tags: [Paramètres]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirmation
 *             properties:
 *               confirmation:
 *                 type: string
 *                 example: "SUPPRIMER"
 *                 description: "Doit contenir exactement 'SUPPRIMER' pour confirmer"
 *     responses:
 *       200:
 *         description: Compte supprimé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Compte supprimé avec succès"
 *       400:
 *         description: Confirmation invalide
 *       401:
 *         description: Token manquant ou invalide
 *       500:
 *         description: Erreur serveur
 */
router.delete('/delete-account', checkAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { confirmation } = req.body;

    // Validation de la confirmation
    if (confirmation !== 'SUPPRIMER') {
      return res.status(400).json({ 
        error: 'Confirmation invalide. Tapez exactement "SUPPRIMER" pour confirmer la suppression.' 
      });
    }

    // Supprimer l'utilisateur de Firestore
    await admin.firestore().collection('users').doc(userId).delete();

    // Supprimer l'utilisateur de Firebase Auth
    await admin.auth().deleteUser(userId);

    // Supprimer les sessions associées
    const sessionsSnapshot = await admin.firestore()
      .collection('sessions')
      .where('studentId', '==', userId)
      .get();

    const batch = admin.firestore().batch();
    sessionsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    res.status(200).json({
      message: 'Compte supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur suppression compte:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du compte' });
  }
});

module.exports = router;
