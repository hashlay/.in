// ── middleware/customerAuth.js ────────────────────────────────────
// JWT-based auth middleware for the customer portal.
// Reads the token from the httpOnly cookie "customer_token",
// verifies it, checks the session hasn't been revoked/expired,
// and attaches the customer document to req.customer.

const jwt             = require('jsonwebtoken');
const crypto          = require('crypto');
const Customer        = require('../models/Customer');
const CustomerSession = require('../models/CustomerSession');

/**
 * Protect customer routes – rejects with 401 if no valid session.
 */
const customerAuth = async (req, res, next) => {
  const token = req.cookies?.customer_token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    // 1. Verify JWT signature & expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== 'customer-session') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    // 2. Check session exists and is valid
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await CustomerSession.findOne({
      tokenHash,
      customerId: decoded.id,
      revoked: false,
    });

    if (!session || session.expiresAt < new Date()) {
      res.clearCookie('customer_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
      return res.status(401).json({ success: false, message: 'Session expired or revoked' });
    }

    // 3. Fetch customer
    const customer = await Customer.findById(decoded.id).select('-password -passwordHash');
    if (!customer || !customer.isActive) {
      res.clearCookie('customer_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
      return res.status(401).json({ success: false, message: 'Account not found or disabled' });
    }

    req.customer        = customer;
    req.customerSession = session;
    next();
  } catch (err) {
    res.clearCookie('customer_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Optional customer auth – attaches req.customer if a valid cookie
 * exists, but does NOT reject if absent. Useful for routes like /me.
 */
const optionalCustomerAuth = async (req, res, next) => {
  const token = req.cookies?.customer_token;
  if (!token) return next();

  try {
    const decoded   = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== 'customer-session') return next();

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session   = await CustomerSession.findOne({
      tokenHash,
      customerId: decoded.id,
      revoked: false,
    });
    if (!session || session.expiresAt < new Date()) return next();

    const customer = await Customer.findById(decoded.id).select('-password -passwordHash');
    if (customer?.isActive) {
      req.customer        = customer;
      req.customerSession = session;
    }
  } catch { /* silently continue unauthenticated */ }

  next();
};

module.exports = { customerAuth, optionalCustomerAuth };
