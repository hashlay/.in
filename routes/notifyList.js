const express = require('express');
const r = express.Router();
const { getNotifyList, createNotify, deleteNotify, exportNotifyCSV } = require('../controllers/miscControllers');
const { verifyToken } = require('../middleware/auth');
r.get('/', verifyToken, getNotifyList);
r.post('/', createNotify);
r.delete('/:id', verifyToken, deleteNotify);
r.get('/export/csv', verifyToken, exportNotifyCSV);
module.exports = r;
