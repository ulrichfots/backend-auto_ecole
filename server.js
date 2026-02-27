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

// ✅ 2. Importation des Routes
// Changement ici : on utilise 'auth.js'
try {
    app.use('/api/auth', require('./routes/auth'));
    console.log("✅ Route /api/auth chargée (fichier auth.js)");
} catch (error) {
    console.error("❌ Erreur : Impossible de charger ./routes/auth.js ->", error.message);
}

// ✅ 3. Configuration Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Auto École',
      version: '1.4.0',
    },
    servers: [{ url: 'https://backend-auto-ecole.onrender.com' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    // ON DÉCLARE UNE ROUTE TEST ICI DIRECTEMENT
    paths: {
      "/api/auth/login": {
        "post": {
          "tags": ["Auth"],
          "summary": "Test de connexion",
          "responses": {
            "200": { "description": "Succès" }
          }
        }
      }
    }
  },
  apis: [], // On met vide pour l'instant pour ne pas scanner les fichiers corrompus
};

try {
    const specs = swaggerJsdoc(swaggerOptions);
    app.use("/api-docs", swaggerUi.serve);
    app.get("/api-docs", swaggerUi.setup(specs, {
        swaggerOptions: { persistAuthorization: true }
    }));
    console.log("✅ Documentation Swagger configurée sur /api-docs");
} catch (err) {
    console.error("❌ Erreur Swagger:", err.message);
}

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "API Live", docs: "/api-docs" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur en ligne sur le port ${PORT}`);
});