const express  = require('express');
const r        = express.Router();
const Razorpay = require('razorpay');
const crypto   = require('crypto');
const Order    = require('../models/Order');
const Product  = require('../models/Product');
const { Settings } = require('../models/index');

const getRazorpayInstance = async () => {
  const paymentSettings = await Settings.findOne({ key: 'payment' });
  const keyId     = paymentSettings?.value?.razorpayKeyId     || process.env.RAZORPAY_KEY_ID;
  const keySecret = paymentSettings?.value?.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

// Create Razorpay order
r.post('/create-order', async (req, res) => {
  try {
    const { items, currency = 'INR', receipt, notes, paymentMethod, deliveryCharge = 0, codCharge = 0, couponDiscount = 0 } = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ success: false, message: 'Cart items are required' });

    const productIds = items.map(i => i.product || i.id).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds }, isActive: true }).lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    let subtotal = 0;
    for (const item of items) {
      const id = item.product || item.id;
      const product = productMap.get(String(id));
      if (!product) {
        return res.status(400).json({ success: false, message: `Product unavailable: ${item.name || id}` });
      }
      if (!item.quantity || item.quantity < 1) {
        return res.status(400).json({ success: false, message: 'Invalid quantity for product' });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
      }
      const price = product.offerPrice || product.price;
      subtotal += price * item.quantity;
    }

    if (couponDiscount < 0 || couponDiscount > subtotal)
      return res.status(400).json({ success: false, message: 'Invalid coupon discount' });

    if (paymentMethod === 'cod' && codCharge < 0)
      return res.status(400).json({ success: false, message: 'Invalid COD charge' });

    const deliverySettings = await Settings.findOne({ key: 'delivery' });
    const deliveryValue = deliverySettings?.value || {};
    const freeAbove = parseFloat(deliveryValue.freeAbove) || 999;
    const adminCharge = parseFloat(deliveryValue.charge) || 49;
    const adminCodCharge = parseFloat(deliveryValue.codCharge) || 0;
    
    const expectedDelivery = (subtotal >= freeAbove) ? 0 : adminCharge;
    const expectedCodCharge = (paymentMethod === 'cod') ? adminCodCharge : 0;

    if (parseFloat(deliveryCharge) !== expectedDelivery)
      return res.status(400).json({ success: false, message: 'Delivery charge mismatch' });
    if (parseFloat(codCharge) !== expectedCodCharge)
      return res.status(400).json({ success: false, message: 'COD charge mismatch' });

    const amount = subtotal + parseFloat(deliveryCharge) + parseFloat(codCharge) - parseFloat(couponDiscount);
    if (!amount || amount < 1)
      return res.status(400).json({ success: false, message: 'Invalid order amount' });

    const razorpay = await getRazorpayInstance();
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {},
    });

    res.json({ success: true, data: order, amount });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'Payment init failed' });
  }
});

// Verify payment signature
r.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const paymentSettings = await Settings.findOne({ key: 'payment' });
    const secret = paymentSettings?.value?.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;

    const body  = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (expectedSig !== razorpay_signature)
      return res.status(400).json({ success: false, message: 'Payment verification failed' });

    // Update our order
    if (orderId) {
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus:      'paid',
        razorpayOrderId:    razorpay_order_id,
        razorpayPaymentId:  razorpay_payment_id,
        orderStatus:        'confirmed',
        $push: { timeline: { status: 'confirmed', message: 'Payment received, order confirmed' } },
      });
    }

    res.json({ success: true, message: 'Payment verified', paymentId: razorpay_payment_id });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Webhook handler (from Razorpay dashboard)
r.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const secret    = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const signature = req.headers['x-razorpay-signature'];
    const digest    = crypto.createHmac('sha256', secret).update(req.body).digest('hex');

    if (secret && digest !== signature)
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });

    const event = JSON.parse(req.body);
    if (event.event === 'payment.captured') {
      const paymentId = event.payload.payment.entity.id;
      await Order.findOneAndUpdate(
        { razorpayPaymentId: paymentId },
        { paymentStatus: 'paid', orderStatus: 'confirmed' }
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = r;
