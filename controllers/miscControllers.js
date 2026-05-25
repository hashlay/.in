// ══════════════════════════════════════════════════════════════════
// REVIEWS CONTROLLER
// ══════════════════════════════════════════════════════════════════
const { Review, Coupon, FAQ, Chatbot, Notification, ActivityLog,
        NotifyList, Contact, Campaign } = require('../models/index');
const Product  = require('../models/Product');
const Customer = require('../models/Customer');
const Admin    = require('../models/Admin');
const { notifyNewReview, notifyGeneral } = require('../services/notificationService');
const { sendCampaignEmail } = require('../services/emailService');
const csv = require('fast-csv');
const { getOrSet, invalidate } = require('../config/cache');

// ── Reviews ─────────────────────────────────────────────────────
exports.getReviews = async (req, res) => {
  const { page=1, limit=20, status, product } = req.query;
  const query = {};
  if (status)  query.status  = status;
  if (product) query.product = product;
  const opts = { page:+page, limit:+limit, sort:'-createdAt', lean:true,
    populate: { path:'product', select:'name images' } };
  const result = await Review.paginate(query, opts);
  res.json({ success:true, data: result });
};

exports.createReview = async (req, res) => {
  try {
    const reviewData = {
      product: req.body.product,
      customer: req.body.customer,
      name: req.body.name,
      email: req.body.email,
      rating: req.body.rating,
      title: req.body.title,
      body: req.body.body || req.body.text,
      images: req.body.images || [],
    };

    if (!reviewData.name || !reviewData.body || !reviewData.rating) {
      return res.status(400).json({ success:false, message:'Name, rating and review text are required' });
    }

    const review = await Review.create(reviewData);
    await notifyNewReview(review);
    invalidate('reviews:');
    res.status(201).json({ success:true, data:review, message:'Review submitted for approval' });
  } catch (error) {
    res.status(400).json({ success:false, message:'Review submission failed', error: error.message });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, req.body, { new:true });
    if (!review) return res.status(404).json({ success:false, message:'Review not found' });
    if (req.body.status === 'approved') {
      const reviews = await Review.find({ product:review.product, status:'approved' });
      const avg = reviews.reduce((s,r)=>s+r.rating,0) / reviews.length;
      await Product.findByIdAndUpdate(review.product, { 'ratings.average':+avg.toFixed(1), 'ratings.count':reviews.length });
    }
    invalidate('reviews:');
    res.json({ success:true, data:review, message:'Review updated' });
  } catch (error) {
    res.status(400).json({ success:false, message:'Update failed', error: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    invalidate('reviews:');
    res.json({ success:true, message:'Review deleted' });
  } catch (error) {
    res.status(400).json({ success:false, message:'Delete failed', error: error.message });
  }
};

exports.getProductReviews = async (req, res) => {
  try {
    const reviews = await getOrSet(`reviews:product:${req.params.id}`, 60, async () => {
      return Review.find({ product:req.params.id, status:'approved' }).sort('-createdAt').lean();
    });
    res.json({ success:true, data:reviews });
  } catch (error) {
    res.status(400).json({ success:false, message:'Fetch failed', error: error.message });
  }
};

// ── Coupons ──────────────────────────────────────────────────────
exports.getCoupons = async (req, res) => {
  const coupons = await Coupon.find({}).sort('-createdAt');
  res.json({ success:true, data:coupons });
};
exports.createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ success:true, data:coupon, message:'Coupon created' });
  } catch (error) {
    res.status(400).json({ success:false, message:'Coupon creation failed', error: error.message });
  }
};
exports.updateCoupon = async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new:true });
  if (!coupon) return res.status(404).json({ success:false, message:'Not found' });
  res.json({ success:true, data:coupon, message:'Coupon updated' });
};
exports.deleteCoupon = async (req, res) => {
  await Coupon.findByIdAndDelete(req.params.id);
  res.json({ success:true, message:'Coupon deleted' });
};

// ── Campaigns ────────────────────────────────────────────────────
exports.getCampaigns = async (req, res) => {
  const campaigns = await Campaign.find({}).sort('-createdAt');
  res.json({ success:true, data:campaigns });
};
exports.createCampaign = async (req, res) => {
  const campaign = await Campaign.create(req.body);
  res.status(201).json({ success:true, data:campaign, message:'Campaign created' });
};
exports.sendCampaign = async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ success:false, message:'Not found' });

  let customers;
  if (campaign.type === 'email') {
    const q = { isActive:true, emailOptIn:true };
    if (campaign.audience === 'new')       { const d=new Date(); d.setDate(d.getDate()-30); q.createdAt={ $gte:d }; }
    if (campaign.audience === 'repeat')    q.totalOrders = { $gt:1 };
    if (campaign.audience === 'high_spenders') q.totalSpend = { $gt:5000 };
    if (campaign.audience === 'accounts_no_orders') {
      q.totalOrders = { $in: [0, null] };
      q.$or = [{ password: { $exists: true, $ne: null } }, { passwordHash: { $exists: true, $ne: null } }];
    }
    if (campaign.audience === 'all_accounts') {
      q.$or = [{ password: { $exists: true, $ne: null } }, { passwordHash: { $exists: true, $ne: null } }];
    }
    customers = await Customer.find(q).select('email name').lean();
    const emails = customers.map(c=>c.email).filter(Boolean);
    await sendCampaignEmail(emails, campaign.subject || campaign.name, campaign.message);
    campaign.status   = 'sent';
    campaign.sentAt   = new Date();
    campaign.sentCount = emails.length;
    await campaign.save();
    res.json({ success:true, message:`Campaign sent to ${emails.length} customers` });
  } else {
    res.json({ success:true, message:'SMS campaign queued (configure SMS provider in env)' });
  }
};
exports.deleteCampaign = async (req, res) => {
  await Campaign.findByIdAndDelete(req.params.id);
  res.json({ success:true, message:'Campaign deleted' });
};

// ── FAQs ─────────────────────────────────────────────────────────
exports.getFaqs = async (req, res) => {
  try {
    const isActive = req.query.active==='true';
    const cacheKey = `faqs:list:${isActive}`;
    const faqs = await getOrSet(cacheKey, 120, async () => {
      const q = isActive ? { isActive:true } : {};
      return FAQ.find(q).sort('order -createdAt').lean();
    });
    res.json({ success:true, data:faqs });
  } catch (error) {
    res.status(400).json({ success:false, message:'Fetch failed', error: error.message });
  }
};
exports.createFaq = async (req, res) => {
  try {
    const faq = await FAQ.create(req.body);
    invalidate('faqs:');
    res.status(201).json({ success:true, data:faq, message:'FAQ created' });
  } catch (error) {
    res.status(400).json({ success:false, message:'Creation failed', error: error.message });
  }
};
exports.updateFaq = async (req, res) => {
  try {
    const faq = await FAQ.findByIdAndUpdate(req.params.id, req.body, { new:true });
    if (!faq) return res.status(404).json({ success:false, message:'FAQ not found' });
    invalidate('faqs:');
    res.json({ success:true, data:faq, message:'FAQ updated' });
  } catch (error) {
    res.status(400).json({ success:false, message:'Update failed', error: error.message });
  }
};
exports.deleteFaq = async (req, res) => {
  try {
    await FAQ.findByIdAndDelete(req.params.id);
    invalidate('faqs:');
    res.json({ success:true, message:'FAQ deleted' });
  } catch (error) {
    res.status(400).json({ success:false, message:'Delete failed', error: error.message });
  }
};

// ── Chatbot ──────────────────────────────────────────────────────
exports.getChatbotRules = async (req, res) => {
  const rules = await Chatbot.find().sort('-createdAt');
  res.json({ success:true, data:rules });
};

exports.getChatbotQueries = async (req, res) => {
  const { ChatbotQuery } = require('../models');
  if (!ChatbotQuery) return res.json({ success:true, data:[] });
  const queries = await ChatbotQuery.find().sort('-createdAt').limit(20);
  res.json({ success:true, data:queries });
};
exports.createChatbotRule = async (req, res) => {
  const rule = await Chatbot.create(req.body);
  res.status(201).json({ success:true, data:rule });
};
exports.updateChatbotRule = async (req, res) => {
  const rule = await Chatbot.findByIdAndUpdate(req.params.id, req.body, { new:true });
  res.json({ success:true, data:rule });
};
exports.deleteChatbotRule = async (req, res) => {
  await Chatbot.findByIdAndDelete(req.params.id);
  res.json({ success:true, message:'Rule deleted' });
};
exports.matchChatbot = async (req, res) => {
  const { message } = req.body;
  if (!message) return res.json({ success:true, reply:null });
  const words = message.toLowerCase().split(/\s+/);
  // Cache chatbot rules for 120s — they rarely change
  const rules = await getOrSet('chatbot:activeRules', 120, async () => {
    return Chatbot.find({ isActive:true }).lean();
  });
  let best = null, bestScore = 0;
  for (const rule of rules) {
    const score = (rule.keywords||[]).filter(k=>words.some(w=>w.includes(k))).length;
    if (score > bestScore) { bestScore=score; best=rule; }
  }
  
  if (best) {
    best.triggerCount = (best.triggerCount||0)+1;
    await Chatbot.findByIdAndUpdate(best._id, {$inc:{triggerCount:1}});
  }

  // Log the query
  const { ChatbotQuery } = require('../models');
  if (ChatbotQuery) {
    await ChatbotQuery.create({
      query: message,
      resolved: !!best
    }).catch(e => console.error('Failed to log chatbot query:', e));
  }
  
  const defaultReply = "I'm not sure about that. Please contact us at contacthashlay@gmail.com or WhatsApp us at +917483138340.";
  res.json({ success:true, reply: best?.response || defaultReply });
};

// ── Notifications ─────────────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  const { page=1, limit=30, unread } = req.query;
  const q = unread==='true' ? { read:false } : {};
  const opts = { page:+page, limit:+limit, sort:'-createdAt', lean:true };
  const result = await Notification.paginate(q, opts);
  const unreadCount = await Notification.countDocuments({ read:false });
  res.json({ success:true, data: result, unreadCount });
};
exports.markRead = async (req, res) => {
  if (req.params.id === 'all') await Notification.updateMany({}, { read:true });
  else await Notification.findByIdAndUpdate(req.params.id, { read:true });
  res.json({ success:true, message:'Marked as read' });
};
exports.clearNotifications = async (req, res) => {
  await Notification.deleteMany({});
  res.json({ success:true, message:'All notifications cleared' });
};

// ── Activity Log ─────────────────────────────────────────────────
exports.getActivityLog = async (req, res) => {
  const { page=1, limit=50, module, admin, adminName, from, to, search } = req.query;
  const q = {};
  if (module && module !== 'all') q.module = module;
  if (admin)  q.admin = admin;
  if (adminName && adminName !== 'all') q.adminName = new RegExp(adminName, 'i');
  if (search) {
    q.$or = [
      { action: new RegExp(search, 'i') },
      { details: new RegExp(search, 'i') },
      { adminName: new RegExp(search, 'i') },
    ];
  }
  if (from||to) { q.createdAt={}; if(from) q.createdAt.$gte=new Date(from); if(to) q.createdAt.$lte=new Date(to); }
  const opts = { page:+page, limit:+limit, sort:'-createdAt', lean:true };
  const result = await ActivityLog.paginate(q, opts);
  
  // Also get distinct admin names for the user filter dropdown
  const Admin = require('../models/Admin');
  const admins = await Admin.find({}).select('name email');
  const adminNames = admins.map(a => a.name || a.email);
  adminNames.push('Customer'); // Customer site actions

  res.json({ success:true, data: result, adminNames });
};
exports.exportActivityLog = async (req, res) => {
  const q = {};
  if (req.query.from || req.query.to) {
    q.createdAt = {};
    if (req.query.from) q.createdAt.$gte = new Date(req.query.from);
    if (req.query.to)   q.createdAt.$lte = new Date(req.query.to + 'T23:59:59');
  }
  if (req.query.module && req.query.module !== 'all') q.module = req.query.module;
  if (req.query.adminName && req.query.adminName !== 'all') q.adminName = new RegExp(req.query.adminName, 'i');
  const logs = await ActivityLog.find(q).sort('-createdAt').limit(5000).lean();
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename=activity-log.csv');
  const s = csv.format({ headers:true });
  s.pipe(res);
  logs.forEach(l=>s.write({ Admin:l.adminName||'System', Module:l.module, Action:l.action, Details:l.details||'', Status:l.status, IP:l.ip||'', Date:new Date(l.createdAt).toLocaleString('en-IN') }));
  s.end();
};

exports.trackActivity = async (req, res) => {
  try {
    const { action, module, details } = req.body;
    await ActivityLog.create({
      adminName: 'Customer',
      action: action || 'STOREFRONT_EVENT',
      module: module || 'customer',
      details: details || '',
      ip: req.ip
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false });
  }
};

// ── Notify List ──────────────────────────────────────────────────
exports.getNotifyList = async (req, res) => {
  const { search } = req.query;
  const q = search ? { $or:[{name:new RegExp(search,'i')},{email:new RegExp(search,'i')},{phone:new RegExp(search,'i')}] } : {};
  const list = await NotifyList.find(q).sort('-createdAt');
  res.json({ success:true, data:list });
};
exports.createNotify = async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ success:false, message:'Name, email and phone are required' });
    }
    const n = await NotifyList.create({ name, email, phone, address, source: req.body.source || 'website' });
    res.status(201).json({ success:true, data:n, message:'Added to notification list' });
  } catch (error) {
    res.status(400).json({ success:false, message:'Signup failed', error: error.message });
  }
};
exports.deleteNotify = async (req, res) => {
  await NotifyList.findByIdAndDelete(req.params.id);
  res.json({ success:true, message:'Deleted' });
};
exports.exportNotifyCSV = async (req, res) => {
  const q = {};
  if (req.query.from || req.query.to) {
    q.createdAt = {};
    if (req.query.from) q.createdAt.$gte = new Date(req.query.from);
    if (req.query.to)   q.createdAt.$lte = new Date(req.query.to + 'T23:59:59');
  }
  const list = await NotifyList.find(q).sort('-createdAt').lean();
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename=notify-list.csv');
  const s = csv.format({ headers:true });
  s.pipe(res);
  list.forEach(n=>s.write({ Name:n.name, Email:n.email, Phone:n.phone||'', Address:n.address||'', Source:n.source||'website', Date:new Date(n.createdAt).toLocaleDateString('en-IN') }));
  s.end();
};

// ── Contacts ─────────────────────────────────────────────────────
exports.getContacts = async (req, res) => {
  const { status } = req.query;
  const q = status ? { status } : {};
  const contacts = await Contact.find(q).sort('-createdAt');
  res.json({ success:true, data:contacts });
};
exports.createContact = async (req, res) => {
  try {
    const { name, email, message, phone } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success:false, message:'Name, email and message are required' });
    }
    const contact = await Contact.create({ name, email, phone, message });
    await notifyGeneral({ type:'system', title:'New Contact Message', message:`${name} sent a message`, link:'/contact' });
    res.status(201).json({ success:true, data:contact, message:'Thank you for contacting us' });
  } catch (error) {
    res.status(400).json({ success:false, message:'Message submission failed', error: error.message });
  }
};
exports.updateContact = async (req, res) => {
  const contact = await Contact.findByIdAndUpdate(req.params.id, req.body, { new:true });
  res.json({ success:true, data:contact });
};
exports.deleteContact = async (req, res) => {
  await Contact.findByIdAndDelete(req.params.id);
  res.json({ success:true, message:'Deleted' });
};
exports.exportContactsCSV = async (req, res) => {
  const q = {};
  if (req.query.from || req.query.to) {
    q.createdAt = {};
    if (req.query.from) q.createdAt.$gte = new Date(req.query.from);
    if (req.query.to)   q.createdAt.$lte = new Date(req.query.to + 'T23:59:59');
  }
  const contacts = await Contact.find(q).sort('-createdAt').lean();
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename=contact-messages.csv');
  const s = csv.format({ headers:true });
  s.pipe(res);
  contacts.forEach(c=>s.write({ Name:c.name, Email:c.email, Phone:c.phone||'', Message:c.message, Status:c.status||'new', Date:new Date(c.createdAt).toLocaleDateString('en-IN') }));
  s.end();
};

// ── Admins ───────────────────────────────────────────────────────
exports.getAdmins = async (req, res) => {
  try {
    const admins = await Admin.find({ isActive: { $ne: false } }).sort('-createdAt').lean();
    const safe = admins.map(a => {
      const obj = { ...a };
      delete obj.password;
      return obj;
    });
    res.json({ success: true, data: safe });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch admins', error: error.message });
  }
};
exports.createAdmin = async (req, res) => {
  if (req.admin.role !== 'super_admin' && req.admin.role !== 'admin') {
    return res.status(403).json({ success:false, message:'Unauthorized' });
  }
  if (req.body.role === 'super_admin' && req.admin.role !== 'super_admin') {
    return res.status(403).json({ success:false, message:'Only a super_admin can create another super_admin' });
  }
  const admin = await Admin.create(req.body);
  
  await ActivityLog.create({
    admin: req.admin._id,
    adminName: req.admin.name || req.admin.email,
    action: 'CREATE_ADMIN',
    module: 'admin',
    details: `Created new admin user: ${admin.name || admin.email} (${admin.role})`,
    ip: req.ip
  });

  res.status(201).json({ success:true, data:admin.toSafeObject(), message:'Admin created' });
};
exports.updateAdmin = async (req, res) => {
  if (req.admin.role !== 'super_admin' && req.admin.role !== 'admin') {
    return res.status(403).json({ success:false, message:'Unauthorized' });
  }
  const { password, ...data } = req.body;
  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ success:false, message:'Admin not found' });
  if (admin.role === 'super_admin' && req.admin.role !== 'super_admin') {
    return res.status(403).json({ success:false, message:'Cannot edit a super_admin' });
  }
  Object.assign(admin, data);
  if (password) admin.password = password;
  await admin.save();

  await ActivityLog.create({
    admin: req.admin._id,
    adminName: req.admin.name || req.admin.email,
    action: 'UPDATE_ADMIN',
    module: 'admin',
    details: `Updated admin user: ${admin.name || admin.email}`,
    ip: req.ip
  });

  res.json({ success:true, data:admin.toSafeObject(), message:'Admin updated' });
};
exports.deleteAdmin = async (req, res) => {
  if (req.admin.role !== 'super_admin' && req.admin.role !== 'admin') {
    return res.status(403).json({ success:false, message:'Unauthorized' });
  }
  if (req.params.id === req.admin._id.toString())
    return res.status(400).json({ success:false, message:"Can't delete yourself" });
  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ success:false, message:'Admin not found' });
  if (admin.role === 'super_admin' && req.admin.role !== 'super_admin') {
    return res.status(403).json({ success:false, message:'Cannot delete a super_admin' });
  }
  await Admin.findByIdAndUpdate(req.params.id, { isActive:false });

  await ActivityLog.create({
    admin: req.admin._id,
    adminName: req.admin.name || req.admin.email,
    action: 'DELETE_ADMIN',
    module: 'admin',
    details: `Deactivated admin user: ${admin.name || admin.email}`,
    ip: req.ip
  });

  res.json({ success:true, message:'Admin deactivated' });
};

// ── Analytics ─────────────────────────────────────────────────────
const Order = require('../models/Order');
const SiteVisit = require('../models/SiteVisit');
const Cart = require('../models/Cart');
exports.getAnalytics = async (req, res) => {
  const { range='30d' } = req.query;
  const days = range==='7d'?7:range==='30d'?30:range==='3m'?90:365;
  const from = new Date(); from.setDate(from.getDate()-days); from.setHours(0,0,0,0);

  const prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate()-days);

  const [
    revenue, orders, customers, topProducts, avgOrder, totalCarts, convertedCarts, pageViews, trafficAgg,
    prevRevenue, prevOrders, prevPageViews, prevTotalCarts, prevConvertedCarts
  ] = await Promise.all([
    Order.aggregate([{ $match:{ createdAt:{$gte:from}, paymentStatus:'paid' } },{ $group:{ _id:null, total:{$sum:'$total'} } }]),
    Order.countDocuments({ createdAt:{ $gte:from } }),
    Customer.countDocuments({ createdAt:{ $gte:from } }),
    Order.aggregate([
      { $match:{ createdAt:{$gte:from} } },{ $unwind:'$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'productDoc' } },
      { $match: { 'productDoc.0': { $exists: true } } },
      { $group:{ _id:'$items.name', sales:{$sum:'$items.quantity'}, revenue:{$sum:'$items.total'} } },
      { $sort:{ sales:-1 } },{ $limit:10 },
    ]),
    Order.aggregate([{ $match:{ createdAt:{$gte:from} } },{ $group:{ _id:null, avg:{$avg:'$total'} } }]),
    Cart.countDocuments({ createdAt: { $gte: from } }),
    Cart.countDocuments({ createdAt: { $gte: from }, status: 'converted' }),
    SiteVisit.countDocuments({ createdAt: { $gte: from } }),
    SiteVisit.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]),
    // Previous period stats
    Order.aggregate([{ $match:{ createdAt:{$gte:prevFrom, $lt:from}, paymentStatus:'paid' } },{ $group:{ _id:null, total:{$sum:'$total'} } }]),
    Order.countDocuments({ createdAt:{ $gte:prevFrom, $lt:from } }),
    SiteVisit.countDocuments({ createdAt: { $gte:prevFrom, $lt:from } }),
    Cart.countDocuments({ createdAt: { $gte:prevFrom, $lt:from } }),
    Cart.countDocuments({ createdAt: { $gte:prevFrom, $lt:from }, status: 'converted' })
  ]);

  const totalCustomers = await Customer.countDocuments({ isActive: true });
  const conversionRate = pageViews > 0
    ? ((orders / pageViews) * 100).toFixed(1) + '%'
    : '0%';

  const abandonRateNum = totalCarts > 0 ? ((totalCarts - convertedCarts) / totalCarts) * 100 : 0;
  const abandonRate = abandonRateNum.toFixed(1) + '%';

  const trafficSources = { instagram: 0, whatsapp: 0, google: 0, facebook: 0, direct: 0, other: 0 };
  trafficAgg.forEach(t => {
    if (trafficSources[t._id] !== undefined) trafficSources[t._id] = t.count;
    else trafficSources.other += t.count;
  });

  // Calculate changes
  const calcChange = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const currentRevenue = revenue[0]?.total||0;
  const previousRevenue = prevRevenue[0]?.total||0;
  const currentAvgOrder = +(avgOrder[0]?.avg||0).toFixed(2);
  const previousAvgOrder = prevOrders > 0 ? +(previousRevenue / prevOrders).toFixed(2) : 0;
  
  const currentConvRate = pageViews > 0 ? (orders / pageViews) * 100 : 0;
  const previousConvRate = prevPageViews > 0 ? (prevOrders / prevPageViews) * 100 : 0;
  
  const prevAbandonRate = prevTotalCarts > 0 ? ((prevTotalCarts - prevConvertedCarts) / prevTotalCarts) * 100 : 0;

  const changes = {
    pageViews: calcChange(pageViews, prevPageViews),
    conversion: currentConvRate - previousConvRate, // Absolute change in %
    abandonment: abandonRateNum - prevAbandonRate, // Absolute change in %
    aov: calcChange(currentAvgOrder, previousAvgOrder)
  };

  res.json({
    success:true,
    data: {
      revenue: currentRevenue,
      orders,
      customers,
      avgOrderValue: currentAvgOrder,
      topProducts,
      conversionRate,
      pageViews,
      cartAbandonment: abandonRate,
      trafficSources,
      changes
    },
  });
};
