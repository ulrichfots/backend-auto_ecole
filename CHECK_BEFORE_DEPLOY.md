# ✅ Checklist avant déploiement Railway

## 📋 Vérifications rapides (5 minutes)

### 1. Fichier .env local existe et contient :

Ouvrez votre fichier `.env` local et vérifiez que vous avez :

```env
✅ FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
✅ FIREBASE_STORAGE_BUCKET=votre-project.appspot.com
✅ SMTP_HOST=smtp.gmail.com
✅ SMTP_PORT=587
✅ SMTP_USER=votre-email@gmail.com
✅ SMTP_PASS=votre_mot_de_passe_app
✅ EMAIL_PASSWORD=votre_mot_de_passe_app
```

⚠️ **Important :** 
- Le `FIREBASE_SERVICE_ACCOUNT` doit être sur **UNE SEULE ligne**
- Le mot de passe email doit être un **mot de passe d'application** (pas votre mot de passe Gmail normal)

---

### 2. Test local fonctionne

```powershell
# Démarrez le serveur
npm start

# Dans un autre terminal, testez :
curl http://localhost:5000/ping
# Devrait retourner : pong

curl http://localhost:5000/health
# Devrait retourner un JSON avec status: "ok"
```

Si ces tests fonctionnent ✅ → Vous êtes prêt pour Railway !

---

### 3. Fichiers ignorés par Git

Vérifiez que `.gitignore` contient :

```
node_modules/
.env
serviceAccountKey.json
app-auto-ecole-firebase-adminsdk-*.json
```

**Test :**
```powershell
git status
```

Vous ne devriez PAS voir :
- ❌ `.env`
- ❌ `serviceAccountKey.json`
- ❌ Fichiers Firebase privés

Si vous les voyez, ils sont dans `.gitignore` ✅

---

### 4. Compte GitHub prêt

- [ ] J'ai un compte GitHub
- [ ] J'ai créé un repository (ou je vais le créer)
- [ ] Je connais mon nom d'utilisateur GitHub

---

### 5. Code prêt à être poussé

```powershell
# Vérifiez l'état de Git
git status

# Si vous voyez des fichiers non commités, faites :
git add .
git commit -m "Prêt pour déploiement Railway"
```

---

## 🚀 Prêt à déployer ?

Si toutes les vérifications ci-dessus sont ✅, suivez maintenant :

**👉 [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)**

---

## ⚠️ Problèmes courants

### "npm start" ne fonctionne pas localement

**Solution :**
```powershell
# Réinstallez les dépendances
rm -r node_modules
npm install
npm start
```

### Firebase ne se connecte pas

**Vérifiez :**
1. Le JSON Firebase est valide (testez sur jsonlint.com)
2. Vous avez bien activé Firestore dans Firebase Console
3. Les permissions sont correctes

### Email ne fonctionne pas

**Pour Gmail, vous devez :**
1. Activer l'authentification à 2 facteurs
2. Créer un **mot de passe d'application** :
   - Allez sur https://myaccount.google.com/security
   - "Mots de passe d'application"
   - Créez un mot de passe pour "Mail"
   - Utilisez CE mot de passe dans `SMTP_PASS`

---

## 📞 Besoin d'aide ?

Si vous avez des problèmes avec cette checklist, vérifiez :
1. Les logs de votre serveur local
2. Le fichier `env.example` pour voir le format attendu
3. La documentation Firebase

---

✅ **Tout est OK ?** Passez au déploiement Railway ! 🚀

