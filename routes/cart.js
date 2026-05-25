const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');

router.post('/sync', async (req, res) => {
  try {
    const { email, items } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    // Find if cart exists
    let cart = await Cart.findOne({ email });
    if (cart) {
      if (items && items.length > 0) {
        cart.items = items;
        cart.lastUpdatedAt = new Date();
        cart.status = 'active'; // Reactivate if it was notified but they added stuff again
        await cart.save();
      } else {
        // Empty cart, maybe delete or just clear
        cart.items = [];
        cart.status = 'active';
        await cart.save();
      }
    } else {
      // Create new
      if (items && items.length > 0) {
        cart = new Cart({ email, items, status: 'active' });
        await cart.save();
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Cart Sync Error]', err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
