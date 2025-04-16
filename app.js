const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('./firebase'); // utilise ta config centralisée

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const commentsRoutes = require('./routes/comments');

console.log('authRoutes:', authRoutes);
console.log('usersRoutes:', usersRoutes);

const app = express();

app.use(cors({
    origin: [
      'http://localhost:52366', // Flutter Web local
      'https://ton-frontend.onrender.com' // Si tu as un front déployé
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));
  
app.use(bodyParser.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/comments', commentsRoutes);

app.listen(3000, () => {
  console.log('Serveur backend démarré sur le port 3000');
});
  

module.exports = admin;
