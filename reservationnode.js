// reservationnode.js (gRPC Server Version - Port 50053)
require('dotenv').config();
const mongoose = require('mongoose');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const reservationController = require('./controllers/reservationController.js');

// Config
const DB_URI = process.env.DB_CONNECTION_STRING;
// FIX: Changed port to 50053 to match viewnode.js client
const GRPC_PORT = '0.0.0.0:50053';
const PROTO_PATH = path.join(__dirname, 'protos', 'cafe_service.proto');

// DB Connection
mongoose.connect(DB_URI)
  .then(() => console.log('RESERVATION API: Connected to MongoDB'))
  .catch(err => console.error('RESERVATION API: DB Error', err));

// Load Proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const cafeProto = grpc.loadPackageDefinition(packageDefinition).cafe_service;

// Start Server
const server = new grpc.Server();

// FIX: Use ReservationService as defined in your proto
server.addService(cafeProto.ReservationService.service, {
  MakeReservation: reservationController.makeReservation,
  GetUserReservations: reservationController.getUserReservations,
  GetOwnerReservations: reservationController.getOwnerReservations,
  UpdateStatus: reservationController.updateStatus
});

server.bindAsync(GRPC_PORT, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) console.error("Failed to bind gRPC server:", err);
  else console.log(`RESERVATION gRPC Service running on ${GRPC_PORT}`);
});
