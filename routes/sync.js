const express = require('express');
const r = express.Router();
const Product = require('../models/Product');
const Order   = require('../models/Order');
const { Settings } = require('../models/index');
const { getOrSet } = require('../config/cache');

// Lightweight manifest — returns timestamp hashes so frontend
// knows if anything changed without fetching all data
r.get('/manifest', async (req, res) => {
  // Cache manifest for 20s — short TTL so changes propagate quickly
  const data = await getOrSet('sync:manifest', 20, async () => {
    const [lastProduct, lastOrder, lastSetting] = await Promise.all([
      Product.findOne({ isActive: true }).sort({ updatedAt: -1 }).select('updatedAt').lean(),
      Order.findOne().sort({ createdAt: -1 }).select('createdAt').lean(),
      Settings.findOne({ key: 'announcement' }).select('updatedAt').lean(),
    ]);

    return {
      productsUpdatedAt:  lastProduct?.updatedAt  || null,
      ordersLastAt:       lastOrder?.createdAt    || null,
      settingsUpdatedAt:  lastSetting?.updatedAt  || null,
      serverTime:         new Date().toISOString(),
    };
  });

  res.json({ success: true, data });
});

module.exports = r;