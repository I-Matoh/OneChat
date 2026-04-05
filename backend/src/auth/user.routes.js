/**
 * User Routes
 * 
 * User management endpoints. Currently provides user listing for
 * starting conversations. Protected by authentication.
 */

const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errors');

const router = Router();

/**
 * GET /users
 * List all users except current user. Used for starting new conversations.
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user.id } }).select('name email status');
  res.json(users);
}));

module.exports = router;
