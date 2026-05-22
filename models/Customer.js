const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const paginate = require('mongoose-paginate-v2');

const customerSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:      { type: String, trim: true },
  password:   { type: String, minlength: 6, select: false },
  avatar:     { type: String, default: '' },
  addresses:  [{
    fullName: String, phone: String, addressLine1: String,
    addressLine2: String, city: String, state: String,
    pincode: String, isDefault: { type: Boolean, default: false },
  }],
  totalOrders:  { type: Number, default: 0 },
  totalSpend:   { type: Number, default: 0 },
  lastOrderAt:  { type: Date },
  lastLoginAt:  { type: Date },
  authMethod:   { type: String, enum: ['email', 'phone', 'checkout'], default: 'email' },
  isVerified:   { type: Boolean, default: false },
  isActive:     { type: Boolean, default: true },
  emailOptIn:   { type: Boolean, default: true },
  smsOptIn:     { type: Boolean, default: true },
  source:       { type: String, default: 'website' },
}, { timestamps: true });

customerSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

customerSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

customerSchema.plugin(paginate);
customerSchema.index({ totalSpend: -1 });
customerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Customer', customerSchema);
