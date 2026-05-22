const mongoose = require('mongoose');
const paginate = require('mongoose-paginate-v2');

const chatSessionSchema = new mongoose.Schema({
  customer:       { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerName:   { type: String, default: '' },
  customerEmail:  { type: String, default: '' },
  status:         { type: String, enum: ['open', 'resolved'], default: 'open' },
  lastMessage:    { type: String, default: '' },
  lastMessageAt:  { type: Date, default: Date.now },
  unreadAdmin:    { type: Number, default: 0 },
  unreadCustomer: { type: Number, default: 0 },
}, { timestamps: true });

chatSessionSchema.index({ customer: 1 });
chatSessionSchema.index({ status: 1, updatedAt: -1 });
chatSessionSchema.plugin(paginate);

module.exports = mongoose.model('ChatSession', chatSessionSchema);
