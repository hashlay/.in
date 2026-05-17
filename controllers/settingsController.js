const { Settings } = require('../models/index');

const DEFAULT_SETTINGS = {
  payment: {
    razorpayKeyId: '', razorpaySecret: '', onlinePayment: true,
    codEnabled: true, codCharge: 0,
  },
  delivery: { freeAbove: 999, charge: 49, codCharge: 0 },
  announcement: { enabled: false, text: '', coupon: '' },
  seo: { title: 'Hashlay', description: '', keywords: '', ogImage: '' },
  banner: { imageUrl: '', ctaText: 'Shop Now', ctaLink: '/products' },
  shipping: { zones: [] },
  store: { name: 'Hashlay', email: 'contacthashlay@gmail.com', phone: '', address: '' },
};

exports.getAll = async (req, res) => {
  const all = await Settings.find({}).lean();
  const result = {};
  for (const s of all) {
    result[s.key] = s.value;
    // Redact sensitive payment secrets — never expose via API
    if (s.key === 'payment' && result[s.key]?.razorpaySecret) {
      result[s.key].razorpaySecret = result[s.key].razorpaySecret
        ? '••••••' + result[s.key].razorpaySecret.slice(-4)
        : '';
    }
  }
  // Merge defaults for missing keys
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (!result[k]) result[k] = v;
  }
  res.json({ success: true, data: result });
};

exports.get = async (req, res) => {
  const setting = await Settings.findOne({ key: req.params.key });
  if (!setting) {
    const def = DEFAULT_SETTINGS[req.params.key];
    return res.json({ success: true, data: def || null });
  }
  res.json({ success: true, data: setting.value });
};

// Public: get non-sensitive settings for customer website
exports.getPublic = async (req, res) => {
  const keys = ['announcement', 'seo', 'banner', 'delivery', 'store', 'payment'];
  const settings = await Settings.find({ key: { $in: keys } }).lean();
  const result = {};
  for (const s of settings) {
    result[s.key] = s.value;
    // Strip sensitive payment data
    if (s.key === 'payment') {
      result[s.key] = {
        onlinePayment: s.value.onlinePayment,
        codEnabled: s.value.codEnabled,
        codCharge: s.value.codCharge,
        razorpayKeyId: s.value.razorpayKeyId, // Only key ID, never secret
      };
    }
  }
  // Merge defaults
  for (const k of keys) if (!result[k]) result[k] = DEFAULT_SETTINGS[k] || {};

  // Ensure Razorpay Key ID from .env is sent if DB is empty
  if (result.payment && !result.payment.razorpayKeyId && process.env.RAZORPAY_KEY_ID) {
    result.payment.razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  }

  res.json({ success: true, data: result });
};

exports.update = async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  const setting = await Settings.findOneAndUpdate(
    { key },
    { key, value, group: req.body.group || 'general', label: req.body.label || key },
    { new: true, upsert: true, runValidators: true }
  );

  res.json({ success: true, data: setting, message: `Settings "${key}" saved` });
};

exports.updateMany = async (req, res) => {
  const { settings } = req.body; // { key: value, ... }
  const ops = Object.entries(settings).map(([key, value]) => ({
    updateOne: {
      filter: { key },
      update: { $set: { key, value } },
      upsert: true,
    },
  }));
  await Settings.bulkWrite(ops);
  res.json({ success: true, message: 'Settings saved' });
};

exports.delete = async (req, res) => {
  await Settings.deleteOne({ key: req.params.key });
  res.json({ success: true, message: 'Setting deleted' });
};
