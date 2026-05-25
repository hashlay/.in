const mongoose = require('mongoose');
const siteVisitSchema = new mongoose.Schema({
  source: { type: String, default: 'direct' },
  ip: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now, expires: '90d' }
});
module.exports = mongoose.model('SiteVisit', siteVisitSchema);