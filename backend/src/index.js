/**
 * OneChat Backend - Main Entry Point
 * 
 * Express server with Socket.IO for real-time collaboration.
 * Sets up middleware, routes, and WebSocket handlers.
 * 
 * Security features:
 *   - JWT_SECRET validation on startup
 *   - CORS configuration from CLIENT_URL
 *   - Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
 *   - Request body size limit (10kb)
 *   - Rate limiting on auth endpoints
 */

const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { createApp } = require('./app');
const { initSocketServer } = require('./websocket/socketServer');
const { logger } = require('./logger');

/**
 * Validate required environment variables on startup.
 * JWT_SECRET must be at least 32 characters for adequate security.
 */
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is required');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  logger.error('JWT_SECRET must be at least 32 characters');
  process.exit(1);
}

const app = createApp();
const server = http.createServer(app);

/**
 * Initialize Socket.IO with CORS and attach to app for route access.
 */
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});
app.set('io', io);
initSocketServer(io);

const PORT = process.env.PORT || 5000;

/**
 * Connect to MongoDB and start the HTTP server.
 */
connectDB().then(() => {
  server.listen(PORT, () => {
    logger.info({ port: PORT }, 'OneChat server running');
  });
});
