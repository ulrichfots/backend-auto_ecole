const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');

console.log('authRoutes:', authRoutes);
console.log('usersRoutes:', usersRoutes);

const app = express();

app.use(cors());
app.use(bodyParser.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

app.listen(3000, () => {
  console.log('Serveur backend démarré sur le port 3000');
});

module.exports = admin;
