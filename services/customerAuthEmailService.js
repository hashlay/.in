/**
 * Customer Auth Email Service
 * Separate SMTP transporter for customer OTP/auth emails.
 * Uses config stored in DB (Settings key: 'customerAuth') — falls back to .env SMTP.
 * This is SEPARATE from the order confirmation email transporter.
 */
const nodemailer = require('nodemailer');
const { Settings } = require('../models/index');
const logger = require('../config/logger');

let cachedTransporter = null;
let cachedConfigHash = null;

/**
 * Get or create the customer auth SMTP transporter.
 * Re-creates if settings have changed.
 */
async function getAuthTransporter() {
  let config;
  try {
    const setting = await Settings.findOne({ key: 'customerAuth' }).lean();
    config = setting?.value || {};
  } catch { config = {}; }

  const smtpHost = config.smtpHost || process.env.CUSTOMER_SMTP_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(config.smtpPort || process.env.CUSTOMER_SMTP_PORT || process.env.SMTP_PORT || 587);
  const smtpUser = config.smtpUser || process.env.CUSTOMER_SMTP_USER || process.env.SMTP_USER;
  const smtpPass = config.smtpPass || process.env.CUSTOMER_SMTP_PASS || process.env.SMTP_PASS;
  const fromName = config.smtpFromName || process.env.CUSTOMER_SMTP_FROM_NAME || process.env.FROM_NAME || 'Hashlay';
  const fromEmail = config.smtpFromEmail || process.env.CUSTOMER_SMTP_FROM_EMAIL || process.env.FROM_EMAIL;

  // Simple hash to detect config changes
  const configHash = `${smtpHost}:${smtpPort}:${smtpUser}:${smtpPass}`;
  if (cachedTransporter && cachedConfigHash === configHash) {
    return { transporter: cachedTransporter, fromName, fromEmail };
  }

  cachedTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });
  cachedConfigHash = configHash;

  return { transporter: cachedTransporter, fromName, fromEmail };
}

/**
 * Send OTP verification email
 */
async function sendOtpEmail(email, otp) {
  try {
    const { transporter, fromName, fromEmail } = await getAuthTransporter();

    const html = `
      <div style="font-family:'DM Sans',Arial,sans-serif;max-width:480px;margin:auto;background:#080810;color:#fff;padding:2.5rem;border-radius:16px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 20px 40px rgba(0,0,0,0.8);">
        <div style="text-align:center;margin-bottom:2rem;border-bottom:1px solid #1e1e35;padding-bottom:1.5rem;">
          <h1 style="color:#0057ff;font-size:2rem;letter-spacing:.12em;margin:0;font-weight:800;">HASHLAY</h1>
          <p style="color:#6b7280;font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;margin:.4rem 0 0;font-weight:700;">Protect What Moves You</p>
        </div>
        <h2 style="font-size:1.3rem;margin-top:0;font-weight:700;text-align:center;color:#fff;">Your Verification Code</h2>
        <p style="color:#9999bb;line-height:1.6;font-size:.9rem;text-align:center;">Use the code below to verify your identity. This code is valid for <strong style="color:#fff;">10 minutes</strong>.</p>
        <div style="text-align:center;margin:2rem 0;">
          <div style="display:inline-block;background:#0f0f1a;border:2px solid rgba(0,87,255,0.3);border-radius:12px;padding:1.2rem 2.5rem;letter-spacing:.5em;font-size:2.2rem;font-weight:800;color:#0057ff;font-family:'Courier New',monospace;">
            ${otp}
          </div>
        </div>
        <p style="color:#6b7280;font-size:.78rem;text-align:center;line-height:1.5;">
          If you didn't request this code, you can safely ignore this email.<br>
          Do not share this code with anyone.
        </p>
        <div style="text-align:center;margin-top:2rem;border-top:1px solid #1e1e35;padding-top:1rem;">
          <p style="color:#0057ff;font-weight:700;font-size:.8rem;letter-spacing:.1em;margin:0;text-transform:uppercase;">Hashlay — Protect What Moves You</p>
        </div>
      </div>`;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: `Your verification code is ${otp}`,
      html,
      text: `Your Hashlay verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
    });

    logger.info(`[CustomerAuth] OTP email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error(`[CustomerAuth] OTP email failed for ${email}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Send OTP via SMS (Fast2SMS)
 */
async function sendOtpSms(phone, otp) {
  try {
    let config;
    try {
      const setting = await Settings.findOne({ key: 'customerAuth' }).lean();
      config = setting?.value || {};
    } catch { config = {}; }

    const apiKey = config.smsApiKey || process.env.FAST2SMS_API_KEY;
    const senderId = config.smsSenderId || process.env.FAST2SMS_SENDER_ID || 'FSTSMS';
    const gatewayUrl = config.smsGatewayUrl || process.env.FAST2SMS_GATEWAY_URL || 'https://www.fast2sms.com/dev/bulkV2';
    const route = config.smsRoute || process.env.FAST2SMS_ROUTE || 'otp';

    if (!apiKey) {
      logger.warn('[CustomerAuth] SMS gateway not configured — no API key');
      return { success: false, error: 'SMS gateway not configured' };
    }

    // Clean phone number — remove country code prefix if present
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
      cleanPhone = cleanPhone.substring(2);
    }

    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route,
        variables_values: otp,
        numbers: cleanPhone,
        flash: 0,
      }),
    });

    const data = await response.json();
    if (data.return === true || data.status_code === 200) {
      logger.info(`[CustomerAuth] OTP SMS sent to ${cleanPhone.substring(0, 4)}****`);
      return { success: true };
    } else {
      logger.error(`[CustomerAuth] SMS failed: ${JSON.stringify(data)}`);
      return { success: false, error: data.message || 'SMS sending failed' };
    }
  } catch (err) {
    logger.error(`[CustomerAuth] SMS error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Test SMTP connection
 */
async function testSmtpConnection() {
  try {
    const { transporter } = await getAuthTransporter();
    await transporter.verify();
    return { success: true, message: 'SMTP connection successful' };
  } catch (err) {
    return { success: false, message: `SMTP connection failed: ${err.message}` };
  }
}

module.exports = { sendOtpEmail, sendOtpSms, testSmtpConnection, getAuthTransporter };
