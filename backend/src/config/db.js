/**
 * MongoDB Database Connection
 * 
 * Establishes connection to MongoDB using Mongoose ODM.
 * Uses connection string from MONGO_URI environment variable.
 * Exits process on connection failure to prevent starting in degraded state.
 */

const mongoose = require('mongoose');
const { logger } = require('../logger');

/**
 * Connect to MongoDB and log connection status.
 * Terminates process on failure since app cannot function without DB.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    logger.info({ host: conn.connection.host }, 'MongoDB connected');
  } catch (err) {
    logger.error({ err: err.message }, 'MongoDB connection error');
    process.exit(1);
  }
};

module.exports = connectDB;

