/**
 * Socket.IO Server Initialization
 * 
 * Sets up real-time bidirectional communication using Socket.IO.
 * This module configures authentication and registers handlers for
 * chat, presence, and collaboration features.
 * 
 * Security:
 *   - All connections require JWT authentication via socketAuthMiddleware
 *   - Users can only interact through their authenticated socket
 *   - CORS is restricted to the configured CLIENT_URL
 * 
 * Architecture:
 *   - Each authenticated user joins a personal room (user:<id>)
 *   - This enables targeted notifications to specific users
 *   - Service handlers manage specific feature domains
 */

const { socketAuthMiddleware } = require('../middleware/auth');
const { registerChatHandlers } = require('../chat/chat.handler');
const { registerCollabHandlers } = require('../collaboration/collab.handler');
const { registerPresenceHandlers, getOnlineUsers } = require('../presence/presence.service');

// Store io instance globally for use by other modules (routes, services)
let globalIo = null;

/**
 * Get the global io instance for emitting events from non-socket modules
 */
function getGlobalIo() {
  return globalIo;
}

/**
 * Initialize Socket.IO server with authentication and handlers
 * 
 * This function is called during server startup (src/index.js).
 * It sets up:
 *   1. Authentication middleware for all connections
 *   2. Connection handlers for each service domain
 *   3. Initial presence data for newly connected users
 * 
 * @param {Object} io - Socket.IO server instance
 */
function initSocketServer(io) {
  globalIo = io;
  io.use(socketAuthMiddleware);

  io.on('connection', async (socket) => {
    const { id, name } = socket.user;
    console.log(`🔌 Socket connected: ${name} (${id})`);

    socket.join(`user:${id}`);

    registerPresenceHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerCollabHandlers(io, socket);

    const onlineUsers = await getOnlineUsers();
    socket.emit('presence:init', onlineUsers);

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${name} (${id})`);
    });
  });

  console.log('✅ Socket.IO server initialized');
}

module.exports = { initSocketServer, getGlobalIo };
