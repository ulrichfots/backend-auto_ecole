require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const app = express();

// ✅ 1. Configuration CORS
app.use(cors({
  origin: true, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));

app.use(express.json());

// ✅ 2. Chargement des routes (Ajoute tes autres routes ici au besoin)
try {
    app.use('/api/auth', require('./routes/auth'));
    console.log("✅ Route /api/auth chargée");
} catch (error) {
    console.error("❌ Erreur chargement routes:", error.message);
}

// ✅ 3. Configuration Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Auto École',
      version: '1.4.0',
      description: 'API complète : Auth, Registration, Student, Sessions, News, Support, etc.',
    },
    servers: [
      { url: 'https://backend-auto-ecole.onrender.com', description: 'Production' },
      { url: `http://localhost:${process.env.PORT || 5000}`, description: 'Développement' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  // ✅ SCAN TOTAL : Routes, Modèles et Contrôleurs pour ne rater aucun Schéma
  apis: [
    "./routes/*.js",
    "./models/*.js",
    "./controllers/*.js"
  ], 
};

try {
    const specs = swaggerJsdoc(swaggerOptions);
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, {
        swaggerOptions: { persistAuthorization: true }
    }));
    console.log("✅ Documentation Swagger configurée sur /api-docs");
} catch (err) {
    console.error("❌ Erreur Swagger JSDoc:", err.message);
}

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "API Live", docs: "/api-docs" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur en ligne sur le port ${PORT}`);
});