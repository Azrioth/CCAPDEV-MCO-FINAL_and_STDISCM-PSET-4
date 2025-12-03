// coreapinode.js (gRPC Server Version - Port 50051)
require('dotenv').config();
const mongoose = require('mongoose');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const authController = require('./controllers/authController.js');
const cafeController = require('./controllers/cafeController.js');

const DB_URI = process.env.DB_CONNECTION_STRING;
const GRPC_PORT = '0.0.0.0:50051';
const PROTO_PATH = path.join(__dirname, 'protos', 'cafe_service.proto');

// Connect to MongoDB
mongoose.connect(DB_URI)
  .then(() => console.log('CORE API: Connected to MongoDB'))
  .catch(err => console.error('CORE API: DB Error', err));

// Load Protobuf
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const cafeProto = grpc.loadPackageDefinition(packageDefinition).cafe_service;

// Start gRPC Server
const server = new grpc.Server();

// Add the CoreService methods
server.addService(cafeProto.CoreService.service, {
  Login: authController.login,
  Register: authController.register,
  // FIX: Use correct exported function names
  GetUserProfile: authController.getUserProfile,
  UpdateUserProfile: authController.updateUserProfile,

  GetCafes: cafeController.getCafes,
  GetCafeById: cafeController.getCafeById,
  CreateCafe: cafeController.createCafe,
});

server.bindAsync(GRPC_PORT, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error("Failed to bind server:", err);
    return;
  }
  console.log(`CORE gRPC API running on ${GRPC_PORT}`);
});
