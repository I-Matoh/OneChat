/**
 * Authentication Controller
 * 
 * Handles user registration and login operations. This controller is
 * responsible for:
 *   - Validating user input (name, email, password)
 *   - Checking for existing users to prevent duplicates
 *   - Creating new users with securely hashed passwords
 *   - Generating JWT tokens for authenticated sessions
 * 
 * Security practices:
 *   - Passwords are never stored in plain text - bcrypt hashing is applied
 *     via the User model's pre-save middleware
 *   - Generic error messages prevent user enumeration attacks
 *   - JWT tokens expire after 7 days to limit exposure window
 *   - Required field validation prevents incomplete registrations
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Register a new user
 * 
 * Creates a new user account with the provided credentials.
 * The password is hashed by the User model's pre-save middleware
 * before being stored in the database.
 * 
 * @param {Object} req  - Express request with { name, email, password } in body
 * @param {Object} res  - Express response
 */
async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Email already in use' });

    const user = await User.create({ name, email, passwordHash: password });
    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Authenticate an existing user
 * 
 * Validates user credentials and returns a JWT token if successful.
 * Uses bcrypt comparison to safely verify passwords without
 * revealing whether the email or password was incorrect.
 * 
 * @param {Object} req  - Express request with { email, password } in body
 * @param {Object} res  - Express response
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function me(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { register, login, me };
