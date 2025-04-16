const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('./firebase'); // utilise ta config centralisée

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');

console.log('authRoutes:', authRoutes);
console.log('usersRoutes:', usersRoutes);

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

app.listen(3000, () => {
  console.log('Serveur backend démarré sur le port 3000');
});

module.exports = admin;
