const mongoose = require('mongoose');
const logger   = require('./logger');

// Cache the connection across serverless function invocations
// This is the official Vercel + MongoDB pattern
let cached = global._mongooseConnection;

if (!cached) {
  cached = global._mongooseConnection = { conn: null, promise: null };
}

const connectDB = async () => {
  // If already connected, reuse existing connection
  if (cached.conn) {
    return cached.conn;
  }

  // If a connection is in progress, wait for it
  if (!cached.promise) {
    const opts = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false, // Disable buffering — fail fast on disconnect
    };

    cached.promise = mongoose
      .connect(process.env.MONGO_URI, opts)
      .then((mongooseInstance) => {
        logger.info(`✅ MongoDB connected: ${mongooseInstance.connection.host}`);
        return mongooseInstance;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // Reset so next request retries
    logger.error('❌ MongoDB connection error:', err.message);
    throw err; // Let the request fail cleanly, not crash the process
  }

  return cached.conn;
};

mongoose.connection.on('disconnected', () => logger.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => logger.info('✅ MongoDB reconnected'));

module.exports = connectDB;