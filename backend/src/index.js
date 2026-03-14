require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const { initSocketServer } = require('./websocket/socketServer');

// Routes
const authRoutes         = require('./auth/auth.routes');
const chatRoutes         = require('./chat/chat.routes');
const collabRoutes       = require('./collaboration/collab.routes');
const notificationRoutes = require('./notifications/notification.routes');
const presenceRoutes     = require('./presence/presence.routes');
const userRoutes         = require('./auth/user.routes');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

// REST API routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/chat', chatRoutes);
app.use('/docs', collabRoutes);
app.use('/notifications', notificationRoutes);
app.use('/presence', presenceRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// Socket.IO
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, credentials: true },
});
initSocketServer(io);

// Start
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 LiveSync server running on port ${PORT}`);
  });
});
