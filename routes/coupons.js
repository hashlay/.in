const express = require('express');
const r = express.Router();
const { getCoupons, createCoupon, updateCoupon, deleteCoupon } = require('../controllers/miscControllers');
const { verifyToken } = require('../middleware/auth');
r.get('/', verifyToken, getCoupons);
r.post('/', verifyToken, createCoupon);
r.patch('/:id', verifyToken, updateCoupon);
r.delete('/:id', verifyToken, deleteCoupon);
module.exports = r;
