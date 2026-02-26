const { admin } = require('../firebase');
const emailService = require('../services/emailService');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Récupération du secret depuis le .env
const JWT_SECRET = process.env.JWT_SECRET || 'votre_cle_secrete_ici';

// --- MIDDLEWARE : CHECK ADMIN ---
exports.checkAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Token non fourni' });

        const token = authHeader.split('Bearer ')[1];
        // Utilisation de JWT au lieu de Firebase Admin pour la vérification
        const decodedToken = jwt.verify(token, JWT_SECRET);
        
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

        // Vérification du statut
        if (userData.statut === 'suspendu') {
            return res.status(403).json({ error: 'Votre compte a été suspendu.' });
        }
        if (userData.statut === 'en attente') {
            return res.status(403).json({ error: 'Votre compte est en attente', status: 'en attente' });
        }

        // Génération du JWT
        const token = jwt.sign(
            { uid: userDoc.id, email: userData.email, role: userData.role },
            JWT_SECRET,
            { expiresIn: rememberMe ? '7d' : '24h' }
        );

        res.status(200).json({
            message: 'Connexion réussie',
            user: {
                uid: userDoc.id,
                email: userData.email,
                nom: userData.nom || userData.nomComplet || '',
                role: userData.role,
                statut: userData.statut,
                isFirstLogin: userData.isFirstLogin || false
            },
            token: token
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
        const decodedToken = jwt.verify(token, JWT_SECRET);
        
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

// --- DEBUG TOKEN ---
exports.debugToken = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = jwt.verify(token, JWT_SECRET);
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
// --- TACHES-42 : FORGOT PASSWORD ---

exports.forgotPassword = async (req, res) => {

    const { email } = req.body;

    try {

        if (!email) {

            return res.status(400).json({ error: 'Email requis' });

        }



        // 1. Vérifier si l'utilisateur existe dans Firestore

        const userSnapshot = await admin.firestore()

            .collection('users')

            .where('email', '==', email)

            .limit(1)

            .get();



        if (userSnapshot.empty) {

            // Pour la sécurité, on répond souvent "Lien envoyé" même si l'email n'existe pas

            return res.status(200).json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });

        }



        // 2. Générer un lien de réinitialisation via Firebase Auth

        const link = await admin.auth().generatePasswordResetLink(email);



        // 3. Envoyer l'email via ton service d'email

        // Note: Cela utilisera le SMTP_PASS que tu configureras plus tard avec ton client

        await emailService.sendResetPasswordEmail(email, link);



        res.status(200).json({ message: 'Lien de réinitialisation envoyé avec succès' });

    } catch (error) {

        console.error('Erreur forgotPassword:', error);

        res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });

    }

};


// --- TACHES-43 : CREATE USER ---
exports.createUser = async (req, res) => {
    const { email, password, nom, role } = req.body;
    try {
        // Ici on garde admin.auth() pour créer le compte dans Firebase Auth
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
        if (!authHeader) return res.status(401).json({ error: 'Token non fourni' });

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = jwt.verify(token, JWT_SECRET);

        // On génère un nouveau token tout frais
        const newToken = jwt.sign(
            { uid: decodedToken.uid, email: decodedToken.email, role: decodedToken.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({ token: newToken });
    } catch (error) {
        res.status(401).json({ error: 'Session expirée' });
    }
};
// --- LOGOUT ---
exports.logout = async (req, res) => {
    res.status(200).json({ message: 'Déconnexion réussie' });
};