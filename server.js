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

try {
    app.use('/api/student', require('./routes/student'));
    console.log("Route /api/student chargee");
} catch (error) {
    console.error("Erreur chargement route student:", error.message);
}

try {
    app.use('/api/student-profile', require('./routes/studentProfile'));
    console.log("Route /api/student-profile chargee");
} catch (error) {
    console.error("Erreur chargement route student-profile:", error.message);
}

try {
    app.use('/api/sessions', require('./routes/sessions'));
    console.log("Route /api/sessions chargee");
} catch (error) {
    console.error("Erreur chargement route sessions:", error.message);
}

try {
    app.use('/api/news', require('./routes/news'));
    console.log("Route /api/news chargee");
} catch (error) {
    console.error("Erreur chargement route news:", error.message);
}

try {
    app.use('/api/comments', require('./routes/comments'));
    console.log("Route /api/comments chargee");
} catch (error) {
    console.error("Erreur chargement route comments:", error.message);
}

try {
    app.use('/api/dashboard', require('./routes/dashboard'));
    console.log("Route /api/dashboard chargee");
} catch (error) {
    console.error("Erreur chargement route dashboard:", error.message);
}

try {
    app.use('/api/users', require('./routes/users'));
    console.log("Route /api/users chargee");
} catch (error) {
    console.error("Erreur chargement route users:", error.message);
}

// ✅ 3. Configuration Swagger
// ... (tes imports restent les mêmes)

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Auto École',
      version: '1.4.0',
    },
    servers: [
      { url: 'https://backend-auto-ecole.onrender.com' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    },
  },
  // On liste les dossiers un par un pour ne pas saturer le parseur
 apis: [
  "./routes/*.js",     // toutes les routes (y compris auth.js)
  // "./models/*.js"    // si tu veux garder la doc de tes modèles, sinon tu peux commenter
], 
};

// ... (le reste de ton code)

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
