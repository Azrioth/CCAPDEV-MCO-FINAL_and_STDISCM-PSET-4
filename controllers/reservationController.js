const reservationModel = require('../models/reservations.js');
// const cafeModel = require('../models/cafe.js');

exports.createReservation = async (req, res) => {
  try {
    const newRes = new reservationModel({
      username: req.body.username,
      cafe_id: req.body.cafe_id,
      cafe_name: req.body.cafe_name
    });
    await newRes.save();
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Get User's Own Reservations (Student Views Grades)
exports.getUserReservations = async (req, res) => {
  try {
    const reservations = await reservationModel.find({ username: req.params.username }).lean();
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. Get Reservations for Owners (Faculty Views Class List)
// This finds all reservations made to cafes that exist in the owner's "cafes" list
exports.getOwnerReservations = async (req, res) => {
  try {
    const cafesOwned = req.query.cafes ? req.query.cafes.split(',') : [];

    if (cafesOwned.length === 0) {
      return res.json([]);
    }

    // Find reservations
    const reservations = await reservationModel.find({
      cafe_name: { $in: cafesOwned }
    }).lean();

    // === CRITICAL FIX: Ensure _id is a string ===
    // This mapping operation ensures the _id property is definitely a string.
    const sanitizedReservations = reservations.map(r => ({
      ...r,
      // .toString() on ObjectId is the required step to pass it to the view
      _id: r._id.toString()
    }));
    // ===========================================

    // Change this line to send the sanitized data
    res.json(sanitizedReservations); //

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. Update Status (Faculty Uploads Grades)
exports.updateStatus = async (req, res) => {
  try {
    // CRITICAL FIX: Using explicit variable assignment instead of destructuring
    // to ensure robustness against potential parsing issues.
    const reservationId = req.body.reservation_id;
    const newStatus = req.body.status;

    if (!reservationId) {
      return res.status(400).json({ error: 'Reservation ID is required.' });
    }

    if (!newStatus) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    const updatedRes = await reservationModel.findByIdAndUpdate(
      reservationId,
      { status: newStatus },
      { new: true }
    );

    if (!updatedRes) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    res.json({ status: 'success', reservation: updatedRes });

  } catch (err) {
    console.error("Error in updateStatus:", err);
    res.status(500).json({ error: err.message });
  }
};
