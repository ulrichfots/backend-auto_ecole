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

try {
    app.use('/api/registration', require('./routes/registration'));
    console.log("Route /api/registration chargee");
} catch (error) {
    console.error("Erreur chargement route registration:", error.message);
}
try {
    app.use('/api/seed', require('./routes/seed'));
    console.log("Route /api/seed chargee");
} catch (error) {
    console.error("Erreur chargement route seed:", error.message);
}
try {
    app.use('/api/settings', require('./routes/settings'));
    console.log("Route /api/settings chargee");
} catch (error) {
    console.error("Erreur chargement route settings:", error.message);
}
try {
    app.use('/api/reservations', require('./routes/reservations'));
    console.log("Route /api/reservations chargee");
} catch (error) {
    console.error("Erreur chargement route reservations:", error.message);
}
try {
    app.use('/api/notifications', require('./routes/notifications'));
    console.log("Route /api/notifications chargee");
} catch (error) {
    console.error("Erreur chargement route notifications:", error.message);
}

// ✅ Endpoint de test SMTP
const emailService = require('./services/emailService');
app.get('/api/test-smtp', async (req, res) => {
  try {
    console.log('🧪 Test de connexion SMTP...');
    const isConnected = await emailService.verifyConnection();
    
    if (isConnected) {
      res.json({
        success: true,
        message: '✅ Connexion SMTP réussie',
        config: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          user: process.env.SMTP_USER
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: '❌ Connexion SMTP échouée',
        config: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          user: process.env.SMTP_USER
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

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
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Erreur serveur' },
            details: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } }
              ]
            },
            message: { type: 'string', example: 'Une erreur est survenue' }
          }
        }
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
