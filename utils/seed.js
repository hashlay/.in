require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const { Settings } = require('../models/index');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB for seeding...');

  // Require admin credentials from environment
  const adminEmail = process.env.ADMIN_DEFAULT_EMAIL;
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.error('❌ ADMIN_DEFAULT_EMAIL and ADMIN_DEFAULT_PASSWORD must be set in .env');
    process.exit(1);
  }
  if (adminPassword.length < 8) {
    console.error('❌ ADMIN_DEFAULT_PASSWORD must be at least 8 characters');
    process.exit(1);
  }

  // Create super admin
  const existingAdmin = await Admin.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await Admin.create({
      name: 'Hashlay Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'super_admin',
      permissions: {
        products: true, orders: true, customers: true,
        analytics: true, marketing: true, settings: true, admins: true,
      },
    });
    console.log('✅ Super admin created');
  } else {
    console.log('⚠️  Admin already exists');
  }

  // Default settings
  const defaults = [
    { key: 'payment', value: { razorpayKeyId: '', razorpayKeySecret: '', onlinePayment: true, codEnabled: true, codCharge: 0 } },
    { key: 'delivery', value: { freeAbove: 999, charge: 49, codCharge: 0 } },
    { key: 'announcement', value: { enabled: false, text: 'Free delivery on orders above ₹999!', coupon: '' } },
    { key: 'seo', value: { title: 'Hashlay — Deserved Care For Everything You Own', description: '', keywords: '', ogImage: '' } },
    { key: 'banner', value: { imageUrl: '', ctaText: 'Shop Now', ctaLink: '#products' } },
    { key: 'store', value: { name: 'Hashlay', email: 'contacthashlay@gmail.com', phone: '', address: '' } },
  ];

  for (const s of defaults) {
    await Settings.findOneAndUpdate({ key: s.key }, s, { upsert: true });
  }
  console.log('✅ Default settings seeded');

  await mongoose.disconnect();
  console.log('✅ Seeding complete');
  process.exit(0);
};

seed().catch(e => { console.error(e); process.exit(1); });
