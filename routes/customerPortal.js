// ── routes/customerPortal.js ─────────────────────────────────────
// Mounted at /api/customer/portal — customer portal API routes.
// Orders, tracking, and live chat support.

const express = require('express');
const router  = express.Router();

const Order        = require('../models/Order');
const AuthSettings = require('../models/AuthSettings');
const ChatSession  = require('../models/ChatSession');
const ChatMessage  = require('../models/ChatMessage');
const { customerAuth } = require('../middleware/customerAuth');

// ═══════════════════════════════════════════════════════════════════
// ── GET /settings — Public (feature flags for portal nav) ────────
// ═══════════════════════════════════════════════════════════════════

router.get('/settings', async (req, res) => {
  const s = await AuthSettings.getSettings();
  res.json({
    success: true,
    featureOrdersEnabled: !!s.featureOrdersEnabled,
    featureTrackEnabled:  !!s.featureTrackEnabled,
    featureChatEnabled:   !!s.featureChatEnabled,
  });
});

// ── All routes below require customer auth ───────────────────────
router.use(customerAuth);

// ═══════════════════════════════════════════════════════════════════
// ── GET /orders — Paginated order list ───────────────────────────
// ═══════════════════════════════════════════════════════════════════

router.get('/orders', async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

  const c = req.customer;
  const query = {
    $or: [
      { customer: c._id },
      ...(c.email ? [{ customerEmail: c.email }] : []),
      ...(c.phone ? [{ customerPhone: c.phone }] : []),
    ],
  };

  const result = await Order.paginate(query, {
    page, limit,
    sort: { createdAt: -1 },
    select: 'orderId createdAt total orderStatus paymentStatus paymentMethod items',
  });

  const orders = result.docs.map(o => ({
    _id:       o._id,
    orderId:   o.orderId,
    createdAt: o.createdAt,
    total:     o.total,
    status:    o.orderStatus,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    itemCount: o.items?.length || 0,
  }));

  res.json({
    success: true,
    orders,
    page: result.page,
    totalPages: result.totalPages,
    totalOrders: result.totalDocs,
    hasMore: result.hasNextPage,
  });
});

// ═══════════════════════════════════════════════════════════════════
// ── GET /orders/:orderId — Full order details ────────────────────
// ═══════════════════════════════════════════════════════════════════

router.get('/orders/:orderId', async (req, res) => {
  const c = req.customer;
  const order = await Order.findOne({
    orderId: req.params.orderId,
    $or: [
      { customer: c._id },
      ...(c.email ? [{ customerEmail: c.email }] : []),
      ...(c.phone ? [{ customerPhone: c.phone }] : []),
    ],
  });

  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  res.json({ success: true, order });
});

// ═══════════════════════════════════════════════════════════════════
// ── GET /track/:orderId — Order with timeline for tracking ───────
// ═══════════════════════════════════════════════════════════════════

router.get('/track/:orderId', async (req, res) => {
  const c = req.customer;
  const order = await Order.findOne({
    orderId: req.params.orderId,
    $or: [
      { customer: c._id },
      ...(c.email ? [{ customerEmail: c.email }] : []),
      ...(c.phone ? [{ customerPhone: c.phone }] : []),
    ],
  }).select('orderId orderStatus deliveryStatus trackingId timeline createdAt updatedAt');

  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  res.json({ success: true, order });
});

// ═══════════════════════════════════════════════════════════════════
// ── POST /chat/start — Create or resume chat session ─────────────
// ═══════════════════════════════════════════════════════════════════

router.post('/chat/start', async (req, res) => {
  // Resume existing open session or create new one
  let session = await ChatSession.findOne({ customerId: req.customer._id, status: 'open' }).sort({ createdAt: -1 });
  if (!session) {
    session = await ChatSession.create({ customerId: req.customer._id });
  }
  res.json({ success: true, sessionId: session._id });
});

// ═══════════════════════════════════════════════════════════════════
// ── GET /chat/messages — Last 50 messages ────────────────────────
// ═══════════════════════════════════════════════════════════════════

router.get('/chat/messages', async (req, res) => {
  const session = await ChatSession.findOne({ customerId: req.customer._id, status: 'open' }).sort({ createdAt: -1 });
  if (!session) return res.json({ success: true, messages: [], sessionId: null });

  const messages = await ChatMessage.find({ sessionId: session._id })
    .sort({ createdAt: 1 })
    .limit(50)
    .lean();

  res.json({ success: true, messages, sessionId: session._id });
});

// ═══════════════════════════════════════════════════════════════════
// ── POST /chat/message — Send a message ──────────────────────────
// ═══════════════════════════════════════════════════════════════════

router.post('/chat/message', async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message is required' });

  // Verify session belongs to this customer
  const session = await ChatSession.findOne({ _id: sessionId, customerId: req.customer._id });
  if (!session) return res.status(404).json({ success: false, message: 'Chat session not found' });

  const msg = await ChatMessage.create({
    sessionId: session._id,
    senderRole: 'customer',
    message: message.trim(),
  });

  // Update session timestamp
  session.updatedAt = new Date();
  await session.save();

  // Emit to admin via Socket.io (if available on req.app)
  const io = req.app.get('io');
  if (io) {
    io.to('admin_inbox').emit('customer_message', {
      sessionId: session._id,
      customerId: req.customer._id,
      customerName: req.customer.name || req.customer.email || req.customer.phone,
      message: msg.message,
      createdAt: msg.createdAt,
      messageId: msg._id,
    });
  }

  res.json({ success: true, message: msg });
});


module.exports = router;
