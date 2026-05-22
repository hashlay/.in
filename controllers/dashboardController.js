const Order   = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { Review } = require('../models/index');
const { getOrSet } = require('../config/cache');

exports.getStats = async (req, res) => {
  // Cache dashboard stats for 45s — many parallel queries, expensive
  const data = await getOrSet('dashboard:stats', 45, async () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);

    const [
      todayOrders, totalOrders, totalProducts, totalCustomers, totalRevenue,
      pendingOrders, processingOrders, deliveredOrders, cancelledOrders,
      todayRevenue, lowStock, recentOrders, pendingReviews,
    ] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      Order.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: true }),
      Customer.countDocuments({ isActive: true }),
      Order.aggregate([{ $match: { orderStatus: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.countDocuments({ orderStatus: 'pending' }),
      Order.countDocuments({ orderStatus: { $in: ['confirmed','processing','shipped','out_for_delivery'] } }),
      Order.countDocuments({ orderStatus: 'delivered' }),
      Order.countDocuments({ orderStatus: 'cancelled' }),
      Order.aggregate([
        { $match: { createdAt: { $gte: today, $lt: tomorrow }, orderStatus: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Product.find({ stock: { $gt: 0, $lt: 10 }, isActive: true }).select('name stock category').limit(10).lean(),
      Order.find({ isActive: true }).sort({ createdAt: -1 }).limit(8)
        .select('orderId customerName total orderStatus createdAt paymentMethod').lean(),
      Review.countDocuments({ status: 'pending' }),
    ]);

    return {
      todayOrders,
      todayRevenue:    todayRevenue[0]?.total || 0,
      totalOrders,
      totalProducts,
      totalCustomers,
      totalRevenue:    totalRevenue[0]?.total || 0,
      pendingOrders,
      processingOrders,
      deliveredOrders,
      cancelledOrders,
      lowStock,
      recentOrders,
      pendingReviews,
    };
  });

  res.json({ success: true, data });
};

exports.getRevenueChart = async (req, res) => {
  const { range = '7d' } = req.query;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '3m' ? 90 : 365;

  // Cache chart data for 120s — heavy aggregation
  const data = await getOrSet(`dashboard:revenue:${range}`, 120, async () => {
    const from = new Date(); from.setDate(from.getDate() - days); from.setHours(0,0,0,0);
    return Order.aggregate([
      { $match: { createdAt: { $gte: from }, isActive: true, orderStatus: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: days <= 30 ? '%Y-%m-%d' : '%Y-%m',
              date: '$createdAt',
            },
          },
          revenue: { $sum: '$total' },
          orders:  { $sum: 1 },
        },
      },
      { $sort: { '_id': 1 } },
    ]);
  });

  res.json({ success: true, data });
};

exports.getOrderStatusChart = async (req, res) => {
  const data = await getOrSet('dashboard:orderStatus', 60, async () => {
    return Order.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]);
  });
  res.json({ success: true, data });
};

exports.getTopProducts = async (req, res) => {
  const data = await getOrSet('dashboard:topProducts', 120, async () => {
    return Order.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', sales: { $sum: '$items.quantity' }, revenue: { $sum: '$items.total' } } },
      { $sort: { sales: -1 } },
      { $limit: 10 },
    ]);
  });
  res.json({ success: true, data });
};

exports.getCustomerGrowth = async (req, res) => {
  const data = await getOrSet('dashboard:customerGrowth', 120, async () => {
    const days = 30;
    const from = new Date(); from.setDate(from.getDate() - days);
    return Customer.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
    ]);
  });
  res.json({ success: true, data });
};

exports.resetStats = async (req, res) => {
  try {
    const { password, statType } = req.body;
    const RESET_PASSWORD = 'hashlay@2026';

    if (password !== RESET_PASSWORD) {
      return res.status(403).json({ success: false, message: 'Invalid reset password' });
    }

    const validTypes = ['totalRevenue', 'pendingOrders', 'deliveredOrders'];
    if (!validTypes.includes(statType)) {
      return res.status(400).json({ success: false, message: 'Invalid stat type' });
    }

    let result;
    if (statType === 'totalRevenue') {
      // Mark all non-cancelled orders as inactive so they won't count in revenue
      result = await Order.updateMany(
        { isActive: true, orderStatus: { $ne: 'cancelled' } },
        { $set: { isActive: false } }
      );
    } else if (statType === 'pendingOrders') {
      // Mark all pending orders as cancelled
      result = await Order.updateMany(
        { orderStatus: 'pending', isActive: true },
        { $set: { orderStatus: 'cancelled', isActive: false } }
      );
    } else if (statType === 'deliveredOrders') {
      // Mark all delivered orders as inactive (archived)
      result = await Order.updateMany(
        { orderStatus: 'delivered', isActive: true },
        { $set: { isActive: false } }
      );
    }

    // Clear dashboard cache
    const { invalidate } = require('../config/cache');
    invalidate('dashboard:stats');
    invalidate('dashboard:revenue:7d');
    invalidate('dashboard:revenue:30d');
    invalidate('dashboard:revenue:3m');
    invalidate('dashboard:orderStatus');

    res.json({ success: true, message: `${statType} has been reset successfully`, modified: result?.modifiedCount || 0 });
  } catch (err) {
    console.error('[Dashboard] Reset stats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
