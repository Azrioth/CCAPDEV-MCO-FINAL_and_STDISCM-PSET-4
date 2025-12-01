// Run this on Port 3001
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

// Import ONLY Core Controllers
const authController = require('./controllers/authController.js');
const cafeController = require('./controllers/cafeController.js');

const server = express();
const PORT = process.env.CORE_API_PORT || 3001;
const DB_URI = process.env.DB_CONNECTION_STRING;

server.use(express.json());
server.use(express.urlencoded({ extended: true }));

mongoose.connect(DB_URI)
  .then(() => console.log('CORE API: Connected to MongoDB'))
  .catch(err => console.error('CORE API: DB Error', err));

const apiRouter = express.Router();

// --- Auth Routes ---
apiRouter.post('/login', authController.login);
apiRouter.post('/register', authController.register);
apiRouter.get('/user/:username', authController.getProfile);
apiRouter.put('/user/:username', authController.updateProfile);

// --- Cafe Routes ---
apiRouter.get('/cafes', cafeController.getCafes);
apiRouter.get('/cafe/:id', cafeController.getCafeById);
apiRouter.post('/add-cafe', cafeController.createCafe);

server.use('/api', apiRouter);

server.listen(PORT, () => {
  console.log(`CORE API running on port ${PORT}`);
});
