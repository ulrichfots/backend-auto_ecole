const admin = require('../firebase').admin;

// 🔐 Vérification du token Firebase
async function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // Vérifier présence header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Token manquant ou format invalide',
      message: 'Utilisez: Authorization: Bearer <token>'
    });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Vérifie le Firebase ID Token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Vérifie que l'utilisateur existe dans Firestore
    const userDoc = await admin.firestore().collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(401).json({
        error: 'Utilisateur non trouvé'
      });
    }

    const userData = userDoc.data();

    // Vérifier statut
    if (userData.statut === 'suspendu') {
      return res.status(403).json({
        error: 'Compte suspendu'
      });
    }

    if (userData.statut === 'en attente') {
      return res.status(403).json({
        error: 'Compte en attente de validation'
      });
    }

    // Injecter user dans la requête
    req.user = {
      uid: uid,
      email: decodedToken.email,
      role: userData.role,
      statut: userData.statut,
      nom: userData.nom
    };

    next();
  } catch (error) {
    console.error('❌ Erreur vérification token:', error.message);
    return res.status(401).json({
      error: 'Token invalide ou expiré'
    });
  }
}

// 🔐 Vérification rôle admin
function checkAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Accès réservé aux administrateurs'
    });
  }
  next();
}

module.exports = {
  checkAuth,
  checkAdmin
};