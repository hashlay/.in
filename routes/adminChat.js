// ── routes/adminChat.js ──────────────────────────────────────────
// Mounted at /api/admin/chat — Admin support inbox API.
// All routes protected by existing admin auth middleware.

const express = require('express');
const router  = express.Router();
const mongoose = require('mongoose');

const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const Customer    = require('../models/Customer');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// ═══════════════════════════════════════════════════════════════════
// ── GET /sessions — List chat sessions ───────────────────────────
// ═══════════════════════════════════════════════════════════════════

router.get('/sessions', async (req, res) => {
  const filter = {};
  if (req.query.status === 'open' || req.query.status === 'resolved') {
    filter.status = req.query.status;
  }

  const sessions = await ChatSession.find(filter)
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  // Enrich with customer info, last message, unread count
  const enriched = await Promise.all(sessions.map(async (s) => {
    const customer = await Customer.findById(s.customerId).select('email phone name').lean();
    const lastMsg = await ChatMessage.findOne({ sessionId: s._id })
      .sort({ createdAt: -1 }).select('message senderRole createdAt').lean();
    const unread = await ChatMessage.countDocuments({
      sessionId: s._id, senderRole: 'customer', readAt: null,
    });
    return {
      _id: s._id,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      customer: customer || { email: 'Unknown', name: null, phone: null },
      lastMessage: lastMsg ? { text: lastMsg.message, sender: lastMsg.senderRole, at: lastMsg.createdAt } : null,
      unread,
    };
  }));

  res.json({ success: true, sessions: enriched });
});

// ═══════════════════════════════════════════════════════════════════
// ── GET /sessions/:id/messages — Messages for a session ──────────
// ═══════════════════════════════════════════════════════════════════

router.get('/sessions/:id/messages', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid session ID' });
  }

  const messages = await ChatMessage.find({ sessionId: req.params.id })
    .sort({ createdAt: 1 }).lean();

  // Mark customer messages as read
  await ChatMessage.updateMany(
    { sessionId: req.params.id, senderRole: 'customer', readAt: null },
    { $set: { readAt: new Date() } },
  );

  res.json({ success: true, messages });
});

// ═══════════════════════════════════════════════════════════════════
// ── POST /sessions/:id/reply — Admin sends a reply ───────────────
// ═══════════════════════════════════════════════════════════════════

router.post('/sessions/:id/reply', async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message required' });

  const session = await ChatSession.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  const msg = await ChatMessage.create({
    sessionId: session._id,
    senderRole: 'admin',
    message: message.trim(),
  });

  session.updatedAt = new Date();
  await session.save();

  // Emit to customer via Socket.io
  const io = req.app.get('io');
  if (io) {
    io.to('customer_' + session.customerId).emit('admin_message', {
      sessionId: session._id,
      message: msg.message,
      createdAt: msg.createdAt,
      messageId: msg._id,
    });
  }

  res.json({ success: true, message: msg });
});

// ═══════════════════════════════════════════════════════════════════
// ── PATCH /sessions/:id/status — Change session status ───────────
// ═══════════════════════════════════════════════════════════════════

router.patch('/sessions/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['open', 'resolved'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be open or resolved' });
  }

  const session = await ChatSession.findByIdAndUpdate(
    req.params.id, { status }, { new: true },
  );
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  res.json({ success: true, session });
});

// ═══════════════════════════════════════════════════════════════════
// ── GET /unread-count — Total unread across all open sessions ────
// ═══════════════════════════════════════════════════════════════════

router.get('/unread-count', async (req, res) => {
  const openSessions = await ChatSession.find({ status: 'open' }).select('_id').lean();
  const ids = openSessions.map(s => s._id);

  const count = ids.length
    ? await ChatMessage.countDocuments({ sessionId: { $in: ids }, senderRole: 'customer', readAt: null })
    : 0;

  res.json({ success: true, count });
});

// ═══════════════════════════════════════════════════════════════════
// ── DELETE /sessions/:id — Delete a chat session and its messages
// ═══════════════════════════════════════════════════════════════════

router.delete('/sessions/:id', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid session ID' });
  }

  const session = await ChatSession.findByIdAndDelete(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  // Delete all messages associated with this session
  await ChatMessage.deleteMany({ sessionId: req.params.id });

  res.json({ success: true, message: 'Chat deleted completely' });
});

module.exports = router;
