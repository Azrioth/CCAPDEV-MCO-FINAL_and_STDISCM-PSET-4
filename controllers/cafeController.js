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

exports.createCafe = async (req, res) => {
  try {
    // 1. Generate a simple numeric ID (since your schema uses Number for cafe_id)
    // In a real app, you'd use UUID or let Mongo handle _id, but for this schema:
    const count = await cafeModel.countDocuments();
    const newId = count + 1;

    // 2. Create the new Cafe object
    const newCafe = new cafeModel({
      name: req.body.name,
      description: req.body.bio, // Mapping 'bio' from form to 'description' in schema
      rating: 0, // Default rating
      items: req.body.items,
      owner: req.body.owner,
      address: req.body.address,
      price_range: req.body.price_range,
      image_name: req.body.image, // Assuming URL or path provided
      cafe_id: newId
    });

    // 3. Save to Database
    await newCafe.save();

    // 4. Return the new ID so frontend can redirect
    res.json({ status: 'success', cafe_id: newId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
