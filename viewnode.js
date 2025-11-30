//Install Commands:
//npm init
//npm i express express-handlebars body-parser mongoose express-validator bcrypt
require('dotenv').config();
const express = require('express');
const handlebars = require('express-handlebars');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const server = express();

// --- CONFIGURATION ---
const PORT = process.env.VIEW_PORT || 3000;
const API_URL = process.env.API_BASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

// --- UTILITY FUNCTION: API Fetch Wrapper ---
const fetchAPI = async (method, path, body = null, queryParams = {}) => {
    try {
        const url = new URL(`${API_URL}${path}`);
        Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));

        const config = {
            method: method.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            config.data = body;
        }

        const response = await axios(url.toString(), config);
        return response;
    } catch (error) {
        console.error(`API Error on ${method} ${path}:`, error.message, error.response?.data);
        return {
            status: error.response?.status || 500,
            data: { error: error.response?.data?.error || 'An API error occurred' }
        };
    }
};

// --- MIDDLEWARE ---
server.use(express.static('public'));
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(cookieParser());

// --- HANDLEBARS SETUP ---
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

// --- AUTH MIDDLEWARE (STATELESS) ---
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

// 1. Initial Routes
server.get('/', (req, res) => {
    if (res.locals.loggedIn) {
        res.redirect('/body_home_user');
    } else {
        res.redirect('/body_home_nouser');
    }
});

server.get('/body_home_user', async (req, res) => {
    const result = await fetchAPI('get', '/cafes');
    res.render('body_home_user', { layout: 'index', cafe: result.data });
});

server.get('/body_home_nouser', async (req, res) => {
    const result = await fetchAPI('get', '/cafes');
    res.render('body_home_nouser', { layout: 'index', cafe: result.data });
});

// 2. Auth Routes
server.get('/login', (req, res) => res.render('login', { layout: 'loginIndex' }));
server.get('/register', (req, res) => res.render('register', { layout: 'loginIndex' }));
// FIX: Changed from GET to POST to handle form submissions
server.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.redirect('/body_home_nouser');
});

server.post('/body_home_user', async (req, res) => {
    const result = await fetchAPI('post', '/login', { username: req.body.user, password: req.body.pass });

    if (result.data.token) {
        // Token expires in 1 hour
        res.cookie('auth_token', result.data.token, { httpOnly: true, maxAge: 3600000 });
        res.redirect('/body_home_user');
    } else {
        res.render('login', { layout: 'index', error: result.data.message || 'Login failed.' });
    }
});

server.post('/submitForm', async (req, res) => {
    if (req.body.inputPassword !== req.body.verify) {
        return res.render('register', { layout: 'index', error: 'Passwords do not match.' });
    }

    const payload = {
        username: req.body.inputUsername,
        password: req.body.inputPassword,
        email: req.body.inputEmail
    };

    const result = await fetchAPI('post', '/register', payload);

    if (result.status === 200 || result.status === 201) {
        res.redirect('/login');
    } else {
        res.render('register', { layout: 'index', error: result.data.error || 'Registration failed.' });
    }
});

// 3. Cafe Routes
server.post('/add-cafe', async (req, res) => {
    if (!res.locals.loggedIn) return res.redirect('/login');

    const payload = {
        name: req.body.name,
        bio: req.body.bio,
        dti: req.body.dti,
        image: req.body.image,
        price_range: req.body.price_range,
        address: req.body.address,
        items: req.body.items ? req.body.items.split(',').map(item => item.trim()) : [],
        owner: res.locals.user.username
    };

    const result = await fetchAPI('post', '/add-cafe', payload);

    if (result.status === 200 || result.status === 201) {
        res.redirect(`/cafe1_user?cafe_id=${result.data.cafe_id}`);
    } else {
        res.render('add_cafe', { layout: 'index', error: result.data.error || 'Failed to register cafe.' });
    }
});

server.get('/add_cafe', (req, res) => {
    if (!res.locals.loggedIn) return res.redirect('/login');
    res.render('add_cafe', { layout: 'index' });
});

server.get('/cafe1', async (req, res) => {
    if (res.locals.loggedIn) {
        return res.redirect(`/cafe1_user?cafe_id=${req.query.cafe_id}`);
    }
  const cafeId = req.query.cafe_id;
    const cafeRes = await fetchAPI('get', `/cafe/${cafeId}`);
    // const reviewsRes = await fetchAPI('get', `/reviews?cafe_id=${cafeId}`);
  const cafe = cafeRes.data || {};
const reviewsRes = await fetchAPI('get', '/reviews', null, { cafe: cafe.name });
    res.render('cafe1', {
        layout: 'index',
        cafe: cafeRes.data,
        review: reviewsRes.data,
        searchInputReview: ""
    });
});

server.get('/cafe1_user', async (req, res) => {
    if (!res.locals.loggedIn) return res.redirect('/login');

    const cafeId = req.query.cafe_id;
    const cafeRes = await fetchAPI('get', `/cafe/${cafeId}`);
    // const reviewsRes = await fetchAPI('get', `/reviews?cafe_id=${cafeId}`);
const cafe = cafeRes.data || {};
const reviewsRes = await fetchAPI('get', '/reviews', null, { cafe: cafe.name });

    const isOwner = res.locals.user.cafes && res.locals.user.cafes.includes(cafe.name);

    res.render('cafe1_user', {
        layout: 'index',
        cafe: cafe,
        review: reviewsRes.data,
        searchInputReview: "",
        isOwner: isOwner
    });
});

// 4. Review Routes
server.post('/submitReview', async (req, res) => {
    if (!res.locals.loggedIn) return res.redirect('/login');

    const payload = {
        username: res.locals.user.username,
        cafe_id: req.body.cafe_id,
        cafe: req.body.cafe_name,
        rating: req.body.input_rating,
        comment: req.body.input_review_body,
        date: new Date().toISOString().split('T')[0],
    };

    await fetchAPI('post', '/review', payload);
    // Redirect back to the specific cafe page
    res.redirect(`/cafe1_user?cafe_id=${req.body.cafe_id}`);
});

server.post('/submitEditedReview', async (req, res) => {
    if (!res.locals.loggedIn) return res.redirect('/login');

    const reviewId = req.query.id;
    const payload = {
        rating: req.body.input_rating,
        comment: req.body.input_review_body,
        isEdited: true
    };

    await fetchAPI('patch', `/review/${reviewId}`, payload);
    res.redirect('/profile_user');
});

server.post('/delete/:id', async (req, res) => {
    if (!res.locals.loggedIn) return res.redirect('/login');

    const reviewId = req.params.id;
    await fetchAPI('delete', `/review/${reviewId}`);
    res.redirect('/profile_user');
});

server.post('/helpful', async (req, res) => {
    if (!res.locals.loggedIn) return res.redirect('/login');
    // Helpful logic here
    res.redirect(req.headers.referer || '/body_home_user');
});

server.post('/respond-review', async (req, res) => {
    if (!res.locals.loggedIn) return res.redirect('/login');
    // Owner response logic here
    res.redirect(req.headers.referer || '/body_home_user');
});

// 5. Profile Routes
server.get('/profile_user', async (req, res) => {
    if (!res.locals.loggedIn) return res.redirect('/login');

    const username = req.query.username || res.locals.user.username;
    const userRes = await fetchAPI('get', `/user/${username}`);
    const reviewsRes = await fetchAPI('get', `/reviews?username=${username}`);

    res.render('profile_user', {
        layout: 'index',
        checkUser: userRes.data,
        review: reviewsRes.data,
        currentLoggedIn: res.locals.user.username === username
    });
});

server.get('/edit_profile', async (req, res) => {
    if (!res.locals.loggedIn) return res.redirect('/login');
    const username = req.query.username;

    if (username !== res.locals.user.username) return res.redirect('/profile_user');

    const userRes = await fetchAPI('get', `/user/${username}`);
    res.render('edit_profile', { layout: 'index', user: userRes.data });
});

// 6. SUBMIT EDIT USER
server.post('/submitEditUser', async (req, res) => {
    if (!res.locals.loggedIn) return res.redirect('/login');

    const {
        username,
        input_desc,
        input_profile_pic,
        input_password,
        confirm_password
    } = req.body;

    if (input_password && input_password !== confirm_password) {
        const userRes = await fetchAPI('get', `/user/${username}`);
        return res.render('edit_profile', {
            layout: 'index',
            user: userRes.data,
            error: 'New passwords do not match.'
        });
    }

    const payload = {
        desc: input_desc,
        profile_pic: input_profile_pic
    };

    if (input_password) {
        payload.password = input_password;
    }

    const result = await fetchAPI('put', `/user/${username}`, payload);

    if (result.status === 200) {
        res.redirect(`/profile_user?username=${username}`);
    } else {
        const userRes = await fetchAPI('get', `/user/${username}`);
        res.render('edit_profile', {
            layout: 'index',
            user: userRes.data,
            error: result.data.error || 'Profile update failed.'
        });
    }
});

// 7. Search & Reviews
server.post('/search_cafe', (req, res) => res.redirect(`/?search=${req.body.searchInput}`));
server.get('/search_cafe', async (req, res) => {
    const result = await fetchAPI('get', '/cafes', null, { search: req.query.searchInput });
    const targetView = res.locals.loggedIn ? 'body_home_user' : 'body_home_nouser';
    res.render(targetView, {
        layout: 'index',
        cafe: result.data,
        searchInput: req.query.searchInput
    });
});

server.post('/search_review', async (req, res) => {
    const cafeId = req.query.cafe_id;
    const searchInputReview = req.body.searchInputReview;
    res.redirect(`/cafe1?cafe_id=${cafeId}&search=${searchInputReview}`);
});

server.post('/search_review_user', async (req, res) => {
    const cafeId = req.query.cafe_id;
    const searchInputReview = req.body.searchInputReview;
    res.redirect(`/cafe1_user?cafe_id=${cafeId}&search=${searchInputReview}`);
});

// 9. Server Start
server.listen(PORT, () => {
    console.log(`View Server running on http://localhost:${PORT}`);
});
