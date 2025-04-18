

const admin = require('../firebase').admin;

async function createOrUpdateUser(uid, data) {
  if (!uid || !data) {
    throw new Error('UID et données obligatoires.');
  }

  const userRef = admin.firestore().collection('users').doc(uid);
  const doc = await userRef.get();

  if (doc.exists) {
    // Si l'utilisateur existe, on met à jour seulement les champs envoyés
    await userRef.update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(), // Optionnel : mettre une date de modification
    });
    console.log(`Utilisateur ${uid} mis à jour.`);
  } else {
    // Si l'utilisateur n'existe pas, on le crée avec un createdAt
    await userRef.set({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      uid: uid, // Important d'enregistrer l'uid dans le document aussi
    });
    console.log(`Utilisateur ${uid} créé.`);
  }
}

module.exports = { createOrUpdateUser };
