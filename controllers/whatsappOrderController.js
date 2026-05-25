const Order    = require('../models/Order');
const Customer = require('../models/Customer');
const Product  = require('../models/Product');
const { notifyNewOrder } = require('../services/notificationService');

// ── Get WhatsApp Orders ─────────────────────────────────────────
exports.getWhatsappOrders = async (req, res) => {
  const { page = 1, limit = 50, status, search } = req.query;
  const query = { isActive: true, source: 'whatsapp' };

  if (status) query.orderStatus = status;
  if (search) {
    query.$or = [
      { orderId: new RegExp(search, 'i') },
      { customerName: new RegExp(search, 'i') },
      { customerPhone: new RegExp(search, 'i') },
    ];
  }

  const opts = { page: parseInt(page), limit: parseInt(limit), sort: '-createdAt', lean: true };
  const result = await Order.paginate(query, opts);
  res.json({ success: true, data: result });
};

// ── Create WhatsApp Order (manual entry) ────────────────────────
exports.createWhatsappOrder = async (req, res) => {
  const body = req.body;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!body.customerName || !body.customerPhone || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Customer name, phone and items are required' });
  }

  try {
    let calculatedSubtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      // Try to match with existing product for stock management
      let product = null;
      if (item.product) {
        product = await Product.findOneAndUpdate(
          { _id: item.product, stock: { $gte: item.quantity }, isActive: true },
          { $inc: { stock: -item.quantity, sales: item.quantity } },
          { new: true }
        ).select('price offerPrice name');
      }

      const price = product ? (product.offerPrice || product.price) : (item.price || 0);
      const name = product ? product.name : (item.name || 'Unknown Product');

      verifiedItems.push({
        product: product?._id || undefined,
        name,
        price,
        quantity: item.quantity || 1,
        total: price * (item.quantity || 1),
      });
      calculatedSubtotal += price * (item.quantity || 1);
    }

    const deliveryCharge = parseFloat(body.deliveryCharge) || 0;
    const discount = parseFloat(body.discount) || 0;
    const total = body.total ? parseFloat(body.total) : (calculatedSubtotal - discount + deliveryCharge);

    const orderData = {
      customerName: body.customerName,
      customerEmail: body.customerEmail || '',
      customerPhone: body.customerPhone,
      address: body.address || {},
      items: verifiedItems,
      subtotal: calculatedSubtotal,
      discount,
      deliveryCharge,
      total,
      paymentMethod: body.paymentMethod || 'upi',
      paymentStatus: body.paymentStatus || 'pending',
      orderStatus: body.orderStatus || 'confirmed',
      source: 'whatsapp',
      screenshotUrl: body.screenshotUrl || '',
      notes: body.notes || '',
      timeline: [{ status: 'confirmed', message: 'WhatsApp order added manually' }],
    };

    const newOrder = new Order(orderData);
    const createdOrder = await newOrder.save();

    // Update/Create customer record
    if (body.customerPhone || body.customerEmail) {
      const searchField = body.customerEmail
        ? { email: body.customerEmail }
        : { phone: body.customerPhone };

      let customer = await Customer.findOne(searchField);
      if (customer) {
        customer.totalOrders = (customer.totalOrders || 0) + 1;
        customer.totalSpend = (customer.totalSpend || 0) + total;
        customer.lastOrderAt = new Date();
        await customer.save();
      } else {
        customer = await Customer.create({
          name: body.customerName,
          email: body.customerEmail || '',
          phone: body.customerPhone,
          addresses: body.address ? [body.address] : [],
          totalOrders: 1,
          totalSpend: total,
          lastOrderAt: new Date(),
        });
      }
      createdOrder.customer = customer._id;
      await createdOrder.save();
    }

    await notifyNewOrder(createdOrder).catch(() => {});

    // Trigger Automatic Emails
    try {
      const { generateInvoiceBuffer } = require('../services/invoiceService');
      const { sendOrderConfirmation, sendAdminNotification } = require('../services/emailService');
      
      const invoiceBuffer = await generateInvoiceBuffer(createdOrder).catch(() => null);

      // Always notify Admin about the manual WhatsApp order
      const addr = createdOrder.address || {};
      const addrStr = typeof addr === 'string' ? addr : [addr.fullName || createdOrder.customerName, addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.pincode, addr.country || 'India'].filter(Boolean).join(', ');
      
      await sendAdminNotification(
        `New WhatsApp Order: ${createdOrder.orderId}`,
        `<div style="font-family:sans-serif;background:#f9fafb;padding:20px;border-radius:8px;">
          <h2 style="color:#111827;margin-top:0;">New Manual Order Added</h2>
          <p><strong>Order ID:</strong> ${createdOrder.orderId}</p>
          <p><strong>Customer:</strong> ${createdOrder.customerName}</p>
          <p><strong>Email:</strong> ${createdOrder.customerEmail || 'No Email Provided'}</p>
          <p><strong>Phone:</strong> ${createdOrder.customerPhone}</p>
          <p><strong>Address:</strong> ${addrStr}</p>
          <p><strong>Total Amount:</strong> ₹${parseFloat(createdOrder.total).toFixed(2)}</p>
          <p><strong>Source:</strong> WhatsApp</p>
        </div>`,
        invoiceBuffer ? [{ filename: `Invoice-${createdOrder.orderId}.pdf`, content: invoiceBuffer, contentType: 'application/pdf' }] : []
      ).catch(() => {});

      // Only send customer confirmation if they provided an email
      if (createdOrder.customerEmail) {
        await sendOrderConfirmation(createdOrder, invoiceBuffer, true).catch(() => {}); // Passing true to skip duplicate admin alert
      }
    } catch (e) {
      console.error('Failed to send WhatsApp order emails:', e);
    }

    return res.status(201).json({ success: true, data: createdOrder, message: 'WhatsApp order created' });
  } catch (error) {
    console.error('WhatsApp order creation error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── AI Parse Screenshot ─────────────────────────────────────────
exports.parseScreenshot = async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ success: false, message: 'Image URL is required' });
  }

  try {
    // Fetch the image
    const imgResponse = await fetch(imageUrl);
    const arrayBuffer = await imgResponse.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imgResponse.headers.get('content-type') || 'image/jpeg';

    // Call Gemini Vision API
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
      return res.status(500).json({ success: false, message: 'GEMINI_API_KEY not configured' });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `You are an order extraction assistant for an e-commerce store called "Hashlay" that sells sneaker care and shoe cleaning products. 

Analyze this WhatsApp order screenshot and extract the order details. Return ONLY valid JSON with this exact structure (no markdown, no explanation):

{
  "customerName": "extracted name or empty string",
  "customerPhone": "extracted phone number or empty string",
  "customerEmail": "extracted email or empty string",
  "address": {
    "addressLine1": "extracted address line 1 or empty",
    "city": "extracted city or empty",
    "state": "extracted state or empty",
    "pincode": "extracted pincode or empty"
  },
  "items": [
    {
      "name": "product name",
      "quantity": 1,
      "price": 0
    }
  ],
  "paymentMethod": "upi or cod or online",
  "notes": "any additional notes from the conversation"
}

Important rules:
- Extract ALL items mentioned in the conversation
- If price is not visible, set it to 0
- If quantity is not mentioned, default to 1
- Extract the full address if available
- Phone numbers should include country code if visible
- Return ONLY the JSON object, nothing else`
              },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
          }
        }),
      }
    );

    const geminiData = await geminiRes.json();
    const textResponse = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse the JSON from the response
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ success: false, message: 'Could not extract order details from image', raw: textResponse });
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Try to match product names with existing products
    const products = await Product.find({ isActive: true }).select('name price offerPrice _id').lean();
    if (extracted.items && extracted.items.length > 0) {
      for (const item of extracted.items) {
        const match = products.find(p =>
          p.name.toLowerCase().includes(item.name.toLowerCase()) ||
          item.name.toLowerCase().includes(p.name.toLowerCase())
        );
        if (match) {
          item.product = match._id;
          item.name = match.name;
          if (!item.price || item.price === 0) {
            item.price = match.offerPrice || match.price;
          }
        }
      }
    }

    return res.json({ success: true, data: extracted });
  } catch (error) {
    console.error('Screenshot parse error:', error);
    return res.status(500).json({ success: false, message: 'Failed to parse screenshot: ' + error.message });
  }
};
