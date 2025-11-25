const reviewModel = require('../models/review.js');

// Get Reviews
exports.getReviews = async (req, res) => {
  try {
    let query = {};
    if (req.query.cafe) query.cafe = req.query.cafe;
    if (req.query.username) query.username = req.query.username;

    // Search reviews by content or author
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      query.$or = [{ comment: regex }, { username: regex }];
    }

    const reviews = await reviewModel.find(query).lean();
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add Review
exports.addReview = async (req, res) => {
  try {
    const newReview = new reviewModel(req.body);
    await newReview.save();
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete Review
exports.deleteReview = async (req, res) => {
  try {
    const deleted = await reviewModel.findByIdAndDelete(req.params.id);
    res.json(deleted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
