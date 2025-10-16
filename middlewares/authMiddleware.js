const admin = require('../firebase').admin;

async function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // Vérifier la présence du header Authorization
  if (!authHeader) {
    return res.status(401).json({
      error: 'Token d\'authentification manquant',
      message: 'Veuillez fournir un token d\'authentification dans le header Authorization',
      debug: {
        hasAuthHeader: false,
        expectedFormat: 'Authorization: Bearer <token>'
      }
    });
  }

  // Vérifier le format du header
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Format d\'authentification incorrect',
      message: 'Le header Authorization doit commencer par "Bearer "',
      debug: {
        hasAuthHeader: true,
        authHeader: authHeader,
        expectedFormat: 'Bearer <token>'
      }
    });
  }

  const token = authHeader.split('Bearer ')[1];

  // Vérifier la présence du token
  if (!token) {
    return res.status(401).json({
      error: 'Token manquant',
      message: 'Aucun token fourni après "Bearer "',
      debug: {
        hasAuthHeader: true,
        authHeader: authHeader,
        extractedToken: null
      }
    });
  }

  try {
    // Vérifier et décoder le token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Vérifier que l'utilisateur existe dans Firestore
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      return res.status(401).json({
        error: 'Utilisateur non trouvé',
        message: 'L\'utilisateur associé à ce token n\'existe pas dans la base de données',
        debug: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          userExists: false
        }
      });
    }

    const userData = userDoc.data();

    // Vérifier le statut du compte
    if (userData.statut === 'suspendu') {
      return res.status(403).json({
        error: 'Compte suspendu',
        message: 'Votre compte a été suspendu. Contactez l\'administration.',
        debug: {
          uid: decodedToken.uid,
          statut: userData.statut
        }
      });
    }

    if (userData.statut === 'en attente') {
      return res.status(403).json({
        error: 'Compte en attente',
        message: 'Votre compte est en attente de validation',
        debug: {
          uid: decodedToken.uid,
          statut: userData.statut
        }
      });
    }

    // Ajouter les informations utilisateur à la requête
    req.user = {
      ...decodedToken,
      role: userData.role,
      statut: userData.statut,
      nom: userData.nom
    };

    next();
  } catch (error) {
    console.error('Erreur vérification token:', error);
    
    // Messages d'erreur plus spécifiques
    let errorMessage = 'Token invalide';
    let debugInfo = {};

    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Token expiré';
      debugInfo = {
        errorCode: error.code,
        message: 'Le token a expiré, veuillez vous reconnecter'
      };
    } else if (error.code === 'auth/id-token-revoked') {
      errorMessage = 'Token révoqué';
      debugInfo = {
        errorCode: error.code,
        message: 'Le token a été révoqué, veuillez vous reconnecter'
      };
    } else if (error.code === 'auth/invalid-id-token') {
      errorMessage = 'Token malformé';
      debugInfo = {
        errorCode: error.code,
        message: 'Le format du token est invalide'
      };
    } else {
      debugInfo = {
        errorCode: error.code || 'unknown',
        message: error.message
      };
    }

    return res.status(401).json({
      error: errorMessage,
      message: debugInfo.message,
      debug: {
        ...debugInfo,
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20) + '...'
      }
    });
  }
}

module.exports = { checkAuth };
