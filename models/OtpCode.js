const mongoose = require('mongoose');

const otpCodeSchema = new mongoose.Schema({
  identifier: { type: String, required: true, lowercase: true, trim: true }, // email or phone
  otpHash:    { type: String, required: true },
  expiresAt:  { type: Date, required: true },
  used:       { type: Boolean, default: false },
  attempts:   { type: Number, default: 0 },
  type:       { type: String, enum: ['email', 'phone'], default: 'email' },
}, { timestamps: true });

// Auto-delete expired OTPs (TTL index)
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Fast lookup by identifier
otpCodeSchema.index({ identifier: 1, expiresAt: 1 });

module.exports = mongoose.model('OtpCode', otpCodeSchema);
