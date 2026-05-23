const mongoose = require('mongoose');

// ── Chat Session ──────────────────────────────────────────────────
// Represents a live-chat support thread between a customer and an
// admin. A customer can open multiple sessions over time. Status
// transitions: open → resolved.

const chatSessionSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  status:    { type: String, enum: ['open', 'resolved'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

chatSessionSchema.index({ customerId: 1 });
chatSessionSchema.index({ status: 1 });

// Auto-update `updatedAt` on save
chatSessionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ChatSession', chatSessionSchema);
