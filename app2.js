//Install Commands:
//npm init
//npm i express express-handlebars body-parser mongoose express-validator bcrypt
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

// --- IMPORT CONTROLLERS ---
// This keeps the main file clean and follows MVC
const authController = require('./controllers/authController.js');
const cafeController = require('./controllers/cafeController.js');
const reviewController = require('./controllers/reviewController.js');

const server = express();

// --- CONFIGURATION ---
const PORT = process.env.API_PORT || 3001;
const DB_URI = process.env.DB_CONNECTION_STRING;

// --- MIDDLEWARE ---
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

// --- FAULT TOLERANT DB CONNECTION ---
// Supports Replica Sets if configured in .env
mongoose.connect(DB_URI)
  .then(() => console.log('API Node: Connected to MongoDB'))
  .catch(err => console.error('API Node: DB Connection Error', err));

// --- ROUTES (Mapped to Controllers) ---

// Auth Routes
server.post('/api/login', authController.login);
server.post('/api/register', authController.register);
server.get('/api/user/:username', authController.getProfile);
server.put('/api/user/:username', authController.updateProfile);

// Cafe Routes
server.get('/api/cafes', cafeController.getCafes);
server.get('/api/cafe/:id', cafeController.getCafeById);

// Review Routes
server.get('/api/reviews', reviewController.getReviews);
server.post('/api/review', reviewController.addReview);
server.delete('/api/review/:id', reviewController.deleteReview);

// Start Server
server.listen(PORT, () => {
  console.log(`API Node running on port ${PORT}`);
});
