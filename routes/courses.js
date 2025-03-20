const express = require("express");
const { db } = require("../firebase");

const router = express.Router();

// Créer un cours
router.post("/", async (req, res) => {
    const { title, instructorId, schedule } = req.body;

    const courseRef = await db.collection("courses").add({
        title,
        instructorId,
        schedule,
    });

    res.send({ id: courseRef.id });
});

// Récupérer tous les cours
router.get("/", async (req, res) => {
    const snapshot = await db.collection("courses").get();
    const courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.send(courses);
});

module.exports = router;