const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');

const router = Router();

// Get all users (for starting conversations)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } }).select('name email status');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
