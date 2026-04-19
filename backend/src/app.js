/**
 * Core Express Application Factory
 * 
 * Architecture Note:
 * We use a factory function (`createApp`) rather than a singleton to allow deterministic,
 * isolated instances of the Express app during test execution. 
 * This file registers all middleware chains (CORS, Security Headers, Logging) and maps
 * the domain-driven route controllers to their respective base paths.
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoose = require('mongoose');
const { getRedis } = require('./config/redis');
const { errorHandler, notFoundHandler, AppError } = require('./middleware/errors');
const { httpLogger, requestIdMiddleware } = require('./logger');
const { rateLimiter } = require('./middleware/rateLimiter');

function createApp() {
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

  app.use(httpLogger);
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(compression());
  app.use(rateLimiter(60000, 100));
  app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '10kb' }));

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

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
