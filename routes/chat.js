const express = require('express');
const r = express.Router();
const c = require('../controllers/chatController');
const { verifyCustomerToken, verifyToken } = require('../middleware/auth');

// Customer endpoints (require customer auth)
r.get('/session',   verifyCustomerToken, c.getSession);
r.get('/messages',   verifyCustomerToken, c.getMessages);
r.post('/send',      verifyCustomerToken, c.sendMessage);
r.post('/typing',    verifyCustomerToken, c.customerTyping);

// Admin endpoints (require admin auth)
r.get('/admin/sessions',              verifyToken, c.adminGetSessions);
r.get('/admin/messages/:sessionId',   verifyToken, c.adminGetMessages);
r.post('/admin/reply/:sessionId',     verifyToken, c.adminReply);
r.patch('/admin/resolve/:sessionId',  verifyToken, c.adminResolve);
r.post('/admin/typing/:sessionId',    verifyToken, c.adminTyping);
r.get('/admin/unread-count',          verifyToken, c.adminUnreadCount);

module.exports = r;
