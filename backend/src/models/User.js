/**
 * User Model
 * 
 * Mongoose schema for user documents in the MongoDB database.
 * This model handles user data persistence and password hashing.
 * 
 * Security features:
 *   - Email is stored lowercase for consistent lookups
 *   - Password hashing uses bcrypt with cost factor 12 (strong)
 *   - The toPublic() method prevents sensitive data leakage in API responses
 * 
 * Schema fields:
 *   - name: Display name (required, trimmed)
 *   - email: Unique identifier (required, lowercase, indexed)
 *   - passwordHash: Bcrypt-hashed password (never exposed to clients)
 *   - status: Online presence state (online/away/offline)
 *   - timestamps: Created and updated at timestamps
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  status:       { type: String, enum: ['online', 'away', 'offline'], default: 'offline' },
}, { timestamps: true });

/**
 * Pre-save middleware: Hash password before saving
 * 
 * Automatically hashes the password using bcrypt with cost factor 12
 * whenever the passwordHash field is modified. This ensures passwords
 * are never stored in plain text.
 * 
 * Security note: Cost factor 12 provides strong protection while keeping
 * hash computation time reasonable (~250ms on modern hardware).
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

/**
 * Compare a plain text password against the stored hash
 * 
 * Used during login to verify user credentials. Returns a promise
 * that resolves to true if passwords match, false otherwise.
 * 
 * @param {string} plain - Plain text password to compare
 * @returns {Promise<boolean>} True if password matches
 */
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/**
 * Convert user to public JSON representation
 * 
 * Returns a sanitized user object for API responses. This method
 * explicitly excludes the passwordHash field to prevent accidental
 * exposure of sensitive data.
 * 
 * @returns {Object} Public user data { id, name, email, status }
 */
userSchema.methods.toPublic = function () {
  return { id: this._id, name: this.name, email: this.email, status: this.status };
};

module.exports = mongoose.model('User', userSchema);
