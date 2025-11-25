const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  username: { type: String },
  cafe: { type: String },
  cafe_id: { type: Number },
  image_src: { type: String },
  rating: { type: Number },
  comment: { type: String },
  date: { type: String },
  isHelpful: { type: Number },
  isUnhelpful: { type: Number },
  owner_response: { type: String },
  isEdited: { type: Boolean }
}, { versionKey: false });

module.exports = mongoose.model('review', reviewSchema);
