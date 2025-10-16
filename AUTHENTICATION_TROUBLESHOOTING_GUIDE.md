# 🔐 Guide de Dépannage - Authentification 401

## 🚨 Problème Identifié

Vous recevez une erreur **401 (Unauthorized)** lors de l'appel à l'endpoint `/api/sessions/upcoming`. Ce guide vous aide à diagnostiquer et résoudre le problème.

## 🔍 Diagnostic Rapide

### 1. **Vérifier le Token d'Authentification**

Utilisez l'endpoint de debug pour analyser votre token :

```bash
curl -X GET "https://backend-auto-ecole-f14d.onrender.com/api/auth/debug-token" \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

### 2. **Vérifier la Validité du Token**

```bash
curl -X GET "https://backend-auto-ecole-f14d.onrender.com/api/auth/verify-token" \
  -H "Authorization: Bearer VOTRE_TOKEN_ICI"
```

## 🛠️ Solutions par Type de Problème

### **Problème 1 : Token Manquant**

**Symptôme :** `Token d'authentification manquant`

**Solution :**
```javascript
// Côté client - Assurez-vous d'envoyer le token
const response = await fetch('/api/sessions/upcoming', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### **Problème 2 : Format Incorrect**

**Symptôme :** `Format d'authentification incorrect`

**Solution :**
```javascript
// ❌ Incorrect
headers: { 'Authorization': token }

// ✅ Correct
headers: { 'Authorization': `Bearer ${token}` }
```

### **Problème 3 : Token Expiré**

**Symptôme :** `Token expiré`

**Solution :**
```javascript
// Rafraîchir le token
const refreshResponse = await fetch('/api/auth/refresh-token', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${currentToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ rememberMe: true })
});

const { token: newToken } = await refreshResponse.json();
```

### **Problème 4 : Token Personnalisé Non Échangé**

**Symptôme :** `Token invalide` ou `Token malformé`

**Cause :** Vous utilisez un `customToken` au lieu d'un `idToken`

**Solution :**
```javascript
// ❌ Ne pas utiliser directement le customToken
const customToken = response.token; // Ceci ne fonctionne pas

// ✅ Échanger le customToken contre un idToken
import { signInWithCustomToken } from 'firebase/auth';

const userCredential = await signInWithCustomToken(auth, customToken);
const idToken = await userCredential.user.getIdToken();

// Utiliser l'idToken pour les appels API
const response = await fetch('/api/sessions/upcoming', {
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  }
});
```

### **Problème 5 : Compte Suspendu ou En Attente**

**Symptôme :** `Compte suspendu` ou `Compte en attente`

**Solution :**
- Contactez l'administration
- Vérifiez votre statut dans la base de données

## 🔧 Processus d'Authentification Correct

### **1. Connexion**
```javascript
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'votre@email.com',
    password: 'votre_mot_de_passe'
  })
});

const { token: customToken } = await loginResponse.json();
```

### **2. Échange du Token (IMPORTANT)**
```javascript
import { signInWithCustomToken } from 'firebase/auth';

// Échanger le customToken contre un idToken
const userCredential = await signInWithCustomToken(auth, customToken);
const idToken = await userCredential.user.getIdToken();
```

### **3. Utilisation pour les Appels API**
```javascript
const response = await fetch('/api/sessions/upcoming', {
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  }
});
```

## 🧪 Tests de Validation

### **Test 1 : Vérifier la Connexion**
```bash
curl -X POST "https://backend-auto-ecole-f14d.onrender.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "votre@email.com",
    "password": "votre_mot_de_passe"
  }'
```

### **Test 2 : Tester l'Endpoint Problématique**
```bash
curl -X GET "https://backend-auto-ecole-f14d.onrender.com/api/sessions/upcoming?page=1&limit=10" \
  -H "Authorization: Bearer VOTRE_ID_TOKEN"
```

## 📋 Checklist de Dépannage

- [ ] Le token est-il présent dans le header `Authorization` ?
- [ ] Le format est-il `Bearer <token>` ?
- [ ] Le token est-il un `idToken` (pas un `customToken`) ?
- [ ] Le token n'est-il pas expiré ?
- [ ] L'utilisateur existe-t-il dans Firestore ?
- [ ] Le statut du compte est-il `actif` ?

## 🆘 Support

Si le problème persiste :

1. **Utilisez l'endpoint de debug :**
   ```bash
   curl -X GET "https://backend-auto-ecole-f14d.onrender.com/api/auth/debug-token" \
     -H "Authorization: Bearer VOTRE_TOKEN"
   ```

2. **Vérifiez les logs du serveur** pour des erreurs détaillées

3. **Contactez l'équipe de développement** avec les informations de debug

## 🔄 Mise à Jour du Code Client

Assurez-vous que votre code client suit ce pattern :

```javascript
class AuthService {
  async login(email, password) {
    // 1. Connexion
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const { token: customToken } = await response.json();
    
    // 2. Échange du token
    const userCredential = await signInWithCustomToken(auth, customToken);
    const idToken = await userCredential.user.getIdToken();
    
    // 3. Stockage du token
    localStorage.setItem('idToken', idToken);
    
    return idToken;
  }
  
  async makeAuthenticatedRequest(url, options = {}) {
    const idToken = localStorage.getItem('idToken');
    
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
  }
}

// Utilisation
const authService = new AuthService();
const response = await authService.makeAuthenticatedRequest('/api/sessions/upcoming');
```

---

**Note :** Ce guide couvre les problèmes d'authentification les plus courants. Si votre problème n'est pas résolu, utilisez l'endpoint de debug pour obtenir plus d'informations.
