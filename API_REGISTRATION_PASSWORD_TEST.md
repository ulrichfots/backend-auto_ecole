# 🔐 API d'Inscription avec Création de Comptes avec Mots de Passe - Test et Documentation

## 📋 **Nouvelles Fonctionnalités**

L'API d'inscription a été **considérablement améliorée** pour créer des comptes utilisateur avec **mots de passe Firebase Auth** lors de l'inscription !

---

## 🔗 **Endpoints Mis à Jour**

### **1. POST /api/registration (AMÉLIORÉ avec Mot de Passe)**
L'endpoint d'inscription crée maintenant **automatiquement un compte Firebase Auth** avec mot de passe.

#### **📝 Nouveau paramètre obligatoire**
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
  "role": "eleve",
  "password": "motdepasse123" // 🆕 NOUVEAU: Mot de passe requis
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
    "role": "eleve",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "userAccount": { // 🆕 ENRICHI: Informations Firebase Auth
    "created": true,
    "uid": "user123",
    "firebaseUid": "firebase_user_456", // 🆕 ID Firebase Auth
    "role": "eleve",
    "statut": "actif",
    "isFirstLogin": true,
    "emailVerified": false // 🆕 Statut vérification email
  }
}
```

---

### **2. POST /api/registration/create-user (MIS À JOUR avec Mot de Passe)**
L'endpoint de création directe de comptes **requiert maintenant un mot de passe**.

#### **📝 Paramètres mis à jour**
```json
{
  "nomComplet": "Marie Instructeur", // ✅ Requis
  "email": "marie.instructeur@auto-ecole.fr", // ✅ Requis
  "role": "instructeur", // ✅ Requis
  "password": "motdepasse123", // ✅ Requis
  "telephone": "0987654321", // Optionnel
  "adresse": "456 Avenue des Instructeurs, 75002 Paris", // Optionnel
  "dateNaissance": "1985-03-20", // Optionnel
  "formation": "Formation Instructeur", // Optionnel
  "licenseType": "B" // Optionnel (défaut: B)
}
```

#### **📤 Réponse enrichie (201)**
```json
{
  "success": true,
  "message": "Compte utilisateur créé avec succès",
  "user": {
    "uid": "user456",
    "firebaseUid": "firebase_user_789", // 🆕 ID Firebase Auth
    "email": "marie.instructeur@auto-ecole.fr",
    "nomComplet": "Marie Instructeur",
    "role": "instructeur",
    "statut": "actif",
    "isFirstLogin": true,
    "emailVerified": false, // 🆕 Statut vérification email
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## 🛡️ **Sécurité et Validation**

### **🔐 Validation des Mots de Passe**
- **Longueur minimum** : 6 caractères
- **Validation côté serveur** : Vérification avant création Firebase
- **Messages d'erreur** : Clairs et informatifs

### **🔥 Intégration Firebase Auth**
- **Création automatique** : Compte Firebase Auth avec mot de passe
- **Liaison Firestore** : Document utilisateur lié au compte Auth
- **Gestion d'erreurs** : Rollback en cas d'échec
- **Statut email** : Suivi de la vérification d'email

---

## 🧪 **Tests d'API**

### **Test 1: Inscription avec mot de passe valide**
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
    "role": "eleve",
    "password": "motdepasse123"
  }'
```

### **Test 2: Inscription sans mot de passe (inscription simple)**
```bash
curl -X POST "http://localhost:5000/api/registration" \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Marie Sans Compte",
    "email": "marie.sans@email.com",
    "telephone": "0987654321",
    "adresse": "456 Rue Sans Compte, 75002 Paris",
    "dateNaissance": "1985-03-20",
    "dateDebut": "2024-03-01",
    "heurePreferee": "09:00",
    "formation": "Permis B - Formation complète"
  }'
```

### **Test 3: Inscription avec mot de passe trop court**
```bash
curl -X POST "http://localhost:5000/api/registration" \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Test Court",
    "email": "test.court@email.com",
    "telephone": "0123456789",
    "adresse": "789 Rue Test, 75003 Paris",
    "dateNaissance": "1990-01-01",
    "dateDebut": "2024-02-15",
    "heurePreferee": "14:00",
    "formation": "Permis B - Formation complète",
    "role": "eleve",
    "password": "123"
  }'
```

### **Test 4: Création directe avec mot de passe (admin)**
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
    "password": "admin123456",
    "formation": "Administration Système",
    "licenseType": "B"
  }'
```

### **Test 5: Test d'erreur - mot de passe manquant (create-user)**
```bash
curl -X POST "http://localhost:5000/api/registration/create-user" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Test Sans Mot de Passe",
    "email": "test.sans@email.com",
    "role": "eleve"
  }'
```

---

## 📊 **Fonctionnalités Avancées**

### **🔄 Création Hybride**
- **Avec mot de passe** : Crée un compte Firebase Auth + document Firestore
- **Sans mot de passe** : Inscription simple sans compte utilisateur
- **Flexibilité** : L'utilisateur choisit s'il veut un compte

### **🔥 Double Intégration Firebase**
```javascript
// Structure du compte créé
{
  // Firebase Auth
  firebaseUid: "firebase_user_456",
  email: "user@email.com",
  emailVerified: false,
  
  // Firestore Document
  uid: "user123",
  nomComplet: "Jean Dupont",
  role: "eleve",
  statut: "actif",
  isFirstLogin: true,
  theoreticalHours: 0,
  practicalHours: 0,
  licenseType: "B",
  formation: "Permis B - Formation complète",
  registrationId: "reg_123456789",
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

### **🛡️ Gestion d'Erreurs Robuste**
- **Validation préalable** : Vérification avant création Firebase
- **Rollback automatique** : En cas d'échec de création Auth
- **Messages détaillés** : Erreurs spécifiques à chaque étape
- **Continuité** : L'inscription continue même si le compte échoue

---

## 🎯 **Cas d'Usage**

### **📝 Inscription Standard avec Compte**
```javascript
// Inscription avec création de compte utilisateur
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
    formation: "Permis B - Formation complète",
    role: "eleve",
    password: "motdepasse123" // ✅ Crée un compte Firebase Auth
  })
});

const data = await response.json();
if (data.userAccount.created) {
  console.log('Compte créé:', data.userAccount.firebaseUid);
  console.log('Utilisateur peut se connecter immédiatement');
}
```

### **📋 Inscription Simple sans Compte**
```javascript
// Inscription sans création de compte (juste demande)
const response = await fetch('/api/registration', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nomComplet: "Marie Sans Compte",
    email: "marie.sans@email.com",
    telephone: "0987654321",
    adresse: "456 Rue Sans Compte, 75002 Paris",
    dateNaissance: "1985-03-20",
    dateDebut: "2024-03-01",
    heurePreferee: "09:00",
    formation: "Permis B - Formation complète"
    // Pas de password = inscription simple
  })
});

const data = await response.json();
console.log('Inscription enregistrée:', data.registrationId);
console.log('Compte créé:', data.userAccount.created); // false
```

### **👨‍🏫 Création d'Instructeur par Admin**
```javascript
// Création directe d'un instructeur avec compte complet
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
    password: "instructeur123", // ✅ Requis
    formation: "Formation Instructeur",
    licenseType: "B"
  })
});

const data = await response.json();
console.log('Instructeur créé:', data.user.nomComplet);
console.log('Firebase UID:', data.user.firebaseUid);
console.log('Prêt à se connecter:', !data.user.isFirstLogin);
```

---

## 📚 **Swagger Documentation**

### **✅ Mise à Jour Complète**
- **Version API** : `1.3.0` → `1.4.0`
- **Nouveaux paramètres** : `password` ajouté aux deux endpoints
- **Réponses enrichies** : `firebaseUid` et `emailVerified` ajoutés
- **Validation** : Règles de mot de passe documentées

### **📖 Contenu Documenté**
- **Schémas détaillés** : Tous les nouveaux champs
- **Exemples réalistes** : Avec et sans mots de passe
- **Validation** : Règles de mot de passe (minimum 6 caractères)
- **Codes d'erreur** : Gestion des erreurs Firebase Auth

**🌐 Accès Swagger :** `http://localhost:5000/api-docs`

---

## 🚀 **Avantages de cette Amélioration**

### **✅ Pour les Utilisateurs**
- **Comptes immédiats** : Peuvent se connecter directement après inscription
- **Flexibilité** : Choix entre inscription simple ou avec compte
- **Sécurité** : Mots de passe sécurisés via Firebase Auth
- **Vérification** : Suivi du statut de vérification d'email

### **✅ Pour les Administrateurs**
- **Création complète** : Comptes Firebase Auth + Firestore en une fois
- **Contrôle total** : Gestion des mots de passe et rôles
- **Traçabilité** : Liaison entre inscription et compte utilisateur
- **Gestion d'erreurs** : Messages clairs en cas de problème

### **✅ Pour le Système**
- **Intégration complète** : Firebase Auth + Firestore synchronisés
- **Sécurité renforcée** : Authentification Firebase native
- **Scalabilité** : Gestion des erreurs et rollback automatique
- **Flexibilité** : Support des inscriptions avec et sans compte

---

## 🎉 **Résumé des Améliorations**

1. **🔐 Mots de passe obligatoires** : Pour la création de comptes utilisateur
2. **🔥 Intégration Firebase Auth** : Création automatique de comptes Auth
3. **🔄 Création hybride** : Avec ou sans compte selon les besoins
4. **🛡️ Validation renforcée** : Vérification des mots de passe
5. **📊 Données enrichies** : `firebaseUid` et `emailVerified` dans les réponses
6. **📚 Documentation complète** : Swagger mis à jour avec tous les détails

L'API d'inscription est maintenant **entièrement intégrée** avec Firebase Auth et la création de comptes utilisateur avec mots de passe ! 🚀
