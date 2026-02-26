const { admin } = require('../firebase');
const emailService = require('../services/emailService');
const crypto = require('crypto');

// --- MIDDLEWARE : CHECK ADMIN ---
exports.checkAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Token non fourni' });

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Accès non autorisé' });
        }
        req.user = decodedToken;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token invalide' });
    }
};

// --- TACHES-41 : LOGIN ---
exports.login = async (req, res) => {
    const { email, password, rememberMe } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Format d\'email invalide' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        }

        const usersSnapshot = await admin.firestore()
            .collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (usersSnapshot.empty) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();

        if (userData.statut === 'suspendu') {
            return res.status(403).json({ error: 'Votre compte a été suspendu.' });
        }

        if (userData.statut === 'en attente') {
            return res.status(403).json({ error: 'Votre compte est en attente', status: 'en attente' });
        }

        const customToken = await admin.auth().createCustomToken(userDoc.id, {
            role: userData.role,
            email: userData.email
        });

        res.status(200).json({
            message: 'Connexion réussie',
            user: {
                uid: userDoc.id,
                email: userData.email,
                nom: userData.nom || userData.nomComplet || '',
                role: userData.role,
                statut: userData.statut,
                isFirstLogin: userData.isFirstLogin || false,
                profileImageUrl: userData.profileImageUrl || null
            },
            token: customToken,
            expiresIn: rememberMe ? '7d' : '1d'
        });
    } catch (error) {
        console.error('Erreur login:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// --- VERIFY TOKEN ---
exports.verifyToken = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
        
        if (!userDoc.exists) return res.status(401).json({ valid: false, error: 'Utilisateur non trouvé' });

        const userData = userDoc.data();
        res.status(200).json({
            valid: true,
            user: { 
                uid: userDoc.id, 
                email: userData.email, 
                role: userData.role,
                nom: userData.nom || userData.nomComplet || '',
                statut: userData.statut
            }
        });
    } catch (error) {
        res.status(401).json({ valid: false, error: 'Token invalide' });
    }
};

// --- TACHES-42 : FORGOT PASSWORD ---
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        if (!email) return res.status(400).json({ error: 'Email requis' });

        const usersSnapshot = await admin.firestore().collection('users').where('email', '==', email).limit(1).get();
        if (usersSnapshot.empty) return res.status(400).json({ error: 'Compte introuvable' });

        const userDoc = usersSnapshot.docs[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await admin.firestore().collection('password_reset_tokens').doc(resetToken).set({
            userId: userDoc.id,
            email: email,
            expiresAt: expiresAt,
            used: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await emailService.sendPasswordResetEmail(email, resetToken, userDoc.data().nom || 'Utilisateur');

        res.status(200).json({ message: 'Email de réinitialisation envoyé', email, expiresIn: '10 minutes' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur interne' });
    }
};

// --- DEBUG TOKEN ---
exports.debugToken = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();

        res.status(200).json({
            success: true,
            tokenInfo: { uid: decodedToken.uid, email: decodedToken.email },
            userInfo: userDoc.exists ? userDoc.data() : 'Non trouvé'
        });
    } catch (error) {
        res.status(401).json({ error: 'Token invalide' });
    }
};

// --- TACHES-43 : CREATE USER ---
exports.createUser = async (req, res) => {
    const { email, password, nom, role } = req.body;
    try {
        const userRecord = await admin.auth().createUser({ email, password });
        await admin.firestore().collection('users').doc(userRecord.uid).set({
            email, nom, role,
            statut: 'en attente',
            isFirstLogin: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            theoreticalHours: 0, practicalHours: 0
        });
        res.status(200).json({ message: 'Utilisateur créé avec succès', userId: userRecord.uid });
    } catch (error) {
        res.status(400).json({ error: 'Erreur création', details: error.message });
    }
};

// --- REFRESH TOKEN ---
exports.refreshToken = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
        
        const userData = userDoc.data();
        const customToken = await admin.auth().createCustomToken(decodedToken.uid, {
            role: userData.role,
            email: userData.email
        });

        res.status(200).json({ message: 'Token rafraîchi', token: customToken });
    } catch (error) {
        res.status(401).json({ error: 'Token invalide' });
    }
};

// --- LOGOUT ---
exports.logout = async (req, res) => {
    res.status(200).json({ message: 'Déconnexion réussie' });
};