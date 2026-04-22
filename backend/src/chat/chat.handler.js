const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { getPub } = require('../config/redis');
const { createNotification } = require('../notifications/notification.service');
const { logActivity } = require('../activity/activity.service');

function normalizeId(value) {
  return value?.toString?.() || String(value);
}

async function getConversationForUser(conversationId, userId) {
  return Conversation.findOne({ _id: conversationId, participants: userId })
    .populate('participants', 'name email status');
}

async function emitStatus(io, conversationId, messageIds, status) {
  if (!messageIds.length) return;
  await Message.updateMany(
    { _id: { $in: messageIds }, conversationId, status: { $ne: status } },
    { status }
  );
  for (const messageId of messageIds) {
    io.to(`chat:${conversationId}`).emit('message:status', { messageId, status });
  }
}

function registerChatHandlers(io, socket) {
  // Join a conversation room to receive messages
  socket.on('chat:join', async (conversationId) => {
    const conversation = await getConversationForUser(conversationId, socket.user.id);
    if (!conversation) {
      socket.emit('error', { message: 'Conversation not found' });
      return;
    }

    socket.join(`chat:${conversationId}`);

    // Clear unread count for this user on this conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      [`unreadCounts.${socket.user.id}`]: 0,
    });
    socket.emit('unread:cleared', { conversationId });

    const unseenMessages = await Message.find({
      conversationId,
      senderId: { $ne: socket.user.id },
      status: { $ne: 'seen' },
    }).select('_id');

    await emitStatus(
      io,
      conversationId,
      unseenMessages.map((message) => message._id.toString()),
      'seen'
    );
  });

  // Leave a conversation room
  socket.on('chat:leave', async (conversationId) => {
    socket.leave(`chat:${conversationId}`);
  });

  // Send a message
  socket.on('message:send', async (data) => {
    try {
      const conversationId = data?.conversationId;
      const content = data?.content?.trim();
      if (!conversationId || !content) {
        socket.emit('error', { message: 'conversationId and content are required' });
        return;
      }

      const conv = await getConversationForUser(conversationId, socket.user.id);
      if (!conv) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const msg = await Message.create({
        conversationId,
        senderId: socket.user.id,
        content,
      });

      // Increment unread counts for all participants except the sender
      const unreadInc = {};
      for (const pid of conv.participants) {
        const pidStr = normalizeId(pid._id || pid);
        if (pidStr !== socket.user.id) {
          unreadInc[`unreadCounts.${pidStr}`] = 1;
        }
      }

      // Update conversation's last message, sort order, and unread counts
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: content,
        updatedAt: Date.now(),
        $inc: unreadInc,
      });

      const populated = {
        _id: msg._id,
        conversationId,
        senderId: socket.user.id,
        senderName: socket.user.name,
        content,
        createdAt: msg.createdAt,
        status: 'sent',
      };

      // Broadcast to room (all participants in the conversation)
      io.to(`chat:${conversationId}`).emit('message:new', populated);
      await logActivity(io, {
        actorId: socket.user.id,
        type: 'message_sent',
        message: `Sent message in ${conv.name || 'conversation'}`,
        meta: { conversationId, messageId: msg._id.toString() },
      });

      // Publish to Redis for horizontal scaling
      try {
        const pub = getPub();
        pub.publish('chat:messages', JSON.stringify(populated));
      } catch { /* Redis optional */ }

      // Create notifications for other participants
      const otherParticipants = conv.participants.filter((p) => normalizeId(p._id || p) !== socket.user.id);
      const activeChatSockets = await io.in(`chat:${conversationId}`).fetchSockets();
      const activeChatUserIds = new Set(
        activeChatSockets
          .map((client) => client.user?.id)
          .filter(Boolean)
          .map(normalizeId)
      );

      let nextStatus = 'sent';

      for (const participantId of otherParticipants) {
        const userId = normalizeId(participantId);
        const userSockets = await io.in(`user:${userId}`).fetchSockets();
        const isConnected = userSockets.length > 0;
        const isViewingConversation = activeChatUserIds.has(userId);

        if (isViewingConversation) {
          nextStatus = 'seen';
        } else if (isConnected && nextStatus !== 'seen') {
          nextStatus = 'delivered';
        }

        await createNotification(
          io,
          userId,
          'message',
          `${socket.user.name}: ${content.substring(0, 80)}`,
          { conversationId }
        );

        const participant = conv.participants.find((user) => normalizeId(user._id || user) === userId);
        const hasMention = participant?.name && content.toLowerCase().includes(`@${participant.name.toLowerCase()}`);
        if (hasMention) {
          await createNotification(
            io,
            userId,
            'mention',
            `${socket.user.name} mentioned you in ${conv.name || 'a conversation'}`,
            { conversationId }
          );
        }

        io.to(`user:${userId}`).emit('conversation:updated', {
          conversationId,
          lastMessage: content,
          updatedAt: msg.createdAt,
        });
      }

      if (nextStatus !== 'sent') {
        await Message.findByIdAndUpdate(msg._id, { status: nextStatus });
        io.to(`chat:${conversationId}`).emit('message:status', {
          messageId: msg._id.toString(),
          status: nextStatus,
        });
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
