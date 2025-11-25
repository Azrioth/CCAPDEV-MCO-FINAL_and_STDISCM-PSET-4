const cafeModel = require('../models/cafe.js');

// Get All Cafes (with Search)
exports.getCafes = async (req, res) => {
  try {
    let query = {};
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      query = { $or: [{ name: regex }, { description: regex }] };
    }
    const cafes = await cafeModel.find(query).lean();
    res.json(cafes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Single Cafe
exports.getCafeById = async (req, res) => {
  try {
    const cafe = await cafeModel.findOne({ cafe_id: parseInt(req.params.id) }).lean();
    res.json(cafe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
