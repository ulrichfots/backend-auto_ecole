# 🚂 Déploiement sur Railway - Guide Simple

## ✅ Étape 1 : Préparation (5 min)

### Vérifiez que vous avez :
- ✅ Un compte GitHub (gratuit)
- ✅ Votre code local prêt
- ✅ Les informations Firebase (dans votre fichier .env local)

---

## 🚀 Étape 2 : Push sur GitHub (si pas déjà fait)

### Si vous n'avez PAS encore de repository GitHub :

1. **Créez un repository sur GitHub :**
   - Allez sur https://github.com/new
   - Nom : `autoecole-backend`
   - Type : Private (recommandé) ou Public
   - Cliquez sur "Create repository"

2. **Dans votre terminal PowerShell :**
   ```powershell
   # Initialisez Git (si pas déjà fait)
   git init
   
   # Ajoutez tous les fichiers
   git add .
   
   # Faites un commit
   git commit -m "Premier déploiement Railway"
   
   # Liez à votre repository GitHub (remplacez VOTRE-USERNAME)
   git remote add origin https://github.com/VOTRE-USERNAME/autoecole-backend.git
   
   # Poussez sur GitHub
   git branch -M main
   git push -u origin main
   ```

### Si vous avez DÉJÀ un repository GitHub :

```powershell
# Ajoutez les nouveaux fichiers
git add .

# Commit
git commit -m "Préparation déploiement Railway"

# Push
git push
```

---

## 🚂 Étape 3 : Déployer sur Railway (10 min)

### 1. Créer un compte Railway

1. Allez sur **https://railway.app**
2. Cliquez sur **"Start a New Project"** ou **"Login"**
3. Choisissez **"Login with GitHub"**
4. Autorisez Railway à accéder à vos repositories

### 2. Créer un nouveau projet

1. Sur Railway Dashboard, cliquez sur **"New Project"**
2. Sélectionnez **"Deploy from GitHub repo"**
3. Choisissez le repository **autoecole-backend**
4. Railway va détecter automatiquement Node.js et commencer le build ✅

### 3. Attendre le premier déploiement

- Railway va installer les dépendances (`npm install`)
- Cela prendra 2-3 minutes
- ⚠️ **Le déploiement ÉCHOUERA** - C'est normal ! Il manque les variables d'environnement

---

## ⚙️ Étape 4 : Configuration des variables d'environnement (5 min)

### 1. Accéder aux variables

1. Dans Railway Dashboard, cliquez sur votre projet **autoecole-backend**
2. Cliquez sur l'onglet **"Variables"**

### 2. Ajouter les variables

Cliquez sur **"New Variable"** et ajoutez UNE PAR UNE :

#### Variables obligatoires :

```
NODE_ENV=production
```

```
PORT=5000
```

#### Firebase (récupérez depuis votre fichier .env local) :

```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"VOTRE_PROJECT_ID","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```

```
FIREBASE_STORAGE_BUCKET=VOTRE-PROJECT-ID.appspot.com
```

#### Email (Nodemailer) :

```
SMTP_HOST=smtp.gmail.com
```

```
SMTP_PORT=587
```

```
SMTP_USER=votre-email@gmail.com
```

```
SMTP_PASS=votre_mot_de_passe_app
```

```
EMAIL_PASSWORD=votre_mot_de_passe_app
```

### 3. Redéployer

- Railway redéploiera automatiquement quand vous ajoutez les variables
- Attendez 2-3 minutes
- Vous devriez voir **"Success"** ✅

---

## 🌐 Étape 5 : Obtenir votre URL (2 min)

### 1. Générer un domaine

1. Dans votre projet Railway
2. Cliquez sur **"Settings"**
3. Section **"Networking"**
4. Cliquez sur **"Generate Domain"**

### 2. Votre URL

Railway générera une URL comme :
```
https://autoecole-backend-production.up.railway.app
```

### 3. Testez votre API

Ouvrez dans le navigateur ou utilisez curl :

```powershell
# Test principal
curl https://VOTRE-URL.railway.app/

# Test ping
curl https://VOTRE-URL.railway.app/ping

# Test health
curl https://VOTRE-URL.railway.app/health
```

Vous devriez voir :
```
pong
```

### 4. Documentation Swagger

Ouvrez dans le navigateur :
```
https://VOTRE-URL.railway.app/api-docs
```

Vous devriez voir la documentation interactive de votre API ✅

---

## 📡 Étape 6 : Configurer UptimeRobot (Keep-Alive) (5 min)

### 1. Créer un compte UptimeRobot

1. Allez sur **https://uptimerobot.com**
2. Cliquez sur **"Sign Up Free"**
3. Créez un compte (pas de carte bancaire)
4. Confirmez votre email

### 2. Ajouter un monitor

1. Connectez-vous à UptimeRobot
2. Cliquez sur **"+ Add New Monitor"**
3. Remplissez :
   ```
   Monitor Type: HTTP(s)
   Friendly Name: Auto École API
   URL: https://VOTRE-URL.railway.app/ping
   Monitoring Interval: 5 minutes
   ```
4. Cliquez sur **"Create Monitor"**

### 3. Vérification

- Le monitor apparaît dans votre dashboard
- Statut : **"Up"** (vert) ✅
- Votre API ne s'endormira plus jamais ! 🎉

---

## 🎉 Félicitations !

Votre API est maintenant :
- ✅ Déployée sur Railway
- ✅ Accessible via une URL publique
- ✅ Toujours active (keep-alive)
- ✅ Monitorée 24/7

---

## 📱 Mettre à jour votre application Flutter

Modifiez l'URL de base dans votre app Flutter :

```dart
// lib/config/api_config.dart ou équivalent

// AVANT
const String baseUrl = 'http://localhost:5000';

// APRÈS  
const String baseUrl = 'https://VOTRE-URL.railway.app';
```

Rebuild votre app Flutter et testez ! 🚀

---

## 🔄 Mises à jour futures

Pour mettre à jour votre API :

```powershell
# Modifiez votre code
# Puis :

git add .
git commit -m "Mise à jour de l'API"
git push
```

**Railway redéploiera automatiquement !** ✅

---

## 💰 Crédits gratuits Railway

Railway offre **5$ de crédits GRATUITS par mois** :

- Votre API consommera ~3-4$/mois
- **Vous restez dans le gratuit !** ✅
- Pas de carte bancaire requise pour commencer

---

## ⚠️ Dépannage

### Le déploiement échoue

**Vérifiez :**
1. Toutes les variables d'environnement sont définies
2. `FIREBASE_SERVICE_ACCOUNT` est un JSON valide (sur une seule ligne)
3. Les logs Railway (onglet "Deployments" → cliquez sur le déploiement → "View Logs")

### Firebase ne fonctionne pas

**Vérifiez :**
1. Le JSON Firebase est correctement formaté
2. Le fichier `serviceAccountKey.json` n'est PAS poussé sur GitHub (vérifiez `.gitignore`)
3. Les permissions Firebase sont correctes

### L'API ne répond pas

**Vérifiez :**
1. Le domaine est bien généré dans Settings → Networking
2. L'URL est accessible dans le navigateur
3. Les logs Railway ne montrent pas d'erreurs

### Besoin d'aide ?

- **Railway Discord** : https://discord.gg/railway
- **Railway Docs** : https://docs.railway.app
- **UptimeRobot Support** : https://uptimerobot.com/contact

---

## 📊 Vérification finale

### Checklist :

- [ ] Code poussé sur GitHub
- [ ] Projet créé sur Railway
- [ ] Variables d'environnement configurées
- [ ] Déploiement réussi (status "Success")
- [ ] Domaine généré
- [ ] URL accessible (teste /ping)
- [ ] UptimeRobot configuré
- [ ] Monitor "Up" sur UptimeRobot
- [ ] App Flutter mise à jour avec la nouvelle URL

---

🎯 **Tout fonctionne ? Parfait ! Votre API est maintenant en production !** 🚀

