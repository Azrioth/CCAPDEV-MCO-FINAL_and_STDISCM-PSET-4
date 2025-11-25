const mongoose = require('mongoose');

const cafeSchema = new mongoose.Schema({
  name: { type: String },
  description: { type: String },
  rating: { type: Number },
  items: { type: Array },
  owner: { type: String },
  address: { type: String },
  price_range: { type: String },
  image_name: { type: String },
  cafe_id: { type: Number }
}, { versionKey: false });

module.exports = mongoose.model('shop', cafeSchema);
