const { Settings } = require('../models/index');
const { getOrSet, invalidate } = require('../config/cache');

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
  // Cache individual settings for 120s
  const data = await getOrSet(`settings:key:${req.params.key}`, 120, async () => {
    const setting = await Settings.findOne({ key: req.params.key }).lean();
    if (!setting) return DEFAULT_SETTINGS[req.params.key] || null;
    return setting.value;
  });
  res.json({ success: true, data });
};

// Public: get non-sensitive settings for customer website
exports.getPublic = async (req, res) => {
  // Cache public settings for 90s — called on every page load
  const result = await getOrSet('settings:public', 90, async () => {
    const keys = ['announcement', 'seo', 'banner', 'delivery', 'store', 'payment'];
    const settings = await Settings.find({ key: { $in: keys } }).lean();
    const data = {};
    for (const s of settings) {
      data[s.key] = s.value;
      // Strip sensitive payment data
      if (s.key === 'payment') {
        data[s.key] = {
          onlinePayment: s.value.onlinePayment,
          codEnabled: s.value.codEnabled,
          codCharge: s.value.codCharge,
          razorpayKeyId: s.value.razorpayKeyId, // Only key ID, never secret
        };
      }
    }
    // Merge defaults
    for (const k of keys) if (!data[k]) data[k] = DEFAULT_SETTINGS[k] || {};

    // Ensure Razorpay Key ID from .env is sent if DB is empty
    if (data.payment && !data.payment.razorpayKeyId && process.env.RAZORPAY_KEY_ID) {
      data.payment.razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    }

    return data;
  });

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

  // Bust settings caches on update
  invalidate('settings:');

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

  // Bust settings caches on batch update
  invalidate('settings:');

  res.json({ success: true, message: 'Settings saved' });
};

exports.delete = async (req, res) => {
  await Settings.deleteOne({ key: req.params.key });

  invalidate('settings:');

  res.json({ success: true, message: 'Setting deleted' });
};
