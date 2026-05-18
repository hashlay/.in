const express = require('express');
const r = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
  getWhatsappOrders,
  createWhatsappOrder,
  parseScreenshot,
} = require('../controllers/whatsappOrderController');

r.get('/', verifyToken, getWhatsappOrders);
r.post('/', verifyToken, createWhatsappOrder);
r.post('/parse-screenshot', verifyToken, parseScreenshot);

module.exports = r;
