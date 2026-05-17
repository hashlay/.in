const express = require('express');
const r = express.Router();
const { getFaqs, createFaq, updateFaq, deleteFaq } = require('../controllers/miscControllers');
const { verifyToken } = require('../middleware/auth');
r.get('/', getFaqs);
r.post('/', verifyToken, createFaq);
r.patch('/:id', verifyToken, updateFaq);
r.delete('/:id', verifyToken, deleteFaq);
module.exports = r;
