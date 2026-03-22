const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');
const emailService = require('../services/emailService');

// ============================================================
// ✅ TEMPLATES EMAIL
// ============================================================
const emailTemplates = {

  welcome: (nom, email, motDePasse) => ({
    subject: '🎓 Bienvenue à l\'auto-école — Vos identifiants de connexion',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a73e8; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">🚗 Auto-École</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Bonjour ${nom} !</h2>
          <p style="color: #555;">Bienvenue dans notre auto-école. Votre compte a été créé avec succès.</p>
          <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #1a73e8; margin-top: 0;">Vos identifiants :</h3>
            <p><strong>Email :</strong> ${email}</p>
            <p><strong>Mot de passe :</strong> ${motDePasse}</p>
          </div>
          <p style="color: #e53935; font-size: 13px;">⚠️ Veuillez changer votre mot de passe lors de votre première connexion.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/login" style="background: #1a73e8; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">Se connecter</a>
          </div>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École</p>
      </div>`
  }),

  reservationValidee: (nom, reservation) => ({
    subject: '✅ Votre réservation a été validée',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #34a853; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">✅ Réservation confirmée</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Bonjour ${nom} !</h2>
          <p style="color: #555;">Votre réservation a été <strong style="color: #34a853;">validée</strong>.</p>
          <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p>📚 <strong>Type :</strong> ${reservation.courseTitle}</p>
            <p>📅 <strong>Date :</strong> ${reservation.date}</p>
            <p>🕐 <strong>Heure :</strong> ${reservation.time}</p>
            <p>👨‍🏫 <strong>Instructeur :</strong> ${reservation.instructorNom}</p>
            ${reservation.location ? `<p>📍 <strong>Lieu :</strong> ${reservation.location}</p>` : ''}
            ${reservation.meetingLink ? `<p>🔗 <strong>Lien :</strong> <a href="${reservation.meetingLink}">${reservation.meetingLink}</a></p>` : ''}
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #34a853; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">Voir mon espace</a>
          </div>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École</p>
      </div>`
  }),

  reservationRefusee: (nom, reservation, motif) => ({
    subject: '❌ Votre réservation n\'a pas pu être acceptée',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #e53935; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">❌ Réservation refusée</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Bonjour ${nom} !</h2>
          <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p>📚 <strong>Type :</strong> ${reservation.courseTitle}</p>
            <p>📅 <strong>Date :</strong> ${reservation.date}</p>
            <div style="background: #ffeaea; border-left: 4px solid #e53935; padding: 10px; margin-top: 15px; border-radius: 4px;">
              <strong>Motif :</strong> ${motif || 'Aucun motif précisé'}
            </div>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #1a73e8; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">Nouvelle réservation</a>
          </div>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École</p>
      </div>`
  }),

  reservationAnnulee: (nom, reservation) => ({
    subject: '🚫 Confirmation d\'annulation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f57c00; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">🚫 Réservation annulée</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Bonjour ${nom} !</h2>
          <p style="color: #555;">Votre réservation a bien été annulée.</p>
          <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p>📚 <strong>Type :</strong> ${reservation.courseTitle}</p>
            <p>📅 <strong>Date :</strong> ${reservation.date}</p>
          </div>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École</p>
      </div>`
  }),

  admisCode: (nom) => ({
    subject: '🎉 Vous êtes admis à passer l\'examen du code !',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #7b1fa2; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">🎉 Admis à l'examen !</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Bonjour ${nom} !</h2>
          <p style="color: #555;">Vous avez été <strong style="color: #7b1fa2;">admis à passer l'examen du code de la route</strong>.</p>
          <p style="color: #555;">Notre équipe vous contactera pour les détails. Bonne chance ! 🍀</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #7b1fa2; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">Voir mon espace</a>
          </div>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École</p>
      </div>`
  }),

  rappelSeance: (nom, session) => ({
    subject: `⏰ Rappel — Séance demain à ${session.scheduledTime}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a73e8; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">⏰ Rappel de séance</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Bonjour ${nom} !</h2>
          <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p>📚 <strong>Type :</strong> ${session.courseTitle}</p>
            <p>📅 <strong>Date :</strong> ${session.scheduledDate}</p>
            <p>🕐 <strong>Heure :</strong> ${session.scheduledTime}</p>
            <p>👨‍🏫 <strong>Instructeur :</strong> ${session.instructorNom}</p>
            ${session.location ? `<p>📍 <strong>Lieu :</strong> ${session.location}</p>` : ''}
            ${session.meetingLink ? `<p>🔗 <strong>Lien :</strong> <a href="${session.meetingLink}">${session.meetingLink}</a></p>` : ''}
          </div>
          <p style="color: #e53935;">⚠️ Pensez à être à l'heure !</p>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École</p>
      </div>`
  }),

  nouvelleActualite: (nom, article) => ({
    subject: `📰 Nouvelle actualité — ${article.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a73e8; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">📰 Nouvelle actualité</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Bonjour ${nom} !</h2>
          <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            ${article.imageUrl ? `<img src="${article.imageUrl}" style="width: 100%; border-radius: 4px; margin-bottom: 15px;" />` : ''}
            <h3 style="color: #1a73e8; margin-top: 0;">${article.title}</h3>
            <p style="color: #555;">${article.excerpt || ''}</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/news/${article.id}" style="background: #1a73e8; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">Lire l'article</a>
          </div>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École</p>
      </div>`
  })
};

// ============================================================
// ✅ FONCTIONS UTILITAIRES
// ============================================================

const sendEmail = async (to, template) => {
  try {
    await emailService.transporter.sendMail({
      from: `"Auto-École" <${process.env.SMTP_USER}>`,
      to,
      subject: template.subject,
      html: template.html
    });
    console.log(`✅ Email envoyé à ${to}`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur email à ${to}:`, error.message);
    return false;
  }
};

// ✅ Créer une notification in-app dans Firestore
const createNotification = async (userId, { title, message, type, data = {} }) => {
  try {
    await admin.firestore().collection('notifications').add({
      userId,
      title,
      message,
      type,
      data,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ Notification in-app créée pour ${userId}`);
  } catch (error) {
    console.error(`❌ Erreur création notification:`, error.message);
  }
};

// ============================================================
// ✅ ROUTES IN-APP NOTIFICATIONS
// ============================================================

/**
 * @swagger
 * /api/notifications/me:
 *   get:
 *     summary: Toutes les notifications de l'utilisateur connecté
 *     description: Retourne toutes les notifications (élève ou admin) avec pagination
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Si true, retourne uniquement les non lues
 *     responses:
 *       200:
 *         description: Notifications récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       message:
 *                         type: string
 *                       type:
 *                         type: string
 *                       isRead:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                 unreadCount:
 *                   type: number
 *                 total:
 *                   type: number
 */
router.get('/me', checkAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;

    let query = admin.firestore().collection('notifications')
      .where('userId', '==', userId);

    if (unreadOnly === 'true') {
      query = query.where('isRead', '==', false);
    }

    const snap = await query.orderBy('createdAt', 'desc').get();

    const allNotifications = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    }));

    const total = allNotifications.length;
    const unreadCount = allNotifications.filter(n => !n.isRead).length;
    const paginatedNotifications = allNotifications.slice((page - 1) * limit, (page - 1) * limit + parseInt(limit));

    res.status(200).json({
      notifications: paginatedNotifications,
      unreadCount,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur GET /notifications/me:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/me/unread:
 *   get:
 *     summary: Nombre de notifications non lues (pour la cloche 🔔)
 *     description: Retourne le count des notifications non lues — à appeler au chargement de chaque page
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Count récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unreadCount:
 *                   type: number
 *                   example: 3
 *                 hasUnread:
 *                   type: boolean
 *                   example: true
 */
router.get('/me/unread', checkAuth, async (req, res) => {
  try {
    const userId = req.user.uid;

    const snap = await admin.firestore().collection('notifications')
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .get();

    res.status(200).json({
      unreadCount: snap.size,
      hasUnread: snap.size > 0
    });
  } catch (error) {
    console.error('Erreur GET /notifications/me/unread:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/me/summary:
 *   get:
 *     summary: Résumé des notifications admin
 *     description: Résumé pour le dashboard admin — réservations en attente, séances du jour, nouveaux élèves
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Résumé récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reservationsEnAttente:
 *                   type: number
 *                 seancesAujourdhui:
 *                   type: number
 *                 nouveauxEleves:
 *                   type: number
 *                 notificationsNonLues:
 *                   type: number
 */
router.get('/me/summary', checkAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Réservé à l\'admin' });
    }

    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [reservationsSnap, seancesSnap, elevesSnap, notifSnap] = await Promise.all([
      admin.firestore().collection('reservations').where('status', '==', 'en_cours').get(),
      admin.firestore().collection('sessions').where('scheduledDate', '>=', startOfDay).where('scheduledDate', '<=', endOfDay).get(),
      admin.firestore().collection('users').where('role', '==', 'eleve').where('createdAt', '>=', startOfMonth).get(),
      admin.firestore().collection('notifications').where('userId', '==', userId).where('isRead', '==', false).get()
    ]);

    res.status(200).json({
      reservationsEnAttente: reservationsSnap.size,
      seancesAujourdhui: seancesSnap.size,
      nouveauxEleves: elevesSnap.size,
      notificationsNonLues: notifSnap.size
    });
  } catch (error) {
    console.error('Erreur GET /notifications/me/summary:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Marquer une notification comme lue
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marquée comme lue
 *       404:
 *         description: Notification introuvable
 */
router.patch('/:id/read', checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const notifDoc = await admin.firestore().collection('notifications').doc(id).get();
    if (!notifDoc.exists) return res.status(404).json({ error: 'Notification introuvable' });
    if (notifDoc.data().userId !== userId) return res.status(403).json({ error: 'Accès non autorisé' });

    await admin.firestore().collection('notifications').doc(id).update({
      isRead: true,
      readAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ message: 'Notification marquée comme lue' });
  } catch (error) {
    console.error('Erreur PATCH /:id/read:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/me/read-all:
 *   patch:
 *     summary: Marquer toutes les notifications comme lues
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Toutes les notifications marquées comme lues
 */
router.patch('/me/read-all', checkAuth, async (req, res) => {
  try {
    const userId = req.user.uid;

    const snap = await admin.firestore().collection('notifications')
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .get();

    const batch = admin.firestore().batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true, readAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    await batch.commit();

    res.status(200).json({ message: 'Toutes les notifications marquées comme lues', count: snap.size });
  } catch (error) {
    console.error('Erreur PATCH /me/read-all:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Supprimer une notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification supprimée
 *       404:
 *         description: Notification introuvable
 */
router.delete('/:id', checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const notifDoc = await admin.firestore().collection('notifications').doc(id).get();
    if (!notifDoc.exists) return res.status(404).json({ error: 'Notification introuvable' });
    if (notifDoc.data().userId !== userId) return res.status(403).json({ error: 'Accès non autorisé' });

    await admin.firestore().collection('notifications').doc(id).delete();
    res.status(200).json({ message: 'Notification supprimée' });
  } catch (error) {
    console.error('Erreur DELETE /:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================================
// ✅ ROUTES EMAIL + IN-APP
// ============================================================

/**
 * @swagger
 * /api/notifications/welcome:
 *   post:
 *     summary: Envoyer email de bienvenue + notification in-app (admin)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - motDePasse
 *             properties:
 *               userId:
 *                 type: string
 *               motDePasse:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email et notification envoyés
 *       404:
 *         description: Utilisateur introuvable
 */
router.post('/welcome', checkAuth, async (req, res) => {
  try {
    const { userId, motDePasse } = req.body;
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const userData = userDoc.data();
    const template = emailTemplates.welcome(userData.nom, userData.email, motDePasse);
    const sent = await sendEmail(userData.email, template);

    // ✅ Notification in-app
    await createNotification(userId, {
      title: 'Bienvenue à l\'auto-école !',
      message: 'Votre compte a été créé. Connectez-vous avec vos identifiants.',
      type: 'welcome'
    });

    // ✅ Notification admin
    const adminSnap = await admin.firestore().collection('users').where('role', '==', 'admin').limit(1).get();
    if (!adminSnap.empty) {
      await createNotification(adminSnap.docs[0].id, {
        title: 'Nouvel élève inscrit',
        message: `${userData.nom} a rejoint l'auto-école`,
        type: 'new_student',
        data: { studentId: userId }
      });
    }

    res.status(200).json({ message: sent ? 'Email et notification envoyés' : 'Notification envoyée (email échoué)', success: sent });
  } catch (error) {
    console.error('Erreur /welcome:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/reservation/{reservationId}:
 *   post:
 *     summary: Notifier élève du statut de sa réservation (email + in-app)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reservationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification envoyée
 *       404:
 *         description: Réservation introuvable
 */
router.post('/reservation/:reservationId', checkAuth, async (req, res) => {
  try {
    const { reservationId } = req.params;
    const reservationDoc = await admin.firestore().collection('reservations').doc(reservationId).get();
    if (!reservationDoc.exists) return res.status(404).json({ error: 'Réservation introuvable' });

    const reservation = reservationDoc.data();
    const studentDoc = await admin.firestore().collection('users').doc(reservation.studentId).get();
    if (!studentDoc.exists) return res.status(404).json({ error: 'Élève introuvable' });

    const studentData = studentDoc.data();
    const instructorDoc = await admin.firestore().collection('users').doc(reservation.instructorId).get();
    const instructorData = instructorDoc.exists ? instructorDoc.data() : null;

    const reservationInfo = {
      courseTitle: reservation.courseTitle,
      date: reservation.date,
      time: reservation.time,
      duration: reservation.duration,
      instructorNom: instructorData?.nom || 'Instructeur',
      location: reservation.location || null,
      meetingLink: reservation.meetingLink || null
    };

    let template, notifTitle, notifMessage;

    switch (reservation.status) {
      case 'validee':
        template = emailTemplates.reservationValidee(studentData.nom, reservationInfo);
        notifTitle = '✅ Réservation validée';
        notifMessage = `Votre séance "${reservation.courseTitle}" du ${reservation.date} à ${reservation.time} a été confirmée`;
        break;
      case 'refusee':
        template = emailTemplates.reservationRefusee(studentData.nom, reservationInfo, reservation.motifRefus);
        notifTitle = '❌ Réservation refusée';
        notifMessage = `Votre demande de "${reservation.courseTitle}" n'a pas pu être acceptée. Motif: ${reservation.motifRefus || 'Non précisé'}`;
        break;
      case 'annulee':
        template = emailTemplates.reservationAnnulee(studentData.nom, reservationInfo);
        notifTitle = '🚫 Réservation annulée';
        notifMessage = `Votre réservation "${reservation.courseTitle}" du ${reservation.date} a été annulée`;
        break;
      default:
        return res.status(400).json({ error: 'Statut invalide pour notification' });
    }

    const sent = await sendEmail(studentData.email, template);

    // ✅ Notification in-app élève
    await createNotification(reservation.studentId, {
      title: notifTitle,
      message: notifMessage,
      type: `reservation_${reservation.status}`,
      data: { reservationId }
    });

    res.status(200).json({ message: 'Notification envoyée', success: sent, to: studentData.email });
  } catch (error) {
    console.error('Erreur /reservation/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/nouvelle-reservation:
 *   post:
 *     summary: Notifier l'admin d'une nouvelle réservation (in-app)
 *     description: À appeler automatiquement quand un élève crée une réservation
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reservationId
 *             properties:
 *               reservationId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Admin notifié
 */
router.post('/nouvelle-reservation', checkAuth, async (req, res) => {
  try {
    const { reservationId } = req.body;
    const reservationDoc = await admin.firestore().collection('reservations').doc(reservationId).get();
    if (!reservationDoc.exists) return res.status(404).json({ error: 'Réservation introuvable' });

    const reservation = reservationDoc.data();
    const studentDoc = await admin.firestore().collection('users').doc(reservation.studentId).get();
    const studentData = studentDoc.exists ? studentDoc.data() : null;

    // ✅ Notification in-app admin
    const adminSnap = await admin.firestore().collection('users').where('role', '==', 'admin').limit(1).get();
    if (!adminSnap.empty) {
      await createNotification(adminSnap.docs[0].id, {
        title: '📋 Nouvelle réservation',
        message: `${studentData?.nom || 'Un élève'} a demandé une séance de "${reservation.courseTitle}" le ${reservation.date} à ${reservation.time}`,
        type: 'nouvelle_reservation',
        data: { reservationId }
      });
    }

    res.status(200).json({ message: 'Admin notifié' });
  } catch (error) {
    console.error('Erreur /nouvelle-reservation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/admis-code:
 *   post:
 *     summary: Notifier un élève qu'il est admis à passer le code (email + in-app)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Notification envoyée
 *       404:
 *         description: Utilisateur introuvable
 */
router.post('/admis-code', checkAuth, async (req, res) => {
  try {
    const { userId } = req.body;
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const userData = userDoc.data();
    const template = emailTemplates.admisCode(userData.nom);
    const sent = await sendEmail(userData.email, template);

    // ✅ Notification in-app
    await createNotification(userId, {
      title: '🎉 Admis à l\'examen du code !',
      message: 'Félicitations ! Vous êtes admis à passer l\'examen du code de la route. Notre équipe vous contactera pour les détails.',
      type: 'admis_code'
    });

    res.status(200).json({ message: 'Notification envoyée', success: sent });
  } catch (error) {
    console.error('Erreur /admis-code:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/actualite/{articleId}:
 *   post:
 *     summary: Notifier tous les élèves d'une nouvelle actualité (email + in-app)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notifications envoyées
 *       404:
 *         description: Article introuvable
 */
router.post('/actualite/:articleId', checkAuth, async (req, res) => {
  try {
    const { articleId } = req.params;
    const articleDoc = await admin.firestore().collection('news').doc(articleId).get();
    if (!articleDoc.exists) return res.status(404).json({ error: 'Article introuvable' });

    const article = { id: articleDoc.id, ...articleDoc.data() };
    const studentsSnap = await admin.firestore().collection('users').where('role', '==', 'eleve').get();

    if (studentsSnap.empty) return res.status(200).json({ message: 'Aucun élève trouvé', sent: 0 });

    const results = await Promise.allSettled(
      studentsSnap.docs.map(async (doc) => {
        const student = doc.data();
        if (!student.email) return false;

        // ✅ Email + notification in-app
        const template = emailTemplates.nouvelleActualite(student.nom, article);
        await Promise.all([
          sendEmail(student.email, template),
          createNotification(doc.id, {
            title: `📰 ${article.title}`,
            message: article.excerpt || 'Une nouvelle actualité a été publiée',
            type: 'nouvelle_actualite',
            data: { articleId }
          })
        ]);
        return true;
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    res.status(200).json({ message: 'Notifications envoyées', sent, total: results.length });
  } catch (error) {
    console.error('Erreur /actualite/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/send-reminders:
 *   post:
 *     summary: Rappels séances du lendemain (cron-job.org)
 *     description: |
 *       Appelé automatiquement par cron-job.org chaque jour à 08h00.
 *       Header requis : x-cron-secret
 *     tags: [Notifications]
 *     parameters:
 *       - in: header
 *         name: x-cron-secret
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rappels envoyés
 *       401:
 *         description: Clé secrète invalide
 */
router.post('/send-reminders', async (req, res) => {
  try {
    const cronSecret = req.headers['x-cron-secret'];
    if (cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Clé secrète invalide' });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfTomorrow = new Date(tomorrow); startOfTomorrow.setHours(0, 0, 0, 0);
    const endOfTomorrow = new Date(tomorrow); endOfTomorrow.setHours(23, 59, 59, 999);

    const sessionsSnap = await admin.firestore().collection('sessions')
      .where('scheduledDate', '>=', startOfTomorrow)
      .where('scheduledDate', '<=', endOfTomorrow)
      .where('status', '==', 'confirmee')
      .get();

    if (sessionsSnap.empty) return res.status(200).json({ message: 'Aucune séance demain', sent: 0 });

    let sent = 0, failed = 0;

    await Promise.allSettled(sessionsSnap.docs.map(async (doc) => {
      const session = doc.data();
      const sessionDate = session.scheduledDate?.toDate();
      const instructorDoc = await admin.firestore().collection('users').doc(session.instructorId).get();
      const instructorData = instructorDoc.exists ? instructorDoc.data() : null;

      const sessionInfo = {
        courseTitle: session.courseTitle,
        scheduledDate: sessionDate?.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        scheduledTime: session.scheduledTime,
        duration: session.dureeLabel || `${session.durationHeures}h${session.durationMinutes > 0 ? session.durationMinutes : ''}`,
        instructorNom: instructorData?.nom || 'Instructeur',
        location: session.location || null,
        meetingLink: session.meetingLink || null
      };

      const notifyStudent = async (studentId) => {
        const studentDoc = await admin.firestore().collection('users').doc(studentId).get();
        if (!studentDoc.exists) return;
        const student = studentDoc.data();
        const template = emailTemplates.rappelSeance(student.nom, sessionInfo);

        await Promise.all([
          sendEmail(student.email, template).then(ok => ok ? sent++ : failed++),
          createNotification(studentId, {
            title: `⏰ Rappel — Séance demain à ${session.scheduledTime}`,
            message: `N'oubliez pas votre séance "${session.courseTitle}" demain à ${session.scheduledTime}`,
            type: 'rappel_seance',
            data: { sessionId: doc.id }
          })
        ]);
      };

      if (session.courseCategory === 'pratique' && session.studentId) {
        await notifyStudent(session.studentId);
      } else if (session.courseCategory === 'theorique' && session.students?.length > 0) {
        await Promise.allSettled(session.students.map(s => notifyStudent(s.studentId)));
      }
    }));

    res.status(200).json({ message: 'Rappels envoyés', sent, failed });
  } catch (error) {
    console.error('Erreur /send-reminders:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;