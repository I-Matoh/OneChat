const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { getGlobalIo } = require('../websocket/socketServer');

const router = Router();

// Get all conversations for current user
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const convs = await Conversation.find({ participants: req.user.id })
      .populate('participants', 'name email status')
      .sort({ updatedAt: -1 });
    res.json(convs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a conversation
router.post('/conversations', authMiddleware, async (req, res) => {
  try {
    const { participantIds, name } = req.body;
    const participants = [req.user.id, ...(participantIds || [])];
    const conv = await Conversation.create({ participants, name: name || '' });
    const populated = await conv.populate('participants', 'name email status');
    
    // Emit conversation:new to all participants for real-time updates
    const io = getGlobalIo();
    if (io) {
      for (const participantId of participants) {
        io.to(`user:${participantId}`).emit('conversation:new', {
          ...populated.toObject(),
          createdBy: { _id: req.user.id, name: req.user.name }
        });
      }
    }
    
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages for a conversation (paginated)
router.get('/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ conversationId: id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'name email');

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
