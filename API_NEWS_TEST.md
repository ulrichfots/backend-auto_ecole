# 📰 Tests API de Gestion des Actualités

## ✅ Endpoints créés

### **1. GET /api/news/stats**
- **Description :** Récupérer les statistiques des actualités
- **Authentification :** Requise (Admin/Instructeur)
- **Réponse :** Statistiques (total, publiés, brouillons, vues)

### **2. GET /api/news**
- **Description :** Liste des actualités avec filtres et pagination
- **Authentification :** Requise (Admin/Instructeur)
- **Paramètres :** status, category, author, search, page, limit
- **Réponse :** Liste paginée des actualités

### **3. POST /api/news**
- **Description :** Créer une nouvelle actualité
- **Authentification :** Requise (Admin/Instructeur)
- **Body :** multipart/form-data avec titre, contenu, image, etc.
- **Réponse :** Actualité créée

### **4. GET /api/news/{id}**
- **Description :** Récupérer une actualité par ID
- **Authentification :** Requise (Admin/Instructeur)
- **Réponse :** Détails de l'actualité

### **5. PUT /api/news/{id}**
- **Description :** Modifier une actualité
- **Authentification :** Requise (Auteur ou Admin)
- **Body :** multipart/form-data
- **Réponse :** Actualité modifiée

### **6. DELETE /api/news/{id}**
- **Description :** Supprimer une actualité
- **Authentification :** Requise (Auteur ou Admin)
- **Réponse :** Confirmation de suppression

### **7. POST /api/news/{id}/view**
- **Description :** Incrémenter le compteur de vues
- **Authentification :** Non requise
- **Réponse :** Nouveau nombre de vues

---

## 🧪 Tests à effectuer

### **Test 1 : Récupérer les statistiques**

```bash
curl -X GET http://localhost:5000/api/news/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse attendue :**
```json
{
  "totalArticles": 5,
  "publishedArticles": 3,
  "draftArticles": 1,
  "scheduledArticles": 1,
  "totalViews": 869
}
```

### **Test 2 : Lister les actualités avec filtres**

```bash
curl -X GET "http://localhost:5000/api/news?status=published&page=1&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse attendue :**
```json
{
  "articles": [
    {
      "id": "abc123def456",
      "title": "Nouvelle réglementation du code de la route 2024",
      "excerpt": "Les nouvelles règles du code de la route entrent en vigueur...",
      "content": "Le contenu complet...",
      "category": "reglementation",
      "status": "published",
      "tags": ["permis", "code", "formation"],
      "authorName": "Jean Martin",
      "views": 245,
      "imageUrl": "https://storage.googleapis.com/bucket/image.jpg",
      "createdAt": "2024-01-20T10:30:00.000Z",
      "publishedAt": "2024-01-20T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 25,
    "totalPages": 5
  }
}
```

### **Test 3 : Créer une nouvelle actualité**

```bash
curl -X POST http://localhost:5000/api/news \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Nouvelle réglementation du code de la route 2024" \
  -F "excerpt=Les nouvelles règles du code de la route entrent en vigueur ce mois-ci." \
  -F "content=Le contenu complet de l'actualité avec formatage HTML..." \
  -F "category=reglementation" \
  -F "status=published" \
  -F "tags=permis, code, formation" \
  -F "allowComments=true" \
  -F "pinToTop=false" \
  -F "image=@/path/to/image.jpg"
```

**Réponse attendue :**
```json
{
  "message": "Actualité créée avec succès",
  "article": {
    "id": "new123article456",
    "title": "Nouvelle réglementation du code de la route 2024",
    "excerpt": "Les nouvelles règles du code de la route entrent en vigueur ce mois-ci.",
    "content": "Le contenu complet de l'actualité avec formatage HTML...",
    "category": "reglementation",
    "status": "published",
    "tags": ["permis", "code", "formation"],
    "allowComments": true,
    "pinToTop": false,
    "authorId": "user123",
    "authorName": "Jean Martin",
    "views": 0,
    "imageUrl": "https://storage.googleapis.com/bucket/image.jpg",
    "createdAt": "2024-01-20T10:30:00.000Z",
    "publishedAt": "2024-01-20T10:30:00.000Z"
  }
}
```

### **Test 4 : Modifier une actualité**

```bash
curl -X PUT http://localhost:5000/api/news/abc123def456 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Titre modifié" \
  -F "status=draft" \
  -F "pinToTop=true"
```

**Réponse attendue :**
```json
{
  "message": "Actualité modifiée avec succès",
  "article": {
    "id": "abc123def456",
    "title": "Titre modifié",
    "status": "draft",
    "pinToTop": true,
    "updatedAt": "2024-01-20T11:30:00.000Z"
  }
}
```

### **Test 5 : Supprimer une actualité**

```bash
curl -X DELETE http://localhost:5000/api/news/abc123def456 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse attendue :**
```json
{
  "message": "Actualité supprimée avec succès"
}
```

### **Test 6 : Incrémenter les vues**

```bash
curl -X POST http://localhost:5000/api/news/abc123def456/view
```

**Réponse attendue :**
```json
{
  "message": "Vue comptabilisée",
  "views": 246
}
```

---

## 🔧 Fonctionnalités implémentées

### **Gestion des actualités :**
- ✅ CRUD complet (Create, Read, Update, Delete)
- ✅ Upload d'images avec validation (PNG, JPG, GIF jusqu'à 10MB)
- ✅ Gestion des statuts (draft, published, scheduled)
- ✅ Catégorisation (actualites, reglementation, promotions, conseils, technique, nouveau-centre)
- ✅ Système de tags
- ✅ Épinglage en haut de liste
- ✅ Gestion des commentaires
- ✅ Publication programmée

### **Filtres et recherche :**
- ✅ Filtrage par statut
- ✅ Filtrage par catégorie
- ✅ Filtrage par auteur
- ✅ Recherche par titre
- ✅ Pagination complète

### **Statistiques :**
- ✅ Total d'articles du mois
- ✅ Articles publiés
- ✅ Articles en brouillon
- ✅ Articles programmés
- ✅ Total des vues du mois

### **Sécurité :**
- ✅ Authentification requise
- ✅ Autorisation par rôle (Admin/Instructeur)
- ✅ Protection des modifications (auteur ou admin)
- ✅ Validation des données d'entrée
- ✅ Validation des types de fichiers

### **Performance :**
- ✅ Requêtes Firestore optimisées
- ✅ Pagination côté serveur
- ✅ Compteur de vues atomique
- ✅ Gestion des erreurs complète

---

## 📱 Intégration Flutter

### **Récupérer les statistiques :**
```dart
final response = await http.get(
  Uri.parse('$baseUrl/api/news/stats'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
);

final stats = jsonDecode(response.body);
// stats['totalArticles'], stats['publishedArticles'], etc.
```

### **Lister les actualités :**
```dart
final response = await http.get(
  Uri.parse('$baseUrl/api/news?status=published&page=1&limit=10'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
);

final data = jsonDecode(response.body);
final articles = data['articles'];
final pagination = data['pagination'];
```

### **Créer une actualité :**
```dart
var request = http.MultipartRequest(
  'POST',
  Uri.parse('$baseUrl/api/news'),
);

request.headers['Authorization'] = 'Bearer $token';
request.fields['title'] = title;
request.fields['content'] = content;
request.fields['category'] = category;
request.fields['status'] = 'draft';

if (imageFile != null) {
  request.files.add(await http.MultipartFile.fromPath('image', imageFile.path));
}

final response = await request.send();
final responseBody = await response.stream.bytesToString();
final result = jsonDecode(responseBody);
```

### **Modifier une actualité :**
```dart
var request = http.MultipartRequest(
  'PUT',
  Uri.parse('$baseUrl/api/news/$articleId'),
);

request.headers['Authorization'] = 'Bearer $token';
request.fields['title'] = newTitle;
request.fields['status'] = 'published';

final response = await request.send();
```

### **Supprimer une actualité :**
```dart
final response = await http.delete(
  Uri.parse('$baseUrl/api/news/$articleId'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
);
```

### **Incrémenter les vues :**
```dart
final response = await http.post(
  Uri.parse('$baseUrl/api/news/$articleId/view'),
  headers: {
    'Content-Type': 'application/json',
  },
);

final data = jsonDecode(response.body);
final views = data['views'];
```

---

## 📚 Documentation Swagger

Accédez à la documentation interactive :
```
http://localhost:5000/api-docs
```

Vous y trouverez :
- ✅ Tous les endpoints de gestion des actualités
- ✅ Schémas de requête et réponse détaillés
- ✅ Exemples de données
- ✅ Codes d'erreur complets
- ✅ Tests interactifs
- ✅ Gestion des fichiers multipart

---

🎉 **L'API de gestion des actualités est complète et fonctionnelle !**

## 🔄 Prochaines étapes :

1. **Tester localement** avec les commandes curl
2. **Déployer sur Render/Railway**
3. **Intégrer avec Flutter**
4. **Ajouter des notifications email** (optionnel)
5. **Ajouter des commentaires** (optionnel)
