const express = require('express');
const r = express.Router();
const { getNotifications, markRead, clearNotifications } = require('../controllers/miscControllers');
const { verifyToken } = require('../middleware/auth');
r.get('/', verifyToken, getNotifications);
r.patch('/:id/read', verifyToken, markRead);
r.delete('/clear', verifyToken, clearNotifications);
module.exports = r;
