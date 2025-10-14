# 👤 Tests API des Pages de Profil

## ✅ Nouvelles APIs créées

### **1. GET /api/sessions/me**
- **Description :** Récupérer les séances de l'utilisateur connecté
- **Authentification :** Requise
- **Paramètres :**
  - `limit`: nombre max de séances (défaut: 20)
- **Réponse :** Séances formatées pour la page "Mes séances"

### **2. GET /api/settings**
- **Description :** Récupérer les paramètres de l'utilisateur
- **Authentification :** Requise
- **Réponse :** Paramètres de sécurité, notifications et profil

### **3. PATCH /api/settings/notifications**
- **Description :** Mettre à jour les préférences de notification
- **Authentification :** Requise
- **Body :** `{ sessionReminders: boolean, newsUpdates: boolean }`

### **4. PATCH /api/settings/password**
- **Description :** Changer le mot de passe
- **Authentification :** Requise
- **Body :** `{ currentPassword: string, newPassword: string }`

### **5. PATCH /api/settings/two-factor**
- **Description :** Activer/désactiver l'authentification à deux facteurs
- **Authentification :** Requise
- **Body :** `{ enabled: boolean }`

### **6. DELETE /api/settings/delete-account**
- **Description :** Supprimer le compte utilisateur
- **Authentification :** Requise
- **Body :** `{ confirmation: "SUPPRIMER" }`

### **7. POST /api/support/contact**
- **Description :** Envoyer un message de contact
- **Authentification :** Non requise
- **Body :** Formulaire de contact complet

### **8. GET /api/support/tickets**
- **Description :** Récupérer les tickets de l'utilisateur
- **Authentification :** Requise
- **Paramètres :** `status`, `limit`

### **9. GET /api/support/faq**
- **Description :** Récupérer la FAQ
- **Authentification :** Non requise
- **Paramètres :** `category`

### **10. GET /api/support/info**
- **Description :** Récupérer les informations de contact
- **Authentification :** Non requise

---

## 🧪 Tests à effectuer

### **Test 1 : Récupérer les séances de l'utilisateur**

```bash
curl -X GET http://localhost:5000/api/sessions/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse attendue :**
```json
{
  "sessions": [
    {
      "id": "session123",
      "title": "Code de la route - Signalisation",
      "instructorName": "Marie Dubois",
      "date": "lundi 15 janvier",
      "time": "14:00",
      "duration": "2h",
      "type": "Théorique",
      "status": "Terminé",
      "iconType": "book"
    }
  ],
  "totalCount": 4
}
```

### **Test 2 : Récupérer les paramètres utilisateur**

```bash
curl -X GET http://localhost:5000/api/settings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse attendue :**
```json
{
  "security": {
    "passwordLastModified": "2024-01-15T10:30:00Z",
    "twoFactorEnabled": false
  },
  "notifications": {
    "sessionReminders": true,
    "newsUpdates": false
  },
  "profile": {
    "email": "marie.dubois@email.com",
    "phone": "06 12 34 56 78",
    "address": "123 Rue de la Paix, 75001 Paris"
  }
}
```

### **Test 3 : Mettre à jour les notifications**

```bash
curl -X PATCH http://localhost:5000/api/settings/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "sessionReminders": true,
    "newsUpdates": false
  }'
```

### **Test 4 : Changer le mot de passe**

```bash
curl -X PATCH http://localhost:5000/api/settings/password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "currentPassword": "ancienMotDePasse123",
    "newPassword": "nouveauMotDePasse456"
  }'
```

### **Test 5 : Activer l'authentification à deux facteurs**

```bash
curl -X PATCH http://localhost:5000/api/settings/two-factor \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "enabled": true
  }'
```

### **Test 6 : Envoyer un message de contact**

```bash
curl -X POST http://localhost:5000/api/support/contact \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Marie Dubois",
    "email": "marie.dubois@example.com",
    "telephone": "06 12 34 56 78",
    "sujet": "Question sur mon inscription",
    "priorite": "Normale",
    "message": "Bonjour, j'aimerais savoir comment procéder pour mon inscription..."
  }'
```

**Réponse attendue :**
```json
{
  "message": "Message envoyé avec succès",
  "ticketId": "TICKET_123456",
  "responseTime": "Réponse sous 24h"
}
```

### **Test 7 : Récupérer les tickets de l'utilisateur**

```bash
curl -X GET http://localhost:5000/api/support/tickets \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Test 8 : Récupérer la FAQ**

```bash
curl -X GET "http://localhost:5000/api/support/faq?category=inscription"
```

**Réponse attendue :**
```json
{
  "faq": [
    {
      "id": "faq_001",
      "question": "Comment s'inscrire à un cours de conduite ?",
      "reponse": "Pour vous inscrire, rendez-vous sur notre site web...",
      "category": "inscription",
      "order": 1
    }
  ]
}
```

### **Test 9 : Récupérer les informations de contact**

```bash
curl -X GET http://localhost:5000/api/support/info
```

**Réponse attendue :**
```json
{
  "contact": {
    "telephone": {
      "number": "01 23 45 67 89",
      "hours": "Lundi - Vendredi : 8h00 - 18h00"
    },
    "email": {
      "address": "support@auto-ecole.fr",
      "responseTime": "Réponse sous 24h"
    },
    "address": {
      "location": "123 Rue de la Paix, 75001 Paris",
      "hours": "Lun-Ven: 8h-18h, Sam: 9h-16h"
    }
  }
}
```

### **Test 10 : Supprimer le compte (ATTENTION!)**

```bash
curl -X DELETE http://localhost:5000/api/settings/delete-account \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "confirmation": "SUPPRIMER"
  }'
```

---

## 🎯 Fonctionnalités des pages supportées

### ✅ **Page "Mes séances"**
- ✅ Affichage des séances avec icônes
- ✅ Statuts (Terminé, À venir, Absent)
- ✅ Types (Théorique, Pratique, En ligne)
- ✅ Informations instructeur et horaires
- ✅ Formatage des dates en français

### ✅ **Page "Informations personnelles"**
- ✅ Affichage des informations de contact
- ✅ Informations personnelles
- ✅ Bouton de modification des informations
- ✅ API existante : `PUT /api/student-profile/{uid}`

### ✅ **Page "Ma progression"**
- ✅ Calcul de la progression globale
- ✅ Progression par catégorie (théorie, pratique)
- ✅ Objectifs et statuts
- ✅ API existante : `GET /api/student-profile/{uid}`

### ✅ **Page "Paramètres du compte"**
- ✅ Section sécurité (mot de passe, 2FA)
- ✅ Préférences de notification
- ✅ Zone de danger (suppression compte)
- ✅ Toutes les APIs créées

### ✅ **Page "Contacter le Support"**
- ✅ Formulaire de contact complet
- ✅ Gestion des priorités
- ✅ FAQ par catégories
- ✅ Informations de contact
- ✅ Suivi des tickets
- ✅ Toutes les APIs créées

---

## 🔧 Utilisation côté frontend

### **Page "Mes séances"**
```javascript
const response = await fetch('/api/sessions/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { sessions } = await response.json();
// sessions contient les séances formatées pour l'affichage
```

### **Page "Paramètres"**
```javascript
// Récupérer les paramètres
const settings = await fetch('/api/settings', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Mettre à jour les notifications
await fetch('/api/settings/notifications', {
  method: 'PATCH',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    sessionReminders: true,
    newsUpdates: false
  })
});
```

### **Page "Support"**
```javascript
// Envoyer un message
const response = await fetch('/api/support/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nomComplet: 'Marie Dubois',
    email: 'marie@example.com',
    sujet: 'Ma question',
    message: 'Contenu du message'
  })
});

// Récupérer la FAQ
const faq = await fetch('/api/support/faq?category=inscription');
```

---

## 📝 Notes importantes

1. **Authentification :** La plupart des endpoints nécessitent un token JWT valide
2. **Validation :** Tous les inputs sont validés côté serveur
3. **Emails :** Les messages de contact génèrent des emails automatiques
4. **Sécurité :** La suppression de compte nécessite une confirmation explicite
5. **Formatage :** Les dates sont formatées en français pour l'affichage
6. **Icônes :** Les types de séances sont mappés vers des types d'icônes
7. **Statuts :** Les statuts des séances sont calculés dynamiquement

Toutes les pages de profil sont maintenant entièrement dynamiques et fonctionnelles ! 🎉
