const mongoose = require('mongoose');
const paginate  = require('mongoose-paginate-v2');

// ── Review ────────────────────────────────────────────────────────
const reviewSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  name:     { type: String, required: true },
  email:    { type: String },
  rating:   { type: Number, required: true, min: 1, max: 5 },
  title:    { type: String },
  body:     { type: String, required: true },
  images:   [String],
  status:   { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  helpful:  { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
}, { timestamps: true });
reviewSchema.plugin(paginate);
exports.Review = mongoose.model('Review', reviewSchema);

// ── Coupon ────────────────────────────────────────────────────────
const couponSchema = new mongoose.Schema({
  code:         { type: String, required: true, unique: true, uppercase: true, trim: true },
  type:         { type: String, enum: ['percentage','flat'], required: true },
  value:        { type: Number, required: true, min: 0 },
  minOrder:     { type: Number, default: 0 },
  maxDiscount:  { type: Number, default: null },
  expiryDate:   { type: Date },
  usageLimit:   { type: Number, default: null },
  usedCount:    { type: Number, default: 0 },
  isActive:     { type: Boolean, default: true },
  description:  { type: String },
  applicableTo: { type: String, enum: ['all','new_user','repeat_user'], default: 'all' },
}, { timestamps: true });
exports.Coupon = mongoose.model('Coupon', couponSchema);

// ── Campaign ──────────────────────────────────────────────────────
const campaignSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  type:       { type: String, enum: ['email','sms'], required: true },
  subject:    { type: String },
  message:    { type: String, required: true },
  audience:   { type: String, enum: ['all','new','repeat','high_spenders'], default: 'all' },
  status:     { type: String, enum: ['draft','scheduled','sent','failed'], default: 'draft' },
  scheduledAt:{ type: Date },
  sentAt:     { type: Date },
  sentCount:  { type: Number, default: 0 },
  openRate:   { type: Number, default: 0 },
  clickRate:  { type: Number, default: 0 },
}, { timestamps: true });
exports.Campaign = mongoose.model('Campaign', campaignSchema);

// ── FAQ ───────────────────────────────────────────────────────────
const faqSchema = new mongoose.Schema({
  category: { type: String, required: true, trim: true },
  question: { type: String, required: true, trim: true },
  answer:   { type: String, required: true, trim: true },
  order:    { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
exports.FAQ = mongoose.model('FAQ', faqSchema);

// ── Chatbot ───────────────────────────────────────────────────────
const chatbotSchema = new mongoose.Schema({
  label:    { type: String, required: true },
  keywords: [{ type: String, lowercase: true, trim: true }],
  response: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  triggerCount: { type: Number, default: 0 },
}, { timestamps: true });
exports.Chatbot = mongoose.model('Chatbot', chatbotSchema);

const chatbotQuerySchema = new mongoose.Schema({
  query: { type: String, required: true },
  resolved: { type: Boolean, default: false }
}, { timestamps: true });
exports.ChatbotQuery = mongoose.model('ChatbotQuery', chatbotQuerySchema);

// ── Notify List (customer signup) ─────────────────────────────────
const notifyListSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  email:   { type: String, required: true },
  phone:   { type: String },
  address: { type: String },
  source:  { type: String, default: 'website' },
}, { timestamps: true });
exports.NotifyList = mongoose.model('NotifyList', notifyListSchema);

// ── Contact Message ───────────────────────────────────────────────
const contactSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  email:   { type: String, required: true },
  phone:   { type: String },
  message: { type: String, required: true },
  status:  { type: String, enum: ['open','resolved'], default: 'open' },
  reply:   { type: String },
  repliedAt:{ type: Date },
}, { timestamps: true });
exports.Contact = mongoose.model('Contact', contactSchema);

// ── Notification ──────────────────────────────────────────────────
const notificationSchema = new mongoose.Schema({
  type:   {
    type: String,
    enum: ['new_order','order_update','new_customer','new_review','low_stock',
           'payment','admin_action','system','campaign'],
    required: true,
  },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  link:    { type: String },
  read:    { type: Boolean, default: false },
  meta:    { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });
notificationSchema.plugin(paginate);
exports.Notification = mongoose.model('Notification', notificationSchema);

// ── Activity Log ──────────────────────────────────────────────────
const activityLogSchema = new mongoose.Schema({
  admin:     { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  adminName: { type: String },
  action:    { type: String, required: true },
  module:    { type: String, required: true },
  details:   { type: String },
  ip:        { type: String },
  userAgent: { type: String },
  status:    { type: String, enum: ['success','failure'], default: 'success' },
  meta:      { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });
activityLogSchema.plugin(paginate);
exports.ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

// ── Settings ──────────────────────────────────────────────────────
const settingsSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
  group: { type: String, default: 'general' },
  label: { type: String },
}, { timestamps: true });
exports.Settings = mongoose.model('Settings', settingsSchema);
