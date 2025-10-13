const express = require('express');
const router = express.Router();
const admin = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * /api/users/dashboard:
 *   get:
 *     summary: Accéder au dashboard élève
 *     tags: [Utilisateurs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard élève accessible
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Bienvenue sur le dashboard élève"
 *                 user:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     nom:
 *                       type: string
 *                     role:
 *                       type: string
 *                       example: "eleve"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès réservé aux élèves
 *       404:
 *         description: Utilisateur introuvable
 */
router.get('/dashboard', checkAuth, async (req, res) => {
  const uid = req.user.uid;

  try {
    const userDoc = await admin.firestore().collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const userData = userDoc.data();

    if (userData.role !== 'eleve') {
      return res.status(403).json({ error: 'Accès réservé aux élèves' });
    }

    res.status(200).json({
      message: 'Bienvenue sur le dashboard élève',
      user: userData,
    });
  } catch (error) {
    console.error('Erreur dashboard:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
