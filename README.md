# 🚗 Auto École - Backend API

API backend pour l'application de gestion d'auto-école.

## 🚀 Déploiement sur Railway

**Suivez le guide :** [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)

## 🔗 Endpoints principaux

- `GET /` - Page d'accueil
- `GET /ping` - Test rapide (keep-alive)
- `GET /health` - Vérification santé de l'API
- `GET /api-docs` - Documentation Swagger

## 📁 Structure

```
autoecole-backend/
├── routes/           # Routes de l'API
├── services/         # Services (email, users, etc.)
├── middlewares/      # Middlewares (auth, validation)
├── server.js         # Point d'entrée
├── firebase.js       # Configuration Firebase
└── package.json      # Dépendances
```

## 🛠️ Développement local

```bash
# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp env.example .env
# Puis éditer .env avec vos vraies valeurs

# Démarrer le serveur
npm start
```

L'API sera disponible sur `http://localhost:5000`

## 📚 Documentation

- **Déploiement Railway** : [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)
- **Keep-Alive** : [KEEP_ALIVE_GUIDE.md](./KEEP_ALIVE_GUIDE.md)
- **Documentation API** : `/api-docs` (Swagger)

## 🔐 Variables d'environnement

Voir `env.example` pour la liste complète.

Variables obligatoires :
- `FIREBASE_SERVICE_ACCOUNT` - Credentials Firebase
- `FIREBASE_STORAGE_BUCKET` - Bucket Firebase
- `SMTP_*` - Configuration email

## 📞 Support

Pour toute question sur le déploiement, consultez [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)

