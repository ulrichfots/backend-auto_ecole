# 🔐 Tests API de Récupération de Mot de Passe

## ✅ Endpoints créés

### **1. POST /api/auth/forgot-password**
- **Description :** Demande de réinitialisation de mot de passe
- **Paramètres :** `email`
- **Fonctionnalités :**
  - ✅ Validation du format email
  - ✅ Vérification de l'existence de l'utilisateur
  - ✅ Génération d'un token sécurisé (32 bytes)
  - ✅ Expiration automatique (10 minutes)
  - ✅ Envoi d'email HTML avec template professionnel
  - ✅ Gestion des erreurs d'envoi

### **2. POST /api/auth/resend-reset-email**
- **Description :** Renvoyer l'email de réinitialisation
- **Paramètres :** `email`
- **Fonctionnalités :**
  - ✅ Limitation des tentatives (3 en 5 minutes)
  - ✅ Invalidation des anciens tokens
  - ✅ Génération d'un nouveau token
  - ✅ Envoi d'email de renvoi

### **3. GET /api/auth/verify-reset-token**
- **Description :** Vérifier la validité d'un token de réinitialisation
- **Paramètres :** `token` (query parameter)
- **Fonctionnalités :**
  - ✅ Vérification de l'existence du token
  - ✅ Vérification de l'expiration
  - ✅ Vérification si le token est utilisé
  - ✅ Retour des informations du token

### **4. POST /api/auth/reset-password**
- **Description :** Réinitialiser le mot de passe avec un token
- **Paramètres :** `token`, `newPassword`
- **Fonctionnalités :**
  - ✅ Validation du token
  - ✅ Validation du nouveau mot de passe
  - ✅ Mise à jour dans Firebase Auth
  - ✅ Invalidation de tous les tokens de l'utilisateur
  - ✅ Sécurité renforcée

---

## 🧪 Tests à effectuer

### **Test 1 : Demande de réinitialisation**

```bash
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@autoecole.fr"
  }'
```

**Réponse attendue :**
```json
{
  "message": "Email de réinitialisation envoyé",
  "email": "admin@autoecole.fr",
  "expiresIn": "10 minutes"
}
```

### **Test 2 : Vérification du token**

```bash
# Récupérez le token depuis l'email ou les logs
TOKEN="abc123def456..."

curl -X GET "http://localhost:5000/api/auth/verify-reset-token?token=$TOKEN"
```

**Réponse attendue :**
```json
{
  "valid": true,
  "email": "admin@autoecole.fr",
  "expiresAt": "2024-01-15T12:00:00.000Z"
}
```

### **Test 3 : Réinitialisation du mot de passe**

```bash
curl -X POST http://localhost:5000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123def456...",
    "newPassword": "nouveauMotDePasse123"
  }'
```

**Réponse attendue :**
```json
{
  "message": "Mot de passe réinitialisé avec succès"
}
```

### **Test 4 : Renvoyer l'email**

```bash
curl -X POST http://localhost:5000/api/auth/resend-reset-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@autoecole.fr"
  }'
```

**Réponse attendue :**
```json
{
  "message": "Email de réinitialisation renvoyé",
  "email": "admin@autoecole.fr",
  "expiresIn": "10 minutes"
}
```

---

## 📧 Template Email

L'email de réinitialisation inclut :

### **Design professionnel :**
- ✅ Header avec logo Auto École
- ✅ Couleurs cohérentes (bleu Auto École)
- ✅ Template responsive
- ✅ Bouton d'action clair

### **Contenu informatif :**
- ✅ Salutation personnalisée
- ✅ Explication de la demande
- ✅ Bouton de réinitialisation
- ✅ Lien de secours
- ✅ Avertissements de sécurité
- ✅ Expiration du lien (10 minutes)

### **Sécurité :**
- ✅ Lien unique et sécurisé
- ✅ Expiration automatique
- ✅ Usage unique
- ✅ Avertissements anti-phishing

---

## 🔧 Configuration requise

### **Variables d'environnement :**
```env
# Email (déjà configuré)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@gmail.com
SMTP_PASS=votre_mot_de_passe_app

# Frontend URL (pour les liens dans les emails)
FRONTEND_URL=http://localhost:3000  # ou votre URL de production
```

### **Collections Firestore :**
- ✅ `users` - Utilisateurs existants
- ✅ `password_reset_tokens` - Tokens de réinitialisation (créée automatiquement)

---

## 🚀 Fonctionnalités avancées

### **Sécurité :**
- ✅ Tokens cryptographiquement sécurisés (32 bytes)
- ✅ Expiration automatique (10 minutes)
- ✅ Usage unique (token marqué comme utilisé)
- ✅ Limitation des tentatives (3 en 5 minutes)
- ✅ Invalidation des anciens tokens

### **UX :**
- ✅ Messages d'erreur clairs en français
- ✅ Email HTML professionnel
- ✅ Lien de secours si le bouton ne fonctionne pas
- ✅ Gestion des cas d'erreur

### **Performance :**
- ✅ Requêtes Firestore optimisées
- ✅ Batch operations pour l'invalidation
- ✅ Nettoyage automatique des tokens expirés

---

## 📱 Intégration Flutter

### **Page 1 : Demande de réinitialisation**
```dart
// POST /api/auth/forgot-password
final response = await http.post(
  Uri.parse('$baseUrl/api/auth/forgot-password'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'email': email}),
);
```

### **Page 2 : Vérification du token**
```dart
// GET /api/auth/verify-reset-token?token=...
final response = await http.get(
  Uri.parse('$baseUrl/api/auth/verify-reset-token?token=$token'),
);
```

### **Page 3 : Réinitialisation**
```dart
// POST /api/auth/reset-password
final response = await http.post(
  Uri.parse('$baseUrl/api/auth/reset-password'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'token': token,
    'newPassword': newPassword,
  }),
);
```

---

## 📚 Documentation Swagger

Accédez à la documentation interactive :
```
http://localhost:5000/api-docs
```

Vous y trouverez :
- ✅ Tous les endpoints de récupération de mot de passe
- ✅ Schémas de requête et réponse
- ✅ Exemples de données
- ✅ Codes d'erreur détaillés
- ✅ Tests interactifs

---

🎉 **L'API de récupération de mot de passe est complète et fonctionnelle !**
