const mongoose = require('mongoose');

// ── Chat Message ──────────────────────────────────────────────────
// Individual message within a ChatSession. Supports read-receipts
// via the `readAt` timestamp. The compound index on
// { sessionId, createdAt } allows efficient chronological queries.

const chatMessageSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true,
  },
  senderRole: { type: String, enum: ['customer', 'admin'], required: true },
  message:    { type: String, required: true },
  readAt:     { type: Date, default: null },
  createdAt:  { type: Date, default: Date.now },
});

chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
