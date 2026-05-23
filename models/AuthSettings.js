const mongoose = require('mongoose');

// ── Auth Settings (singleton) ─────────────────────────────────────
// Always exactly one document in this collection. Managed from the
// admin panel. Stores encrypted credentials for SMTP and SMS
// gateways, login-method toggles, and customer-portal feature flags.

const authSettingsSchema = new mongoose.Schema({
  // ── Login method toggles ──
  emailLoginEnabled: { type: Boolean, default: true },
  phoneLoginEnabled: { type: Boolean, default: false },

  // ── SMTP / Email gateway ──
  smtpHost:          { type: String },
  smtpPort:          { type: Number },
  smtpUser:          { type: String },
  smtpPassEncrypted: { type: String },            // AES-256 encrypted
  smtpFromName:      { type: String },
  smtpFromEmail:     { type: String },
  smtpEncryption:    { type: String, enum: ['TLS', 'SSL'] },

  // ── SMS gateway ──
  smsApiKeyEncrypted: { type: String },            // AES-256 encrypted
  smsSenderId:        { type: String },
  smsGatewayUrl:      { type: String, default: 'https://www.fast2sms.com/dev/bulkV2' },
  smsRoute:           { type: String },

  // ── Customer portal feature flags ──
  featureOrdersEnabled: { type: Boolean, default: true },
  featureTrackEnabled:  { type: Boolean, default: true },
  featureChatEnabled:   { type: Boolean, default: true },

  updatedAt: { type: Date, default: Date.now },
});

// ── Helper: always returns the single settings document ──
authSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

// Auto-update `updatedAt` on save
authSettingsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AuthSettings', authSettingsSchema);
