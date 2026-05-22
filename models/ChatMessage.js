const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  session:    { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', required: true },
  senderRole: { type: String, enum: ['customer', 'admin'], required: true },
  senderName: { type: String, default: '' },
  message:    { type: String, required: true, trim: true },
  readAt:     { type: Date, default: null },
}, { timestamps: true });

chatMessageSchema.index({ session: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
