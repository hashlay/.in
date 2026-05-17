const jwt      = require('jsonwebtoken');
const Admin    = require('../models/Admin');
const Customer = require('../models/Customer');

// ── Admin Token Verification ─────────────────────────────────────
exports.verifyToken = async (req, res, next) => {
  let token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;

  // Also accept token from query param (for file downloads / exports)
  if (!token && req.query.token) token = req.query.token;

  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin   = await Admin.findById(decoded.id).select('-password');
    if (!admin || !admin.isActive)
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ── Role Guard ───────────────────────────────────────────────────
exports.requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.admin.role))
    return res.status(403).json({ success: false, message: 'Forbidden: insufficient role' });
  next();
};

// ── Permission Guard ─────────────────────────────────────────────
exports.requirePermission = (perm) => (req, res, next) => {
  if (req.admin.role === 'super_admin') return next();
  if (!req.admin.permissions?.[perm])
    return res.status(403).json({ success: false, message: `Forbidden: no ${perm} permission` });
  next();
};

// ── Optional Admin Auth ──────────────────────────────────────────
exports.optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1] : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.admin = await Admin.findById(decoded.id).select('-password');
    } catch {}
  }
  next();
};

// ── Customer Token Verification ──────────────────────────────────
exports.verifyCustomerToken = async (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;

  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'customer')
      return res.status(401).json({ success: false, message: 'Invalid token type' });

    const customer = await Customer.findById(decoded.id).select('-password');
    if (!customer || !customer.isActive)
      return res.status(401).json({ success: false, message: 'Unauthorized' });

    req.customer = customer;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};