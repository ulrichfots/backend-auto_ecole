require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const app = express();

// ✅ 1. Configuration CORS unique et globale
// Cette configuration gère tout (Render, Localhost et Swagger)
app.use(cors({
  origin: true, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));

app.use(express.json());

// ✅ 2. Middleware de debug (Utile pour voir les erreurs d'origine sur Render)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${req.method} ${req.url} - Origin: ${req.headers.origin || 'Direct Access'}`);
  }
  next();
});

// ✅ 3. Configuration Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Auto École',
      version: '1.4.0',
      description: 'API complète pour la gestion d\'une auto-école avec authentification Firebase, inscriptions avec création automatique de comptes utilisateur avec mots de passe, gestion des rôles, pages de profil, support et paramètres utilisateur',
    },
    servers: [
      {
        url: 'https://backend-auto-ecole-f14d.onrender.com',
        description: 'Serveur de production',
      },
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: 'Serveur de développement',
      },
    ],
    // ✅ ACTIVE LA SÉCURITÉ GLOBALE (Le cadenas sur Swagger)
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        // ... (Garde tous tes schémas ici, je les ai omis pour la lisibilité)
        DashboardStats: { type: 'object', properties: { /* ... */ } },
        StudentProfile: { type: 'object', properties: { /* ... */ } },
        // Ajoute tes schémas NewsArticle, Session, etc., tels que définis dans ton message
      }
    },
    tags: [
      { name: 'Auth', description: 'Endpoints d\'authentification' },
      { name: 'Registration', description: 'Endpoints d\'inscription' },
      { name: 'Student', description: 'Endpoints des étudiants' },
      { name: 'Sessions', description: 'Endpoints des séances' },
      { name: 'Dashboard', description: 'Endpoints du tableau de bord' },
      // ... autres tags
    ],
  },
  // ✅ IMPORTANT : Scanner server.js ET les fichiers dans le dossier routes
  apis: ["./server.js", "./routes/*.js"], 
};

const specs = swaggerJsdoc(swaggerOptions);

// ✅ 4. Montage de Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, {
  swaggerOptions: {
    persistAuthorization: true, // Garde le token même après un refresh
  }
}));

// ✅ 5. Importation des Routes
// Assure-toi que les noms de fichiers correspondent à tes fichiers réels
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/registration', require('./routes/registrationRoutes'));
app.use('/api/student', require('./routes/studentRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
// ... ajoute les autres selon tes fichiers

// ✅ 6. Route de base
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 API Auto-École opérationnelle !", 
    documentation: "/api-docs" 
  });
});

// ✅ 7. Lancement du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ✅ Serveur démarré avec succès !
  🌍 Local: http://localhost:${PORT}
  📄 Doc: http://localhost:${PORT}/api-docs
  `);
});