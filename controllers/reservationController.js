// controllers/reservationController.js
const reservationModel = require('../models/reservations.js');
const mongoose = require('mongoose');

// Helper to map Mongoose doc to Proto message
const mapToProto = (doc) => ({
  _id: doc._id.toString(),
  username: doc.username,
  cafe_id: doc.cafe_id,
  cafe_name: doc.cafe_name,
  date: doc.date ? doc.date.toString() : new Date().toISOString(),
  status: doc.status || 'pending'
});

exports.makeReservation = async (call, callback) => {
  try {
    const { username, cafe_id, cafe_name } = call.request;
    const newRes = new reservationModel({
      username,
      cafe_id,
      cafe_name,
      status: 'pending',
      date: new Date()
    });
    await newRes.save();

    callback(null, { status: 'success' });
  } catch (err) {
    callback(null, { status: 'error', error: err.message });
  }
};

exports.getUserReservations = async (call, callback) => {
  try {
    const username = call.request.username;
    const data = await reservationModel.find({ username }).lean();
    const mapped = data.map(mapToProto);
    callback(null, { reservations: mapped });
  } catch (err) {
    callback(null, { reservations: [] });
  }
};

exports.getOwnerReservations = async (call, callback) => {
  try {
    const cafes = call.request.cafes || [];
    if (cafes.length === 0) return callback(null, { reservations: [] });

    const data = await reservationModel.find({ cafe_name: { $in: cafes } }).lean();
    const mapped = data.map(mapToProto);
    callback(null, { reservations: mapped });
  } catch (err) {
    callback(null, { reservations: [] });
  }
};

exports.updateStatus = async (call, callback) => {
  try {
    const { reservation_id, status } = call.request;

    await reservationModel.findByIdAndUpdate(
      reservation_id,
      { status: status },
      { new: true }
    );
    callback(null, { status: 'success' });
  } catch (err) {
    callback(null, { status: 'error', error: err.message });
  }
};
