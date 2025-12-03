// Run this on Port 3002
// reviewnode.js
// reviewnode.js (gRPC Server Version)
// reviewnode.js (gRPC Server Version - Port 50052)
require('dotenv').config();
const mongoose = require('mongoose');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const reviewController = require('./controllers/reviewController.js');

const DB_URI = process.env.DB_CONNECTION_STRING;
const GRPC_PORT = '0.0.0.0:50052';
// FIX: Ensure 'protos' folder is in path
const PROTO_PATH = path.join(__dirname, 'protos', 'cafe_service.proto');

// Connect to MongoDB
mongoose.connect(DB_URI)
  .then(() => console.log('REVIEW API: Connected to MongoDB'))
  .catch(err => console.error('REVIEW API: DB Error', err));

// Load Protobuf
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const cafeProto = grpc.loadPackageDefinition(packageDefinition).cafe_service;

// Start gRPC Server
const server = new grpc.Server();

server.addService(cafeProto.ReviewService.service, {
  GetReviews: reviewController.getReviews,
  AddReview: reviewController.addReview,
  DeleteReview: reviewController.deleteReview,
  EditReview: reviewController.editReview
});

server.bindAsync(GRPC_PORT, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) console.error(err);
  else console.log(`REVIEW gRPC Service running on ${GRPC_PORT}`);
});
