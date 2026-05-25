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

// Endpoint for real order notifications on the storefront
r.get('/recent-purchases', async (req, res) => {
  const data = await getOrSet('sync:recent_purchases', 60, async () => {
    const recentOrders = await Order.find({ isActive: true, 'items.0': { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('customerName address.city items.name items.image createdAt')
      .lean();
    
    return recentOrders.map(o => {
      let fName = 'Someone';
      if (o.customerName) {
        fName = o.customerName.split(' ')[0];
        fName = fName.charAt(0).toUpperCase() + fName.slice(1).toLowerCase();
      }
      return {
        name: fName,
        city: (o.address && o.address.city) ? o.address.city : 'India',
        product: o.items[0]?.name || 'Premium Sneaker Care Kit',
        image: o.items[0]?.image || 'https://res.cloudinary.com/drj19ghhl/image/upload/v1777176961/f47e171f-1606-4005-9edd-41239b24ea44_ovi6oo.jpg',
        time: o.createdAt
      };
    });
  });
  res.json({ success: true, data });
});

module.exports = r;