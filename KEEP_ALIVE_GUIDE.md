# 🔄 Guide : Garder l'API éveillée gratuitement

Ce guide explique comment garder votre API active 24/7 sans qu'elle s'endorme.

## 🎯 Endpoints disponibles

Votre API a maintenant 2 endpoints pour le monitoring :

- **`/health`** : Retourne le statut détaillé de l'API
  ```json
  {
    "status": "ok",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "uptime": 3600
  }
  ```

- **`/ping`** : Retourne simplement "pong" (plus léger)
  ```
  pong
  ```

---

## ✅ Solution 1 : UptimeRobot (RECOMMANDÉ)

### Pourquoi UptimeRobot ?
- ✅ 100% gratuit (pas de carte bancaire)
- ✅ Ping toutes les 5 minutes
- ✅ 50 monitors gratuits
- ✅ Dashboard de monitoring
- ✅ Alertes email si l'API tombe
- ✅ Aucun code nécessaire

### Configuration (5 minutes)

1. **Créer un compte**
   - Allez sur https://uptimerobot.com
   - Cliquez sur "Sign Up Free"
   - Confirmez votre email

2. **Ajouter un monitor**
   - Connectez-vous à votre dashboard
   - Cliquez sur "+ Add New Monitor"
   - Remplissez le formulaire :
     ```
     Monitor Type: HTTP(s)
     Friendly Name: Auto École API
     URL: https://VOTRE-APP.onrender.com/ping
     Monitoring Interval: 5 minutes
     ```
   - Cliquez sur "Create Monitor"

3. **Vérification**
   - Le monitor apparaîtra dans votre dashboard
   - Statut : "Up" (vert) = API active ✅
   - Statut : "Down" (rouge) = API en panne ❌

### Configuration avancée (optionnelle)

Pour recevoir des alertes :
- Allez dans "My Settings" → "Alert Contacts"
- Ajoutez votre email
- UptimeRobot vous enverra un email si l'API tombe

---

## ✅ Solution 2 : Cron-job.org (Alternative)

### Pourquoi Cron-job.org ?
- ✅ 100% gratuit
- ✅ Ping jusqu'à toutes les 1 minute (plan gratuit : 5 min)
- ✅ Interface simple

### Configuration

1. **Créer un compte**
   - Allez sur https://cron-job.org
   - Créez un compte gratuit

2. **Créer un cron job**
   - Cliquez sur "Create cronjob"
   - Configuration :
     ```
     Title: Keep API Alive
     URL: https://VOTRE-APP.onrender.com/health
     Schedule: Every 5 minutes
     ```
   - Sauvegardez

---

## ✅ Solution 3 : GitHub Actions (Développeurs)

### Pourquoi GitHub Actions ?
- ✅ Gratuit si vous avez un repo GitHub
- ✅ 2000 minutes gratuites/mois
- ✅ Ping toutes les 14 minutes = ~3000 pings/mois
- ✅ Contrôle total

### Configuration

Le fichier `.github/workflows/keep-alive.yml` a déjà été créé dans votre projet.

**Pour l'activer :**

1. **Modifier le fichier**
   - Ouvrez `.github/workflows/keep-alive.yml`
   - Remplacez `https://votre-app.onrender.com` par votre vraie URL

2. **Push vers GitHub**
   ```bash
   git add .github/workflows/keep-alive.yml
   git commit -m "Add keep-alive workflow"
   git push
   ```

3. **Activer GitHub Actions**
   - Allez sur votre repo GitHub
   - Onglet "Actions"
   - Activez les workflows si demandé

4. **Tester manuellement**
   - Dans "Actions", cliquez sur "Keep API Alive"
   - Cliquez sur "Run workflow"
   - Vérifiez que ça fonctionne ✅

---

## 📊 Comparaison des solutions

| Solution | Intervalle | Setup | Monitoring | Alertes |
|----------|-----------|-------|------------|---------|
| **UptimeRobot** | 5 min | ⭐⭐⭐ Facile | ✅ Oui | ✅ Oui |
| **Cron-job.org** | 5 min | ⭐⭐⭐ Facile | ✅ Oui | ⚠️ Limité |
| **GitHub Actions** | 14 min | ⭐⭐ Moyen | ⚠️ Via logs | ❌ Non |

---

## 🎯 Recommandation

**Pour la plupart des cas : UptimeRobot**
- Configuration en 5 minutes
- Dashboard de monitoring
- Alertes email gratuites
- Ping toutes les 5 minutes

**Si vous êtes développeur : GitHub Actions**
- Contrôle total
- Pas de dépendance externe
- Gratuit avec GitHub

---

## ⚠️ Notes importantes

### Limites du plan gratuit Render/Railway
- Le service peut quand même s'endormir si vous dépassez les heures gratuites
- Render gratuit : 750 heures/mois (~31 jours)
- Railway gratuit : 5$/mois de crédits

### Consommation avec keep-alive
- **Sans keep-alive** : ~500 heures/mois (service s'endort souvent)
- **Avec keep-alive** : ~720-750 heures/mois (service toujours actif)

✅ Avec un seul service, vous resterez dans les limites gratuites !

---

## 🔧 Vérification

Pour tester que tout fonctionne :

1. **Testez les endpoints localement**
   ```bash
   npm start
   # Dans un autre terminal :
   curl http://localhost:5000/ping
   curl http://localhost:5000/health
   ```

2. **Testez après déploiement**
   ```bash
   curl https://votre-app.onrender.com/ping
   curl https://votre-app.onrender.com/health
   ```

3. **Vérifiez le monitoring**
   - UptimeRobot : Dashboard doit montrer "Up" ✅
   - GitHub Actions : Vérifiez les logs dans l'onglet "Actions"

---

## 🚀 Prochaines étapes

1. ✅ Déployez votre API sur Render/Railway
2. ✅ Notez l'URL de production
3. ✅ Configurez UptimeRobot avec cette URL
4. ✅ Vérifiez que le monitoring fonctionne
5. 🎉 Votre API restera active 24/7 !

---

## ❓ Questions fréquentes

**Q: Le ping consomme-t-il beaucoup de ressources ?**  
R: Non, les endpoints `/ping` et `/health` sont ultra légers.

**Q: Puis-je utiliser plusieurs solutions en même temps ?**  
R: Oui ! Vous pouvez combiner UptimeRobot + GitHub Actions pour plus de fiabilité.

**Q: Que se passe-t-il si je dépasse les heures gratuites ?**  
R: Le service s'arrêtera jusqu'au mois prochain OU vous devrez passer au plan payant.

**Q: Le keep-alive fonctionne-t-il avec toutes les plateformes ?**  
R: Oui ! Render, Railway, Fly.io, Koyeb, etc. Tant que vous avez une URL publique.

---

🎉 **C'est tout ! Votre API restera maintenant éveillée 24/7 gratuitement !**

