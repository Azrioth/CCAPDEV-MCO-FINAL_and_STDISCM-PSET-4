// controllers/reservationController.js
const reservationModel = require('../models/reservations.js');
const mongoose = require('mongoose');
const dayjs = require('dayjs');

// Helper to map Mongoose doc to Proto message
const mapToProto = (doc) => {
  const originalDate = new Date(doc.date);

  // 1. Calculate the New Date: Original Date + 7 days
  const futureDate = new Date(originalDate);
  // Set the date to 7 days from the original date
  futureDate.setDate(originalDate.getDate() + 7);

  // 2. Format the Date (e.g., "Wed Mar 06 2024")
  const formattedDate = futureDate.toDateString();

  // 3. Format the Time (e.g., "14:30:00")
  // toLocaleTimeString with options gives HH:MM:SS without GMT/UTC/AM/PM
  const hours = originalDate.getUTCHours().toString().padStart(2, '0');
  const minutes = originalDate.getUTCMinutes().toString().padStart(2, '0');
  const seconds = originalDate.getUTCSeconds().toString().padStart(2, '0');

  const formattedTime = `${hours}:${minutes}:${seconds}`;
  // Explicitly return the object
  return {
    _id: doc._id.toString(),
    username: doc.username,
    cafe_id: doc.cafe_id,
    cafe_name: doc.cafe_name,
    date: formattedDate, // Date is now +7 days
    time: formattedTime, // Time is clean (HH:MM:SS)
    notes: doc.notes || '',
    status: doc.status || 'pending'
  };
};
exports.makeReservation = async (call, callback) => {
  try {
    // FIX: Include 'notes' in the destructuring
    const { username, cafe_id, cafe_name, notes } = call.request;

    const newRes = new reservationModel({
      username,
      cafe_id,
      cafe_name, // This is the field now being reliably populated
      status: 'Pending',
      date: new Date(),
      notes: notes || '' // Ensure notes are saved
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
