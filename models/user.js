const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String },
  password: { type: String },
  email: { type: String },
  desc: { type: String },
  profile_pic: { type: String },
  helpful: { type: Array },
  cafes: { type: Array }
}, { versionKey: false });

module.exports = mongoose.model('user', userSchema);
