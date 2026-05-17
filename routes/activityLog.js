const express = require('express');
const r = express.Router();
const { getActivityLog, exportActivityLog, trackActivity } = require('../controllers/miscControllers');
const { verifyToken } = require('../middleware/auth');
r.get('/', verifyToken, getActivityLog);
r.get('/export', verifyToken, exportActivityLog);
r.post('/track', trackActivity);
module.exports = r;
