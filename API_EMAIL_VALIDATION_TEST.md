# 🚫 API d'Inscription - Validation des Emails Uniques - Test et Documentation

## 📋 **Nouvelle Fonctionnalité**

L'API d'inscription empêche maintenant **toute inscription avec une adresse email déjà utilisée** dans le système !

---

## 🛡️ **Validation Renforcée**

### **🔍 Vérification Multi-Niveau**
1. **Firebase Auth** : Vérification dans la base d'authentification Firebase
2. **Format Email** : Validation du format d'email
3. **Unicité** : Empêche les doublons d'email

### **⚡ Processus de Validation**
```javascript
// 1. Validation du format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return res.status(400).json({
    error: 'Format d\'email invalide'
  });
}

// 2. Vérification dans Firebase Auth
try {
  const existingAuthUser = await admin.auth().getUserByEmail(email);
  if (existingAuthUser) {
    return res.status(400).json({
      error: 'Email déjà utilisé',
      details: 'Un compte avec cette adresse email existe déjà dans le système'
    });
  }
} catch (authError) {
  // Gestion des erreurs Firebase
}
```

---

## 🧪 **Tests de Validation**

### **Test 1: Inscription avec email valide (première fois)**
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

**✅ Réponse attendue (201):**
```json
{
  "success": true,
  "message": "Inscription enregistrée avec succès",
  "userAccount": {
    "created": true,
    "uid": "user123",
    "firebaseUid": "firebase_user_456",
    "role": "eleve",
    "statut": "actif"
  }
}
```

### **Test 2: Tentative d'inscription avec le même email**
```bash
curl -X POST "http://localhost:5000/api/registration" \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Marie Martin",
    "email": "jean.dupont@email.com",
    "telephone": "0987654321",
    "adresse": "456 Rue de la Paix, 75002 Paris",
    "dateNaissance": "1985-03-20",
    "dateDebut": "2024-03-01",
    "heurePreferee": "09:00",
    "formation": "Permis B - Formation complète",
    "role": "eleve",
    "password": "autre123456"
  }'
```

**❌ Réponse attendue (400):**
```json
{
  "error": "Email déjà utilisé",
  "details": "Un compte avec cette adresse email existe déjà dans le système"
}
```

### **Test 3: Création d'utilisateur avec email existant (admin)**
```bash
curl -X POST "http://localhost:5000/api/registration/create-user" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Pierre Admin",
    "email": "jean.dupont@email.com",
    "role": "admin",
    "password": "admin123456"
  }'
```

**❌ Réponse attendue (400):**
```json
{
  "error": "Email déjà utilisé",
  "details": "Un compte avec cette adresse email existe déjà dans le système"
}
```

### **Test 4: Email avec format invalide**
```bash
curl -X POST "http://localhost:5000/api/registration" \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Test Format",
    "email": "email-invalide",
    "telephone": "0123456789",
    "adresse": "789 Rue Test, 75003 Paris",
    "dateNaissance": "1990-01-01",
    "dateDebut": "2024-02-15",
    "heurePreferee": "14:00",
    "formation": "Permis B - Formation complète",
    "role": "eleve",
    "password": "motdepasse123"
  }'
```

**❌ Réponse attendue (400):**
```json
{
  "error": "Format d'email invalide"
}
```

### **Test 5: Test de casse (majuscules/minuscules)**
```bash
curl -X POST "http://localhost:5000/api/registration" \
  -H "Content-Type: application/json" \
  -d '{
    "nomComplet": "Test Casse",
    "email": "JEAN.DUPONT@EMAIL.COM",
    "telephone": "0123456789",
    "adresse": "789 Rue Test, 75003 Paris",
    "dateNaissance": "1990-01-01",
    "dateDebut": "2024-02-15",
    "heurePreferee": "14:00",
    "formation": "Permis B - Formation complète",
    "role": "eleve",
    "password": "motdepasse123"
  }'
```

**❌ Réponse attendue (400):**
```json
{
  "error": "Email déjà utilisé",
  "details": "Un compte avec cette adresse email existe déjà dans le système"
}
```

---

## 🔧 **Endpoints Protégés**

### **1. POST /api/registration**
- ✅ **Validation Firebase Auth** : Vérification de l'unicité de l'email
- ✅ **Format Email** : Validation regex
- ✅ **Messages d'erreur** : Clairs et informatifs

### **2. POST /api/registration/create-user**
- ✅ **Validation Firebase Auth** : Vérification de l'unicité de l'email
- ✅ **Authentification Admin** : Seuls les admins peuvent créer des comptes
- ✅ **Messages d'erreur** : Spécifiques à chaque cas

---

## 📊 **Codes d'Erreur**

### **400 - Bad Request**
```json
// Format d'email invalide
{
  "error": "Format d'email invalide"
}

// Email déjà utilisé
{
  "error": "Email déjà utilisé",
  "details": "Un compte avec cette adresse email existe déjà dans le système"
}

// Données manquantes
{
  "error": "Données d'inscription invalides",
  "details": ["Le champ 'nomComplet' est requis"]
}
```

### **500 - Server Error**
```json
// Erreur de vérification Firebase
{
  "error": "Erreur lors de la vérification de l'email",
  "details": "Impossible de vérifier si l'email existe déjà"
}
```

---

## 🎯 **Cas d'Usage Pratiques**

### **📝 Inscription Standard**
```javascript
// Tentative d'inscription
const response = await fetch('/api/registration', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nomComplet: "Jean Dupont",
    email: "jean.dupont@email.com",
    // ... autres données
    password: "motdepasse123"
  })
});

const data = await response.json();

if (response.status === 400) {
  if (data.error === 'Email déjà utilisé') {
    console.log('❌ Cet email est déjà utilisé');
    // Afficher un message à l'utilisateur
  } else if (data.error === 'Format d\'email invalide') {
    console.log('❌ Format d\'email incorrect');
    // Demander de corriger l'email
  }
} else if (response.status === 201) {
  console.log('✅ Inscription réussie');
  console.log('Compte créé:', data.userAccount.created);
}
```

### **👨‍💼 Création Admin**
```javascript
// Création d'un utilisateur par un admin
const response = await fetch('/api/registration/create-user', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json' 
  },
  body: JSON.stringify({
    nomComplet: "Marie Instructeur",
    email: "marie.instructeur@auto-ecole.fr",
    role: "instructeur",
    password: "instructeur123"
  })
});

const data = await response.json();

if (response.status === 400) {
  if (data.error === 'Email déjà utilisé') {
    console.log('❌ Impossible de créer: email déjà utilisé');
    // Proposer de modifier l'email ou de récupérer le compte existant
  }
} else if (response.status === 201) {
  console.log('✅ Utilisateur créé avec succès');
  console.log('Firebase UID:', data.user.firebaseUid);
}
```

---

## 🛡️ **Sécurité et Performance**

### **🔐 Sécurité**
- **Validation côté serveur** : Impossible de contourner la vérification
- **Firebase Auth** : Utilise l'API officielle Firebase
- **Gestion d'erreurs** : Pas d'exposition d'informations sensibles

### **⚡ Performance**
- **Vérification rapide** : Firebase Auth optimisé
- **Cache Firebase** : Réutilisation des vérifications
- **Gestion d'erreurs** : Arrêt immédiat en cas de doublon

### **🔄 Robustesse**
- **Gestion des erreurs Firebase** : Distinction entre "utilisateur non trouvé" et vraies erreurs
- **Fallback** : En cas d'erreur de vérification, arrêt sécurisé
- **Logging** : Enregistrement des erreurs pour debugging

---

## 📚 **Documentation Swagger**

### **✅ Mise à Jour Complète**
- **Codes d'erreur** : 400 avec exemples détaillés
- **Descriptions** : "Email déjà utilisé" documenté
- **Exemples** : Réponses d'erreur réalistes
- **Validation** : Règles d'unicité expliquées

### **📖 Contenu Documenté**
- **Erreurs de validation** : Format et données manquantes
- **Erreurs d'unicité** : Email déjà utilisé
- **Erreurs serveur** : Problèmes de vérification Firebase
- **Exemples complets** : Tous les cas d'usage

**🌐 Accès Swagger :** `http://localhost:5000/api-docs`

---

## 🎉 **Résumé des Améliorations**

1. **🚫 Prévention des doublons** : Impossible de s'inscrire avec le même email
2. **🔥 Validation Firebase Auth** : Vérification dans la base d'authentification
3. **📝 Messages clairs** : Erreurs spécifiques et informatives
4. **🛡️ Sécurité renforcée** : Validation côté serveur obligatoire
5. **📚 Documentation complète** : Swagger mis à jour avec tous les cas
6. **⚡ Performance optimisée** : Vérification rapide et efficace

**L'API d'inscription empêche maintenant complètement les inscriptions avec des emails déjà utilisés !** 🚀
