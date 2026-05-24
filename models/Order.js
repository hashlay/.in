const mongoose = require('mongoose');
const paginate  = require('mongoose-paginate-v2');

const orderItemSchema = new mongoose.Schema({
  product:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name:      { type: String, required: true },
  image:     { type: String },
  price:     { type: Number, required: true },
  quantity:  { type: Number, required: true, min: 1 },
  total:     { type: Number, required: true },
}, { _id: false });

const addressSchema = new mongoose.Schema({
  fullName: String, phone: String, addressLine1: String,
  addressLine2: String, city: String, state: String,
  pincode: String, country: { type: String, default: 'India' },
}, { _id: false });

const timelineSchema = new mongoose.Schema({
  status: String, 
  message: String, 
  location: String,
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId:        { type: String, unique: true },
  estimatedDeliveryDate: { type: Date },
  customer:       { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName:   { type: String, required: true },
  customerEmail:  { type: String },
  customerPhone:  { type: String },
  address:        addressSchema,
  items:          [orderItemSchema],
  subtotal:       { type: Number, required: true },
  deliveryCharge: { type: Number, default: 0 },
  codCharge:      { type: Number, default: 0 },
  discount:       { type: Number, default: 0 },
  couponCode:     { type: String },
  total:          { type: Number, required: true },
  paymentMethod:  { type: String, enum: ['cod','online','upi'], default: 'cod' },
  paymentStatus:  { type: String, enum: ['pending','paid','failed','refunded'], default: 'pending' },
  razorpayOrderId:  { type: String },
  razorpayPaymentId:{ type: String },
  orderStatus:    {
    type: String,
    enum: ['pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled','returned'],
    default: 'pending',
  },
  deliveryStatus: { type: String, enum: ['pending','dispatched','in_transit','delivered','failed'], default: 'pending' },
  trackingId:     { type: String },
  notes:          { type: String },
  timeline:       [timelineSchema],
  invoiceUrl:     { type: String },
  isActive:       { type: Boolean, default: true },
  orderNumber:    { type: String }, // Added to bypass legacy MongoDB unique index
  source:         { type: String, enum: ['website','whatsapp'], default: 'website' },
  screenshotUrl:  { type: String },
}, { timestamps: true });

const { v4: uuidv4 } = require('uuid');

orderSchema.pre('save', async function (next) {
  if (!this.orderId) {
    try {
      const now = new Date();
      // Use IST or local server time, assuming standard Date works fine.
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      const count = await this.constructor.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      });
      
      const nextNumber = String(count + 1).padStart(3, '0');
      this.orderId = `HL${mm}${dd}${nextNumber}`;
    } catch (e) {
      // Fallback in case DB count fails, so order can still save
      this.orderId = 'HL' + require('uuid').v4().replace(/-/g, '').substring(0, 10).toUpperCase();
    }
  }
  if (!this.orderNumber) {
    this.orderNumber = this.orderId;
  }
  next();
});

orderSchema.plugin(paginate);
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
