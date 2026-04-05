/**
 * Authentication Routes
 * 
 * Public endpoints for user registration, login, and session retrieval.
 * All endpoints use rate limiting to prevent abuse.
 */

const { Router } = require('express');
const { register, login, me } = require('./auth.controller');
const { rateLimiter } = require('../middleware/rateLimiter');
const { authMiddleware } = require('../middleware/auth');
const { validateAuthRegister, validateAuthLogin } = require('../middleware/validate');

const router = Router();

/**
 * POST /auth/register
 * Create new user account. Rate limited to 10/min to prevent spam.
 */
router.post('/register', rateLimiter(60000, 10), validateAuthRegister, register);

/**
 * POST /auth/login
 * Authenticate user and return JWT token. Rate limited to 20/min.
 */
router.post('/login',    rateLimiter(60000, 20), validateAuthLogin, login);

/**
 * GET /auth/me
 * Get current authenticated user profile.
 */
router.get('/me', authMiddleware, me);

module.exports = router;
