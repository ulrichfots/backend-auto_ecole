const admin = require("firebase-admin");

function loadServiceAccount() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return require("./serviceAccountKey.json");
  }

  try {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    // Handle private key from env where newlines are escaped (\\n)
    if (parsed.private_key && typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }

    return parsed;
  } catch (error) {
    console.error("FIREBASE_SERVICE_ACCOUNT invalide, fallback vers serviceAccountKey.json:", error.message);
    return require("./serviceAccountKey.json");
  }
}

if (!admin.apps.length) {
  try {
    const serviceAccount = loadServiceAccount();

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined
    });

    console.log("Firebase Admin initialise");
  } catch (error) {
    console.error("Erreur Firebase:", error.message);
  }
}

let bucket = null;
if (process.env.FIREBASE_STORAGE_BUCKET) {
  try {
    bucket = admin.storage().bucket();
    console.log("Firebase Storage active");
  } catch (error) {
    console.log("Storage desactive (Bucket non configure)");
  }
}

module.exports = { admin, bucket };
