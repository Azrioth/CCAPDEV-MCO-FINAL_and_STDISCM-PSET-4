const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  username: { type: String, required: true },
  cafe_id: { type: String, required: true },
  cafe_name: { type: String, required: true },
  status: { type: String, default: 'Pending' },
  date: { type: Date, default: Date.now }
}, { versionKey: false });

module.exports = mongoose.model('reservation', reservationSchema);
