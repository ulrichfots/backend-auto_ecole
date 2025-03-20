const express = require("express");
const { admin, db } = require("../firebase");

const router = express.Router();

// Middleware pour vérifier le token Firebase
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split("Bearer ")[1];

    if (!token) {
        return res.status(401).send("Accès interdit");
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        res.status(403).send("Token invalide");
    }
};

// Récupérer les infos utilisateur
router.get("/me", verifyToken, async (req, res) => {
    const user = await db.collection("users").doc(req.user.uid).get();
    
    if (!user.exists) {
        return res.status(404).send("Utilisateur non trouvé");
    }

    res.send(user.data());
});

module.exports = router;
