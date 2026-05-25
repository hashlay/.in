const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  email: { type: String, required: true },
  items: { type: Array, default: [] },
  lastUpdatedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'converted', 'abandoned_notified'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);
