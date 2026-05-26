require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Order = require('./models/Order');
  const res = await Order.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
  ]);
  console.log('AGGREGATION RESULT:', res);
  
  const totalOrders = await Order.countDocuments();
  console.log('TOTAL ORDERS IN DB:', totalOrders);
  
  process.exit(0);
}).catch(console.error);
