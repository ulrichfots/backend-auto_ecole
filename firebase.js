const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
      : require('./serviceAccountKey.json');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialisé');
  } catch (error) {
    console.error('❌ Erreur Firebase:', error.message);
  }
}

// Protection contre le crash du Storage
let bucket = null;
try {
  // On ne tente d'accéder au bucket QUE si la variable est définie sur Render
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    bucket = admin.storage().bucket();
  }
} catch (e) {
  console.log("ℹ️ Storage désactivé (Bucket non configuré)");
}

module.exports = { admin, bucket };