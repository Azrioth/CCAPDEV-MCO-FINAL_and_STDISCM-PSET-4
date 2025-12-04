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
  if (!res.locals.loggedIn) return res.redirect('/login');
  const cafeId = req.query.cafe_id;

  const cafeRes = await grpcCall(coreClient, 'GetCafeById', { cafe_id: cafeId });
  // Note: Protocol buffers default to default values, so check if name exists to confirm found
  const cafe = cafeRes.name ? cafeRes : {};

  const reviewRes = await grpcCall(reviewClient, 'GetReviews', { cafe_name: cafe.name });

  const isOwner = res.locals.user.cafes && res.locals.user.cafes.includes(cafe.name);

  res.render('cafe1_user', {
    layout: 'index',
    cafe: cafe,
    review: reviewRes.reviews || [],
    isOwner: isOwner
  });
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
  if (!res.locals.loggedIn) return res.redirect('/login');
  const username = req.query.username || res.locals.user.username;

  // Get User Data
  const userRes = await grpcCall(coreClient, 'GetUserProfile', { username: username });

  // Get Reviews made by User
  const reviewsRes = await grpcCall(reviewClient, 'GetReviews', { username: username });
  let reviews = reviewsRes.reviews || []; // Start with raw reviews

  // --- CRITICAL FIX: AUGMENT REVIEWS WITH CAFE DETAILS (ID and IMAGE) ---
  if (reviews.length > 0) {
    // 1. Get ALL cafes from Core API for lookup (assuming 'GetCafes' returns all)
    const allCafesRes = await grpcCall(coreClient, 'GetCafes', { search: "" });
    const allCafes = allCafesRes.cafes || [];

    // 2. Create a map for quick lookup: { cafeName: { _id, image } }
    const cafeDataMap = {};
    allCafes.forEach(cafe => {
      // Store the ID and Image using the Name as the key
      cafeDataMap[cafe.name] = {
        _id: cafe._id,
        image: cafe.image
      };
    });

    // 3. Update each review object with the necessary cafe details
    reviews = reviews.map(review => {
      const cafeName = review.cafe;
      const cafeDetails = cafeDataMap[cafeName] || { _id: null, image: 'https://via.placeholder.com/50' };

      // Replace the simple 'review.cafe' string with a new object
      review.cafe = {
        name: cafeName,
        _id: cafeDetails._id, // Add the Cafe ID for the link
        image: cafeDetails.image // Add the image URL
      };
      return review;
    });
  }
  // ------------------------------------------------------------------------

  // Get Reservations made by User
  const userReservations = await grpcCall(reservationClient, 'GetUserReservations', { username: username });

  let ownerRequests = [];
  // If viewing own profile and is an owner
  if (res.locals.user.username === username && userRes.cafes && userRes.cafes.length > 0) {
    const ownerRes = await grpcCall(reservationClient, 'GetOwnerReservations', { cafes: userRes.cafes });
    ownerRequests = ownerRes.reservations || [];
  }

  res.render('profile_user', {
    layout: 'index',
    checkUser: userRes,
    review: reviews, // Use the augmented reviews array
    reservations: userReservations.reservations || [],
    ownerRequests: ownerRequests,
    currentLoggedIn: res.locals.user.username === username
  });
});
server.get('/cafe/:cafe_id', (req, res) => {

  const cafeId = req.params.cafe_id;

  const targetUrl = res.locals.loggedIn ?
    `/cafe1_user?cafe_id=${cafeId}` :
    `/cafe1?cafe_id=${cafeId}`;

  res.redirect(targetUrl);


});
// Start View Server
server.listen(PORT, () => {
  console.log(`VIEW SERVER running on http://localhost:${PORT}`);
});
