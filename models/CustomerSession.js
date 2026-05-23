const mongoose = require('mongoose');

// ── Customer Session ──────────────────────────────────────────────
// Tracks active JWT sessions per customer. The tokenHash stores a
// SHA-256 hash of the issued JWT so that individual sessions can be
// revoked (e.g. "log out other devices") without rotating the global
// JWT_SECRET. The `revoked` flag soft-deletes sessions on logout.

const customerSessionSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  tokenHash:  { type: String, required: true },
  deviceInfo: { type: String },
  createdAt:  { type: Date, default: Date.now },
  expiresAt:  { type: Date, required: true },
  revoked:    { type: Boolean, default: false },
});

customerSessionSchema.index({ customerId: 1 });
customerSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('CustomerSession', customerSessionSchema);
