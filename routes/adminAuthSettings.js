// ── routes/adminAuthSettings.js ──────────────────────────────────
// Mounted at /api/admin/auth-settings
// Admin-protected CRUD for Customer Auth Portal settings.
// All routes require existing admin verifyToken middleware.

const express = require('express');
const router  = express.Router();
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');

const AuthSettings       = require('../models/AuthSettings');
const { encrypt, decrypt } = require('../utils/crypto');
const { verifyToken }    = require('../middleware/auth');

// All routes require admin auth
router.use(verifyToken);


// ═══════════════════════════════════════════════════════════════════
// ── GET / — Return current AuthSettings (sensitive fields masked) ─
// ═══════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  const settings = await AuthSettings.getSettings();
  const obj = settings.toObject();

  // Mask sensitive fields
  obj.smtpPassMasked   = obj.smtpPassEncrypted   ? '••••••' : '';
  obj.smsApiKeyMasked  = obj.smsApiKeyEncrypted   ? '••••••' : '';

  // Remove raw encrypted values from response
  delete obj.smtpPassEncrypted;
  delete obj.smsApiKeyEncrypted;

  // Add config status flags for frontend warnings
  obj.smtpConfigured  = !!(settings.smtpHost && settings.smtpUser && settings.smtpPassEncrypted);
  obj.smsConfigured   = !!settings.smsApiKeyEncrypted;

  return res.json({ success: true, data: obj });
});


// ═══════════════════════════════════════════════════════════════════
// ── POST /toggles — Update login method & feature toggles ────────
// ═══════════════════════════════════════════════════════════════════
router.post('/toggles',
  body('emailLoginEnabled').optional().isBoolean(),
  body('phoneLoginEnabled').optional().isBoolean(),
  body('featureOrdersEnabled').optional().isBoolean(),
  body('featureTrackEnabled').optional().isBoolean(),
  body('featureChatEnabled').optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const settings = await AuthSettings.getSettings();
    const {
      emailLoginEnabled, phoneLoginEnabled,
      featureOrdersEnabled, featureTrackEnabled, featureChatEnabled,
    } = req.body;

    // Determine resulting toggle states
    const nextEmail = emailLoginEnabled !== undefined ? emailLoginEnabled : settings.emailLoginEnabled;
    const nextPhone = phoneLoginEnabled !== undefined ? phoneLoginEnabled : settings.phoneLoginEnabled;

    // At least one login method must remain enabled
    if (!nextEmail && !nextPhone) {
      return res.status(400).json({
        success: false,
        message: 'At least one login method (email or phone) must be enabled.',
      });
    }

    // Apply updates
    if (emailLoginEnabled !== undefined)   settings.emailLoginEnabled   = emailLoginEnabled;
    if (phoneLoginEnabled !== undefined)   settings.phoneLoginEnabled   = phoneLoginEnabled;
    if (featureOrdersEnabled !== undefined) settings.featureOrdersEnabled = featureOrdersEnabled;
    if (featureTrackEnabled !== undefined)  settings.featureTrackEnabled  = featureTrackEnabled;
    if (featureChatEnabled !== undefined)   settings.featureChatEnabled   = featureChatEnabled;

    await settings.save();

    return res.json({ success: true, message: 'Toggles updated', data: settings });
  },
);


// ═══════════════════════════════════════════════════════════════════
// ── POST /smtp — Save SMTP configuration ─────────────────────────
// ═══════════════════════════════════════════════════════════════════
router.post('/smtp',
  body('smtpHost').trim().notEmpty().withMessage('SMTP host is required'),
  body('smtpPort').isInt({ min: 1, max: 65535 }).withMessage('Invalid port'),
  body('smtpUser').trim().notEmpty().withMessage('SMTP username is required'),
  body('smtpFromName').trim().notEmpty().withMessage('From name is required'),
  body('smtpFromEmail').isEmail().withMessage('Invalid from email'),
  body('smtpEncryption').isIn(['TLS', 'SSL']).withMessage('Encryption must be TLS or SSL'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const settings = await AuthSettings.getSettings();
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFromName, smtpFromEmail, smtpEncryption } = req.body;

    settings.smtpHost       = smtpHost;
    settings.smtpPort       = parseInt(smtpPort, 10);
    settings.smtpUser       = smtpUser;
    settings.smtpFromName   = smtpFromName;
    settings.smtpFromEmail  = smtpFromEmail;
    settings.smtpEncryption = smtpEncryption;

    // Only update password if a new one was provided (blank = keep existing)
    if (smtpPass && smtpPass.trim() !== '') {
      settings.smtpPassEncrypted = encrypt(smtpPass.trim());
    }

    await settings.save();

    return res.json({ success: true, message: 'SMTP settings saved' });
  },
);


// ═══════════════════════════════════════════════════════════════════
// ── POST /smtp/test — Send a test email ──────────────────────────
// ═══════════════════════════════════════════════════════════════════
router.post('/smtp/test', async (req, res) => {
  const settings = await AuthSettings.getSettings();

  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassEncrypted) {
    return res.status(400).json({ success: false, message: 'SMTP not configured. Save settings first.' });
  }

  try {
    const pass = decrypt(settings.smtpPassEncrypted);

    const transporter = nodemailer.createTransport({
      host:   settings.smtpHost,
      port:   settings.smtpPort || 587,
      secure: settings.smtpEncryption === 'SSL',
      auth: { user: settings.smtpUser, pass },
    });

    // Send test email to the admin's own email
    const adminEmail = req.admin.email;
    await transporter.sendMail({
      from:    `"${settings.smtpFromName || 'Hashlay'}" <${settings.smtpFromEmail || settings.smtpUser}>`,
      to:      adminEmail,
      subject: '✅ SMTP Test — Hashlay Customer Auth',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8f9fa;border-radius:12px;">
          <h2 style="color:#22c55e;margin:0 0 12px;">✅ SMTP Connection Successful</h2>
          <p style="color:#374151;margin:0 0 8px;">Your Customer Auth SMTP settings are configured correctly.</p>
          <p style="color:#6b7280;font-size:13px;margin:0;">
            Host: ${settings.smtpHost}:${settings.smtpPort} (${settings.smtpEncryption})<br>
            Sent at: ${new Date().toLocaleString()}
          </p>
        </div>
      `,
    });

    return res.json({ success: true, message: `Test email sent to ${adminEmail}` });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `SMTP test failed: ${err.message}`,
    });
  }
});


// ═══════════════════════════════════════════════════════════════════
// ── POST /sms — Save SMS gateway configuration ──────────────────
// ═══════════════════════════════════════════════════════════════════
router.post('/sms',
  body('smsGatewayUrl').optional().isURL().withMessage('Invalid gateway URL'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const settings = await AuthSettings.getSettings();
    const { smsApiKey, smsSenderId, smsGatewayUrl, smsRoute } = req.body;

    if (smsSenderId  !== undefined) settings.smsSenderId   = smsSenderId;
    if (smsGatewayUrl !== undefined) settings.smsGatewayUrl = smsGatewayUrl;
    if (smsRoute      !== undefined) settings.smsRoute      = smsRoute;

    // Only update API key if a new one was provided
    if (smsApiKey && smsApiKey.trim() !== '') {
      settings.smsApiKeyEncrypted = encrypt(smsApiKey.trim());
    }

    await settings.save();

    return res.json({ success: true, message: 'SMS settings saved' });
  },
);


// ═══════════════════════════════════════════════════════════════════
// ── POST /sms/test — Send a test SMS ─────────────────────────────
// ═══════════════════════════════════════════════════════════════════
router.post('/sms/test',
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const settings = await AuthSettings.getSettings();

    if (!settings.smsApiKeyEncrypted) {
      return res.status(400).json({ success: false, message: 'SMS API key not configured. Save settings first.' });
    }

    try {
      const apiKey     = decrypt(settings.smsApiKeyEncrypted);
      const gatewayUrl = settings.smsGatewayUrl || 'https://www.fast2sms.com/dev/bulkV2';
      const senderId   = settings.smsSenderId   || 'FSTSMS';
      const route      = settings.smsRoute      || 'v3';
      const phone      = req.body.phone.replace(/^\+91/, '').replace(/\D/g, '');

      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          route,
          sender_id: senderId,
          message:   'This is a test SMS from Hashlay Customer Auth settings. If you received this, your SMS gateway is working!',
          flash:     0,
          numbers:   phone,
        }),
      });

      const result = await response.json();

      if (response.ok && result.return) {
        return res.json({ success: true, message: `Test SMS sent to ${phone}` });
      }

      return res.status(500).json({
        success: false,
        message: `SMS gateway error: ${result.message || 'Unknown error'}`,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: `SMS test failed: ${err.message}`,
      });
    }
  },
);


module.exports = router;
