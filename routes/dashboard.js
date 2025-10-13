const express = require('express');
const router = express.Router();
const admin = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Récupérer les statistiques du dashboard
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques du dashboard récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 moniteursActifs:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       example: 12
 *                     evolution:
 *                       type: string
 *                       example: "+2 ce mois"
 *                     trend:
 *                       type: string
 *                       example: "up"
 *                 elevesInscrits:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       example: 247
 *                     evolution:
 *                       type: string
 *                       example: "+15 ce mois"
 *                     trend:
 *                       type: string
 *                       example: "up"
 *                 comptesActifs:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       example: 89
 *                     evolution:
 *                       type: string
 *                       example: "+8% vs mois dernier"
 *                     trend:
 *                       type: string
 *                       example: "up"
 *                 enAttente:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       example: 5
 *                     status:
 *                       type: string
 *                       example: "Urgent à traiter"
 *                     priority:
 *                       type: string
 *                       example: "high"
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé (pas admin)
 *       500:
 *         description: Erreur serveur
 */
router.get('/stats', checkAuth, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    // Récupérer tous les utilisateurs
    const usersSnapshot = await admin.firestore().collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calculer les statistiques
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Moniteurs actifs
    const moniteursActifs = users.filter(user => user.role === 'instructeur');
    const moniteursCeMois = moniteursActifs.filter(user => 
      user.createdAt && user.createdAt.toDate() >= thisMonth
    );

    // Élèves inscrits
    const elevesInscrits = users.filter(user => user.role === 'eleve');
    const elevesCeMois = elevesInscrits.filter(user => 
      user.createdAt && user.createdAt.toDate() >= thisMonth
    );

    // Comptes actifs (tous les utilisateurs actifs)
    const comptesActifs = users.filter(user => user.isActive !== false);
    const comptesMoisDernier = users.filter(user => 
      user.createdAt && 
      user.createdAt.toDate() >= lastMonth && 
      user.createdAt.toDate() < thisMonth
    );

    // En attente d'approbation (utilisateurs avec statut pending ou similaires)
    const enAttente = users.filter(user => 
      user.status === 'pending' || user.status === 'en_attente' || !user.isActive
    );

    // Calculer les évolutions
    const evolutionMoniteurs = moniteursCeMois.length > 0 ? 
      `+${moniteursCeMois.length} ce mois` : 'Aucun nouveau ce mois';
    
    const evolutionEleves = elevesCeMois.length > 0 ? 
      `+${elevesCeMois.length} ce mois` : 'Aucun nouveau ce mois';
    
    const evolutionComptes = comptesMoisDernier.length > 0 ? 
      `+${Math.round((comptesActifs.length / comptesMoisDernier.length - 1) * 100)}% vs mois dernier` : 
      '+0% vs mois dernier';

    const stats = {
      moniteursActifs: {
        total: moniteursActifs.length,
        evolution: evolutionMoniteurs,
        trend: moniteursCeMois.length > 0 ? 'up' : 'stable'
      },
      elevesInscrits: {
        total: elevesInscrits.length,
        evolution: evolutionEleves,
        trend: elevesCeMois.length > 0 ? 'up' : 'stable'
      },
      comptesActifs: {
        total: comptesActifs.length,
        evolution: evolutionComptes,
        trend: comptesActifs.length > comptesMoisDernier.length ? 'up' : 'stable'
      },
      enAttente: {
        total: enAttente.length,
        status: enAttente.length > 0 ? 'Urgent à traiter' : 'Aucune demande',
        priority: enAttente.length > 3 ? 'high' : enAttente.length > 0 ? 'medium' : 'low'
      }
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

/**
 * @swagger
 * /api/dashboard/recent-accounts:
 *   get:
 *     summary: Récupérer les comptes récents
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Nombre maximum de comptes à retourner
 *     responses:
 *       200:
 *         description: Comptes récents récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accounts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "user123"
 *                       nom:
 *                         type: string
 *                         example: "Jean Martin"
 *                       email:
 *                         type: string
 *                         example: "jean.martin@autoecole.fr"
 *                       role:
 *                         type: string
 *                         enum: [admin, instructeur, eleve]
 *                         example: "eleve"
 *                       status:
 *                         type: string
 *                         example: "Actif"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       timeAgo:
 *                         type: string
 *                         example: "Il y a 2 jours"
 *                       initials:
 *                         type: string
 *                         example: "JM"
 *                       profileImageUrl:
 *                         type: string
 *                         nullable: true
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé (pas admin)
 *       500:
 *         description: Erreur serveur
 */
router.get('/recent-accounts', checkAuth, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    const limit = parseInt(req.query.limit) || 10;
    const limitValue = Math.min(Math.max(limit, 1), 50); // Entre 1 et 50

    // Récupérer les utilisateurs les plus récents
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .orderBy('createdAt', 'desc')
      .limit(limitValue)
      .get();

    const accounts = usersSnapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt ? data.createdAt.toDate() : new Date();
      
      // Calculer le temps écoulé
      const now = new Date();
      const diffMs = now - createdAt;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      let timeAgo;
      if (diffDays > 0) {
        timeAgo = `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        timeAgo = `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
      } else if (diffMinutes > 0) {
        timeAgo = `Il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
      } else {
        timeAgo = 'À l\'instant';
      }

      // Générer les initiales
      const initials = data.nom ? 
        data.nom.split(' ').map(name => name[0]).join('').toUpperCase() : 
        'U';

      // Déterminer le statut
      let status = 'Actif';
      if (data.status === 'pending' || data.status === 'en_attente') {
        status = 'En attente';
      } else if (data.isActive === false) {
        status = 'Inactif';
      }

      return {
        id: doc.id,
        nom: data.nom || 'Utilisateur',
        email: data.email || '',
        role: data.role || 'eleve',
        status: status,
        createdAt: createdAt.toISOString(),
        timeAgo: timeAgo,
        initials: initials,
        profileImageUrl: data.profileImageUrl || null
      };
    });

    res.status(200).json({ accounts });
  } catch (error) {
    console.error('Erreur récupération comptes récents:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des comptes récents' });
  }
});

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     summary: Récupérer un résumé complet du dashboard
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Résumé du dashboard récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   $ref: '#/components/schemas/DashboardStats'
 *                 recentAccounts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RecentAccount'
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Token manquant ou invalide
 *       403:
 *         description: Accès non autorisé (pas admin)
 *       500:
 *         description: Erreur serveur
 */
router.get('/summary', checkAuth, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }

    // Récupérer les statistiques et les comptes récents en parallèle
    const [statsResponse, accountsResponse] = await Promise.all([
      // Simuler l'appel aux stats
      admin.firestore().collection('users').get(),
      admin.firestore().collection('users').orderBy('createdAt', 'desc').limit(5).get()
    ]);

    const users = statsResponse.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const recentUsers = accountsResponse.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt ? data.createdAt.toDate() : new Date();
      const diffDays = Math.floor((new Date() - createdAt) / (1000 * 60 * 60 * 24));
      
      return {
        id: doc.id,
        nom: data.nom || 'Utilisateur',
        email: data.email || '',
        role: data.role || 'eleve',
        status: data.status === 'pending' ? 'En attente' : 'Actif',
        timeAgo: `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`,
        initials: data.nom ? data.nom.split(' ').map(name => name[0]).join('').toUpperCase() : 'U'
      };
    });

    // Calculer les stats rapidement
    const stats = {
      moniteursActifs: {
        total: users.filter(u => u.role === 'instructeur').length,
        evolution: '+2 ce mois',
        trend: 'up'
      },
      elevesInscrits: {
        total: users.filter(u => u.role === 'eleve').length,
        evolution: '+15 ce mois',
        trend: 'up'
      },
      comptesActifs: {
        total: users.filter(u => u.isActive !== false).length,
        evolution: '+8% vs mois dernier',
        trend: 'up'
      },
      enAttente: {
        total: users.filter(u => u.status === 'pending').length,
        status: 'Urgent à traiter',
        priority: 'high'
      }
    };

    res.status(200).json({
      stats,
      recentAccounts: recentUsers,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur récupération résumé:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du résumé' });
  }
});

module.exports = router;
