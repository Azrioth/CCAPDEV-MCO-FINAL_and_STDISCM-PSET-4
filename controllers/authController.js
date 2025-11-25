const userModel = require('../models/user.js'); // Mongoose Model for User data
const bcrypt = require('bcrypt'); // For password hashing
const jwt = require('jsonwebtoken'); // For stateless session management
const JWT_SECRET = process.env.JWT_SECRET; // Must match the secret in your .env file

// Handles user login: finds user, compares password, returns JWT token
exports.login = async (req, res) => {
  try {
    const user = await userModel.findOne({ username: req.body.username }).lean();
    if (!user) return res.json({ status: 'fail', message: 'User not found' });

    // Compare the provided password with the stored hash
    const match = await bcrypt.compare(req.body.password, user.password);
    if (match) {
      // SUCCESS: Generate a JWT for stateless session
      const token = jwt.sign(
        // Payload data stored in the token (accessible by View Node)
        { username: user.username, email: user.email, cafes: user.cafes },
        JWT_SECRET,
        { expiresIn: '1h' } // Token expires in 1 hour
      );

      // Prepare response object (without the password hash)
      const userResponse = { ...user };
      delete userResponse.password;

      res.json({ status: 'success', token: token, user: userResponse });
    } else {
      // FAIL: Password mismatch
      res.json({ status: 'fail', message: 'Incorrect password' });
    }
  } catch (err) {
    // Handles database/server errors
    res.status(500).json({ error: err.message });
  }
};

// Handles new user registration
exports.register = async (req, res) => {
  try {
    // Check if user already exists
    const existingUser = await userModel.findOne({ username: req.body.username });
    if (existingUser) {
        return res.status(400).json({ status: 'fail', message: 'Username already exists' });
    }

    // Generate strong password hash
    const hash = await bcrypt.hash(req.body.password, 10);

    const newUser = new userModel({
      username: req.body.username,
      password: hash,
      email: req.body.email,
      desc: "A new Espresso Self user.", // Default description
      profile_pic: "Photos/profile_picture.webp", // Default profile picture path
      helpful: [],
      cafes: [] // Initialize cafes array
    });
    await newUser.save();
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Handles updating user profile details (description, profile_pic, and optional password)
exports.updateProfile = async (req, res) => {
  try {
    const updateData = {};

    // Update description if provided
    if (req.body.desc !== undefined) {
      updateData.desc = req.body.desc;
    }

    // CRITICAL FIX: Update profile_pic if provided from the form
    // This value comes directly from the input field in edit_profile.hbs
    if (req.body.profile_pic !== undefined) {
      updateData.profile_pic = req.body.profile_pic;
    }

    // Hash new password if the user is changing it
    if (req.body.password) {
      updateData.password = await bcrypt.hash(req.body.password, 10);
    }

    // Find and update the user, returning the new document
    const user = await userModel.findOneAndUpdate(
      { username: req.params.username },
      updateData,
      { new: true } // returns the updated document
    ).lean();

    if (user) delete user.password;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Handles fetching a user's profile data
exports.getProfile = async (req, res) => {
  try {
    const user = await userModel.findOne({ username: req.params.username }).select('-password').lean();
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
