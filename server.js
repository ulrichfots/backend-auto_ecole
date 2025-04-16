require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// ✅ Configuration CORS avancée (pour éviter l'erreur "No 'Access-Control-Allow-Origin'")
app.use(cors({
  origin: [
    'http://localhost:52366', // ton app Flutter Web en local
    'http://localhost:3000',  // (optionnel) si tu as aussi un front React
    'https://ton-frontend.onrender.com' // si tu as aussi déployé ton front web sur Render
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());

// ✅ Test route
app.get("/", (req, res) => {
  res.send("API Auto École fonctionne !");
});

// ✅ Tes routes
const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);

const courseRoutes = require("./routes/courses");
app.use("/courses", courseRoutes);

// ✅ Lancement du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
