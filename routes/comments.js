const express = require('express');
const router = express.Router();
const admin = require('../firebase'); // <- ton fichier firebase.js
const { checkAuth } = require('../middlewares/authMiddleware'); // si tu veux protéger

// Ajouter un commentaire
router.post('/', checkAuth, async (req, res) => {
  const { comment } = req.body;
  const uid = req.user.uid;

  try {
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    const nom = userDoc.data()?.nom ?? "Utilisateur";

    const commentRef = await admin.firestore().collection('comments').add({
      uid,
      name: nom,
      comment,
      likes: 0,
      dislikes: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ id: commentRef.id, message: 'Commentaire enregistré' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur ajout commentaire' });
  }
});

// Récupérer tous les commentaires
router.get('/', async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('comments').orderBy('createdAt', 'desc').get();
    const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur récupération des commentaires' });
  }
});

// ✅ PATCH pour like/dislike un commentaire
router.patch('/:id', checkAuth, async (req, res) => {
    const { type } = req.body;
    const commentId = req.params.id;
    const uid = req.user.uid;
  
    if (!['like', 'dislike'].includes(type)) {
      return res.status(400).json({ error: 'Type invalide (attendu: like ou dislike)' });
    }
  
    try {
      const commentRef = admin.firestore().collection('comments').doc(commentId);
      const voteRef = commentRef.collection('votes').doc(uid);
      const voteSnap = await voteRef.get();
  
      if (voteSnap.exists) {
        return res.status(403).json({ error: 'Vous avez déjà voté ce commentaire.' });
      }
  
      // ✅ Mise à jour du compteur
      const field = type === 'like' ? 'likes' : 'dislikes';
      await commentRef.update({
        [field]: admin.firestore.FieldValue.increment(1),
      });
  
      // ✅ Enregistrement du vote
      await voteRef.set({
        type,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
  
      res.status(200).json({ message: `✅ ${type} enregistré` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });
  
  console.log('📩 Nouveau commentaire reçu :', req.body);
console.log('👤 UID :', uid);


module.exports = router;
