/**
 * Chat Controller — Customer support live chat
 * Uses polling (Vercel-compatible, no WebSockets needed)
 */
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const logger = require('../config/logger');

// In-memory typing indicators (expire after 4 seconds)
const typingStatus = new Map(); // key: sessionId, value: { role, name, at }

function isTyping(sessionId, role) {
  const key = `${sessionId}:${role}`;
  const status = typingStatus.get(key);
  if (!status) return false;
  if (Date.now() - status.at > 4000) {
    typingStatus.delete(key);
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════
//  CUSTOMER ENDPOINTS
// ═══════════════════════════════════════════════════

/**
 * GET /api/chat/session
 * Get or create chat session for current customer
 */
exports.getSession = async (req, res) => {
  const customer = req.customer;

  let session = await ChatSession.findOne({
    customer: customer._id,
    status: 'open',
  }).lean();

  if (!session) {
    session = await ChatSession.create({
      customer: customer._id,
      customerName: customer.name,
      customerEmail: customer.email || customer.phone,
    });
    session = session.toObject();
  }

  // Check if admin is typing
  session.adminTyping = isTyping(session._id.toString(), 'admin');

  res.json({ success: true, data: session });
};

/**
 * GET /api/chat/messages
 * Get messages for customer's active session (supports polling with ?after=timestamp)
 */
exports.getMessages = async (req, res) => {
  const customer = req.customer;
  const { after, limit = 50 } = req.query;

  const session = await ChatSession.findOne({
    customer: customer._id,
    status: 'open',
  });

  if (!session) {
    return res.json({ success: true, data: [], adminTyping: false });
  }

  const query = { session: session._id };
  if (after) {
    query.createdAt = { $gt: new Date(after) };
  }

  const messages = await ChatMessage.find(query)
    .sort({ createdAt: 1 })
    .limit(parseInt(limit))
    .lean();

  // Mark admin messages as read by customer
  if (messages.length > 0) {
    const adminMsgIds = messages
      .filter(m => m.senderRole === 'admin' && !m.readAt)
      .map(m => m._id);
    if (adminMsgIds.length > 0) {
      await ChatMessage.updateMany(
        { _id: { $in: adminMsgIds } },
        { $set: { readAt: new Date() } }
      );
      session.unreadCustomer = 0;
      await session.save();
    }
  }

  res.json({
    success: true,
    data: messages,
    adminTyping: isTyping(session._id.toString(), 'admin'),
  });
};

/**
 * POST /api/chat/send
 * Customer sends a message
 */
exports.sendMessage = async (req, res) => {
  const customer = req.customer;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }

  // Sanitize message (basic XSS prevention)
  const cleanMessage = message.trim().substring(0, 2000);

  let session = await ChatSession.findOne({
    customer: customer._id,
    status: 'open',
  });

  if (!session) {
    session = await ChatSession.create({
      customer: customer._id,
      customerName: customer.name,
      customerEmail: customer.email || customer.phone,
    });
  }

  const msg = await ChatMessage.create({
    session: session._id,
    senderRole: 'customer',
    senderName: customer.name,
    message: cleanMessage,
  });

  // Update session
  session.lastMessage = cleanMessage.substring(0, 100);
  session.lastMessageAt = new Date();
  session.unreadAdmin = (session.unreadAdmin || 0) + 1;
  await session.save();

  res.json({ success: true, data: msg });
};

/**
 * POST /api/chat/typing
 * Customer typing indicator
 */
exports.customerTyping = async (req, res) => {
  const customer = req.customer;
  const session = await ChatSession.findOne({ customer: customer._id, status: 'open' });
  if (session) {
    typingStatus.set(`${session._id}:customer`, {
      role: 'customer', name: customer.name, at: Date.now(),
    });
  }
  res.json({ success: true });
};

// ═══════════════════════════════════════════════════
//  ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════

/**
 * GET /api/chat/admin/sessions
 * List all chat sessions for admin
 */
exports.adminGetSessions = async (req, res) => {
  const { status = 'all', search } = req.query;
  const query = {};
  if (status !== 'all') query.status = status;
  if (search) {
    query.$or = [
      { customerName: new RegExp(search, 'i') },
      { customerEmail: new RegExp(search, 'i') },
    ];
  }

  const sessions = await ChatSession.find(query)
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .lean();

  // Add typing indicators
  sessions.forEach(s => {
    s.customerTyping = isTyping(s._id.toString(), 'customer');
  });

  res.json({ success: true, data: sessions });
};

/**
 * GET /api/chat/admin/messages/:sessionId
 * Get messages for a specific session (admin)
 */
exports.adminGetMessages = async (req, res) => {
  const { sessionId } = req.params;
  const { after, limit = 50 } = req.query;

  const query = { session: sessionId };
  if (after) {
    query.createdAt = { $gt: new Date(after) };
  }

  const messages = await ChatMessage.find(query)
    .sort({ createdAt: 1 })
    .limit(parseInt(limit))
    .lean();

  // Mark customer messages as read by admin
  const customerMsgIds = messages
    .filter(m => m.senderRole === 'customer' && !m.readAt)
    .map(m => m._id);
  if (customerMsgIds.length > 0) {
    await ChatMessage.updateMany(
      { _id: { $in: customerMsgIds } },
      { $set: { readAt: new Date() } }
    );
    await ChatSession.findByIdAndUpdate(sessionId, { unreadAdmin: 0 });
  }

  const session = await ChatSession.findById(sessionId).lean();

  res.json({
    success: true,
    data: messages,
    session,
    customerTyping: isTyping(sessionId, 'customer'),
  });
};

/**
 * POST /api/chat/admin/reply/:sessionId
 * Admin sends a reply
 */
exports.adminReply = async (req, res) => {
  const { sessionId } = req.params;
  const { message } = req.body;
  const admin = req.admin;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }

  const cleanMessage = message.trim().substring(0, 2000);

  const session = await ChatSession.findById(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  const msg = await ChatMessage.create({
    session: sessionId,
    senderRole: 'admin',
    senderName: admin.name || 'Admin',
    message: cleanMessage,
  });

  session.lastMessage = cleanMessage.substring(0, 100);
  session.lastMessageAt = new Date();
  session.unreadCustomer = (session.unreadCustomer || 0) + 1;
  await session.save();

  res.json({ success: true, data: msg });
};

/**
 * PATCH /api/chat/admin/resolve/:sessionId
 * Mark session as resolved/reopen
 */
exports.adminResolve = async (req, res) => {
  const { sessionId } = req.params;
  const { status = 'resolved' } = req.body;

  const session = await ChatSession.findByIdAndUpdate(
    sessionId,
    { status },
    { new: true }
  );

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }

  res.json({ success: true, data: session, message: `Conversation ${status}` });
};

/**
 * POST /api/chat/admin/typing/:sessionId
 * Admin typing indicator
 */
exports.adminTyping = async (req, res) => {
  const { sessionId } = req.params;
  typingStatus.set(`${sessionId}:admin`, {
    role: 'admin', name: req.admin?.name || 'Admin', at: Date.now(),
  });
  res.json({ success: true });
};

/**
 * GET /api/chat/admin/unread-count
 * Get total unread count across all sessions
 */
exports.adminUnreadCount = async (req, res) => {
  const result = await ChatSession.aggregate([
    { $match: { status: 'open' } },
    { $group: { _id: null, total: { $sum: '$unreadAdmin' } } },
  ]);
  const count = result[0]?.total || 0;
  res.json({ success: true, data: { count } });
};
