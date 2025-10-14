# 🚗 Tests API de Gestion des Séances

## ✅ Endpoints créés pour la page de gestion des séances

### **1. GET /api/sessions/dashboard-stats**
- **Description :** Statistiques du dashboard (total, confirmées, en attente, annulées, aujourd'hui, cette semaine)
- **Authentification :** Requise (Admin/Instructeur)
- **Réponse :** Statistiques complètes du dashboard

### **2. GET /api/sessions/upcoming**
- **Description :** Liste des séances à venir avec pagination et filtres
- **Authentification :** Requise (Admin/Instructeur)
- **Paramètres :** status, instructorId, type, search, page, limit
- **Réponse :** Liste paginée des séances à venir

### **3. GET /api/sessions/instructors**
- **Description :** Liste des instructeurs pour les filtres
- **Authentification :** Requise (Admin/Instructeur)
- **Réponse :** Liste des instructeurs disponibles

### **4. GET /api/sessions/types**
- **Description :** Liste des types de séances
- **Authentification :** Requise (Admin/Instructeur)
- **Réponse :** Types de séances avec couleurs

### **5. PUT /api/sessions/{id}**
- **Description :** Modifier une séance complète
- **Authentification :** Requise (Admin/Instructeur)
- **Body :** Données complètes de la séance
- **Réponse :** Séance modifiée

### **6. DELETE /api/sessions/{id}**
- **Description :** Supprimer une séance (bouton "Supprimer")
- **Authentification :** Requise (Admin/Instructeur)
- **Réponse :** Confirmation de suppression

---

## 🧪 Tests à effectuer

### **Test 1 : Récupérer les statistiques du dashboard**

```bash
curl -X GET http://localhost:5000/api/sessions/dashboard-stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse attendue :**
```json
{
  "totalSessions": 8,
  "confirmedSessions": 5,
  "pendingSessions": 2,
  "cancelledSessions": 1,
  "todaySessions": 0,
  "thisWeekSessions": 0
}
```

### **Test 2 : Récupérer les séances à venir avec filtres**

```bash
curl -X GET "http://localhost:5000/api/sessions/upcoming?status=confirmée&page=1&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse attendue :**
```json
{
  "sessions": [
    {
      "id": "session123",
      "student": {
        "id": "student123",
        "nom": "Marie Dubois",
        "email": "marie.dubois@email.com",
        "initials": "MD"
      },
      "instructor": {
        "id": "instructor123",
        "nom": "Jean Martin"
      },
      "type": "conduite",
      "date": "2024-01-20T09:00:00.000Z",
      "time": "09:00",
      "duration": "1h30",
      "status": "confirmée"
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

### **Test 3 : Récupérer la liste des instructeurs**

```bash
curl -X GET http://localhost:5000/api/sessions/instructors \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse attendue :**
```json
{
  "instructors": [
    {
      "id": "instructor123",
      "nom": "Jean Martin",
      "email": "jean.martin@autoecole.fr"
    },
    {
      "id": "instructor456",
      "nom": "Sophie Bernard",
      "email": "sophie.bernard@autoecole.fr"
    }
  ]
}
```

### **Test 4 : Récupérer les types de séances**

```bash
curl -X GET http://localhost:5000/api/sessions/types \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse attendue :**
```json
{
  "types": [
    { "value": "conduite", "label": "Conduite", "color": "blue" },
    { "value": "code", "label": "Code", "color": "green" },
    { "value": "examen", "label": "Examen", "color": "red" },
    { "value": "évaluation", "label": "Évaluation", "color": "yellow" },
    { "value": "perfectionnement", "label": "Perfectionnement", "color": "purple" }
  ]
}
```

### **Test 5 : Modifier une séance**

```bash
curl -X PUT http://localhost:5000/api/sessions/session123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student123",
    "instructorId": "instructor456",
    "courseType": "code",
    "courseTitle": "Cours de code théorique",
    "scheduledDate": "2024-01-21T14:00:00.000Z",
    "scheduledTime": "14:00",
    "duration": "2h00",
    "status": "confirmée",
    "location": "Salle de cours B",
    "notes": "Révision des panneaux"
  }'
```

**Réponse attendue :**
```json
{
  "message": "Séance modifiée avec succès",
  "session": {
    "id": "session123",
    "studentId": "student123",
    "instructorId": "instructor456",
    "courseType": "code",
    "courseTitle": "Cours de code théorique",
    "scheduledDate": "2024-01-21T14:00:00.000Z",
    "scheduledTime": "14:00",
    "duration": "2h00",
    "status": "confirmée",
    "location": "Salle de cours B",
    "notes": "Révision des panneaux",
    "updatedAt": "2024-01-20T10:30:00.000Z"
  }
}
```

### **Test 6 : Supprimer une séance**

```bash
curl -X DELETE http://localhost:5000/api/sessions/session123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse attendue :**
```json
{
  "message": "Séance supprimée avec succès"
}
```

---

## 🔧 Fonctionnalités implémentées

### **Dashboard des séances :**
- ✅ **Statistiques complètes** - Total, confirmées, en attente, annulées
- ✅ **Périodes** - Aujourd'hui, cette semaine, ce mois
- ✅ **Filtres avancés** - Statut, instructeur, type, recherche
- ✅ **Pagination** - Gestion des grandes listes
- ✅ **CRUD complet** - Create, Read, Update, Delete

### **Gestion des séances :**
- ✅ **Types de séances** - Conduite, Code, Examen, Évaluation, Perfectionnement
- ✅ **Statuts** - Confirmée, En attente, Annulée
- ✅ **Instructeurs** - Liste dynamique des instructeurs
- ✅ **Élèves** - Informations complètes des élèves
- ✅ **Horaires** - Date, heure, durée
- ✅ **Lieux** - Gestion des emplacements

### **Interface utilisateur :**
- ✅ **Cartes de statistiques** - 6 cartes colorées
- ✅ **Filtres** - Statut, instructeur, type, recherche
- ✅ **Tableau** - Liste des séances avec colonnes
- ✅ **Actions** - Modifier, supprimer
- ✅ **Pagination** - Navigation entre les pages

### **Sécurité :**
- ✅ **Authentification** - Token JWT requis
- ✅ **Autorisation** - Admin et Instructeur uniquement
- ✅ **Validation** - Données d'entrée validées
- ✅ **Gestion d'erreurs** - Messages d'erreur clairs

---

## 📱 Intégration Flutter

### **Récupérer les statistiques du dashboard :**
```dart
final response = await http.get(
  Uri.parse('$baseUrl/api/sessions/dashboard-stats'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
);

final stats = jsonDecode(response.body);
// stats['totalSessions'], stats['confirmedSessions'], etc.
```

### **Récupérer les séances à venir :**
```dart
final response = await http.get(
  Uri.parse('$baseUrl/api/sessions/upcoming?status=confirmée&page=1&limit=10'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
);

final data = jsonDecode(response.body);
final sessions = data['sessions'];
final pagination = data['pagination'];
```

### **Récupérer les instructeurs pour les filtres :**
```dart
final response = await http.get(
  Uri.parse('$baseUrl/api/sessions/instructors'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
);

final data = jsonDecode(response.body);
final instructors = data['instructors'];
```

### **Récupérer les types de séances :**
```dart
final response = await http.get(
  Uri.parse('$baseUrl/api/sessions/types'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
);

final data = jsonDecode(response.body);
final types = data['types'];
```

### **Modifier une séance :**
```dart
final response = await http.put(
  Uri.parse('$baseUrl/api/sessions/$sessionId'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'studentId': studentId,
    'instructorId': instructorId,
    'courseType': 'conduite',
    'scheduledDate': scheduledDate.toIso8601String(),
    'scheduledTime': '09:00',
    'duration': '1h30',
    'status': 'confirmée',
    'location': 'Salle de cours A',
    'notes': 'Notes importantes'
  }),
);
```

### **Supprimer une séance :**
```dart
final response = await http.delete(
  Uri.parse('$baseUrl/api/sessions/$sessionId'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
);
```

---

## 📚 Documentation Swagger

Accédez à la documentation interactive :
```
http://localhost:5000/api-docs
```

Vous y trouverez :
- ✅ Tous les endpoints de gestion des séances
- ✅ Schémas de requête et réponse détaillés
- ✅ Exemples de données
- ✅ Codes d'erreur complets
- ✅ Tests interactifs

---

## 🎯 **Résumé des APIs manquantes ajoutées :**

### **✅ APIs ajoutées pour la page de gestion des séances :**

1. **`GET /api/sessions/dashboard-stats`** - Statistiques du dashboard ✅
2. **`GET /api/sessions/upcoming`** - Séances à venir avec pagination ✅
3. **`GET /api/sessions/instructors`** - Liste des instructeurs ✅
4. **`GET /api/sessions/types`** - Types de séances ✅
5. **`PUT /api/sessions/{id}`** - Modifier une séance ✅
6. **`DELETE /api/sessions/{id}`** - Supprimer une séance ✅

### **🔧 Fonctionnalités couvertes :**
- ✅ **6 cartes de statistiques** (Total, Confirmées, En attente, Annulées, Aujourd'hui, Cette semaine)
- ✅ **Filtres** (Statut, Instructeur, Type, Recherche)
- ✅ **Tableau des séances** avec toutes les colonnes
- ✅ **Actions** (Modifier, Supprimer)
- ✅ **Pagination** complète
- ✅ **Données enrichies** (Élèves, Instructeurs)

---

🎉 **Toutes les APIs nécessaires pour la page de gestion des séances sont maintenant disponibles !**

Votre interface Flutter peut maintenant utiliser ces APIs pour :
- Afficher les statistiques du dashboard
- Filtrer et rechercher les séances
- Gérer les séances (créer, modifier, supprimer)
- Récupérer les listes pour les filtres
- Paginer les résultats
