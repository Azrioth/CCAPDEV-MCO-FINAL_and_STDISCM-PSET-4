//Install Commands:
//npm init
//npm i express express-handlebars body-parser mongoose express-validator bcrypt
require('dotenv').config();
const express = require('express');
const handlebars = require('express-handlebars');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const server = express();

// --- CONFIGURATION ---
const PORT = process.env.VIEW_PORT || 3000;
const API_URL = process.env.API_BASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

// --- MIDDLEWARE ---
server.use(express.static('public'));
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(cookieParser());

// --- HANDLEBARS SETUP ---
server.set('view engine', 'hbs');
server.engine('hbs', handlebars.engine({
    extname: 'hbs',
    helpers: {
        ifEquals: (arg1, arg2, options) => (arg1 == arg2) ? options.fn(this) : options.inverse(this),
        ifIncludes: (arg1, arg2, options) => {
            if (!Array.isArray(arg2)) return options.inverse(this);
            return arg2.includes(arg1) ? options.fn(this) : options.inverse(this);
        }
    }
}));

// --- AUTH MIDDLEWARE (STATELESS) ---
server.use((req, res, next) => {
    const token = req.cookies.auth_token;
    res.locals.loggedIn = false;
    res.locals.user = null;

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            res.locals.user = decoded;
            res.locals.loggedIn = true;
            global.loggedUser = decoded;
        } catch (err) {
            res.clearCookie('auth_token');
        }
    }
    next();
});

// --- API HELPER (FAULT TOLERANCE) ---
async function fetchAPI(method, endpoint, data = null, params = null) {
    try {
        const config = { method, url: `${API_URL}${endpoint}`, data, params, timeout: 3000 };
        const response = await axios(config);
        return { success: true, data: response.data };
    } catch (err) {
        console.error(`API Error on ${endpoint}:`, err.message);
        return { success: false, error: "System unavailable" };
    }
}

// --- ROUTES ---

// 1. Home
server.get('/', async (req, res) => {
    const result = await fetchAPI('get', '/cafes');
    if (!result.success) return res.render('body_home_nouser', { layout: 'index', title: 'Maintenance', error: true });

    const viewName = res.locals.loggedIn ? 'body_home_user' : 'body_home_nouser';
    res.render(viewName, {
        layout: 'index',
        title: 'Home - Espresso Self!',
        cafe: result.data,
        user: res.locals.user
    });
});

// 2. Login
server.get('/login', (req, res) => res.render('login', { layout: 'loginIndex', title: 'Login' }));

server.post('/body_home_user', async (req, res) => {
    const result = await fetchAPI('post', '/login', {
        username: req.body.user,
        password: req.body.pass
    });

    if (result.success && result.data.status === 'success') {
        res.cookie('auth_token', result.data.token, { httpOnly: true, maxAge: 3600000 });
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});

// 3. Logout
server.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.redirect('/');
});

// 4. Register
server.get('/register', (req, res) => res.render('register', { layout: 'loginIndex', title: 'Register' }));

server.post('/submitForm', async (req, res) => {
    if (req.body.inputPassword !== req.body.verify) return res.send("Passwords do not match");

    const result = await fetchAPI('post', '/register', {
        username: req.body.inputUsername,
        password: req.body.inputPassword,
        email: req.body.inputEmail
    });

    if (result.success && result.data.status === 'success') {
        res.redirect('/login');
    } else {
        res.status(500).send("Registration Failed");
    }
});

// 5. Cafe Details
server.get('/cafe1', async (req, res) => {
    const [cafeRes, reviewRes] = await Promise.all([
        fetchAPI('get', `/cafe/${req.query.cafe_id}`),
        fetchAPI('get', '/reviews', null, { cafe: req.query.cafe_name, search: req.query.searchInputReview })
    ]);

    if (!cafeRes.success) return res.redirect('/');

    const viewName = res.locals.loggedIn ? 'cafe1_user' : 'cafe1';
    const isOwner = res.locals.loggedIn && res.locals.user.cafes.includes(cafeRes.data.name);

    res.render(viewName, {
        layout: 'index',
        title: `${cafeRes.data.name} - Espresso Self!`,
        cafe: cafeRes.data,
        review: reviewRes.data || [],
        user: res.locals.user,
        isOwner: isOwner,
        searchInputReview: req.query.searchInputReview
    });
});

// 6. User Profile
server.get('/profile_user', async (req, res) => {
    const targetUser = req.query.username;
    const [userRes, reviewRes] = await Promise.all([
        fetchAPI('get', `/user/${targetUser}`),
        fetchAPI('get', '/reviews', null, { username: targetUser })
    ]);

    if (!userRes.success || !userRes.data) return res.redirect('/');

    const isCurrentUser = res.locals.loggedIn && (res.locals.user.username === targetUser);

    res.render('profile_user', {
        layout: 'index',
        title: `${targetUser} - Profile`,
        checkUser: userRes.data,
        user: res.locals.user,
        review: reviewRes.data || [],
        loggedIn: res.locals.loggedIn,
        currentLoggedIn: isCurrentUser
    });
});

// 7. Edit Profile
server.get('/edit_profile', async (req, res) => {
    if (!res.locals.loggedIn) return res.redirect('/login');
    const userRes = await fetchAPI('get', `/user/${req.query.username}`);
    res.render('edit_profile', { layout: 'index', user: userRes.data });
});

server.post('/submitEditUser', async (req, res) => {
    // FIX 1: Add input_profile_pic to the payload
    const payload = {
        desc: req.body.input_desc,
        profile_pic: req.body.input_profile_pic // Added profile picture update
    };
    if(req.body.input_password && req.body.input_password === req.body.confirm_password) {
        payload.password = req.body.input_password;
    }
    await fetchAPI('put', `/user/${req.body.username}`, payload);
    res.redirect(`/profile_user?username=${req.body.username}`);
});

// 8. Search & Reviews
server.post('/search_cafe', (req, res) => res.redirect(`/?search=${req.body.searchInput}`));
server.get('/search_cafe', async (req, res) => {
    const result = await fetchAPI('get', '/cafes', null, { search: req.query.searchInput });
    res.render('body_home_nouser', { layout: 'index', cafe: result.data, searchInput: req.query.searchInput });
});

server.post('/submitReview', async (req, res) => {
    const payload = {
        username: res.locals.user.username,
        cafe: req.body.cafe_name,
        rating: req.body.input_rating,
        comment: req.body.input_review_body,
        date: new Date().toLocaleDateString(),
        isHelpful: 0, isUnhelpful: 0, isEdited: false
    };
    await fetchAPI('post', '/review', payload);
    res.redirect('/');
});

server.listen(PORT, () => console.log(`View Node running on port ${PORT}`));
