const { socketAuthMiddleware } = require('../middleware/auth');
const { registerChatHandlers } = require('../chat/chat.handler');
const { registerCollabHandlers } = require('../collaboration/collab.handler');
const { registerPresenceHandlers, getOnlineUsers } = require('../presence/presence.service');
const { logger } = require('../logger');

let globalIo = null;

function getGlobalIo() {
  return globalIo;
}

function initSocketServer(io) {
  globalIo = io;
  io.use(socketAuthMiddleware);

  io.on('connection', async (socket) => {
    const { id, name } = socket.user;
    logger.info({ userId: id, name }, 'Socket connected');

    socket.join(`user:${id}`);

    registerPresenceHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerCollabHandlers(io, socket);

    const onlineUsers = await getOnlineUsers();
    socket.emit('presence:init', onlineUsers);

    socket.on('disconnect', () => {
      logger.info({ userId: id, name }, 'Socket disconnected');
    });
  });

  logger.info('Socket.IO server initialized');
}

module.exports = { initSocketServer, getGlobalIo };

