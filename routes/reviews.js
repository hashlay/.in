const express = require('express');
const r = express.Router();
const { getReviews, createReview, updateReview, deleteReview } = require('../controllers/miscControllers');
const { verifyToken } = require('../middleware/auth');
r.get('/', getReviews);
r.post('/', createReview);
r.patch('/:id', verifyToken, updateReview);
r.delete('/:id', verifyToken, deleteReview);
module.exports = r;
