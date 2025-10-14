const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    // Essayer d'abord la variable d'environnement, sinon utiliser le fichier
    let serviceAccount;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      // Fallback vers le fichier serviceAccountKey.json
      serviceAccount = require('./serviceAccountKey.json');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "app-auto-ecole.appspot.com",
    });

    console.log('✅ Firebase Admin initialisé avec succès');
  } catch (error) {
    console.error('❌ Erreur initialisation Firebase:', error.message);
    console.error('Vérifiez que le fichier serviceAccountKey.json existe et est valide');
  }
}

const bucket = admin.storage().bucket();

async function uploadImageToStorage(file) {
  return new Promise((resolve, reject) => {
    const { v4: uuidv4 } = require('uuid');
    const fileName = `profile_images/${uuidv4()}`;
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    });

    blobStream.on('error', (err) => {
      reject(err);
    });

    blobStream.on('finish', async () => {
      try {
        // cette ligne pour rendre l'image publique
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
