require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Import your Models
const userModel = require('./models/user.js');
const cafeModel = require('./models/cafe.js');
const reviewModel = require('./models/review.js');

// Import your Raw Data
const userData = require('./databases/EspressoSelf.user.json');
const cafeData = require('./databases/EspressoSelf.cafe.json');
const reviewData = require('./databases/EspressoSelf.review.json');

const DB_URI = process.env.DB_CONNECTION_STRING;

// Connect to DB
mongoose.connect(DB_URI)
  .then(() => {
    console.log('SEEDER: Connected to MongoDB...');
    seedDatabase();
  })
  .catch(err => {
    console.error('SEEDER: Could not connect to DB', err);
    process.exit(1);
  });

// --- HELPER FUNCTION ---
// Fixes IDs exported from MongoDB Compass
// Converts { "$oid": "65ec..." } -> "65ec..."
function fixIds(dataList) {
  return dataList.map(item => {
    if (item._id && item._id.$oid) {
      item._id = item._id.$oid;
    }
    return item;
  });
}

async function seedDatabase() {
  try {
    // 1. CLEAR EXISTING DATA
    console.log('SEEDER: Deleting old data...');
    await userModel.deleteMany({});
    await cafeModel.deleteMany({});
    await reviewModel.deleteMany({});

    // 2. INSERT USERS (WITH HASHING)
    console.log('SEEDER: Hashing passwords and inserting users...');
    const saltRounds = 10;

    // Clean the User IDs before processing
    const cleanUserData = fixIds(userData);

    for (let user of cleanUserData) {
      // Hash the password
      const hashedPassword = await bcrypt.hash(String(user.password), saltRounds);

      // Create user with hashed password
      const newUser = new userModel({
        ...user,
        password: hashedPassword
      });
      await newUser.save();
    }

    // 3. INSERT CAFES
    console.log('SEEDER: Inserting cafes...');
    const cleanCafeData = fixIds(cafeData);
    await cafeModel.insertMany(cleanCafeData);

    // 4. INSERT REVIEWS
    console.log('SEEDER: Inserting reviews...');
    const cleanReviewData = fixIds(reviewData);
    await reviewModel.insertMany(cleanReviewData);

    console.log('SEEDER: Database successfully populated!');
    process.exit();
  } catch (err) {
    console.error('SEEDER: Error seeding database', err);
    process.exit(1);
  }
}
