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
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // If connection dropped, reset and reconnect
  if (cached.conn && mongoose.connection.readyState !== 1) {
    cached.conn = null;
    cached.promise = null;
  }

  // If a connection is in progress, wait for it
  if (!cached.promise) {
    const opts = {
      maxPoolSize: 5,                  // Lower pool = faster cold start (was 10)
      minPoolSize: 1,                  // Keep at least 1 connection alive
      serverSelectionTimeoutMS: 3000,  // Fail faster (was 5000)
      socketTimeoutMS: 30000,          // Reduced from 45000
      connectTimeoutMS: 3000,          // Fast connect timeout
      heartbeatFrequencyMS: 15000,     // More frequent heartbeats to detect drops
      bufferCommands: false,           // Disable buffering — fail fast on disconnect
      autoIndex: false,                // Don't build indexes on every connect (production)
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

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️  MongoDB disconnected');
  // Reset cache so next request reconnects
  cached.conn = null;
  cached.promise = null;
});
mongoose.connection.on('reconnected',  () => logger.info('✅ MongoDB reconnected'));

module.exports = connectDB;