// ── routes/auth.js ───────────────────────────────────────────────
const express = require('express');
const r = express.Router();
const c = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
r.post('/login', c.login);
r.post('/logout', verifyToken, c.logout);
r.get('/me', verifyToken, c.me);
r.patch('/change-password', verifyToken, c.changePassword);
module.exports = r;
