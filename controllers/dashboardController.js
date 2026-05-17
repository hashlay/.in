const Order   = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { Review } = require('../models/index');

exports.getStats = async (req, res) => {
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
    Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Order.countDocuments({ orderStatus: 'pending' }),
    Order.countDocuments({ orderStatus: { $in: ['confirmed','processing','shipped','out_for_delivery'] } }),
    Order.countDocuments({ orderStatus: 'delivered' }),
    Order.countDocuments({ orderStatus: 'cancelled' }),
    Order.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow }, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Product.find({ stock: { $gt: 0, $lt: 10 }, isActive: true }).select('name stock category').limit(10),
    Order.find({ isActive: true }).sort({ createdAt: -1 }).limit(8)
      .select('orderId customerName total orderStatus createdAt paymentMethod'),
    Review.countDocuments({ status: 'pending' }),
  ]);

  res.json({
    success: true,
    data: {
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
    },
  });
};

exports.getRevenueChart = async (req, res) => {
  const { range = '7d' } = req.query;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '3m' ? 90 : 365;
  const from = new Date(); from.setDate(from.getDate() - days); from.setHours(0,0,0,0);

  const data = await Order.aggregate([
    { $match: { createdAt: { $gte: from }, isActive: true } },
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

  res.json({ success: true, data });
};

exports.getOrderStatusChart = async (req, res) => {
  const data = await Order.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
  ]);
  res.json({ success: true, data });
};

exports.getTopProducts = async (req, res) => {
  const data = await Order.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$items' },
    { $group: { _id: '$items.name', sales: { $sum: '$items.quantity' }, revenue: { $sum: '$items.total' } } },
    { $sort: { sales: -1 } },
    { $limit: 10 },
  ]);
  res.json({ success: true, data });
};

exports.getCustomerGrowth = async (req, res) => {
  const days = 30;
  const from = new Date(); from.setDate(from.getDate() - days);
  const data = await Customer.aggregate([
    { $match: { createdAt: { $gte: from } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    { $sort: { '_id': 1 } },
  ]);
  res.json({ success: true, data });
};
