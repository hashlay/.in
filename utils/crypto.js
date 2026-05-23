// ── utils/crypto.js ──────────────────────────────────────────────
// AES-256-CBC encrypt / decrypt helpers for storing sensitive
// credentials at rest (SMTP passwords, SMS API keys, etc.).
// Requires ENCRYPTION_KEY (64-char hex = 32 bytes) in .env.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

/**
 * Derive the 32-byte key buffer from the hex ENCRYPTION_KEY env var.
 * Accepts either a raw 64-char hex string (preferred) or an arbitrary
 * passphrase (hashed to 32 bytes via SHA-256 for convenience).
 */
function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY is not set in environment');
  // If it looks like a 64-char hex string, use it directly
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  // Otherwise hash it to 32 bytes (convenience for dev)
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypt plaintext → "iv:ciphertext" (both hex-encoded).
 * @param  {string} text  Plaintext to encrypt
 * @return {string}       "iv:ciphertext" hex string
 */
function encrypt(text) {
  if (!text) return text;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt "iv:ciphertext" → plaintext.
 * @param  {string} text  Encrypted string in "iv:ciphertext" format
 * @return {string}       Decrypted plaintext
 */
function decrypt(text) {
  if (!text) return text;
  const key = getKey();
  const [ivHex, encryptedHex] = text.split(':');
  if (!ivHex || !encryptedHex) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };
