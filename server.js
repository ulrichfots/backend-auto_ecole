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

// ✅ 2. Configuration Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Auto École',
      version: '1.4.0',
      description: 'Gestion auto-école Firebase & JWT',
    },
    servers: [
      {
        url: 'https://backend-auto-ecole-f14d.onrender.com',
        description: 'Production',
      },
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: 'Développement',
      },
    ],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      // J'ai vidé les schemas ici pour éviter les erreurs YAML si tu en as oublié un
      // Tu pourras les rajouter un par un
      schemas: {} 
    },
    // ✅ Correction du TypeError : On laisse Swagger générer les tags 
    // ou on s'assure qu'ils sont parfaitement définis sans virgule traînante
    tags: [
      { name: 'Auth' },
      { name: 'Registration' },
      { name: 'Student' }
    ],
  },
  // On cible uniquement les fichiers existants pour éviter les erreurs de lecture
  apis: ["./routes/*.js"], 
};

// Initialisation sécurisée de Swagger
try {
    const specs = swaggerJsdoc(swaggerOptions);
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, {
        swaggerOptions: { persistAuthorization: true }
    }));
} catch (err) {
    console.error("❌ Erreur Swagger JSDoc:", err);
}

// ✅ 3. Importation des Routes (IMPORTANT : Vérifie bien tes noms de fichiers)
// Si un fichier n'existe pas, Render va crash.
try {
    app.use('/api/auth', require('./routes/authRoutes'));
    // Commente ces lignes si les fichiers n'existent pas encore physiquement :
    // app.use('/api/registration', require('./routes/registrationRoutes'));
    // app.use('/api/student', require('./routes/studentRoutes'));
} catch (error) {
    console.error("❌ Erreur lors du chargement des routes:", error.message);
}

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "API Live" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur sur port ${PORT}`);
});