# 🚀 Guide de déploiement - Railway + UptimeRobot

Ce guide vous explique comment déployer votre API en **15 minutes** gratuitement.

---

## 🚂 Étape 1 : Déployer sur Railway (10 minutes)

### 1. Créer un compte Railway

1. Allez sur **[railway.app](https://railway.app)**
2. Cliquez sur **"Start a New Project"** ou **"Login"**
3. Connectez-vous avec **GitHub** (recommandé) ou Email

### 2. Créer un nouveau projet

#### Option A : Depuis GitHub (RECOMMANDÉ)

1. **Push votre code sur GitHub** (si pas déjà fait) :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/VOTRE-USERNAME/autoecole-backend.git
   git push -u origin main
   ```

2. **Sur Railway :**
   - Cliquez sur **"New Project"**
   - Sélectionnez **"Deploy from GitHub repo"**
   - Choisissez votre repository **autoecole-backend**
   - Railway détectera automatiquement Node.js ✅

#### Option B : Depuis un repo local (si pas de GitHub)

1. **Installer Railway CLI :**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login :**
   ```bash
   railway login
   ```

3. **Déployer :**
   ```bash
   railway init
   railway up
   ```

### 3. Configurer les variables d'environnement

1. **Dans Railway Dashboard :**
   - Cliquez sur votre projet
   - Onglet **"Variables"**

2. **Ajoutez ces variables :**
   ```
   NODE_ENV=production
   PORT=5000
   
   # Firebase Admin (récupérez les valeurs depuis votre fichier .env local)
   FIREBASE_PROJECT_ID=votre-project-id
   FIREBASE_CLIENT_EMAIL=votre-client-email
   FIREBASE_PRIVATE_KEY=votre-private-key
   
   # Email (Nodemailer)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=votre-email@gmail.com
   EMAIL_PASSWORD=votre-mot-de-passe-app
   ADMIN_EMAIL=admin@autoecole.fr
   ```

   **⚠️ Important pour FIREBASE_PRIVATE_KEY :**
   - Copiez la clé AVEC les guillemets et `\n`
   - Exemple : `"-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANB...\n-----END PRIVATE KEY-----\n"`

### 4. Déployer

- Railway déploiera automatiquement ✅
- Attendez 2-3 minutes
- Vous verrez **"Success"** quand c'est prêt

### 5. Obtenir votre URL

1. Dans Railway Dashboard :
   - Cliquez sur votre service
   - Onglet **"Settings"**
   - Section **"Domains"**
   - Cliquez sur **"Generate Domain"**

2. **Votre URL sera :**
   ```
   https://autoecole-backend-production.up.railway.app
   ```

3. **Testez l'API :**
   ```bash
   curl https://VOTRE-URL.railway.app/ping
   # Devrait retourner : pong
   ```

✅ **Votre API est maintenant en ligne !**

---

## 📡 Étape 2 : Configurer UptimeRobot (5 minutes)

### 1. Créer un compte

1. Allez sur **[uptimerobot.com](https://uptimerobot.com)**
2. Cliquez sur **"Sign Up Free"**
3. Remplissez le formulaire (pas de carte bancaire requise)
4. Confirmez votre email

### 2. Ajouter un monitor

1. **Connectez-vous à votre dashboard**
2. Cliquez sur **"+ Add New Monitor"**

3. **Remplissez le formulaire :**
   ```
   Monitor Type: HTTP(s)
   Friendly Name: Auto École API
   URL (or IP): https://VOTRE-URL.railway.app/ping
   Monitoring Interval: 5 minutes
   ```

4. Cliquez sur **"Create Monitor"**

### 3. Vérification

- Vous verrez votre monitor dans le dashboard
- Statut doit être **"Up"** (vert) ✅
- Pourcentage de disponibilité : **100%**

### 4. Configurer les alertes (optionnel)

1. Cliquez sur **"My Settings"**
2. Onglet **"Alert Contacts"**
3. Ajoutez votre email
4. Vous recevrez des emails si l'API tombe

✅ **Votre API ne s'endormira plus jamais !**

---

## 🎉 Félicitations !

Votre API est maintenant :
- ✅ **Déployée sur Railway** (gratuit)
- ✅ **Toujours active** (keep-alive avec UptimeRobot)
- ✅ **Monitorée 24/7**
- ✅ **Alertes en cas de problème**

---

## 📊 Crédits gratuits Railway

Railway offre **5$ de crédits/mois** gratuitement :

**Consommation approximative :**
- API petite/moyenne : **~3-4$/mois**
- **Vous restez dans les limites gratuites !** ✅

**Calcul :**
- 500 MB RAM × 720h/mois ≈ 3.60 USD
- Avec keep-alive actif : ~3-4$/mois

---

## 🔧 Mettre à jour votre application Flutter

Modifiez l'URL de base de votre API dans Flutter :

```dart
// Avant
const String baseUrl = 'http://localhost:5000';

// Après
const String baseUrl = 'https://VOTRE-URL.railway.app';
```

---

## 🔍 Vérification finale

### 1. Testez les endpoints

```bash
# Endpoint principal
curl https://VOTRE-URL.railway.app/

# Ping
curl https://VOTRE-URL.railway.app/ping

# Health check
curl https://VOTRE-URL.railway.app/health

# Documentation Swagger
# Ouvrez dans le navigateur :
https://VOTRE-URL.railway.app/api-docs
```

### 2. Testez l'authentification

```bash
# Test login (exemple)
curl -X POST https://VOTRE-URL.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### 3. Vérifiez UptimeRobot

- Dashboard UptimeRobot doit montrer **"Up"** ✅
- Temps de réponse : ~100-300ms

---

## ⚠️ Dépannage

### L'API ne démarre pas sur Railway

**Vérifiez :**
1. Les variables d'environnement (surtout Firebase)
2. Les logs dans Railway (onglet "Deployments" → "View Logs")
3. Le `package.json` a bien le script `"start": "node server.js"`

### UptimeRobot montre "Down"

**Vérifiez :**
1. L'URL est correcte (avec https://)
2. L'endpoint `/ping` fonctionne (testez dans le navigateur)
3. Railway n'a pas d'erreur

### Firebase ne fonctionne pas

**Vérifiez :**
1. `FIREBASE_PRIVATE_KEY` contient bien les guillemets et `\n`
2. Les 3 variables Firebase sont toutes définies
3. Le projet Firebase est actif

---

## 📞 Support

**Railway :**
- Discord : https://discord.gg/railway
- Docs : https://docs.railway.app

**UptimeRobot :**
- Support : https://uptimerobot.com/contact
- Docs : https://blog.uptimerobot.com

---

## 🔄 Mises à jour futures

### Avec GitHub (automatique)

Si vous avez connecté GitHub :
```bash
git add .
git commit -m "Update API"
git push
```
→ Railway redéploiera automatiquement ✅

### Avec Railway CLI

```bash
railway up
```

---

## 💰 Après les crédits gratuits

Si vous dépassez les 5$/mois gratuits :

**Option 1 : Passer au plan payant**
- 5$/mois minimum
- Carte bancaire requise

**Option 2 : Optimiser**
- Réduire la taille de l'app
- Utiliser moins de RAM
- Désactiver le keep-alive en heures creuses

**Option 3 : Migrer vers une autre plateforme**
- Fly.io (3 VM gratuites)
- Render (750h/mois)
- Heroku alternatives

---

🎯 **Vous êtes prêt à déployer !** Suivez les étapes ci-dessus et votre API sera en ligne en 15 minutes.

