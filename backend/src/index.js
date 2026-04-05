/**
 * LiveSync Backend - Main Entry Point
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

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { getRedis } = require('./config/redis');
const { initSocketServer } = require('./websocket/socketServer');
const { errorHandler, notFoundHandler, AppError } = require('./middleware/errors');
const { logger, httpLogger, requestIdMiddleware } = require('./logger');

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

/**
 * Import all route modules.
 */
const authRoutes = require('./auth/auth.routes');
const chatRoutes = require('./chat/chat.routes');
const collabRoutes = require('./collaboration/collab.routes');
const notificationRoutes = require('./notifications/notification.routes');
const presenceRoutes = require('./presence/presence.routes');
const userRoutes = require('./auth/user.routes');
const aiRoutes = require('./ai/ai.routes');
const workspaceRoutes = require('./workspace/workspace.routes');
const searchRoutes = require('./search/search.routes');
const taskRoutes = require('./tasks/task.routes');
const activityRoutes = require('./activity/activity.routes');

const app = express();
const server = http.createServer(app);

/**
 * HTTP request logging with pino-http.
 */
app.use(httpLogger);

/**
 * Request ID middleware for tracing.
 */
app.use(requestIdMiddleware);

/**
 * CORS configuration - only allow requests from the configured client URL.
 */
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

/**
 * Security headers to prevent common browser-based attacks.
 */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

/**
 * JSON body parser with size limit to prevent large payload attacks.
 */
app.use(express.json({ limit: '10kb' }));

/**
 * Register all API routes under their base paths.
 */
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/chat', chatRoutes);
app.use('/docs', collabRoutes);
app.use('/notifications', notificationRoutes);
app.use('/presence', presenceRoutes);
app.use('/ai', aiRoutes);
app.use('/workspaces', workspaceRoutes);
app.use('/search', searchRoutes);
app.use('/tasks', taskRoutes);
app.use('/activity', activityRoutes);

/**
 * Health check endpoint - basic server status.
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

/**
 * Readiness check endpoint - verifies MongoDB and Redis connectivity.
 */
app.get('/ready', async (req, res, next) => {
  try {
    const mongoReady = mongoose.connection.readyState === 1;
    let redisReady = false;
    try {
      const pong = await getRedis().ping();
      redisReady = pong === 'PONG';
    } catch {
      redisReady = false;
    }

    if (!mongoReady || !redisReady) {
      throw new AppError('Service not ready', 503, 'SERVICE_NOT_READY', {
        mongoReady,
        redisReady,
      });
    }
    res.json({ status: 'ready', timestamp: Date.now(), mongoReady, redisReady });
  } catch (err) {
    next(err);
  }
});

/**
 * Error handling middleware (must be registered after all routes).
 */
app.use(notFoundHandler);
app.use(errorHandler);

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
    logger.info({ port: PORT }, 'LiveSync server running');
  });
});

