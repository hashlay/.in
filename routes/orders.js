const express = require('express');
const r = express.Router();
const c = require('../controllers/orderController');
const { verifyToken } = require('../middleware/auth');

const rateLimit = require('express-rate-limit');

const orderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 orders per windowMs
  message: { success: false, message: 'Too many orders. Please try again later.' }
});

// Public (from customer website)
r.post('/',              orderLimiter, c.createOrder);
r.post('/validate-coupon', c.validateCoupon);

// Admin
r.get('/',               verifyToken, c.getOrders);
r.get('/export/csv',     verifyToken, c.exportCSV);
r.get('/:id',            verifyToken, c.getOrder);
r.patch('/:id/status',   verifyToken, c.updateOrderStatus);
r.delete('/:id',         verifyToken, c.deleteOrder);

module.exports = r;
