const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getOnlineUsers } = require('./presence.service');

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await getOnlineUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
