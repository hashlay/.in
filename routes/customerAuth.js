// ── routes/customerAuth.js ───────────────────────────────────────
// Mounted at /api/customer/auth — handles OTP-based customer
// authentication, password setup, session management.
// All routes are additive — nothing in the existing codebase is modified.

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const rateLimit  = require('express-rate-limit');

const Customer        = require('../models/Customer');
const OtpCode         = require('../models/OtpCode');
const CustomerSession = require('../models/CustomerSession');
const AuthSettings    = require('../models/AuthSettings');
const { decrypt }     = require('../utils/crypto');
const { customerAuth } = require('../middleware/customerAuth');

// ═══════════════════════════════════════════════════════════════════
// ── HELPERS ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

/** Cookie options for the customer session JWT */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  path:     '/',
};

/** Validate email per RFC 5322 (simplified) */
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Validate E.164 phone (+ followed by 7-15 digits) */
function isValidPhone(v) {
  return /^\+[1-9]\d{6,14}$/.test(v);
}

/** Determine if identifier is email or phone */
function identifierType(identifier) {
  if (isValidEmail(identifier)) return 'email';
  if (isValidPhone(identifier)) return 'phone';
  return null;
}

/** Build a Nodemailer transporter from AuthSettings SMTP config */
function buildTransporter(settings) {
  const pass = settings.smtpPassEncrypted ? decrypt(settings.smtpPassEncrypted) : null;
  return nodemailer.createTransport({
    host: settings.smtpHost   || process.env.CUSTOMER_SMTP_HOST  || process.env.SMTP_HOST,
    port: settings.smtpPort   || process.env.CUSTOMER_SMTP_PORT  || 587,
    secure: (settings.smtpEncryption === 'SSL'),
    auth: {
      user: settings.smtpUser || process.env.CUSTOMER_SMTP_USER  || process.env.SMTP_USER,
      pass: pass              || process.env.CUSTOMER_SMTP_PASS  || process.env.SMTP_PASS,
    },
  });
}

/** Build the OTP verification email HTML */
function otpEmailHtml(otp, fromName) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${fromName || 'Hashlay'}</h1>
      </td></tr>
      <tr><td style="padding:40px;">
        <p style="margin:0 0 12px;font-size:16px;color:#374151;">Your verification code is:</p>
        <div style="background:#f0f0ff;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#6366f1;">${otp}</span>
        </div>
        <p style="margin:0;font-size:14px;color:#6b7280;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      </td></tr>
      <tr><td style="padding:20px 40px;background:#f9fafb;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">If you didn't request this code, you can safely ignore this email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Create a JWT session token, store session, set cookie */
async function createSession(customer, req, res) {
  const token = jwt.sign(
    { id: customer._id, purpose: 'customer-session' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await CustomerSession.create({
    customerId: customer._id,
    tokenHash,
    deviceInfo: req.headers['user-agent'] || 'unknown',
    expiresAt,
  });

  // Update last login
  await Customer.updateOne(
    { _id: customer._id },
    { $set: { lastLoginAt: new Date() } }
  );

  res.cookie('customer_token', token, COOKIE_OPTIONS);
  return token;
}


// ═══════════════════════════════════════════════════════════════════
// ── RATE LIMITERS ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

/** Global per-IP rate limit for all customer auth routes */
const globalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Tighter limit specifically for OTP send */
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many OTP requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(globalAuthLimiter);


// ═══════════════════════════════════════════════════════════════════
// ── GET /settings — Public auth settings for frontend ────────────
// ═══════════════════════════════════════════════════════════════════

router.get('/settings', async (req, res) => {
  const settings = await AuthSettings.getSettings();
  return res.json({
    success: true,
    emailLoginEnabled: !!settings.emailLoginEnabled,
    phoneLoginEnabled: !!settings.phoneLoginEnabled,
  });
});


// ═══════════════════════════════════════════════════════════════════
// ── ROUTE 1: POST /send-otp ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

router.post('/send-otp',
  otpSendLimiter,
  body('identifier').trim().notEmpty().withMessage('Email or phone is required'),
  async (req, res) => {
    // ── Validate input ──
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const identifier = req.body.identifier.trim().toLowerCase();
    const type = identifierType(identifier);

    // ── Load settings & check if login method is enabled ──
    const settings = await AuthSettings.getSettings();

    if (type === 'email' && !settings.emailLoginEnabled) {
      return res.status(400).json({ success: false, message: 'Email login is not enabled' });
    }
    if (type === 'phone' && !settings.phoneLoginEnabled) {
      return res.status(400).json({ success: false, message: 'Phone login is not enabled' });
    }
    if (!type) {
      return res.status(400).json({ success: false, message: 'Invalid email or phone format' });
    }

    // ── Rate limit per identifier (max 3 OTPs per 15 min) ──
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentCount = await OtpCode.countDocuments({
      identifier,
      createdAt: { $gte: fifteenMinAgo },
    });
    if (recentCount >= 3) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP requests. Try again in 15 minutes.',
      });
    }

    // ── Generate & hash OTP ──
    const otp     = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OtpCode.create({ identifier, otpHash, expiresAt });
    
    // DEMO LOG: Print OTP to console for easy testing without SMTP configured
    console.log(`[TESTING] Generated OTP for ${identifier}: ${otp}`);

    // ── Send OTP ──
    try {
      if (type === 'email') {
        const transporter = buildTransporter(settings);
        const fromName  = settings.smtpFromName  || process.env.CUSTOMER_SMTP_FROM_NAME  || process.env.FROM_NAME  || 'Hashlay';
        const fromEmail = settings.smtpFromEmail || process.env.CUSTOMER_SMTP_FROM_EMAIL || process.env.FROM_EMAIL || 'noreply@hashlay.in';

        await transporter.sendMail({
          from:    `"${fromName}" <${fromEmail}>`,
          to:      identifier,
          subject: 'Your verification code',
          html:    otpEmailHtml(otp, fromName),
        });
      } else {
        // Phone — POST to Fast2SMS (or configured gateway)
        const apiKey     = settings.smsApiKeyEncrypted ? decrypt(settings.smsApiKeyEncrypted) : process.env.SMS_API_KEY;
        const gatewayUrl = settings.smsGatewayUrl || process.env.SMS_GATEWAY_URL || 'https://www.fast2sms.com/dev/bulkV2';
        const senderId   = settings.smsSenderId   || process.env.SMS_SENDER_ID   || 'FSTSMS';
        const route      = settings.smsRoute      || 'v3';
        // Strip leading + for Fast2SMS
        const phoneNumber = identifier.replace(/^\+91/, '');

        const response = await fetch(gatewayUrl, {
          method: 'POST',
          headers: {
            'authorization': apiKey,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            route,
            sender_id: senderId,
            message:   `Your OTP is ${otp}. Valid for 10 minutes. Do not share.`,
            flash:     0,
            numbers:   phoneNumber,
          }),
        });

        if (!response.ok) {
          const logger = require('../config/logger');
          logger.error(`SMS send failed: ${response.status} ${await response.text()}`);
        }
      }
    } catch (err) {
      // Log but don't reveal to client
      const logger = require('../config/logger');
      logger.error(`OTP delivery failed for ${type}: ${err.message}`);
    }

    // ── Always return the same response (security) ──
    return res.json({ success: true, message: 'OTP sent' });
  },
);


// ═══════════════════════════════════════════════════════════════════
// ── ROUTE 2: POST /verify-otp ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

router.post('/verify-otp',
  body('identifier').trim().notEmpty().withMessage('Identifier is required'),
  body('otp').trim().notEmpty().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const identifier = req.body.identifier.trim().toLowerCase();
    const otp        = req.body.otp.trim();

    // ── Find latest unused, unexpired OTP ──
    const otpDoc = await OtpCode.findOne({
      identifier,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // ── Brute-force lockout (>5 attempts) ──
    if (otpDoc.attempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Request a new OTP.',
      });
    }

    // ── Increment attempts ──
    otpDoc.attempts += 1;
    await otpDoc.save();

    // ── Compare OTP ──
    // DEMO BYPASS: Allows '000000' to work for testing purposes.
    // Make sure to remove this before real production launch!
    let isMatch = false;
    if (otp === '000000') {
      isMatch = true;
    } else {
      isMatch = await bcrypt.compare(otp, otpDoc.otpHash);
    }

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // ── Mark as used ──
    otpDoc.used = true;
    await otpDoc.save();

    // ── Determine identifier type ──
    const type = identifierType(identifier);
    const query = type === 'email' ? { email: identifier } : { phone: identifier };

    // ── Check if customer exists ──
    let existingCustomer = await Customer.findOne(query).select('+passwordHash');
    
    // If checkout flag is present, auto-create and auto-login even without password
    if (req.body.checkout) {
      if (!existingCustomer) {
        existingCustomer = await Customer.create({
          [type]: identifier,
          name: req.body.name || null,
        });
      }
      await createSession(existingCustomer, req, res);
      return res.json({
        success: true,
        message: 'OTP verified and logged in.',
      });
    }

    if (!existingCustomer || !existingCustomer.passwordHash) {
      // New user or user without password — issue temp token for set-password
      const tempToken = jwt.sign(
        { identifier, type, purpose: 'set-password' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' },
      );
      return res.json({
        success: true,
        isNewUser: true,
        tempToken,
        message: 'OTP verified. Please set your password.',
      });
    }

    // ── Existing customer with password — create session ──
    await createSession(existingCustomer, req, res);

    return res.json({
      success:   true,
      isNewUser: false,
      message:   'Login successful',
    });
  },
);


// ═══════════════════════════════════════════════════════════════════
// ── ROUTE 3: POST /set-password ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

router.post('/set-password',
  body('tempToken').trim().notEmpty().withMessage('Temp token is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('confirmPassword').trim().notEmpty().withMessage('Confirm password is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { tempToken, password, confirmPassword, name, email, phone } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Path 'name' is required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    // ── Verify temp token ──
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    if (decoded.purpose !== 'set-password') {
      return res.status(401).json({ success: false, message: 'Invalid token purpose' });
    }

    const { identifier, type } = decoded;
    
    // Check if the extra email or phone already exists
    if (email && type !== 'email') {
      const existingEmail = await Customer.findOne({ email });
      if (existingEmail && existingEmail.phone !== identifier) {
        return res.status(400).json({ success: false, message: 'This email is already registered to another account.' });
      }
    }
    if (phone && type !== 'phone') {
      const existingPhone = await Customer.findOne({ phone });
      if (existingPhone && existingPhone.email !== identifier) {
        return res.status(400).json({ success: false, message: 'This phone number is already registered to another account.' });
      }
    }

    // ── Hash password with bcrypt cost 12 ──
    const passwordHash = await bcrypt.hash(password, 12);

    // ── Upsert customer ──
    const query  = type === 'email' ? { email: identifier } : { phone: identifier };
    const update = {
      passwordHash,
      name: name.trim(),
      ...(email ? { email: email.trim() } : {}),
      ...(phone ? { phone: phone.trim() } : {}),
      ...(type === 'email' ? { email: identifier } : { phone: identifier }),
    };

    const customer = await Customer.findOneAndUpdate(
      query,
      { $set: update, $setOnInsert: { source: 'customer-portal' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // ── Create session & set cookie ──
    await createSession(customer, req, res);

    return res.json({ success: true, message: 'Password set successfully' });
  },
);


// ═══════════════════════════════════════════════════════════════════
// ── ROUTE 4: POST /logout ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

router.post('/logout', customerAuth, async (req, res) => {
  // Revoke the current session
  if (req.customerSession) {
    req.customerSession.revoked = true;
    await req.customerSession.save();
  }

  // Clear the cookie
  res.clearCookie('customer_token', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/',
  });

  return res.json({ success: true, message: 'Logged out successfully' });
});


// ═══════════════════════════════════════════════════════════════════
// ── ROUTE 5: GET /me ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════

router.get('/me', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  const token = req.cookies?.customer_token;

  if (!token) {
    return res.json({ loggedIn: false });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== 'customer-session') {
      return res.json({ loggedIn: false });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await CustomerSession.findOne({
      tokenHash,
      customerId: decoded.id,
      revoked: false,
    });

    if (!session || session.expiresAt < new Date()) {
      return res.json({ loggedIn: false });
    }

    const customer = await Customer.findById(decoded.id).select('email phone name');
    if (!customer) {
      return res.json({ loggedIn: false });
    }

    return res.json({
      loggedIn: true,
      customer: {
        _id:   customer._id,
        email: customer.email || null,
        phone: customer.phone || null,
        name:  customer.name  || null,
      },
    });
  } catch {
    return res.json({ loggedIn: false });
  }
});


module.exports = router;
