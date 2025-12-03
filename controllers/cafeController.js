// controllers/cafeController.js
const Cafe = require('../models/cafe.js');
const User = require('../models/user.js');

// Helper to map Mongo Cafe to Proto Cafe
const mapCafe = (doc) => {
  // Use the raw image name from the database (e.g., 'Cafe1_Starbucks.jpg')
  let imageFileName = doc.image_name || '';

  // 1. Sanitize the path: Remove any existing leading slashes or folder names
  // This ensures we start with a clean file name.
  imageFileName = imageFileName.split('/').pop();
  imageFileName = imageFileName.trim();

  // 2. Build the correct root-relative path using the guaranteed directory structure
  let imagePath = '';
  if (imageFileName) {
    // CRITICAL FIX: Explicitly prepend the correct root folder path
    // This is now guaranteed to output: /Photos/Cafe1_Starbucks.jpg
    imagePath = `/Photos/${imageFileName}`;
  }
  // =================================================================

  return {
    _id: doc._id.toString(),
    name: doc.name,
    bio: doc.bio || '',
    dti: doc.dti || '',
    // Use the guaranteed correct path
    image: imagePath,
    price_range: doc.price_range || '',
    address: doc.address || '',
    items: doc.items || [],
    owner: doc.owner || ''
  };
};
exports.getCafes = async (call, callback) => {
  try {
    const search = call.request.search;
    let query = {};

    if (search) {
      query = { name: { $regex: search, $options: 'i' } };
    }

    const cafes = await Cafe.find(query).lean();
    const cafeList = cafes.map(mapCafe);

    callback(null, { cafes: cafeList });
  } catch (err) {
    callback(err);
  }
};

exports.getCafeById = async (call, callback) => {
  try {
    const { cafe_id } = call.request;
    const cafe = await Cafe.findById(cafe_id).lean();

    if (!cafe) return callback(new Error("Cafe not found"));

    callback(null, mapCafe(cafe));
  } catch (err) {
    callback(err);
  }
};

exports.createCafe = async (call, callback) => {
  try {
    const data = call.request;

    // 1. Create Cafe - Save image as 'image_name' in DB
    const newCafe = new Cafe({
      name: data.name,
      bio: data.bio,
      dti: data.dti,
      image_name: data.image, // Use image_name for DB field
      price_range: data.price_range,
      address: data.address,
      items: data.items,
      owner: data.owner
    });

    const savedCafe = await newCafe.save();

    // 2. Update User (Owner) to include this cafe
    await User.findOneAndUpdate(
      { username: data.owner },
      { $push: { cafes: savedCafe.name } }
    );

    callback(null, { status: 'success', message: savedCafe._id.toString() });
  } catch (err) {
    console.error(err);
    callback(null, { status: 'error', error: err.message });
  }
};
