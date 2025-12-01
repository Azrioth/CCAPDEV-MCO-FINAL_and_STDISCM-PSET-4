// Run this on Port 3003
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

// Import ONLY Reservation Controller
const reservationController = require('./controllers/reservationController.js');

const server = express();
const PORT = process.env.RESERVATION_API_PORT || 3003;
const DB_URI = process.env.DB_CONNECTION_STRING;

server.use(express.json());
server.use(express.urlencoded({ extended: true }));

mongoose.connect(DB_URI)
  .then(() => console.log('RESERVATION API: Connected to MongoDB'))
  .catch(err => console.error('RESERVATION API: DB Error', err));

const apiRouter = express.Router();

// --- Reservation Routes ---
apiRouter.post('/reservations', reservationController.createReservation);
apiRouter.get('/reservations/user/:username', reservationController.getUserReservations);
apiRouter.get('/reservations/owner', reservationController.getOwnerReservations);
apiRouter.post('/reservations/status', reservationController.updateStatus);

server.use('/api', apiRouter);

server.listen(PORT, () => {
  console.log(`RESERVATION API running on port ${PORT}`);
});
