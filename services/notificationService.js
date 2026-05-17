const { Notification } = require('../models/index');

const notify = async ({ type, title, message, link = '', meta = {} }) => {
  try {
    await Notification.create({ type, title, message, link, meta });
  } catch (err) {
    console.error('[Notify]', err.message);
  }
};

exports.notifyNewOrder = (order) => notify({
  type: 'new_order',
  title: 'New Order Received',
  message: `Order ${order.orderId} from ${order.customerName} — ₹${order.total}`,
  link: `/orders/${order._id}`,
  meta: { orderId: order._id },
});

exports.notifyOrderUpdate = (order, newStatus) => notify({
  type: 'order_update',
  title: 'Order Status Updated',
  message: `Order ${order.orderId} status → ${newStatus}`,
  link: `/orders/${order._id}`,
  meta: { orderId: order._id, status: newStatus },
});

exports.notifyNewCustomer = (customer) => notify({
  type: 'new_customer',
  title: 'New Customer Registered',
  message: `${customer.name} (${customer.email}) just joined`,
  link: `/customers`,
  meta: { customerId: customer._id },
});

exports.notifyNewReview = (review) => notify({
  type: 'new_review',
  title: 'New Review Submitted',
  message: `${review.name} left a ${review.rating}★ review`,
  link: `/reviews`,
  meta: { reviewId: review._id },
});

exports.notifyLowStock = (product) => notify({
  type: 'low_stock',
  title: 'Low Stock Alert',
  message: `"${product.name}" has only ${product.stock} units left`,
  link: `/products`,
  meta: { productId: product._id },
});

exports.notifyGeneral = notify;
