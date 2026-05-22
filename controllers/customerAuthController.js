/**
 * Customer Auth Controller
 * Handles OTP-based login, password setting, and customer profile
 */
const jwt      = require('jsonwebtoken');
const Customer = require('../models/Customer');
const { Settings } = require('../models/index');
const { createOtp, verifyOtp } = require('../services/otpService');
const { sendOtpEmail, sendOtpSms, testSmtpConnection } = require('../services/customerAuthEmailService');
const logger = require('../config/logger');

/**
 * Helper: Get auth settings from DB
 */
async function getAuthSettings() {
  try {
    const setting = await Settings.findOne({ key: 'customerAuth' }).lean();
    return setting?.value || {};
  } catch { return {}; }
}

/**
 * POST /api/customer-auth/send-otp
 * Send OTP to email or phone
 */
exports.sendOtp = async (req, res) => {
  const { identifier, type = 'email' } = req.body;

  if (!identifier) {
    return res.status(400).json({ success: false, message: 'Email or phone number is required' });
  }

  // Validate type and check if enabled
  const settings = await getAuthSettings();
  if (type === 'email' && settings.emailLoginEnabled === false) {
    return res.status(400).json({ success: false, message: 'Email login is currently disabled' });
  }
  if (type === 'phone' && !settings.phoneLoginEnabled) {
    return res.status(400).json({ success: false, message: 'Phone login is currently disabled' });
  }

  // Validate format
  if (type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(identifier)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
  } else if (type === 'phone') {
    const phoneClean = identifier.replace(/\D/g, '');
    if (phoneClean.length < 10 || phoneClean.length > 13) {
      return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }
  }

  try {
    // Create OTP
    const { otp } = await createOtp(identifier, type);

    // Send OTP via appropriate channel
    let sendResult;
    if (type === 'email') {
      sendResult = await sendOtpEmail(identifier, otp);
    } else {
      sendResult = await sendOtpSms(identifier, otp);
    }

    if (!sendResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
    }

    // Check if account exists (don't reveal to prevent enumeration — but we need it for UX)
    const query = type === 'email' ? { email: identifier.toLowerCase() } : { phone: identifier };
    const existing = await Customer.findOne(query).select('password isVerified');
    const accountExists = !!existing;
    const hasPassword = !!(existing?.password);

    // Anti-enumeration: always return success
    res.json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        accountExists,
        hasPassword,
        expiresInMinutes: 10,
      },
    });
  } catch (err) {
    if (err.message.includes('Too many OTP')) {
      return res.status(429).json({ success: false, message: err.message });
    }
    logger.error('[CustomerAuth] sendOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

/**
 * POST /api/customer-auth/verify-otp
 * Verify OTP and login/create account
 */
exports.verifyOtp = async (req, res) => {
  const { identifier, otp, type = 'email' } = req.body;

  if (!identifier || !otp) {
    return res.status(400).json({ success: false, message: 'Identifier and OTP are required' });
  }

  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ success: false, message: 'OTP must be exactly 6 digits' });
  }

  try {
    const result = await verifyOtp(identifier, otp);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    // OTP verified — find or create customer
    const query = type === 'email'
      ? { email: identifier.toLowerCase().trim() }
      : { phone: identifier.replace(/\D/g, '') };

    let customer = await Customer.findOne(query).select('+password');
    let isNewUser = false;

    if (!customer) {
      // Create new customer account
      isNewUser = true;
      const customerData = {
        name: type === 'email' ? identifier.split('@')[0] : 'Customer',
        email: type === 'email' ? identifier.toLowerCase().trim() : '',
        phone: type === 'phone' ? identifier.replace(/\D/g, '') : '',
        isVerified: true,
        authMethod: type,
        lastLoginAt: new Date(),
        source: 'portal',
      };
      customer = await Customer.create(customerData);

      // Log activity
      const { ActivityLog } = require('../models/index');
      await ActivityLog.create({
        adminName: 'Customer',
        action: 'REGISTER',
        module: 'customer',
        details: `${customerData.name} (${identifier}) created account via OTP`,
        ip: req.ip,
      }).catch(() => {});
    } else {
      // Existing customer — update login info
      customer.isVerified = true;
      customer.lastLoginAt = new Date();
      if (type === 'phone' && !customer.phone) customer.phone = identifier.replace(/\D/g, '');
      if (type === 'email' && !customer.email) customer.email = identifier.toLowerCase().trim();
      await customer.save();
    }

    const hasPassword = !!(customer.password);

    // If returning user with password, log them in
    // If new user, also log them in but flag needsPassword
    const token = jwt.sign(
      { id: customer._id, type: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Safe customer object (no password)
    const safeCustomer = customer.toObject();
    delete safeCustomer.password;

    res.json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      data: {
        token,
        customer: safeCustomer,
        isNewUser,
        needsPassword: isNewUser || !hasPassword,
      },
    });
  } catch (err) {
    logger.error('[CustomerAuth] verifyOtp error:', err.message);
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

/**
 * POST /api/customer-auth/set-password
 * Set password for new account (requires auth)
 */
exports.setPassword = async (req, res) => {
  const { password, confirmPassword } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }

  try {
    const customer = await Customer.findById(req.customer._id).select('+password');
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    customer.password = password; // Will be hashed by pre-save hook
    await customer.save();

    res.json({ success: true, message: 'Password set successfully' });
  } catch (err) {
    logger.error('[CustomerAuth] setPassword error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to set password' });
  }
};

/**
 * POST /api/customer-auth/login
 * Email + password login (returning users)
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  try {
    const customer = await Customer.findOne({ email: email.toLowerCase() }).select('+password');
    if (!customer || !customer.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!customer.password) {
      return res.status(400).json({ success: false, message: 'Please use OTP login. You haven\'t set a password yet.' });
    }

    const match = await customer.matchPassword(password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    customer.lastLoginAt = new Date();
    await customer.save();

    const token = jwt.sign(
      { id: customer._id, type: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password: _, ...safeCustomer } = customer.toObject();

    res.json({
      success: true,
      message: 'Login successful',
      data: { token, customer: safeCustomer },
    });
  } catch (err) {
    logger.error('[CustomerAuth] login error:', err.message);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
};

/**
 * GET /api/customer-auth/me
 * Get current customer profile
 */
exports.getMe = async (req, res) => {
  res.json({ success: true, data: req.customer });
};

/**
 * GET /api/customer-auth/my-orders
 * Get current customer's orders
 */
exports.getMyOrders = async (req, res) => {
  const Order = require('../models/Order');
  const { page = 1, limit = 10 } = req.query;

  const customer = req.customer;
  const query = {
    isActive: true,
    $or: [
      { customer: customer._id },
      { customerEmail: customer.email },
      { customerPhone: customer.phone },
    ].filter(q => Object.values(q)[0]),
  };

  const opts = { page: parseInt(page), limit: parseInt(limit), sort: '-createdAt', lean: true };
  const result = await Order.paginate(query, opts);

  res.json({ success: true, data: result });
};

/**
 * GET /api/customer-auth/track-order/:orderId
 * Get order details for tracking
 */
exports.trackOrder = async (req, res) => {
  const Order = require('../models/Order');
  const { orderId } = req.params;

  const customer = req.customer;
  const order = await Order.findOne({
    orderId: orderId.toUpperCase(),
    $or: [
      { customer: customer._id },
      { customerEmail: customer.email },
      { customerPhone: customer.phone },
    ].filter(q => Object.values(q)[0]),
  }).lean();

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.json({ success: true, data: order });
};

/**
 * GET /api/customer-auth/settings
 * Get auth settings (public — what's enabled)
 */
exports.getPublicAuthSettings = async (req, res) => {
  const settings = await getAuthSettings();
  res.json({
    success: true,
    data: {
      emailLoginEnabled: settings.emailLoginEnabled !== false, // default true
      phoneLoginEnabled: !!settings.phoneLoginEnabled,
      featureOrdersEnabled: settings.featureOrdersEnabled !== false,
      featureTrackEnabled: settings.featureTrackEnabled !== false,
      featureChatEnabled: settings.featureChatEnabled !== false,
    },
  });
};

/**
 * POST /api/customer-auth/test-smtp (Admin only)
 * Test customer auth SMTP connection
 */
exports.testSmtp = async (req, res) => {
  const result = await testSmtpConnection();
  res.json(result);
};

/**
 * POST /api/customer-auth/test-sms (Admin only)
 * Send test SMS
 */
exports.testSms = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'Phone number required' });
  const { sendOtpSms } = require('../services/customerAuthEmailService');
  const result = await sendOtpSms(phone, '123456');
  res.json(result);
};
