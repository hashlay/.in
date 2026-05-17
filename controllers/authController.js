const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { ActivityLog } = require('../models/index');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password required' });

  const admin = await Admin.findOne({ email }).select('+password');
  if (!admin || !admin.isActive)
    return res.status(401).json({ success: false, message: 'Invalid credentials' });

  const match = await admin.matchPassword(password);
  if (!match) {
    await ActivityLog.create({
      adminName: email, action: 'LOGIN_FAILED', module: 'auth',
      details: `Failed login attempt for ${email}`,
      ip: req.ip, userAgent: req.headers['user-agent'], status: 'failure',
    });
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  admin.lastLogin  = new Date();
  admin.loginCount = (admin.loginCount || 0) + 1;
  await admin.save();

  await ActivityLog.create({
    admin: admin._id, adminName: admin.name, action: 'LOGIN', module: 'auth',
    details: `${admin.name} logged in`, ip: req.ip, userAgent: req.headers['user-agent'],
  });

  const token = signToken(admin._id);
  res.json({ success: true, token, admin: admin.toSafeObject() });
};

exports.logout = async (req, res) => {
  await ActivityLog.create({
    admin: req.admin._id, adminName: req.admin.name,
    action: 'LOGOUT', module: 'auth',
    details: `${req.admin.name} logged out`,
    ip: req.ip, userAgent: req.headers['user-agent'],
  });
  res.json({ success: true, message: 'Logged out' });
};

exports.me = async (req, res) => {
  res.json({ success: true, admin: req.admin });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = await Admin.findById(req.admin._id).select('+password');
  const match = await admin.matchPassword(currentPassword);
  if (!match) return res.status(400).json({ success: false, message: 'Current password incorrect' });
  if (newPassword.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  admin.password = newPassword;
  await admin.save();
  res.json({ success: true, message: 'Password changed successfully' });
};
