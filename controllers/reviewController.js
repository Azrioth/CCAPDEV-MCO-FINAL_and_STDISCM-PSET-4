// controllers/reviewController.js
const reviewModel = require('../models/review.js');

// Helper to map Mongoose Document to Proto Message
const mapReview = (doc) => ({
  _id: doc._id.toString(),
  username: doc.username,
  cafe_id: doc.cafe_id,
  cafe: doc.cafe,
  rating: doc.rating,
  comment: doc.comment,
  date: doc.date ? doc.date.toString() : new Date().toISOString(),
  isEdited: doc.isEdited || false
});

// 1. Get Reviews
exports.getReviews = async (call, callback) => {
  try {
    const { cafe_name, username } = call.request;
    let query = {};

    if (cafe_name) query.cafe = cafe_name;
    if (username) query.username = username;

    const reviews = await reviewModel.find(query).lean();
    const mappedReviews = reviews.map(mapReview);

    callback(null, { reviews: mappedReviews });
  } catch (err) {
    console.error("Error getting reviews:", err);
    callback(null, { reviews: [] });
  }
};

// 2. Add Review
exports.addReview = async (call, callback) => {
  try {
    const data = call.request;
    const newReview = new reviewModel({
      username: data.username,
      cafe_id: data.cafe_id,
      cafe: data.cafe,
      rating: data.rating,
      comment: data.comment,
      date: data.date,
      isEdited: false
    });

    await newReview.save();
    callback(null, { status: 'success' });
  } catch (err) {
    console.error("Error adding review:", err);
    callback(null, { status: 'error', error: err.message });
  }
};

// 3. Delete Review
exports.deleteReview = async (call, callback) => {
  try {
    const { id } = call.request;
    await reviewModel.findByIdAndDelete(id);
    callback(null, { status: 'success' });
  } catch (err) {
    console.error("Error deleting review:", err);
    callback(null, { status: 'error', error: err.message });
  }
};

// 4. Edit Review
exports.editReview = async (call, callback) => {
  try {
    const { id, rating, comment } = call.request;

    await reviewModel.findByIdAndUpdate(id, {
      rating: rating,
      comment: comment,
      isEdited: true
    });
    callback(null, { status: 'success' });
  } catch (err) {
    console.error("Error editing review:", err);
    callback(null, { status: 'error', error: err.message });
  }
};
