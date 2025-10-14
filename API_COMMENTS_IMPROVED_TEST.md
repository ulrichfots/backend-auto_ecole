# 📝 Tests API de Commentaires Améliorée

## ✅ Nouvelles fonctionnalités ajoutées

### **1. POST /api/comments (Amélioré)**
- **Description :** Ajouter un commentaire (avec ou sans authentification)
- **Authentification :** Optionnelle
- **Body :** 
  ```json
  {
    "comment": "Très bon cours de conduite !",
    "name": "Marie Dubois",          // Requis si pas authentifié
    "email": "marie@example.com",    // Requis si pas authentifié
    "parentId": "abc123"             // Optionnel pour répondre à un commentaire
  }
  ```
- **Réponse :** Commentaire créé avec initiales générées automatiquement

### **2. GET /api/comments (Amélioré)**
- **Description :** Récupérer les commentaires avec tri et réponses imbriquées
- **Paramètres :**
  - `sort`: `recent` (défaut), `oldest`, `popular`
  - `limit`: nombre max de commentaires (défaut: 50)
  - `includeReplies`: inclure les réponses (défaut: true)
- **Réponse :** Structure hiérarchique avec commentaires et réponses

### **3. GET /api/comments/{id}/replies (Nouveau)**
- **Description :** Récupérer les réponses d'un commentaire spécifique
- **Paramètres :**
  - `sort`: `recent` (défaut), `oldest`, `popular`
- **Réponse :** Liste des réponses avec compteur

---

## 🧪 Tests à effectuer

### **Test 1 : Commentaire anonyme**

```bash
curl -X POST http://localhost:5000/api/comments \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Excellent article ! Les informations sont très claires.",
    "name": "Marie Dubois",
    "email": "marie.dubois@example.com"
  }'
```

**Réponse attendue :**
```json
{
  "id": "comment123",
  "message": "Commentaire enregistré",
  "initials": "MD"
}
```

### **Test 2 : Commentaire authentifié**

```bash
curl -X POST http://localhost:5000/api/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "comment": "Merci pour ce partage de qualité !"
  }'
```

### **Test 3 : Réponse à un commentaire**

```bash
curl -X POST http://localhost:5000/api/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{
    "comment": "Merci beaucoup Marie pour votre retour positif!",
    "parentId": "comment123"
  }'
```

### **Test 4 : Récupérer tous les commentaires avec réponses**

```bash
curl -X GET "http://localhost:5000/api/comments?sort=recent&includeReplies=true"
```

**Réponse attendue :**
```json
{
  "comments": [
    {
      "id": "comment123",
      "name": "Marie Dubois",
      "email": "marie.dubois@example.com",
      "comment": "Excellent article !",
      "likes": 12,
      "dislikes": 0,
      "initials": "MD",
      "createdAt": "2024-01-15T14:30:00Z",
      "replies": [
        {
          "id": "reply456",
          "name": "Admin",
          "comment": "Merci beaucoup Marie !",
          "likes": 3,
          "dislikes": 0,
          "initials": "A",
          "createdAt": "2024-01-15T15:45:00Z"
        }
      ]
    }
  ],
  "totalCount": 4,
  "parentCommentsCount": 3
}
```

### **Test 5 : Tri par popularité**

```bash
curl -X GET "http://localhost:5000/api/comments?sort=popular&limit=10"
```

### **Test 6 : Récupérer les réponses d'un commentaire**

```bash
curl -X GET "http://localhost:5000/api/comments/comment123/replies?sort=recent"
```

**Réponse attendue :**
```json
{
  "replies": [
    {
      "id": "reply456",
      "name": "Admin",
      "comment": "Merci beaucoup Marie !",
      "likes": 3,
      "dislikes": 0,
      "initials": "A",
      "createdAt": "2024-01-15T15:45:00Z"
    }
  ],
  "count": 1
}
```

### **Test 7 : Voter sur un commentaire (inchangé)**

```bash
curl -X PATCH http://localhost:5000/api/comments/comment123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_TOKEN" \
  -d '{
    "type": "like"
  }'
```

---

## 🎯 Fonctionnalités de la page supportées

### ✅ **Formulaire de commentaire**
- Support des commentaires anonymes (nom + email)
- Support des commentaires authentifiés
- Génération automatique des initiales pour les avatars

### ✅ **Système de réponses**
- Réponses imbriquées aux commentaires
- API dédiée pour récupérer les réponses
- Support des réponses d'admin

### ✅ **Tri et filtrage**
- Tri par date (récent/ancien)
- Tri par popularité (likes)
- Limitation du nombre de commentaires

### ✅ **Système de votes**
- Like/dislike sur commentaires et réponses
- Prévention du vote multiple
- Compteurs en temps réel

### ✅ **Affichage des avatars**
- Initiales générées automatiquement
- Support des utilisateurs anonymes et authentifiés

---

## 🔧 Utilisation côté frontend

### **Créer un commentaire anonyme**
```javascript
const response = await fetch('/api/comments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    comment: 'Mon commentaire',
    name: 'Mon Nom',
    email: 'mon@email.com'
  })
});
```

### **Créer une réponse**
```javascript
const response = await fetch('/api/comments', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    comment: 'Ma réponse',
    parentId: 'commentId123'
  })
});
```

### **Récupérer les commentaires avec tri**
```javascript
const response = await fetch('/api/comments?sort=popular&limit=20');
const data = await response.json();
// data.comments contient les commentaires avec leurs réponses
```

### **Afficher les avatars**
```javascript
// Utiliser les initiales retournées par l'API
const avatar = comment.initials; // "MD" pour Marie Dubois
```
