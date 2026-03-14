const { Router } = require('express');
const { register, login } = require('./auth.controller');
const { rateLimiter } = require('../middleware/rateLimiter');

const router = Router();

router.post('/register', rateLimiter(60000, 10), register);
router.post('/login',    rateLimiter(60000, 20), login);

module.exports = router;
