/**
 * Presence Routes
 * 
 * REST API for user online/offline status.
 * Provides endpoint to fetch currently online users.
 */

const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getOnlineUsers } = require('./presence.service');
const { asyncHandler } = require('../middleware/errors');

const router = Router();

/**
 * GET /presence
 * Get list of all currently online users.
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const users = await getOnlineUsers();
  res.json(users);
}));

module.exports = router;
