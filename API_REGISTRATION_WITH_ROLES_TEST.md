# 🚀 API d'Inscription avec Création de Comptes Utilisateur - Test et Documentation

## 📋 **Nouvelles Fonctionnalités**

L'API d'inscription a été **considérablement améliorée** pour créer automatiquement des comptes utilisateur avec des rôles spécifiques lors de l'inscription !

---

## 🔗 **Endpoints Mis à Jour**

### **1. POST /api/registration (AMÉLIORÉ)**
L'endpoint d'inscription existant crée maintenant **automatiquement un compte utilisateur** avec le rôle spécifié.

#### **📝 Nouveau paramètre**
```json
{
  "nomComplet": "Jean Dupont",
  "email": "jean.dupont@email.com",
  "telephone": "0123456789",
  "adresse": "123 Rue de la Paix, 75001 Paris",
  "dateNaissance": "1990-05-15",
  "dateDebut": "2024-02-15",
  "heurePreferee": "14:00",
  "formation": "Permis B - Formation complète",
  "role": "eleve" // 🆕 NOUVEAU: Rôle de l'utilisateur
}
```

#### **📤 Nouvelle réponse enrichie (201)**
```json
{
  "success": true,
  "message": "Inscription enregistrée avec succès",
  "registrationId": "reg_123456789",
  "emailsSent": {
    "student": { "success": true, "messageId": "email_123" },
    "admin": { "success": true, "messageId": "email_456" }
  },
  "registration": {
    "id": "reg_123456789",
    "nomComplet": "Jean Dupont",
    "email": "jean.dupont@email.com",
    "dateDebut": "2024-02-15",
    "heurePreferee": "14:00",
    "formation": "Permis B - Formation complète",
    "role": "eleve", // 🆕 Rôle inclus dans l'inscription
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "userAccount": { // 🆕 NOUVEAU: Informations du compte créé
    "created": true,
    "uid": "user123",
    "role": "eleve",
    "statut": "actif",
    "isFirstLogin": true
  }
}
```

#### **🎯 Rôles disponibles**
- **`eleve`** (par défaut) : Élève de l'auto-école
- **`instructeur`** : Instructeur de conduite
- **`admin`** : Administrateur du système

---

### **2. POST /api/registration/create-user (NOUVEAU)**
Nouvel endpoint pour créer directement des comptes utilisateur avec des rôles spécifiques (admin uniquement).

#### **🔐 Authentification**
- ✅ **Requis** : Token Bearer
- ✅ **Rôle** : Admin uniquement

#### **📝 Paramètres requis**
```json
{
  "nomComplet": "Marie Instructeur", // ✅ Requis
  "email": "marie.instructeur@auto-ecole.fr", // ✅ Requis
  "role": "instructeur", // ✅ Requis
  "telephone": "0987654321", // Optionnel
  "adresse": "456 Avenue des Instructeurs, 75002 Paris", // Optionnel
  "dateNaissance": "1985-03-20", // Optionnel
  "formation": "Formation Instructeur", // Optionnel
  "licenseType": "B" // Optionnel (défaut: B)
}
```

#### **📤 Réponse de succès (201)**
```json
{
  "success": true,
  "message": "Compte utilisateur créé avec succès",
  "user": {
    "uid": "user456",
    "email": "marie.instructeur@auto-ecole.fr",
    "nomComplet": "Marie Instructeur",
    "role": "instructeur",
    "statut": "actif",
    "isFirstLogin": true,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### **🚫 Codes d'erreur**
- **400** : Données invalides ou utilisateur existe déjà
- **401** : Token manquant ou invalide
- **403** : Accès non autorisé (pas admin)
- **500** : Erreur serveur

---

## 🧪 **Tests d'API**

### **Test 1: Inscription avec création automatique de compte élève**
```bash
curl -X POST "http://localhost:5000/api/registration" \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Jean Dupont",
    "email": "jean.dupont@email.com",
    "telephone": "0123456789",
    "adresse": "123 Rue de la Paix, 75001 Paris",
    "dateNaissance": "1990-05-15",
    "dateDebut": "2024-02-15",
    "heurePreferee": "14:00",
    "formation": "Permis B - Formation complète",
    "role": "eleve"
  }'
```

### **Test 2: Inscription avec création automatique de compte instructeur**
```bash
curl -X POST "http://localhost:5000/api/registration" \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Marie Instructeur",
    "email": "marie.instructeur@auto-ecole.fr",
    "telephone": "0987654321",
    "adresse": "456 Avenue des Instructeurs, 75002 Paris",
    "dateNaissance": "1985-03-20",
    "dateDebut": "2024-03-01",
    "heurePreferee": "09:00",
    "formation": "Formation Instructeur",
    "role": "instructeur"
  }'
```

### **Test 3: Création directe de compte utilisateur (admin)**
```bash
curl -X POST "http://localhost:5000/api/registration/create-user" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Pierre Admin",
    "email": "pierre.admin@auto-ecole.fr",
    "telephone": "0555666777",
    "adresse": "789 Rue des Admins, 75003 Paris",
    "dateNaissance": "1980-12-10",
    "role": "admin",
    "formation": "Administration Système",
    "licenseType": "B"
  }'
```

### **Test 4: Test d'erreur - utilisateur existe déjà**
```bash
curl -X POST "http://localhost:5000/api/registration/create-user" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Utilisateur Existant",
    "email": "existant@email.com",
    "role": "eleve"
  }'
```

### **Test 5: Test d'erreur - accès non autorisé**
```bash
# Sans token
curl -X POST "http://localhost:5000/api/registration/create-user" \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Test",
    "email": "test@email.com",
    "role": "eleve"
  }'

# Avec token non-admin
curl -X POST "http://localhost:5000/api/registration/create-user" \
  -H "Authorization: Bearer NON_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Test",
    "email": "test@email.com",
    "role": "eleve"
  }'
```

---

## 📊 **Fonctionnalités Avancées**

### **🔄 Création Automatique de Comptes**
- **Vérification d'existence** : Évite les doublons d'email
- **Rôle par défaut** : `eleve` si aucun rôle spécifié
- **Données complètes** : Toutes les informations de l'inscription
- **Statut initial** : `actif` avec `isFirstLogin: true`
- **Progression** : Heures théoriques et pratiques initialisées à 0

### **🛡️ Sécurité et Validation**
- **Authentification obligatoire** : Pour la création directe de comptes
- **Autorisation par rôle** : Seuls les admins peuvent créer des comptes
- **Validation des rôles** : Vérification des rôles valides
- **Validation des emails** : Format et unicité vérifiés
- **Gestion d'erreurs** : Messages d'erreur sécurisés

### **📈 Données Utilisateur Créées**
```javascript
// Structure complète du compte utilisateur créé
{
  uid: "unique_id",
  email: "user@email.com",
  nomComplet: "Nom Complet",
  telephone: "0123456789",
  adresse: "Adresse complète",
  dateNaissance: "1990-05-15",
  role: "eleve|instructeur|admin",
  statut: "actif",
  isFirstLogin: true,
  theoreticalHours: 0,
  practicalHours: 0,
  licenseType: "A|B|C|D",
  formation: "Formation choisie",
  registrationId: "reg_123456789", // Lié à l'inscription
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

---

## 🎯 **Cas d'Usage**

### **📝 Inscription Élève Standard**
```javascript
// Inscription classique d'un élève
const response = await fetch('/api/registration', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nomComplet: "Jean Dupont",
    email: "jean.dupont@email.com",
    telephone: "0123456789",
    adresse: "123 Rue de la Paix, 75001 Paris",
    dateNaissance: "1990-05-15",
    dateDebut: "2024-02-15",
    heurePreferee: "14:00",
    formation: "Permis B - Formation complète"
    // role: "eleve" (par défaut)
  })
});

const data = await response.json();
console.log('Compte créé:', data.userAccount.created);
console.log('UID utilisateur:', data.userAccount.uid);
```

### **👨‍🏫 Création d'Instructeur**
```javascript
// Création d'un compte instructeur par un admin
const response = await fetch('/api/registration/create-user', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json' 
  },
  body: JSON.stringify({
    nomComplet: "Marie Instructeur",
    email: "marie.instructeur@auto-ecole.fr",
    telephone: "0987654321",
    role: "instructeur",
    formation: "Formation Instructeur",
    licenseType: "B"
  })
});

const data = await response.json();
console.log('Instructeur créé:', data.user.nomComplet);
```

### **🔍 Vérification de Compte Créé**
```javascript
// Vérifier si un compte a été créé lors de l'inscription
const response = await fetch('/api/registration/with-roles', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});

const data = await response.json();
data.registrations.forEach(reg => {
  if (reg.userRole) {
    console.log(`${reg.nomComplet}: ${reg.userRole.role} - Créé le ${reg.userRole.createdAt}`);
  } else {
    console.log(`${reg.nomComplet}: Aucun compte associé`);
  }
});
```

---

## 📚 **Swagger Documentation**

### **✅ Mise à Jour Complète**
- **Version API** : `1.2.0` → `1.3.0`
- **Nouveaux schémas** : `RegistrationResponse` enrichi avec `userAccount`
- **Nouvel endpoint** : `POST /api/registration/create-user`
- **Paramètres** : `role` ajouté à l'inscription
- **Exemples** : Réponses complètes avec comptes créés

### **📖 Documentation Disponible**
- **Schémas détaillés** : Tous les nouveaux objets documentés
- **Exemples réalistes** : Réponses de succès et d'erreur
- **Authentification** : Configuration Bearer token
- **Validation** : Paramètres requis et optionnels

**🌐 Accès Swagger :** `http://localhost:5000/api-docs`

---

## 🚀 **Avantages de cette Amélioration**

### **✅ Pour les Administrateurs**
- **Création simplifiée** : Un seul appel API pour inscription + compte
- **Gestion des rôles** : Attribution directe des rôles
- **Contrôle total** : Création directe de comptes si nécessaire
- **Traçabilité** : Lien entre inscription et compte utilisateur

### **✅ Pour les Utilisateurs**
- **Processus fluide** : Inscription = création automatique de compte
- **Accès immédiat** : Compte utilisable directement après inscription
- **Données complètes** : Toutes les informations de l'inscription conservées
- **Progression** : Base pour le suivi des heures de formation

### **✅ Pour le Système**
- **Cohérence des données** : Inscription et compte utilisateur liés
- **Évite les doublons** : Vérification d'existence automatique
- **Sécurité** : Authentification et autorisation appropriées
- **Extensibilité** : Facile d'ajouter de nouveaux rôles

---

## 🎉 **Résumé des Améliorations**

1. **🔄 Création automatique** : Comptes utilisateur créés lors de l'inscription
2. **🎭 Gestion des rôles** : Attribution de rôles lors de l'inscription
3. **🆕 Nouvel endpoint** : Création directe de comptes pour les admins
4. **📊 Données enrichies** : Réponses incluant les informations du compte créé
5. **🛡️ Sécurité renforcée** : Validation et autorisation appropriées
6. **📚 Documentation complète** : Swagger mis à jour avec tous les détails

L'API d'inscription est maintenant **complètement intégrée** avec la création de comptes utilisateur et la gestion des rôles ! 🚀
