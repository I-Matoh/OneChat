const { Router } = require('express');
const { register, login, me } = require('./auth.controller');
const { rateLimiter } = require('../middleware/rateLimiter');
const { authMiddleware } = require('../middleware/auth');

const router = Router();

router.post('/register', rateLimiter(60000, 10), register);
router.post('/login',    rateLimiter(60000, 20), login);
router.get('/me', authMiddleware, me);

module.exports = router;
