/**
 * Authentication Middleware
 * 
 * This module provides authentication middleware for both REST API routes
 * and WebSocket (Socket.IO) connections. Both use JWT (JSON Web Tokens)
 * for stateless authentication.
 * 
 * Security considerations:
 *   - Tokens are verified against the JWT_SECRET environment variable
 *   - Bearer token scheme is required (Authorization: Bearer <token>)
 *   - Invalid or missing tokens result in 401 Unauthorized responses
 *   - Socket connections are rejected if authentication fails
 */

const jwt = require('jsonwebtoken');

/**
 * Express middleware — verify JWT in Authorization header
 * 
 * This middleware protects REST API routes by validating the JWT token
 * sent in the Authorization header. It extracts the user payload and
 * attaches it to req.user for downstream handlers to use.
 * 
 * Expected header format: Authorization: Bearer <jwt_token>
 * 
 * @param {Object} req  - Express request object
 * @param {Object} res  - Express response object
 * @param {Function} next - Express next middleware function
 */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Socket.IO middleware — verify JWT on WebSocket handshake
 * 
 * Socket.IO connections start with an HTTP handshake. This middleware
 * runs during that handshake to authenticate the connection before
 * any WebSocket events can be exchanged. The token is passed in the
 * socket handshake auth object.
 * 
 * Expected handshake: { auth: { token: "<jwt_token>" } }
 * 
 * @param {Object} socket - Socket.IO socket object
 * @param {Function} next - Callback to proceed to connection handler
 */
function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
}

module.exports = { authMiddleware, socketAuthMiddleware };
