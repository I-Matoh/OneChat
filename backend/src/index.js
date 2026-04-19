/**
 * Application Entry / Server Initialization
 * 
 * Architecture Note:
 * The index.js acts as the definitive start script. It bootstraps the environment,
 * strictly enforces essential environment variables (JWT_SECRET entropy), provisions 
 * the MongoDB connection, and attaches the Socket.IO overlay to the Express HTTP Server.
 * 
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
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { getRedis } = require('./config/redis');
const { createApp } = require('./app');
const { initSocketServer } = require('./websocket/socketServer');
const { logger } = require('./logger');

process.on('uncaughtException', (err) => {
  logger.error({ err, message: 'Uncaught Exception' });
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error({ err, message: 'Unhandled Rejection' });
  process.exit(1);
});

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

  const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    
    server.close(() => {
      logger.info('HTTP server closed');
    });

    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
      }
      
      const redis = getRedis();
      if (redis) {
        await redis.quit();
        logger.info('Redis connection closed');
      }
      
      process.exit(0);
    } catch (err) {
      logger.error({ err, message: 'Error during graceful shutdown' });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
});
