const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { checkAuth } = require('../middlewares/authMiddleware');
const emailService = require('../services/emailService');

// ============================================================
// ✅ TEMPLATES EMAIL
// ============================================================
const emailTemplates = {

  // 1. Email de bienvenue
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
            <h3 style="color: #1a73e8; margin-top: 0;">Vos identifiants de connexion :</h3>
            <p><strong>Email :</strong> ${email}</p>
            <p><strong>Mot de passe :</strong> ${motDePasse}</p>
          </div>
          <p style="color: #e53935; font-size: 13px;">⚠️ Veuillez changer votre mot de passe lors de votre première connexion.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/login" 
               style="background: #1a73e8; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Se connecter
            </a>
          </div>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École — Ne pas répondre à cet email</p>
      </div>
    `
  }),

  // 2. Réservation validée
  reservationValidee: (nom, reservation) => ({
    subject: '✅ Votre réservation a été validée',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #34a853; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">✅ Réservation confirmée</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Bonjour ${nom} !</h2>
          <p style="color: #555;">Votre demande de réservation a été <strong style="color: #34a853;">validée</strong> par notre équipe.</p>
          <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #34a853; margin-top: 0;">Détails de votre séance :</h3>
            <p>📚 <strong>Type :</strong> ${reservation.courseTitle}</p>
            <p>📅 <strong>Date :</strong> ${reservation.date}</p>
            <p>🕐 <strong>Heure :</strong> ${reservation.time}</p>
            <p>⏱️ <strong>Durée :</strong> ${reservation.duration}h</p>
            <p>👨‍🏫 <strong>Instructeur :</strong> ${reservation.instructorNom}</p>
            ${reservation.location ? `<p>📍 <strong>Lieu :</strong> ${reservation.location}</p>` : ''}
            ${reservation.meetingLink ? `<p>🔗 <strong>Lien :</strong> <a href="${reservation.meetingLink}">${reservation.meetingLink}</a></p>` : ''}
          </div>
          <p style="color: #555;">Soyez à l'heure ! En cas d'empêchement, contactez-nous dès que possible.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background: #34a853; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Voir mon espace
            </a>
          </div>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École — Ne pas répondre à cet email</p>
      </div>
    `
  }),

  // 3. Réservation refusée
  reservationRefusee: (nom, reservation, motif) => ({
    subject: '❌ Votre réservation n\'a pas pu être acceptée',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #e53935; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">❌ Réservation refusée</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Bonjour ${nom} !</h2>
          <p style="color: #555;">Votre demande de réservation n'a pas pu être acceptée.</p>
          <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p>📚 <strong>Type :</strong> ${reservation.courseTitle}</p>
            <p>📅 <strong>Date demandée :</strong> ${reservation.date}</p>
            <p>🕐 <strong>Heure demandée :</strong> ${reservation.time}</p>
            <div style="background: #ffeaea; border-left: 4px solid #e53935; padding: 10px; margin-top: 15px; border-radius: 4px;">
              <strong>Motif du refus :</strong><br/>${motif || 'Aucun motif précisé'}
            </div>
          </div>
          <p style="color: #555;">Vous pouvez faire une nouvelle réservation à une autre date.</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background: #1a73e8; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Faire une nouvelle réservation
            </a>
          </div>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École — Ne pas répondre à cet email</p>
      </div>
    `
  }),

  // 4. Réservation annulée
  reservationAnnulee: (nom, reservation) => ({
    subject: '🚫 Confirmation d\'annulation de votre réservation',
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
            <p>🕐 <strong>Heure :</strong> ${reservation.time}</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background: #1a73e8; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Faire une nouvelle réservation
            </a>
          </div>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École — Ne pas répondre à cet email</p>
      </div>
    `
  }),

  // 5. Admis à passer le code
  admisCode: (nom) => ({
    subject: '🎉 Félicitations — Vous êtes admis à passer l\'examen du code !',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #7b1fa2; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">🎉 Admis à l'examen !</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Bonjour ${nom} !</h2>
          <p style="color: #555; font-size: 16px;">
            Nous avons le plaisir de vous informer que vous avez été 
            <strong style="color: #7b1fa2;">admis à passer l'examen du code de la route</strong>.
          </p>
          <div style="background: #f3e5f5; border-left: 4px solid #7b1fa2; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #555;">Notre équipe vous contactera prochainement pour vous communiquer la date et les détails de l'examen.</p>
          </div>
          <p style="color: #555;">Continuez à réviser et bonne chance ! 🍀</p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background: #7b1fa2; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Voir mon espace
            </a>
          </div>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École — Ne pas répondre à cet email</p>
      </div>
    `
  }),

  // 6. Rappel séance
  rappelSeance: (nom, session) => ({
    subject: `⏰ Rappel — Vous avez une séance demain à ${session.scheduledTime}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a73e8; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">⏰ Rappel de séance</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Bonjour ${nom} !</h2>
          <p style="color: #555;">Ceci est un rappel pour votre séance de demain.</p>
          <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #1a73e8; margin-top: 0;">Détails :</h3>
            <p>📚 <strong>Type :</strong> ${session.courseTitle}</p>
            <p>📅 <strong>Date :</strong> ${session.scheduledDate}</p>
            <p>🕐 <strong>Heure :</strong> ${session.scheduledTime}</p>
            <p>⏱️ <strong>Durée :</strong> ${session.duration}h</p>
            <p>👨‍🏫 <strong>Instructeur :</strong> ${session.instructorNom}</p>
            ${session.location ? `<p>📍 <strong>Lieu :</strong> ${session.location}</p>` : ''}
            ${session.meetingLink ? `<p>🔗 <strong>Lien :</strong> <a href="${session.meetingLink}">${session.meetingLink}</a></p>` : ''}
          </div>
          <p style="color: #e53935;">⚠️ Pensez à être à l'heure !</p>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École — Ne pas répondre à cet email</p>
      </div>
    `
  }),

  // 7. Nouvelle actualité
  nouvelleActualite: (nom, article) => ({
    subject: `📰 Nouvelle actualité — ${article.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a73e8; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">📰 Nouvelle actualité</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #333;">Bonjour ${nom} !</h2>
          <p style="color: #555;">Une nouvelle actualité vient d'être publiée.</p>
          <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0;">
            ${article.imageUrl ? `<img src="${article.imageUrl}" style="width: 100%; border-radius: 4px; margin-bottom: 15px;" />` : ''}
            <h3 style="color: #1a73e8; margin-top: 0;">${article.title}</h3>
            <p style="color: #555;">${article.excerpt || ''}</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/news/${article.id}" 
               style="background: #1a73e8; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              Lire l'article
            </a>
          </div>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">© Auto-École — Ne pas répondre à cet email</p>
      </div>
    `
  })
};

// ============================================================
// ✅ FONCTION UTILITAIRE — ENVOYER UN EMAIL VIA emailService
// ============================================================
const sendEmail = async (to, template) => {
  try {
    await emailService.transporter.sendMail({
      from: `"Auto-École" <${process.env.SMTP_USER}>`,
      to,
      subject: template.subject,
      html: template.html
    });
    console.log(`✅ Email envoyé à ${to} — ${template.subject}`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur envoi email à ${to}:`, error.message);
    return false;
  }
};

// ============================================================
// ✅ ROUTES
// ============================================================

/**
 * @swagger
 * /api/notifications/welcome:
 *   post:
 *     summary: Envoyer email de bienvenue à un nouvel élève (admin)
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
 *         description: Email envoyé avec succès
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

    res.status(200).json({ message: sent ? 'Email de bienvenue envoyé' : 'Erreur envoi', success: sent });
  } catch (error) {
    console.error('Erreur /welcome:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/reservation/{reservationId}:
 *   post:
 *     summary: Envoyer notification statut réservation (admin)
 *     description: Envoie automatiquement le bon email selon le statut (validee, refusee, annulee)
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
 *         description: Email envoyé avec succès
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

    let template;
    switch (reservation.status) {
      case 'validee':
        template = emailTemplates.reservationValidee(studentData.nom, reservationInfo);
        break;
      case 'refusee':
        template = emailTemplates.reservationRefusee(studentData.nom, reservationInfo, reservation.motifRefus);
        break;
      case 'annulee':
        template = emailTemplates.reservationAnnulee(studentData.nom, reservationInfo);
        break;
      default:
        return res.status(400).json({ error: 'Statut invalide pour notification' });
    }

    const sent = await sendEmail(studentData.email, template);

    res.status(200).json({
      message: sent ? 'Notification envoyée' : 'Erreur envoi',
      success: sent,
      to: studentData.email,
      status: reservation.status
    });
  } catch (error) {
    console.error('Erreur /reservation/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/admis-code:
 *   post:
 *     summary: Notifier un élève qu'il est admis à passer le code (admin)
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
 *         description: Email envoyé avec succès
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

    res.status(200).json({ message: sent ? 'Notification envoyée' : 'Erreur envoi', success: sent, to: userData.email });
  } catch (error) {
    console.error('Erreur /admis-code:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/actualite/{articleId}:
 *   post:
 *     summary: Notifier tous les élèves d'une nouvelle actualité (admin)
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
 *         description: Emails envoyés avec succès
 *       404:
 *         description: Article introuvable
 */
router.post('/actualite/:articleId', checkAuth, async (req, res) => {
  try {
    const { articleId } = req.params;

    const articleDoc = await admin.firestore().collection('news').doc(articleId).get();
    if (!articleDoc.exists) return res.status(404).json({ error: 'Article introuvable' });

    const article = { id: articleDoc.id, ...articleDoc.data() };

    const studentsSnap = await admin.firestore().collection('users')
      .where('role', '==', 'eleve')
      .get();

    if (studentsSnap.empty) {
      return res.status(200).json({ message: 'Aucun élève trouvé', sent: 0 });
    }

    const results = await Promise.allSettled(
      studentsSnap.docs.map(async (doc) => {
        const student = doc.data();
        if (!student.email) return false;
        const template = emailTemplates.nouvelleActualite(student.nom, article);
        return sendEmail(student.email, template);
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    const failed = results.length - sent;

    res.status(200).json({ message: 'Emails envoyés', sent, failed, total: results.length });
  } catch (error) {
    console.error('Erreur /actualite/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/notifications/send-reminders:
 *   post:
 *     summary: Envoyer rappels séances du lendemain (cron-job.org)
 *     description: |
 *       Appelé automatiquement par cron-job.org chaque jour à 08h00.
 *       **Configuration cron-job.org :**
 *       - URL : https://backend-auto-ecole.onrender.com/api/notifications/send-reminders
 *       - Méthode : POST
 *       - Header : x-cron-secret → valeur de CRON_SECRET dans .env
 *       - Schedule : tous les jours à 08h00
 *     tags: [Notifications]
 *     parameters:
 *       - in: header
 *         name: x-cron-secret
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rappels envoyés avec succès
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

    if (sessionsSnap.empty) {
      return res.status(200).json({ message: 'Aucune séance demain', sent: 0 });
    }

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
        duration: session.duration,
        instructorNom: instructorData?.nom || 'Instructeur',
        location: session.location || null,
        meetingLink: session.meetingLink || null
      };

      if (session.courseCategory === 'pratique' && session.studentId) {
        // Séance pratique — un seul élève
        const studentDoc = await admin.firestore().collection('users').doc(session.studentId).get();
        if (studentDoc.exists) {
          const student = studentDoc.data();
          const template = emailTemplates.rappelSeance(student.nom, sessionInfo);
          const ok = await sendEmail(student.email, template);
          ok ? sent++ : failed++;
        }
      } else if (session.courseCategory === 'theorique' && session.students?.length > 0) {
        // Séance théorique — plusieurs élèves
        await Promise.allSettled(session.students.map(async (s) => {
          const studentDoc = await admin.firestore().collection('users').doc(s.studentId).get();
          if (studentDoc.exists) {
            const student = studentDoc.data();
            const template = emailTemplates.rappelSeance(student.nom, sessionInfo);
            const ok = await sendEmail(student.email, template);
            ok ? sent++ : failed++;
          }
        }));
      }
    }));

    console.log(`✅ Rappels: ${sent} envoyés, ${failed} échecs`);
    res.status(200).json({ message: 'Rappels envoyés', sent, failed });
  } catch (error) {
    console.error('Erreur /send-reminders:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;