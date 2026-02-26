const admin = require("firebase-admin");

let bucket = null; // On l'initialise à null par défaut

if (!admin.apps.length) {
  try {
    let serviceAccount;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      serviceAccount = require('./serviceAccountKey.json');
    }

    const firebaseConfig = {
      credential: admin.credential.cert(serviceAccount)
    };
    
    // On n'ajoute le bucket que s'il est défini dans ton .env ou sur Render
    if (process.env.FIREBASE_STORAGE_BUCKET && 
        process.env.FIREBASE_STORAGE_BUCKET !== 'your-project-id.appspot.com') {
      firebaseConfig.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
    }

    admin.initializeApp(firebaseConfig);
    
    // On n'initialise le bucket QUE SI l'admin est OK
    if (firebaseConfig.storageBucket) {
        bucket = admin.storage().bucket();
        console.log('✅ Firebase Admin & Storage initialisés');
    } else {
        console.log('✅ Firebase Admin initialisé (Storage ignoré pour l\'instant)');
    }

  } catch (error) {
    console.error('❌ Erreur initialisation Firebase:', error.message);
  }
} else {
    // Si déjà initialisé, on récupère le bucket existant
    try {
        bucket = admin.storage().bucket();
    } catch(e) {
        bucket = null;
    }
}

async function uploadImageToStorage(file) {
  if (!bucket) {
      throw new Error("Le stockage Firebase n'est pas configuré.");
  }
  // ... le reste de ta fonction reste identique
  return new Promise((resolve, reject) => {
      // (ton code actuel ici)
  });
}

module.exports = {
  admin,
  uploadImageToStorage,
};