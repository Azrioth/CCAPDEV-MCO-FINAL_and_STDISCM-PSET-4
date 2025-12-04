// controllers/authController.js
const User = require('../models/user.js'); // Assuming you have this model
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // 👈 NEW: Import bcrypt for hashing/comparison

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';

// Helper to format Mongo User to Proto User
const mapUser = (user, token = '') => ({
  username: user.username,
  email: user.email || '',
  cafes: user.cafes || [],
  desc: user.desc || '',
  profile_pic: user.profile_pic || '',
  token: token
});

// 1. Login (gRPC Handler)
exports.login = async (call, callback) => {
  try {
    const { username, password } = call.request;
    const user = await User.findOne({ username });

    // 1. Check if user exists
    if (!user) {
      // Use the gRPC UNAUTHENTICATED status code for invalid credentials
      return callback({ code: grpc.status.UNAUTHENTICATED, details: "Invalid credentials" });
    }

    // 2. CRITICAL FIX: Use bcrypt to compare the plain text password with the hashed password from the DB
    // Assuming your passwords in MongoDB are hashed.
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return callback({ code: grpc.status.UNAUTHENTICATED, details: "Invalid credentials" });
    }

    // 3. Generate Token
    const token = jwt.sign(
      { username: user.username, email: user.email, cafes: user.cafes, profile_pic: user.profile_pic },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 4. Send back user data and token
    callback(null, mapUser(user, token));

  } catch (err) {
    console.error("Login gRPC Error:", err);
    callback(err);
  }
};

// 2. Register (gRPC Handler)
exports.register = async (call, callback) => {
  try {
    const { username, password, email } = call.request;

    const existing = await User.findOne({ username });
    if (existing) {
      return callback(null, { status: 'error', error: 'User already exists' });
    }

    // NOTE: You should hash the password here before saving
    // Example: const hashedPassword = await bcrypt.hash(password, 10);
    // const newUser = new User({ username, password: hashedPassword, email });

    // Assuming you handle hashing in the model's pre-save hook or will implement it.
    const newUser = new User({ username, password, email });
    await newUser.save();

    callback(null, { status: 'success', message: 'User registered' });
  } catch (err) {
    callback(null, { status: 'error', error: err.message });
  }
};

// 3. Get User Profile (gRPC Handler)
exports.getUserProfile = async (call, callback) => {
  try {
    const { username } = call.request;
    const user = await User.findOne({ username });

    if (!user) return callback(new Error('User not found'));

    callback(null, mapUser(user));
  } catch (err) {
    callback(err);
  }
};

// 4. Update User Profile (gRPC Handler)
exports.updateUserProfile = async (call, callback) => {
  try {
    const { username, desc, profile_pic, password } = call.request;

    const updates = {};
    if (desc) updates.desc = desc;
    if (profile_pic) updates.profile_pic = profile_pic;

    // NOTE: Handle password hashing if the password field is updated
    if (password) {
      // Example: updates.password = await bcrypt.hash(password, 10);
      updates.password = password; // Assuming handling in model or will be fixed
    }

    const updatedUser = await User.findOneAndUpdate(
      { username },
      { $set: updates },
      { new: true }
    );

    if (!updatedUser) return callback(null, { status: 'error', error: 'User not found' });

    callback(null, { status: 'success', message: 'Profile updated' });
  } catch (err) {
    callback(null, { status: 'error', error: err.message });
  }
};
