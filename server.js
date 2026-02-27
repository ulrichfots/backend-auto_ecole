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
      description: 'Gestion complète de l\'authentification'
    },
    servers: [
      { url: 'https://backend-auto-ecole.onrender.com', description: 'Production' },
      { url: `http://localhost:${process.env.PORT || 5000}`, description: 'Local' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    },
    paths: {
      "/api/auth/login": {
        "post": {
          "tags": ["Auth"],
          "summary": "Connexion utilisateur",
          "requestBody": {
            "required": true,
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "email": { "type": "string", "example": "admin@test.com" },
                    "password": { "type": "string", "example": "password123" }
                  }
                }
              }
            }
          },
          "responses": { "200": { "description": "Token généré" }, "401": { "description": "Identifiants invalides" } }
        }
      },
      "/api/auth/verify-token": {
        "get": {
          "tags": ["Auth"],
          "summary": "Vérifier le token JWT",
          "security": [{ "bearerAuth": [] }],
          "responses": { "200": { "description": "Token valide" }, "401": { "description": "Non autorisé" } }
        }
      },
      "/api/auth/forgot-password": {
        "post": {
          "tags": ["Auth"],
          "summary": "Réinitialisation du mot de passe",
          "requestBody": {
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": { "email": { "type": "string" } }
                }
              }
            }
          },
          "responses": { "200": { "description": "Email envoyé" } }
        }
      },
      "/api/auth/createUser": {
        "post": {
          "tags": ["Auth"],
          "summary": "Créer un utilisateur (Admin uniquement)",
          "security": [{ "bearerAuth": [] }],
          "requestBody": {
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "email": { "type": "string" },
                    "password": { "type": "string" },
                    "role": { "type": "string", "enum": ["admin", "instructeur", "eleve"] }
                  }
                }
              }
            }
          },
          "responses": { "201": { "description": "Utilisateur créé" }, "403": { "description": "Accès refusé" } }
        }
      }
    }
  },
  apis: [] // On laisse vide pour éviter les erreurs de scan
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