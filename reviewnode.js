// Run this on Port 3002
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

// Import ONLY Review Controller
const reviewController = require('./controllers/reviewController.js');

const server = express();
const PORT = process.env.REVIEW_API_PORT || 3002;
const DB_URI = process.env.DB_CONNECTION_STRING;

server.use(express.json());
server.use(express.urlencoded({ extended: true }));

mongoose.connect(DB_URI)
  .then(() => console.log('REVIEW API: Connected to MongoDB'))
  .catch(err => console.error('REVIEW API: DB Error', err));

const apiRouter = express.Router();

// --- Review Routes ---
apiRouter.get('/reviews', reviewController.getReviews);
apiRouter.post('/review', reviewController.addReview);
apiRouter.delete('/review/:id', reviewController.deleteReview);

server.use('/api', apiRouter);

server.listen(PORT, () => {
  console.log(`REVIEW API running on port ${PORT}`);
});
