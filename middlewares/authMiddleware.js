// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');
const admin = require('../firebase').admin; // Pour accéder à Firestore et vérifier l'existence des users
const JWT_SECRET = process.env.JWT_SECRET || 'votre_cle_secrete_ici';

/**
 * Middleware pour vérifier le JWT custom
 */
async function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant ou format incorrect' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Vérification du JWT custom
    const decodedToken = jwt.verify(token, JWT_SECRET);

    // Vérifier que l'utilisateur existe dans Firestore
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    const userData = userDoc.data();

    // Vérifier le statut du compte
    if (userData.statut === 'suspendu') {
      return res.status(403).json({ error: 'Compte suspendu' });
    }
    if (userData.statut === 'en attente') {
      return res.status(403).json({ error: 'Compte en attente' });
    }

    // Ajouter les infos utilisateur à la requête
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: userData.role,
      nom: userData.nom || '',
      statut: userData.statut
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide ou expiré', details: error.message });
  }
}

/**
 * Middleware pour vérifier que l'utilisateur est admin
 */
async function checkAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Utilisateur non authentifié' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès admin requis' });
  next();
}

module.exports = { checkAuth, checkAdmin };