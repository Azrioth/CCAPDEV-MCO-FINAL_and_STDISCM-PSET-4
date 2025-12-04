//Install Commands:
//npm init
//npm i express express-handlebars body-parser mongoose express-validator bcrypt
// viewnode.js
require('dotenv').config();
const express = require('express');
const handlebars = require('express-handlebars');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const server = express();
const PORT = process.env.VIEW_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// --- gRPC CONFIGURATION ---
const PROTO_PATH = path.join(__dirname, 'protos', 'cafe_service.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const cafeProto = grpc.loadPackageDefinition(packageDefinition).cafe_service;

// Connect to Microservices (Ports must match the server files)
//
const CORE_GRPC_ADDRESS = process.env.CORE_GRPC_ADDRESS || 'localhost:50051';
const REVIEW_GRPC_ADDRESS = process.env.REVIEW_GRPC_ADDRESS || 'localhost:50052';
const RESERVATION_GRPC_ADDRESS = process.env.RESERVATION_GRPC_ADDRESS || 'localhost:50053';

const coreClient = new cafeProto.CoreService(CORE_GRPC_ADDRESS, grpc.credentials.createInsecure());
const reviewClient = new cafeProto.ReviewService(REVIEW_GRPC_ADDRESS, grpc.credentials.createInsecure());
const reservationClient = new cafeProto.ReservationService(RESERVATION_GRPC_ADDRESS, grpc.credentials.createInsecure());
const isValidObjectId = (id) => {
  if (!id || typeof id !== 'string') return false;
  // Checks for exactly 24 hexadecimal characters
  return /^[0-9a-fA-F]{24}$/.test(id);
};
// --- HELPER: Promisify gRPC Calls ---
const grpcCall = (client, method, payload = {}) => {
  return new Promise((resolve, reject) => {
    client[method](payload, (err, response) => {
      if (err) {
        // Handle gRPC specific errors nicely
        console.error(`gRPC Error [${method}]:`, err);
        resolve({ error: err.message, status: 'error' }); // Resolve to avoid crashing, but pass error
      } else {
        resolve(response);
      }
    });
  });
};

// --- MIDDLEWARE ---
server.use(express.static('public'));
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(cookieParser());

server.set('view engine', 'hbs');
server.engine('hbs', handlebars.engine({
  extname: 'hbs',
  defaultLayout: 'index',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  helpers: {
    ifEquals: (arg1, arg2, options) => (arg1 == arg2) ? options.fn(this) : options.inverse(this),
    ifIncludes: (arg1, arg2, options) => {
      if (!Array.isArray(arg2)) return options.inverse(this);
      return arg2.includes(arg1) ? options.fn(this) : options.inverse(this);
    }
  }
}));

// --- AUTH MIDDLEWARE ---
server.use((req, res, next) => {
  const token = req.cookies.auth_token;
  res.locals.loggedIn = false;
  res.locals.user = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      res.locals.loggedIn = true;
      res.locals.user = decoded;
      req.user = decoded;
    } catch (err) {
      res.clearCookie('auth_token');
    }
  }
  next();
});

// --- ROUTES ---

// 1. HOME
server.get('/', (req, res) => {
  const target = res.locals.loggedIn ? '/body_home_user' : '/body_home_nouser';
  res.redirect(target);
});

server.get('/body_home_user', async (req, res) => {
  const result = await grpcCall(coreClient, 'GetCafes', { search: "" });
  res.render('body_home_user', { layout: 'index', cafe: result.cafes });
});

server.get('/body_home_nouser', async (req, res) => {
  const result = await grpcCall(coreClient, 'GetCafes', { search: "" });
  res.render('body_home_nouser', { layout: 'index', cafe: result.cafes });
});

// 2. AUTH
server.get('/login', (req, res) => res.render('login', { layout: 'loginIndex' }));
server.get('/register', (req, res) => res.render('register', { layout: 'loginIndex' }));
server.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/body_home_nouser');
});

server.post('/body_home_user', async (req, res) => {
  // NOTE: This route handler is only hit when the login form (action="/body_home_user") is submitted.
  const result = await grpcCall(coreClient, 'Login', { username: req.body.user, password: req.body.pass });

  if (result.token) {
    // 1. Set the token cookie
    res.cookie('auth_token', result.token, { httpOnly: true, maxAge: 3600000 });

    // 2. SUCCESS: Redirect to the HOME route (/), which then uses the Auth middleware 
    // to choose between /body_home_user or /body_home_nouser.
    // This is cleaner than redirecting directly to /body_home_user.
    res.redirect('/');
  } else {
    // FAILURE: Render login page again with error message
    res.render('login', { layout: 'loginIndex', error: 'Login failed.' });
  }
});
server.post('/submitForm', async (req, res) => {
  if (req.body.inputPassword !== req.body.verify) return res.render('register', { error: 'Mismatch passwords' });

  const result = await grpcCall(coreClient, 'Register', {
    username: req.body.inputUsername,
    password: req.body.inputPassword,
    email: req.body.inputEmail
  });

  if (result.status === 'success') res.redirect('/login');
  else res.render('register', { error: result.error || 'Registration failed' });
});

// 3. CAFE
server.get('/cafe1_user', async (req, res) => {
  // 1. Authentication Check
  if (!res.locals.loggedIn) {
    return res.redirect('/login');
  }

  const cafeId = req.query.cafe_id;

  // 2. Input Validation
  // Assuming isValidObjectId is defined globally
  if (!cafeId || !isValidObjectId(cafeId)) {
    return res.status(400).render('body_home_user', { // <-- FIX
      layout: 'index',
      errorMessage: 'Invalid or missing cafe ID provided.'
    });
  }

  try {
    // 3. Fetch Cafe Details (Core Service)
    const cafeRes = await grpcCall(coreClient, 'GetCafeById', {
      cafe_id: cafeId
    });
    const cafe = cafeRes.cafe;

    // The log shows: "gRPC Error [GetCafeById]: Error: 2 UNKNOWN: Cafe not found"
    // This is handled here by checking if the cafe object exists/is valid.
    if (!cafe || cafe.error) {
      console.warn(`WARN: Cafe not found for ID ${cafeId}`);
      // Render the home page with an error message
      return res.status(404).render('body_home_user', { // <-- FIX
        layout: 'index',
        errorMessage: 'Cafe not found with the provided ID.'
      });
    }

    // 4. Fetch Reviews (Review Service)
    const reviewsRes = await grpcCall(reviewClient, 'GetReviews', {
      cafe_id: cafeId
    });
    let reviews = reviewsRes.reviews || [];

    // 5. Augment Reviews with user-specific flags
    const loggedInUsername = res.locals.user.username;
    const userHelpfulArray = res.locals.user.helpful || [];
    // Assuming cafe.name is an array of names for a single cafe, as seen in profile_user logic
    const isOwnerOfCafe = res.locals.user.cafes && res.locals.user.cafes.includes(cafe.name);

    reviews = reviews.map(review => ({
      ...review,
      isEditable: review.username === loggedInUsername,
      isHelpful: userHelpfulArray.includes(review._id),
      isOwner: isOwnerOfCafe,
      dateFormatted: new Date(review.date).toLocaleDateString()
    }));


    // 6. Render Page (Success)
    res.render('cafe1_user', {
      layout: 'index',
      cafe: cafe,
      reviews: reviews,
      user: res.locals.user,
      loggedIn: res.locals.loggedIn
    });

  } catch (error) {
    // 7. Generic Error Handling (Fallback to prevent 500 crashes)
    console.error(`Fatal error loading cafe ${cafeId} for user:`, error.message);
    res.status(500).render('body_home_user', { // <-- FIX
      layout: 'index',
      errorMessage: 'An internal error prevented the cafe details from loading.'
    });
  }
});
server.get('/cafe1', async (req, res) => {
  try {
    const cafeId = req.query.cafe_id;
    const searchQuery = req.query.search || '';

    if (!cafeId) return res.redirect('/');

    // 1. Fetch Cafe Details (Core API via gRPC)
    const cafeRes = await grpcCall(coreClient, 'GetCafeById', { cafe_id: cafeId });
    const cafeData = cafeRes;

    if (!cafeData || !cafeData.name) {
      return res.status(404).render('404', { layout: 'index', message: 'Cafe not found.' });
    }

    // 2. Fetch Reviews (Review API via gRPC)
    // Use the cafe name as the query parameter for reviews
    const reviewsRes = await grpcCall(reviewClient, 'GetReviews', {
      cafe_name: cafeData.name,
      // You can add search functionality here if the proto supports it
    });

    // --- CRITICAL FIX: Determine Template and Data ---
    const isUser = res.locals.loggedIn;
    // Render the user-specific template if logged in, otherwise the public one.
    const templateName = isUser ? 'cafe1_user' : 'cafe1';

    // 3. Render the page
    res.render(templateName, {
      layout: 'index',
      // Data passed to both cafe1.hbs and cafe1_user.hbs
      cafe: cafeData,
      review: reviewsRes.reviews || [],
      search: searchQuery,
      isUser: isUser, // You can use this flag in the template if needed
      user: res.locals.user || null // Pass user data for logged-in features
    });

  } catch (err) {
    console.error('Cafe Detail Route Error:', err.message);
    res.status(500).render('error', { layout: 'index', message: 'Failed to load cafe details.' });
  }
});
// 4. RESERVATIONS (UPDATED to gRPC)
server.post('/make-reservation', async (req, res) => {
  if (!res.locals.loggedIn) return res.redirect('/login');

  const payload = {
    username: res.locals.user.username,
    cafe_id: req.body.cafe_id,
    cafe_name: req.body.cafe_name
  };

  await grpcCall(reservationClient, 'MakeReservation', payload);
  res.redirect(`/profile_user`);
});

server.post('/reservations/status', async (req, res) => {
  if (!res.locals.loggedIn) return res.redirect('/login');

  await grpcCall(reservationClient, 'UpdateStatus', {
    reservation_id: req.body.reservation_id,
    status: req.body.status
  });

  res.redirect(`/profile_user?username=${res.locals.user.username}`);
});

// 5. PROFILE
server.get('/profile_user', async (req, res) => {
  try {
    if (!res.locals.loggedIn) return res.redirect("/login");

    const username = req.query.username || res.locals.user.username;

    // ---------------------------
    // Get User Profile
    // ---------------------------
    let userRes;
    try {
      userRes = await grpcCall(coreClient, "GetUserProfile", { username });
    } catch (err) {
      if (err.details === "User not found") {
        return res.status(404).render("404", { message: "User not found" });
      }
      console.error("GetUserProfile ERROR:", err);
      return res.status(500).send("Internal server error");
    }

    // ---------------------------
    // Get Reviews
    // ---------------------------
    let reviewsRes;
    try {
      reviewsRes = await grpcCall(reviewClient, "GetReviews", { username });
    } catch (err) {
      console.error("GetReviews ERROR:", err);
      reviewsRes = { reviews: [] }; // Fail gracefully
    }

    let reviews = reviewsRes.reviews || [];

    // ---------------------------
    // Add Cafe ID + Image to Reviews
    // ---------------------------
    if (reviews.length > 0) {
      let allCafesRes;
      try {
        allCafesRes = await grpcCall(coreClient, "GetCafes", { search: "" });
      } catch (err) {
        console.error("GetCafes ERROR:", err);
        allCafesRes = { cafes: [] }; // Fail gracefully
      }

      const allCafes = allCafesRes.cafes || [];

      // Map by name
      const cafeDataMap = {};
      allCafes.forEach(cafe => {
        cafeDataMap[cafe.name] = {
          _id: cafe._id,
          image: cafe.image
        };
      });

      // Replace review.cafe string with object {name, _id, image}
      reviews = reviews.map(review => {
        const cafeName = review.cafe;
        const details = cafeDataMap[cafeName] || {
          _id: null,
          image: "https://via.placeholder.com/50"
        };

        review.cafe = {
          name: cafeName,
          _id: details._id,
          image: details.image
        };

        return review;
      });
    }

    // ---------------------------
    // Get User Reservations
    // ---------------------------
    let reservationRes;
    try {
      reservationRes = await grpcCall(
        reservationClient,
        "GetUserReservations",
        { username }
      );
    } catch (err) {
      console.error("GetUserReservations ERROR:", err);
      reservationRes = { reservations: [] };
    }

    // ---------------------------
    // Owner Reservation Requests
    // ---------------------------
    let ownerRequests = [];
    if (
      res.locals.user.username === username &&
      userRes.cafes &&
      userRes.cafes.length > 0
    ) {
      try {
        const ownerRes = await grpcCall(
          reservationClient,
          "GetOwnerReservations",
          { cafes: userRes.cafes }
        );
        ownerRequests = ownerRes.reservations || [];
      } catch (err) {
        console.error("GetOwnerReservations ERROR:", err);
      }
    }

    // ---------------------------
    // Render Page
    // ---------------------------
    return res.render("profile_user", {
      layout: "index",
      checkUser: userRes,
      review: reviews,
      reservations: reservationRes.reservations || [],
      ownerRequests,
      currentLoggedIn: res.locals.user.username === username
    });

  } catch (err) {
    console.error("PROFILE_USER ROUTE FATAL ERROR:", err);
    return res.status(500).send("Something went wrong.");
  }
});
server.get('/cafe/:cafe_id', (req, res) => {

  const cafeId = req.params.cafe_id;

  const targetUrl = res.locals.loggedIn ?
    `/cafe1_user?cafe_id=${cafeId}` :
    `/cafe1?cafe_id=${cafeId}`;

  res.redirect(targetUrl);


});

server.get('/edit_profile', async (req, res) => {
  if (!res.locals.loggedIn) {
    return res.redirect('/login');
  }

  // Use the username of the currently logged-in user
  const username = res.locals.user.username;
  let userProfile = {};

  try {
    // Fetch the latest user profile data from the Core Service
    const userRes = await grpcCall(coreClient, 'GetUserProfile', { username: username });
    userProfile = userRes;

    res.render('edit_profile', {
      layout: 'index',
      user: userProfile,
      loggedIn: res.locals.loggedIn,
      // Pass query parameters to display messages
      errorMessage: req.query.error,
      successMessage: req.query.success
    });

  } catch (error) {
    console.error(`Error loading edit profile page for ${username}:`, error.message);
    const errorMessage = encodeURIComponent('Failed to load profile data for editing due to a server error.');
    // Redirect back to profile page on error
    return res.redirect(`/profile_user?username=${username}&error=${errorMessage}`);
  }
});


// 8. POST /submitEditUser - HANDLE FORM SUBMISSION
server.post('/submitEditUser', async (req, res) => {
  if (!res.locals.loggedIn) {
    return res.redirect('/login');
  }

  // Get data from the form (matching input name attributes in edit_profile.hbs)
  const { username, input_desc, input_profile_pic, input_password, confirm_password } = req.body;

  // 1. Password Validation Check
  if (input_password && input_password !== confirm_password) {
    const errorMsg = 'Error: New Password and Confirm New Password do not match.';
    // Redirect back to the form with an error message
    return res.redirect(`/edit_profile?error=${encodeURIComponent(errorMsg)}`);
  }

  // 2. Prepare Update Data for gRPC call
  const updateData = {
    username: username,
    // Use the ternary operator to ensure empty strings are sent if the user clears the field
    desc: input_desc !== undefined ? input_desc : '',
    profile_pic: input_profile_pic !== undefined ? input_profile_pic : '',
    password: input_password || '' // Only send password if provided
  };

  try {
    // 3. Call Core Service to Update Profile
    const updateRes = await grpcCall(coreClient, 'UpdateUserProfile', updateData);

    if (updateRes.status === 'error') {
      const errorMsg = `Update failed: ${updateRes.error}`;
      return res.redirect(`/edit_profile?error=${encodeURIComponent(errorMsg)}`);
    }

    // 4. Update was successful
    const successMsg = 'Profile updated successfully!';

    // Redirect back to the user's profile page to confirm changes
    return res.redirect(`/profile_user?username=${username}&success=${encodeURIComponent(successMsg)}`);

  } catch (error) {
    console.error(`Fatal error updating profile for ${username}:`, error.message);
    const errorMsg = 'An internal server error occurred during the profile update.';
    return res.redirect(`/edit_profile?error=${encodeURIComponent(errorMsg)}`);
  }
});

server.get('/edit_review', async (req, res) => {
  if (!res.locals.loggedIn) {
    return res.redirect('/login');
  }

  const review_id = req.query.id;
  if (!review_id) {
    const errorMsg = 'Review ID is missing.';
    return res.redirect(`/profile_user?username=${res.locals.user.username}&error=${encodeURIComponent(errorMsg)}`);
  }

  let review = {};
  let cafeName = 'Unknown Cafe';

  try {
    // A. Call Review Service to get the review details by ID
    // CRITICAL: We pass the review_id to get the single review, which should include the cafe_id.
    // NOTE: This assumes your ReviewService.GetReviews can handle being passed a review_id
    const reviewRes = await grpcCall(reviewClient, 'GetReviews', { review_id: review_id });
    review = reviewRes.reviews?.[0];

    if (!review) {
      const errorMsg = 'Review not found.';
      return res.redirect(`/profile_user?username=${res.locals.user.username}&error=${encodeURIComponent(errorMsg)}`);
    }

    // B. Call Core Service to get the Cafe Name using the cafe_id
    if (review.cafe_id) {
      // CRITICAL: Call the Core Service's GetCafeById method
      const cafeDetails = await grpcCall(coreClient, 'GetCafeById', { cafe_id: review.cafe_id });
      if (cafeDetails.cafe && cafeDetails.cafe.name) {
        cafeName = cafeDetails.cafe.name;
      } else {
        console.warn(`Cafe not found for ID: ${review.cafe_id}`);
      }
    }

    // C. Render the add_edit_review.hbs template
    res.render('add_edit_review', {
      layout: 'index',
      editing: true,
      review_id: review._id,
      cafe_name: cafeName, // <-- FIXED: This is now the fetched cafe name
      rating: review.rating,
      comment: review.comment,
      loggedIn: res.locals.loggedIn,
      errorMessage: req.query.error
    });

  } catch (error) {
    console.error(`Error loading edit review page for ID ${review_id}:`, error.message);
    const errorMsg = 'Failed to load review data for editing.';
    return res.redirect(`/profile_user?username=${res.locals.user.username}&error=${encodeURIComponent(errorMsg)}`);
  }
});

// 2. POST /submitEditedReview - HANDLE FORM SUBMISSION
server.post('/submitEditedReview', async (req, res) => {
  if (!res.locals.loggedIn) {
    return res.redirect('/login');
  }

  // FIX: Get the review_id from the URL query parameter
  const review_id = req.query.id;
  const username = res.locals.user.username; // For redirection
  const { input_rating, input_review_body } = req.body;

  const rating = parseInt(input_rating, 10);
  if (isNaN(rating) || rating < 1 || rating > 5) {
    const errorMsg = 'Rating must be a number between 1 and 5.';
    return res.redirect(`/edit_review?id=${review_id}&error=${encodeURIComponent(errorMsg)}`);
  }

  try {
    const updateRes = await grpcCall(reviewClient, 'EditReview', {
      review_id: review_id,
      rating: rating,
      comment: input_review_body
    });

    if (updateRes.status === 'error') {
      const errorMsg = `Edit failed: ${updateRes.error}`;
      return res.redirect(`/edit_review?id=${review_id}&error=${encodeURIComponent(errorMsg)}`);
    }

    const successMsg = 'Review updated successfully!';
    return res.redirect(`/profile_user?username=${username}&success=${encodeURIComponent(successMsg)}`);

  } catch (error) {
    console.error(`Fatal error updating review ID ${review_id}:`, error.message);
    const errorMsg = 'An internal server error occurred during the review update.';
    return res.redirect(`/edit_review?id=${review_id}&error=${encodeURIComponent(errorMsg)}`);
  }
});

// --- REVIEW DELETION ROUTE ---

// 3. POST /delete/:review_id - HANDLE DELETE SUBMISSION
server.post('/delete/:review_id', async (req, res) => {
  if (!res.locals.loggedIn) {
    return res.redirect('/login');
  }

  const review_id = req.params.review_id;
  const username = res.locals.user.username;

  try {
    // Call Review Service to Delete the Review
    const deleteRes = await grpcCall(reviewClient, 'DeleteReview', { review_id: review_id });

    if (deleteRes.status === 'error') {
      const errorMsg = `Deletion failed: ${deleteRes.error}`;
      return res.redirect(`/profile_user?username=${username}&error=${encodeURIComponent(errorMsg)}`);
    }

    // Success: Redirect back to the user's profile
    const successMsg = 'Review deleted successfully!';
    return res.redirect(`/profile_user?username=${username}&success=${encodeURIComponent(successMsg)}`);

  } catch (error) {
    console.error(`Fatal error deleting review ID ${review_id}:`, error.message);
    const errorMsg = 'An internal server error occurred during review deletion.';
    return res.redirect(`/profile_user?username=${username}&error=${encodeURIComponent(errorMsg)}`);
  }
});
// Start View Server
server.listen(PORT, () => {
  console.log(`VIEW SERVER running on http://localhost:${PORT}`);
});
