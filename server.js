require('dotenv').config();
require('express-async-errors');

const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const compression  = require('compression');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const { stats: cacheStats } = require('./config/cache');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);

// ── Security & Parsing ───────────────────────────────────────────
// Lazy-load heavy security middleware only when needed
const helmet = require('helmet');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  process.env.CLIENT_URL,
  'https://hashlay-in.vercel.app',
].filter(Boolean);
const isDev = process.env.NODE_ENV !== 'production';

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isDev && (origin.includes('localhost') || origin.includes('127.0.0.1'))) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.endsWith('hashlay.in')) return callback(null, true);
    if (origin.endsWith('vercel.app')) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');
app.use(mongoSanitize());
app.use(xssClean());
app.use(compression());
app.use(cookieParser());

// Skip morgan in production serverless — it adds latency and Vercel has its own logging
if (isDev) {
  const morgan = require('morgan');
  const logger = require('./config/logger');
  app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
}

// ── DB Middleware (Serverless-safe) ──────────────────────────────
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

// ── Rate Limiting ────────────────────────────────────────────────
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' }
});
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Rate limit exceeded.' }
});
const orderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many orders. Please try again later.' }
});

// ── Static ───────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1y',
  immutable: true,
}));

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/products', apiLimiter, require('./routes/products'));
app.use('/api/orders', apiLimiter, require('./routes/orders'));
app.use('/api/customers', apiLimiter, require('./routes/customers'));
app.use('/api/reviews', apiLimiter, require('./routes/reviews'));
app.use('/api/coupons', apiLimiter, require('./routes/coupons'));
app.use('/api/campaigns', apiLimiter, require('./routes/campaigns'));
app.use('/api/faqs', apiLimiter, require('./routes/faqs'));
app.use('/api/chatbot', apiLimiter, require('./routes/chatbot'));
app.use('/api/notifications', apiLimiter, require('./routes/notifications'));
app.use('/api/contacts', apiLimiter, require('./routes/contacts'));
app.use('/api/notify-list', apiLimiter, require('./routes/notifyList'));
app.use('/api/analytics', apiLimiter, require('./routes/analytics'));
app.use('/api/settings', apiLimiter, require('./routes/settings'));
app.use('/api/admins', apiLimiter, require('./routes/admins'));
app.use('/api/activity-log', apiLimiter, require('./routes/activityLog'));
app.use('/api/upload', apiLimiter, require('./routes/upload'));
app.use('/api/invoice', apiLimiter, require('./routes/invoice'));
app.use('/api/razorpay', apiLimiter, require('./routes/razorpay'));
app.use('/api/dashboard', apiLimiter, require('./routes/dashboard'));
app.use('/api/sync', apiLimiter, require('./routes/sync'));
app.use('/api/whatsapp-orders', apiLimiter, require('./routes/whatsappOrders'));

// ── Customer Auth Portal ─────────────────────────────────────────
app.use('/api/customer/auth', require('./routes/customerAuth'));
app.use('/api/admin/auth-settings', apiLimiter, require('./routes/adminAuthSettings'));
app.use('/api/customer/portal', apiLimiter, require('./routes/customerPortal'));
app.use('/api/admin/chat', apiLimiter, require('./routes/adminChat'));

// ── Health check (lightweight — no DB, returns cache stats) ─────
app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    cache: cacheStats(),
  });
});

// ── Keep-alive ping (ultra-lightweight, no middleware) ───────────
app.get('/api/ping', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(200).send('pong');
});

// ── Serve Frontend HTML ──────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'final.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'hashlay-admin.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'auth.html')));
app.get('/portal', (req, res) => res.sendFile(path.join(__dirname, 'portal.html')));

app.get('/:page(privacy|terms|shipping|returns|cookies)(.html)?', (req, res) => {
  res.sendFile(path.join(__dirname, `${req.params.page}.html`));
});

// ── 404 ──────────────────────────────────────────────────────────
app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Global Error Handler ─────────────────────────────────────────
app.use(errorHandler);

// ── Local Dev Server ─────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production' || process.env.FORCE_LISTEN === 'true') {
  const logger = require('./config/logger');
  const http = require('http');
  const { Server: SocketServer } = require('socket.io');
  const PORT = process.env.PORT || 5000;

  const server = http.createServer(app);

  // ── Socket.io Setup ──────────────────────────────────────────
  const io = new SocketServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });
  app.set('io', io);

  io.on('connection', (socket) => {
    // Customers join their own room
    socket.on('join_customer', (customerId) => {
      socket.join('customer_' + customerId);
    });
    // Admins join the admin inbox room
    socket.on('join_admin', () => {
      socket.join('admin_inbox');
    });
    // Admin sends a message to a customer
    socket.on('admin_message', (data) => {
      io.to('customer_' + data.customerId).emit('admin_message', data);
    });
    // Typing indicators
    socket.on('customer_typing', (data) => {
      io.to('admin_inbox').emit('customer_typing', data);
    });
    socket.on('admin_typing', (data) => {
      io.to('customer_' + data.customerId).emit('admin_typing', data);
    });
  });

  server.listen(PORT, () => {
    logger.info(`🚀 Hashlay Backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Set PORT to a free port or stop the process using it.`);
      process.exit(1);
    }
    throw err;
  });

  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
    server.close(() => process.exit(1));
  });
}

process.on('uncaughtException', (err) => {
  const logger = require('./config/logger');
  logger.error('Uncaught Exception:', err);
  if (process.env.NODE_ENV !== 'production') process.exit(1);
});

module.exports = app;