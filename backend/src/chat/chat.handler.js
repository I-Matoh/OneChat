const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { getPub } = require('../config/redis');
const { createNotification } = require('../notifications/notification.service');

function registerChatHandlers(io, socket) {
  // Join all conversations the user is part of
  socket.on('chat:join', async (conversationId) => {
    socket.join(`chat:${conversationId}`);
  });

  // Send a message
  socket.on('message:send', async (data) => {
    try {
      const { conversationId, content } = data;
      const msg = await Message.create({
        conversationId,
        senderId: socket.user.id,
        content,
      });

      // Update conversation's last message
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: content,
        updatedAt: Date.now(),
      });

      const populated = {
        _id: msg._id,
        conversationId,
        senderId: socket.user.id,
        senderName: socket.user.name,
        content,
        createdAt: msg.createdAt,
      };

      // Broadcast to room
      io.to(`chat:${conversationId}`).emit('message:new', populated);

      // Publish to Redis for horizontal scaling
      try {
        const pub = getPub();
        pub.publish('chat:messages', JSON.stringify(populated));
      } catch { /* Redis optional */ }

      // Create notifications for other participants
      const conv = await Conversation.findById(conversationId);
      if (conv) {
        const others = conv.participants.filter((p) => p.toString() !== socket.user.id);
        for (const userId of others) {
          createNotification(io, userId.toString(), 'message', `${socket.user.name}: ${content.substring(0, 80)}`);
        }
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // Typing indicator
  socket.on('message:typing', (data) => {
    socket.to(`chat:${data.conversationId}`).emit('message:typing', {
      userId: socket.user.id,
      userName: socket.user.name,
      conversationId: data.conversationId,
    });
  });
}

module.exports = { registerChatHandlers };
