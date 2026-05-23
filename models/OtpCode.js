const mongoose = require('mongoose');

// ── OTP Code ──────────────────────────────────────────────────────
// Stores hashed OTP codes for email/phone verification.
// Documents auto-delete after 900 seconds (15 min) via the TTL index
// on createdAt. The `used` flag prevents replay attacks, and the
// `attempts` counter enables brute-force lockout logic in routes.

const otpCodeSchema = new mongoose.Schema({
  identifier: { type: String, required: true },          // email or phone
  otpHash:    { type: String, required: true },           // bcrypt hash of OTP
  expiresAt:  { type: Date, required: true },             // logical expiry
  used:       { type: Boolean, default: false },
  attempts:   { type: Number, default: 0 },
  createdAt:  { type: Date, default: Date.now, expires: 900 },  // TTL 15 min
});

otpCodeSchema.index({ identifier: 1, expiresAt: 1 });

module.exports = mongoose.model('OtpCode', otpCodeSchema);
