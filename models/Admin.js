const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true, minlength: 6, select: false },
  role:         { type: String, enum: ['super_admin','admin','manager','support_staff'], default: 'admin' },
  avatar:       { type: String, default: '' },
  isActive:     { type: Boolean, default: true },
  lastLogin:    { type: Date },
  loginCount:   { type: Number, default: 0 },
  permissions:  {
    products:   { type: Boolean, default: true },
    orders:     { type: Boolean, default: true },
    customers:  { type: Boolean, default: true },
    analytics:  { type: Boolean, default: true },
    marketing:  { type: Boolean, default: true },
    settings:   { type: Boolean, default: false },
    admins:     { type: Boolean, default: false },
  },
}, { timestamps: true });

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

adminSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

adminSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Admin', adminSchema);
