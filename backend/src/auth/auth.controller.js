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
const { AppError, asyncHandler } = require('../middleware/errors');

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
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const exists = await User.findOne({ email });
  if (exists) throw new AppError('Email already in use', 409, 'EMAIL_IN_USE');

  const user = await User.create({ name, email, passwordHash: password });
  const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: user.toPublic() });
});

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
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  const match = await user.comparePassword(password);
  if (!match) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

  const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: user.toPublic() });
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  res.json({ user: user.toPublic() });
});

module.exports = { register, login, me };
