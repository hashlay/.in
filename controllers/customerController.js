const Customer = require('../models/Customer');
const Order    = require('../models/Order');
const csv      = require('fast-csv');
const { notifyNewCustomer } = require('../services/notificationService');

exports.getCustomers = async (req, res) => {
  const { page = 1, limit = 20, search, filter, sort = '-createdAt' } = req.query;
  const query = { isActive: true, totalOrders: { $gt: 0 } };

  if (search) query.$or = [
    { name: new RegExp(search, 'i') },
    { email: new RegExp(search, 'i') },
    { phone: new RegExp(search, 'i') },
  ];

  let sortOpt = sort;
  if (filter === 'highspenders') sortOpt = '-totalSpend';
  else if (filter === 'new') {
    const d = new Date(); d.setDate(d.getDate() - 30);
    query.createdAt = { $gte: d };
  } else if (filter === 'repeat') query.totalOrders = { $gt: 1 };

  const opts = { page: parseInt(page), limit: parseInt(limit), sort: sortOpt, lean: true };
  const result = await Customer.paginate(query, opts);
  res.json({ success: true, data: result });
};

exports.getAccounts = async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const query = { isActive: true, $or: [ { password: { $exists: true, $ne: null } }, { passwordHash: { $exists: true, $ne: null } } ] };

  if (search) {
    query.$and = [
      { $or: query.$or },
      { $or: [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') },
      ] }
    ];
    delete query.$or;
  }

  const opts = { page: parseInt(page), limit: parseInt(limit), sort: '-createdAt', lean: true };
  const result = await Customer.paginate(query, opts);
  res.json({ success: true, data: result });
};

exports.getCustomer = async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
  const orders = await Order.find({ customer: req.params.id }).sort('-createdAt').limit(20).lean();
  res.json({ success: true, data: { ...customer.toObject(), orders } });
};

exports.createCustomer = async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address' });
  }
  const existing = await Customer.findOne({ email });
  if (existing) return res.status(409).json({ success: false, message: 'Email already registered' });
  const customer = await Customer.create({ name, email, phone, password });
  await notifyNewCustomer(customer);
  res.status(201).json({ success: true, data: customer, message: 'Customer created' });
};

exports.updateCustomer = async (req, res) => {
  const { password, ...data } = req.body;
  const customer = await Customer.findById(req.params.id).select('+password');
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

  Object.assign(customer, data);
  if (password) {
    customer.passwordHash = await require('bcryptjs').hash(password, 12);
  }
  await customer.save();

  const safeCustomer = customer.toObject();
  delete safeCustomer.password;
  delete safeCustomer.passwordHash;
  res.json({ success: true, data: safeCustomer, message: 'Customer updated' });
};

exports.deleteCustomer = async (req, res) => {
  await Customer.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true, message: 'Customer deactivated' });
};

exports.getCustomerOrders = async (req, res) => {
  const orders = await Order.find({ customer: req.params.id }).sort('-createdAt');
  res.json({ success: true, data: orders });
};

exports.exportCSV = async (req, res) => {
  const q = { isActive: true };
  if (req.query.from || req.query.to) {
    q.createdAt = {};
    if (req.query.from) q.createdAt.$gte = new Date(req.query.from);
    if (req.query.to)   q.createdAt.$lte = new Date(req.query.to + 'T23:59:59');
  }
  const customers = await Customer.find(q).sort('-totalSpend').lean();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
  const s = csv.format({ headers: true });
  s.pipe(res);
  customers.forEach(c => s.write({
    Name: c.name, Email: c.email, Phone: c.phone || '',
    TotalOrders: c.totalOrders, TotalSpend: c.totalSpend,
    Joined: new Date(c.createdAt).toLocaleDateString('en-IN'),
  }));
  s.end();
};

// Public: register customer from website
exports.register = async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address' });
  }
  const existing = await Customer.findOne({ email });
  if (existing) return res.status(409).json({ success: false, message: 'Email already registered' });
  const customer = await Customer.create({ name, email, phone, password });
  await notifyNewCustomer(customer);

  const { ActivityLog } = require('../models/index');
  await ActivityLog.create({
    adminName: 'Customer',
    action: 'REGISTER',
    module: 'customer',
    details: `${name} (${email}) created an account`,
    ip: req.ip
  });

  res.status(201).json({ success: true, message: 'Registered successfully', customerId: customer._id });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const customer = await Customer.findOne({ email }).select('+password');
  if (!customer || !customer.isActive)
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  const match = await customer.matchPassword(password);
  if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: customer._id, type: 'customer' }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const { password: _, ...safeCustomer } = customer.toObject();

  const { ActivityLog } = require('../models/index');
  await ActivityLog.create({
    adminName: 'Customer',
    action: 'LOGIN',
    module: 'login',
    details: `${safeCustomer.name} (${email}) logged into the storefront`,
    ip: req.ip
  });

  res.json({ success: true, token, customer: safeCustomer });
};
