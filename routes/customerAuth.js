const express = require('express');
const r = express.Router();
const c = require('../controllers/customerAuthController');
const { verifyCustomerToken, verifyToken } = require('../middleware/auth');

// Public
r.get('/settings',      c.getPublicAuthSettings);
r.post('/send-otp',     c.sendOtp);
r.post('/verify-otp',   c.verifyOtp);
r.post('/login',        c.login);

// Customer auth required
r.get('/me',            verifyCustomerToken, c.getMe);
r.post('/set-password',  verifyCustomerToken, c.setPassword);
r.get('/my-orders',     verifyCustomerToken, c.getMyOrders);
r.get('/track-order/:orderId', verifyCustomerToken, c.trackOrder);

// Admin only
r.post('/test-smtp',    verifyToken, c.testSmtp);
r.post('/test-sms',     verifyToken, c.testSms);

module.exports = r;
