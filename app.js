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

app.use(cors());
app.use(bodyParser.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/comments', commentsRoutes);

app.listen(3000, () => {
  console.log('Serveur backend démarré sur le port 3000');
});

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:8080', 'https://ton-backend.onrender.com'],
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  

module.exports = admin;
