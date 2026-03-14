const { socketAuthMiddleware } = require('../middleware/auth');
const { registerChatHandlers } = require('../chat/chat.handler');
const { registerCollabHandlers } = require('../collaboration/collab.handler');
const { registerPresenceHandlers, getOnlineUsers } = require('../presence/presence.service');

function initSocketServer(io) {
  // Auth middleware
  io.use(socketAuthMiddleware);

  io.on('connection', async (socket) => {
    const { id, name } = socket.user;
    console.log(`🔌 Socket connected: ${name} (${id})`);

    // Join a personal room for notifications
    socket.join(`user:${id}`);

    // Register service handlers
    registerPresenceHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerCollabHandlers(io, socket);

    // Send initial online users
    const onlineUsers = await getOnlineUsers();
    socket.emit('presence:init', onlineUsers);

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${name} (${id})`);
    });
  });

  console.log('✅ Socket.IO server initialized');
}

module.exports = { initSocketServer };
