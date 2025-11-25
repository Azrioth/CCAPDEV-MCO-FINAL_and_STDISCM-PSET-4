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

// --- API ROUTER SETUP ---
const apiRouter = express.Router();

// Define all routes on the router without the /api prefix (since we mount it at /api)

// Auth Routes
apiRouter.post('/login', authController.login);
apiRouter.post('/register', authController.register);
apiRouter.get('/user/:username', authController.getProfile);
apiRouter.put('/user/:username', authController.updateProfile);

// Cafe Routes
apiRouter.get('/cafes', cafeController.getCafes);
apiRouter.get('/cafe/:id', cafeController.getCafeById);
apiRouter.post('/add-cafe', cafeController.createCafe); // This is the new route

// Review Routes
apiRouter.get('/reviews', reviewController.getReviews);
apiRouter.post('/review', reviewController.addReview);
apiRouter.delete('/review/:id', reviewController.deleteReview);

// Apply the /api prefix to all routes defined in apiRouter
server.use('/api', apiRouter);

// Start Server
server.listen(PORT, () => {
  console.log(`API Node running on port ${PORT}`);
});
