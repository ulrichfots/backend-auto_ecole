# 🧪 Tests API de Connexion

## ✅ Endpoints créés

### **1. POST /api/auth/login**
- **Description :** Connexion utilisateur avec email et mot de passe
- **Paramètres :** `email`, `password`, `rememberMe` (optionnel)
- **Réponse :** Token JWT + informations utilisateur

### **2. POST /api/auth/forgot-password**
- **Description :** Demande de réinitialisation de mot de passe
- **Paramètres :** `email`
- **Réponse :** Confirmation d'envoi d'email

### **3. GET /api/auth/verify-token**
- **Description :** Vérifier la validité d'un token
- **Headers :** `Authorization: Bearer <token>`
- **Réponse :** Informations utilisateur si token valide

### **4. POST /api/auth/refresh-token**
- **Description :** Rafraîchir un token d'authentification
- **Headers :** `Authorization: Bearer <token>`
- **Réponse :** Nouveau token

### **5. POST /api/auth/logout**
- **Description :** Déconnexion utilisateur
- **Headers :** `Authorization: Bearer <token>`
- **Réponse :** Confirmation de déconnexion

---

## 🧪 Tests à effectuer

### **Test 1 : Connexion avec données valides**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@autoecole.fr",
    "password": "password123",
    "rememberMe": true
  }'
```

**Réponse attendue :**
```json
{
  "message": "Connexion réussie",
  "user": {
    "uid": "abc123def456",
    "email": "admin@autoecole.fr",
    "nom": "Administrateur",
    "role": "admin",
    "statut": "actif",
    "isFirstLogin": false,
    "profileImageUrl": null
  },
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "7d"
}
```

### **Test 2 : Documentation Swagger**

Une fois le serveur démarré, accédez à la documentation interactive :

**URL :** http://localhost:5000/api-docs

Vous y trouverez :
- ✅ Tous les endpoints d'authentification
- ✅ Schémas de requête et réponse
- ✅ Exemples de données
- ✅ Tests interactifs
- ✅ Codes d'erreur détaillés

---

## 🔧 Fonctionnalités implémentées

### **Sécurité :**
- ✅ Validation des données d'entrée
- ✅ Vérification du format email
- ✅ Validation de la longueur du mot de passe
- ✅ Tokens JWT avec Firebase Admin
- ✅ Gestion des statuts de compte (actif, suspendu, en attente)

### **UX :**
- ✅ Support "Se souvenir de moi" (tokens longue durée)
- ✅ Messages d'erreur clairs en français
- ✅ Gestion des premières connexions
- ✅ Vérification de token en temps réel

### **Documentation :**
- ✅ Documentation Swagger complète
- ✅ Schémas réutilisables
- ✅ Exemples de requêtes/réponses
- ✅ Codes d'erreur détaillés

---

🎉 **L'API de connexion est complète et fonctionnelle !**
