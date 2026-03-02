const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    // On lit soit la variable d'environnement, soit le fichier local (pour dev local)
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : require('./serviceAccountKey.json');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // On configure le bucket si la variable est présente
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined
    });

    console.log('✅ Firebase Admin initialisé');
  } catch (error) {
    console.error('❌ Erreur Firebase:', error.message);
  }
}

// Récupération du bucket seulement si configuré
let bucket = null;
if (process.env.FIREBASE_STORAGE_BUCKET) {
  try {
    bucket = admin.storage().bucket();
  } catch (e) {
    console.log("ℹ️ Storage désactivé (Bucket non configuré)");
  }
}

module.exports = { admin, bucket };