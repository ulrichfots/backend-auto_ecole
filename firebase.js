const admin = require("firebase-admin");

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
    
    // On n'ajoute le bucket que s'il est vraiment défini dans Render
    if (process.env.FIREBASE_STORAGE_BUCKET && 
        process.env.FIREBASE_STORAGE_BUCKET !== 'your-project-id.appspot.com') {
      firebaseConfig.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
    }

    admin.initializeApp(firebaseConfig);
    console.log('✅ Firebase Admin initialisé avec succès');
  } catch (error) {
    console.error('❌ Erreur initialisation Firebase:', error.message);
  }
}

// --- MODIFICATION ICI : On évite de créer le bucket si l'ID est manquant ---
let bucket = null;
try {
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    bucket = admin.storage().bucket();
  }
} catch (e) {
  console.warn("⚠️ Storage non disponible :", e.message);
}

async function uploadImageToStorage(file) {
  // Si le bucket n'est pas dispo, on rejette proprement au lieu de faire crash le serveur
  if (!bucket) {
    throw new Error("Le stockage Firebase n'est pas configuré (FIREBASE_STORAGE_BUCKET manquant)");
  }

  return new Promise((resolve, reject) => {
    const { v4: uuidv4 } = require('uuid');
    const fileName = `profile_images/${uuidv4()}`;
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      metadata: { contentType: file.mimetype },
    });

    blobStream.on('error', (err) => reject(err));
    blobStream.on('finish', async () => {
      try {
        await blob.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        resolve(publicUrl);
      } catch (err) {
        reject('Erreur makePublic : ' + err);
      }
    });
    blobStream.end(file.buffer);
  });
}

module.exports = {
  admin,
  uploadImageToStorage,
};