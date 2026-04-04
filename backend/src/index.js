
/**
 * LiveSync Backend Server
 * 
 * This is the main entry point for the LiveSync real-time collaboration platform.
 * It sets up:
 *   - Express REST API for authentication, chat, notifications, and presence
 *   - Socket.IO for real-time bidirectional communication
 *   - MongoDB database connection via Mongoose
 *   - Redis for caching and rate limiting
 * 
 * The server enforces security best practices:
 *   - JWT-based authentication for both REST and WebSocket connections
 *   - Rate limiting to prevent brute-force and DoS attacks
 *   - Input validation and sanitization
 *   - Security headers to mitigate common web vulnerabilities
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const { initSocketServer } = require('./websocket/socketServer');

/**
 * Security: Validate critical environment variables on startup.
 * JWT_SECRET is required for token signing/verification - abort if missing.
 * A minimum length requirement prevents weak secret keys.
 */
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be at least 32 characters for secure token signing');
  process.exit(1);
}

/**
 * Route modules for different functional areas:
 *   - /auth: User registration, login, token management
 *   - /users: User profile and user search operations
 *   - /chat: Message history, conversation management
 *   - /docs: Real-time document collaboration
 *   - /notifications: Push notification delivery
 *   - /presence: Online/offline status tracking
 */
const authRoutes         = require('./auth/auth.routes');
const chatRoutes         = require('./chat/chat.routes');
const collabRoutes       = require('./collaboration/collab.routes');
const notificationRoutes = require('./notifications/notification.routes');
const presenceRoutes     = require('./presence/presence.routes');
const userRoutes         = require('./auth/user.routes');
const aiRoutes           = require('./ai/ai.routes');
const workspaceRoutes    = require('./workspace/workspace.routes');
const searchRoutes       = require('./search/search.routes');
const taskRoutes         = require('./tasks/task.routes');
const activityRoutes     = require('./activity/activity.routes');

/**
 * Express application setup
 * We use the native http module to create the server, then pass it to Socket.IO.
 * This allows WebSocket and HTTP traffic on the same port.
 */
const app = express();
const server = http.createServer(app);

/**
 * Middleware configuration
 * 
 * CORS: Restricts cross-origin requests to the configured CLIENT_URL.
 *       This prevents unauthorized domains from making API requests.
 * 
 * Security headers: Adds HTTP headers to protect against common attacks:
 *   - X-Content-Type-Options: Prevents MIME type sniffing
 *   - X-Frame-Options: Prevents clickjacking via iframe embedding
 *   - X-XSS-Protection: Enables browser's XSS filter
 *   - Referrer-Policy: Controls referrer information sent with requests
 * 
 * JSON body parser: Limited to 10kb to prevent large payload DoS attacks.
 */
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '10kb' }));

/**
 * REST API route registration
 * Each route module handles a specific functional domain
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
 * Health check endpoint
 * Used by load balancers and monitoring systems to verify server availability.
 * Returns basic status and current server timestamp.
 */
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * Socket.IO real-time communication setup
 * 
 * Socket.IO extends the HTTP server to support WebSocket connections.
 * The same CORS configuration as the REST API ensures consistent security.
 * The initSocketServer function registers all event handlers and middleware.
 */
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});
app.set('io', io);
initSocketServer(io);

/**
 * Server startup
 * 
 * The server only starts after successful database connection.
 * This ensures the API is not accepting requests before data layer is ready.
 */
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 LiveSync server running on port ${PORT}`);
  });
});
