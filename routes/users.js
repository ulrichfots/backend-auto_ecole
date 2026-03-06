const express = require('express');
const router = express.Router();
const { admin } = require('../firebase');
const { checkAuth, checkAdmin } = require('../middlewares/authMiddleware');

function sanitizeUser(uid, data) {
  return {
    uid,
    nom: data.nom || data.nomComplet || '',
    email: data.email || '',
    role: data.role || '',
    statut: data.statut || '',
    telephone: data.telephone || '',
    adresse: data.adresse || '',
    dateNaissance: data.dateNaissance || '',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

function validateRoleFields({ email, password, nom }) {
  if (!email || !password || !nom) {
    return 'email, password et nom sont obligatoires';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'format email invalide';
  }

  if (password.length < 6) {
    return 'le mot de passe doit contenir au moins 6 caractères';
  }

  return null;
}

async function listUsersByRole(req, res, role) {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const snapshot = await admin.firestore().collection('users').where('role', '==', role).get();

    let users = snapshot.docs.map((doc) => sanitizeUser(doc.id, doc.data()));

    if (search) {
      const q = String(search).toLowerCase();
      users = users.filter((u) =>
        u.nom.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }

    users.sort((a, b) => {
      const aTime = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    const total = users.length;
    const start = (pageNum - 1) * limitNum;
    const items = users.slice(start, start + limitNum);

    return res.status(200).json({
      users: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error(`Erreur liste ${role}:`, error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

async function getUserByRole(req, res, role) {
  try {
    const { uid } = req.params;
    const doc = await admin.firestore().collection('users').doc(uid).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const data = doc.data();
    if (data.role !== role) {
      return res.status(400).json({ error: `Cet utilisateur n'est pas ${role}` });
    }

    return res.status(200).json({ user: sanitizeUser(doc.id, data) });
  } catch (error) {
    console.error(`Erreur détail ${role}:`, error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

async function createUserByRole(req, res, role) {
  try {
    const { email, password, nom, telephone, adresse, dateNaissance, statut } = req.body;
    const validationError = validateRoleFields({ email, password, nom });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nom
    });

    const userData = {
      email,
      nom,
      role,
      statut: statut || 'actif',
      isFirstLogin: true,
      telephone: telephone || '',
      adresse: adresse || '',
      dateNaissance: dateNaissance || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await admin.firestore().collection('users').doc(userRecord.uid).set(userData);

    return res.status(201).json({
      message: `${role} créé avec succès`,
      user: {
        uid: userRecord.uid,
        email,
        nom,
        role,
        statut: userData.statut
      }
    });
  } catch (error) {
    console.error(`Erreur création ${role}:`, error);
    return res.status(400).json({ error: 'Erreur création utilisateur', details: error.message });
  }
}

async function updateUserByRole(req, res, role) {
  try {
    const { uid } = req.params;
    const payload = req.body || {};

    const docRef = admin.firestore().collection('users').doc(uid);
    const existingDoc = await docRef.get();
    if (!existingDoc.exists) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const existing = existingDoc.data();
    if (existing.role !== role) {
      return res.status(400).json({ error: `Cet utilisateur n'est pas ${role}` });
    }

    const allowedFields = ['nom', 'telephone', 'adresse', 'dateNaissance', 'statut', 'email'];
    const updates = {};

    allowedFields.forEach((field) => {
      if (payload[field] !== undefined) {
        updates[field] = payload[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à modifier' });
    }

    if (updates.email && updates.email !== existing.email) {
      await admin.auth().updateUser(uid, { email: updates.email });
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await docRef.update(updates);

    return res.status(200).json({ message: 'Utilisateur modifié avec succès', updatedFields: Object.keys(updates) });
  } catch (error) {
    console.error(`Erreur update ${role}:`, error);
    return res.status(400).json({ error: 'Erreur modification utilisateur', details: error.message });
  }
}

async function deleteUserByRole(req, res, role) {
  try {
    const { uid } = req.params;

    const docRef = admin.firestore().collection('users').doc(uid);
    const existingDoc = await docRef.get();
    if (!existingDoc.exists) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const existing = existingDoc.data();
    if (existing.role !== role) {
      return res.status(400).json({ error: `Cet utilisateur n'est pas ${role}` });
    }

    await docRef.delete();

    try {
      await admin.auth().deleteUser(uid);
    } catch (authError) {
      if (authError.code !== 'auth/user-not-found') {
        throw authError;
      }
    }

    return res.status(200).json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    console.error(`Erreur suppression ${role}:`, error);
    return res.status(400).json({ error: 'Erreur suppression utilisateur', details: error.message });
  }
}

router.get('/me', checkAuth, async (req, res) => {
  try {
    const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    return res.status(200).json({ user: sanitizeUser(userDoc.id, userDoc.data()) });
  } catch (error) {
    console.error('Erreur profil me:', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/dashboard', checkAuth, checkAdmin, async (req, res) => {
  return res.status(200).json({
    message: 'Accès dashboard autorisé (admin uniquement)',
    role: req.user.role
  });
});

router.get('/students', checkAuth, checkAdmin, async (req, res) => listUsersByRole(req, res, 'eleve'));
router.get('/students/:uid', checkAuth, checkAdmin, async (req, res) => getUserByRole(req, res, 'eleve'));
router.post('/students', checkAuth, checkAdmin, async (req, res) => createUserByRole(req, res, 'eleve'));
router.put('/students/:uid', checkAuth, checkAdmin, async (req, res) => updateUserByRole(req, res, 'eleve'));
router.delete('/students/:uid', checkAuth, checkAdmin, async (req, res) => deleteUserByRole(req, res, 'eleve'));

router.get('/instructors', checkAuth, checkAdmin, async (req, res) => listUsersByRole(req, res, 'instructeur'));
router.get('/instructors/:uid', checkAuth, checkAdmin, async (req, res) => getUserByRole(req, res, 'instructeur'));
router.post('/instructors', checkAuth, checkAdmin, async (req, res) => createUserByRole(req, res, 'instructeur'));
router.put('/instructors/:uid', checkAuth, checkAdmin, async (req, res) => updateUserByRole(req, res, 'instructeur'));
router.delete('/instructors/:uid', checkAuth, checkAdmin, async (req, res) => deleteUserByRole(req, res, 'instructeur'));

module.exports = router;
