const express = require('express');
const r = express.Router();
const { verifyToken } = require('../middleware/auth');
const Order = require('../models/Order');
const { generateInvoicePDF } = require('../services/invoiceService');

r.get('/:orderId', verifyToken, async (req, res) => {
  const order = await Order.findOne({
    $or: [{ _id: req.params.orderId.match(/^[0-9a-fA-F]{24}$/) ? req.params.orderId : null },
          { orderId: req.params.orderId }],
  });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  generateInvoicePDF(order, res);
});

module.exports = r;
