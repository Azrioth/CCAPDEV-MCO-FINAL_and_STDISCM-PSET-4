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
    const { review_id } = call.request;

    // FIX: Use reviewModel instead of Review
    const result = await reviewModel.deleteOne({ _id: review_id });

    if (result.deletedCount === 0) {
      return callback(null, { status: 'error', error: 'Review not found or already deleted.' });
    }

    // Return success response
    callback(null, { status: 'success', message: 'Review deleted successfully.' });

  } catch (err) {
    console.error("DeleteReview ERROR:", err.message);
    callback(null, { status: 'error', error: 'Internal server error during deletion.' });
  }
};


// 4. EDIT Review (EditReview)
exports.editReview = async (call, callback) => {
  try {
    const { review_id, rating, comment } = call.request;

    // 💡 FIX 2: Validate the review_id format before attempting a database query
    if (!mongoose.Types.ObjectId.isValid(review_id)) {
      console.error(`Invalid ObjectId format for review ID: ${review_id}`);
      return callback(null, { status: 'error', error: `Review ID "${review_id}" is not a valid ID format.` });
    }

    // Prepare the fields to update
    const updates = {
      rating: rating,
      comment: comment,
      isEdited: true, // Set a flag to show the review was edited
      date: new Date() // Update the timestamp
    };

    // Use reviewModel to find and update the review
    const updatedReview = await reviewModel.findByIdAndUpdate(
      review_id,
      { $set: updates },
      { new: true } // Return the updated document
    );

    if (!updatedReview) {
      return callback(null, { status: 'error', error: 'Review not found.' });
    }

    // Return success response
    callback(null, { status: 'success', message: 'Review updated successfully.' });

  } catch (err) {
    console.error("EditReview ERROR:", err.message);
    callback(null, { status: 'error', error: 'Internal server error during update.' });
  }
};
