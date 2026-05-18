const Order    = require('../models/Order');
const Customer = require('../models/Customer');
const Product  = require('../models/Product');
const { Coupon } = require('../models/index');
const { notifyNewOrder, notifyOrderUpdate } = require('../services/notificationService');
const { sendOrderConfirmation } = require('../services/emailService');
const csv = require('fast-csv');
const { v4: uuidv4 } = require('uuid');

exports.getOrders = async (req, res) => {
  const { page = 1, limit = 20, status, search, from, to, sort = '-createdAt', paymentMethod } = req.query;
  const query = { isActive: true };

  if (status) query.orderStatus = status;
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (search) {
    query.$or = [
      { orderId: new RegExp(search, 'i') },
      { customerName: new RegExp(search, 'i') },
      { customerPhone: new RegExp(search, 'i') },
    ];
  }
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to)   query.createdAt.$lte = new Date(to);
  }

  const opts = { page: parseInt(page), limit: parseInt(limit), sort, lean: true };
  const result = await Order.paginate(query, opts);
  res.json({ success: true, data: result });
};

exports.getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id).populate('customer', 'name email phone');
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, data: order });
};

exports.createOrder = async (req, res) => {
  const body = req.body;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!body.customerName || !body.customerPhone || !body.address || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Order details and cart items are required' });
  }

  const { Settings } = require('../models/index');
  const deliverySettings = await Settings.findOne({ key: 'delivery' });
  const ds = deliverySettings?.value || {};

  let coupon = null;
  let discount = 0;
  let calculatedSubtotal = 0;
  const verifiedItems = [];
  const session = await Order.startSession();
  session.startTransaction();

  try {
    for (const item of items) {
      const product = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity }, isActive: true },
        { $inc: { stock: -item.quantity, sales: item.quantity } },
        { new: true, session }
      ).select('price offerPrice name');

      if (!product) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `Product unavailable or out of stock: ${item.name || item.product}` });
      }

      const actualPrice = product.offerPrice || product.price;
      verifiedItems.push({
        product: product._id,
        name: product.name,
        price: actualPrice,
        quantity: item.quantity,
        total: actualPrice * item.quantity,
      });
      calculatedSubtotal += actualPrice * item.quantity;
    }

    if (body.couponCode) {
      coupon = await Coupon.findOne({ code: body.couponCode.toUpperCase(), isActive: true }).session(session);
      if (coupon && (!coupon.expiryDate || coupon.expiryDate > new Date())
        && (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit)
        && calculatedSubtotal >= (coupon.minOrder || 0)) {
        discount = coupon.type === 'percentage'
          ? (coupon.maxDiscount
            ? Math.min(calculatedSubtotal * coupon.value / 100, coupon.maxDiscount)
            : calculatedSubtotal * coupon.value / 100)
          : coupon.value;
      } else {
        coupon = null;
        discount = 0;
      }
    }

    const deliveryCharge = calculatedSubtotal >= (ds.freeAbove || 999) ? 0 : (ds.charge || 49);
    const codCharge = body.paymentMethod === 'cod' ? (ds.codCharge || 0) : 0;
    const total = calculatedSubtotal - discount + deliveryCharge + codCharge;

    const orderData = {
      customerName: body.customerName,
      customerEmail: body.customerEmail || '',
      customerPhone: body.customerPhone,
      address: body.address,
      items: verifiedItems,
      subtotal: calculatedSubtotal,
      discount,
      couponCode: coupon?.code || null,
      deliveryCharge,
      codCharge,
      total,
      paymentMethod: body.paymentMethod || 'cod',
      paymentStatus: body.paymentMethod === 'online' ? 'paid' : 'pending',
      razorpayOrderId: body.razorpayOrderId || undefined,
      razorpayPaymentId: body.razorpayPaymentId || undefined,
      timeline: [{ status: 'pending', message: 'Order placed successfully' }],
    };
    const newOrder = new Order(orderData);
    const createdOrder = await newOrder.save({ session });

    if (coupon) {
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      await coupon.save({ session });
    }

    if (body.customerEmail) {
      let customer = await Customer.findOne({ email: body.customerEmail }).session(session);
      
      if (customer) {
        // Repeat customer
        customer.totalOrders = (customer.totalOrders || 0) + 1;
        customer.totalSpend = (customer.totalSpend || 0) + total;
        customer.lastOrderAt = new Date();
        // optionally update phone if empty
        if (!customer.phone && body.customerPhone) customer.phone = body.customerPhone;
        await customer.save({ session });
      } else {
        // New customer
        customer = new Customer({
          name: body.customerName,
          email: body.customerEmail,
          phone: body.customerPhone,
          addresses: [body.address],
          totalOrders: 1,
          totalSpend: total,
          lastOrderAt: new Date()
        });
        await customer.save({ session });
      }

      // Link customer to order
      createdOrder.customer = customer._id;
      await createdOrder.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    await notifyNewOrder(createdOrder);
    
    // Trigger Automatic Email
    if (createdOrder.customerEmail) {
      const { generateInvoiceBuffer } = require('../services/invoiceService');
      const invoiceBuffer = await generateInvoiceBuffer(createdOrder).catch(() => null);
      await sendOrderConfirmation(createdOrder, invoiceBuffer).catch(() => {});
    }

    // Trigger Automatic WhatsApp Message
    const { sendOrderWhatsApp } = require('../services/whatsappService');
    if (createdOrder.customerPhone) {
      await sendOrderWhatsApp(createdOrder).catch(() => {});
    }

    const { ActivityLog } = require('../models/index');
    await ActivityLog.create({
      adminName: 'Customer',
      action: 'PLACE_ORDER',
      module: 'order',
      details: `Order ${createdOrder.orderId} placed by ${createdOrder.customerName} for ₹${createdOrder.total}`,
      ip: req.ip
    });

    return res.status(201).json({ success: true, data: createdOrder, message: 'Order created' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

exports.updateOrderStatus = async (req, res) => {
  const { orderStatus, deliveryStatus, trackingId, notes, paymentStatus } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  let updated = false;

  if (orderStatus && order.orderStatus !== orderStatus) {
    order.orderStatus = orderStatus;
    updated = true;
  }
  if (paymentStatus && order.paymentStatus !== paymentStatus) {
    order.paymentStatus = paymentStatus;
    updated = true;
  }

  if (deliveryStatus) order.deliveryStatus = deliveryStatus;
  if (trackingId)     order.trackingId     = trackingId;
  if (notes)          order.notes          = notes;

  if (updated) {
    order.timeline.push({
      status: orderStatus || deliveryStatus || 'Update',
      message: req.body.message || `Status updated`,
      timestamp: new Date(),
    });
  }

  await order.save();
  if (orderStatus) {
    await notifyOrderUpdate(order, orderStatus);
  }
  res.json({ success: true, data: order, message: 'Order updated' });
};

exports.deleteOrder = async (req, res) => {
  await Order.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true, message: 'Order deleted' });
};

exports.exportCSV = async (req, res) => {
  const q = { isActive: true };
  if (req.query.from || req.query.to) {
    q.createdAt = {};
    if (req.query.from) q.createdAt.$gte = new Date(req.query.from);
    if (req.query.to)   q.createdAt.$lte = new Date(req.query.to + 'T23:59:59');
  }
  const orders = await Order.find(q).sort('-createdAt').lean();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
  const s = csv.format({ headers: true });
  s.pipe(res);
  orders.forEach(o => s.write({
    OrderID: o.orderId, Customer: o.customerName, Phone: o.customerPhone,
    Email: o.customerEmail || '', Items: (o.items||[]).map(i=>`${i.name} x${i.quantity}`).join('; '),
    Subtotal: o.subtotal, Discount: o.discount || 0, Delivery: o.deliveryCharge || 0,
    Total: o.total, Payment: o.paymentMethod, PaymentStatus: o.paymentStatus,
    OrderStatus: o.orderStatus, Address: o.address || '',
    Date: new Date(o.createdAt).toLocaleDateString('en-IN'),
  }));
  s.end();
};

exports.validateCoupon = async (req, res) => {
  const { code, subtotal } = req.body;
  const coupon = await Coupon.findOne({ code: code?.toUpperCase(), isActive: true });
  if (!coupon) return res.status(404).json({ success: false, message: 'Invalid coupon code' });
  if (coupon.expiryDate && coupon.expiryDate < new Date())
    return res.status(400).json({ success: false, message: 'Coupon expired' });
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
    return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
  if (subtotal < (coupon.minOrder || 0))
    return res.status(400).json({ success: false, message: `Min order ₹${coupon.minOrder} required` });

  const discount = coupon.type === 'percentage'
    ? (coupon.maxDiscount
    ? Math.min(subtotal * coupon.value / 100, coupon.maxDiscount)
    : subtotal * coupon.value / 100)
    : coupon.value;

  res.json({ success: true, discount, coupon: { code: coupon.code, type: coupon.type, value: coupon.value } });
};
