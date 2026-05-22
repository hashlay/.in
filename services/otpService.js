/**
 * OTP Service — Generate, send, and verify OTPs
 * Uses crypto for secure OTP generation and bcrypt for hashing
 */
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const OtpCode  = require('../models/OtpCode');
const logger   = require('../config/logger');

const OTP_EXPIRY_MINUTES = 10;
const OTP_RATE_LIMIT     = 3;   // max OTPs per identifier per 15 min
const OTP_RATE_WINDOW    = 15;  // minutes
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Generate a cryptographically secure 6-digit OTP
 */
function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Check rate limit — max OTP_RATE_LIMIT requests per OTP_RATE_WINDOW minutes
 */
async function checkRateLimit(identifier) {
  const windowStart = new Date(Date.now() - OTP_RATE_WINDOW * 60 * 1000);
  const count = await OtpCode.countDocuments({
    identifier: identifier.toLowerCase().trim(),
    createdAt: { $gte: windowStart },
  });
  return count < OTP_RATE_LIMIT;
}

/**
 * Create and store a new OTP for the given identifier
 * @returns {{ otp: string, expiresAt: Date }} — plaintext OTP (to send) and expiry
 */
async function createOtp(identifier, type = 'email') {
  const id = identifier.toLowerCase().trim();

  // Rate-limit check
  const allowed = await checkRateLimit(id);
  if (!allowed) {
    throw new Error('Too many OTP requests. Please wait 15 minutes.');
  }

  // Invalidate any previous unused OTPs for this identifier
  await OtpCode.updateMany(
    { identifier: id, used: false },
    { $set: { used: true } }
  );

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await OtpCode.create({
    identifier: id,
    otpHash,
    expiresAt,
    type,
  });

  logger.info(`[OTP] Created OTP for ${type}: ${id.substring(0, 4)}***`);
  return { otp, expiresAt };
}

/**
 * Verify an OTP for the given identifier
 * @returns {{ valid: boolean, message: string }}
 */
async function verifyOtp(identifier, code) {
  const id = identifier.toLowerCase().trim();

  // Find the latest unused, unexpired OTP for this identifier
  const otpDoc = await OtpCode.findOne({
    identifier: id,
    used: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    return { valid: false, message: 'OTP expired or not found. Please request a new one.' };
  }

  // Check max attempts
  if (otpDoc.attempts >= MAX_VERIFY_ATTEMPTS) {
    otpDoc.used = true;
    await otpDoc.save();
    return { valid: false, message: 'Too many failed attempts. Please request a new OTP.' };
  }

  // Increment attempts
  otpDoc.attempts += 1;

  // Compare OTP
  const isMatch = await bcrypt.compare(code.toString(), otpDoc.otpHash);
  if (!isMatch) {
    await otpDoc.save();
    return { valid: false, message: `Incorrect OTP. ${MAX_VERIFY_ATTEMPTS - otpDoc.attempts} attempts remaining.` };
  }

  // Mark as used
  otpDoc.used = true;
  await otpDoc.save();

  logger.info(`[OTP] Verified OTP for ${id.substring(0, 4)}***`);
  return { valid: true, message: 'OTP verified successfully.' };
}

module.exports = { generateOtp, createOtp, verifyOtp, checkRateLimit };
