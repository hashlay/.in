const Cart = require('../models/Cart');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { sendEmail } = require('./emailService');

const startCartCron = () => {
  // Check every 5 minutes
  setInterval(async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const abandonedCarts = await Cart.find({
        status: 'active',
        lastUpdatedAt: { $lte: oneHourAgo },
        'items.0': { $exists: true } // Has at least one item
      });

      for (let cart of abandonedCarts) {
        // Send email
        const customer = await Customer.findOne({ email: cart.email });
        const name = customer ? customer.name : 'there';
        
        const html = `
          <div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:auto;background:#080810;color:#fff;padding:2.5rem;border-radius:16px;">
            <h1 style="color:#0057ff;text-align:center;">Hey ${name}!</h1>
            <h2 style="text-align:center;">You left something behind...</h2>
            <p style="text-align:center;color:#9999bb;">We noticed you left some amazing items in your cart. They are waiting for you!</p>
            <div style="background:#0f0f1a;border-radius:12px;padding:1.5rem;margin:2rem 0;text-align:center;">
              ${cart.items.map(item => `
                <div style="margin-bottom:1rem;">
                  <strong>${item.name}</strong> - ₹${item.price} (x${item.qty || item.quantity || 1})
                </div>
              `).join('')}
            </div>
            <div style="text-align:center;">
              <a href="${process.env.FRONTEND_URL || 'https://hashlay.in'}" style="background:#0057ff;color:#fff;padding:1rem 2rem;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Return to Checkout</a>
            </div>
          </div>
        `;
        
        await sendEmail({
          to: cart.email,
          subject: 'Did you forget something? 🛒 | Hashlay',
          html,
          text: 'You left something in your cart at Hashlay.'
        });

        // Mark as notified
        cart.status = 'abandoned_notified';
        await cart.save();
      }
    } catch (err) {
      console.error('[Cart Cron Error]', err);
    }
  }, 5 * 60 * 1000); // run every 5 mins

  // Review Request Cron - Check every hour
  setInterval(async () => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const ordersToReview = await Order.find({
        orderStatus: 'delivered',
        deliveredAt: { $lte: sevenDaysAgo },
        reviewEmailSent: false,
        customerEmail: { $ne: null }
      });

      for (let order of ordersToReview) {
        if (!order.customerEmail) continue;

        const html = `
          <div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:auto;background:#080810;color:#fff;padding:2.5rem;border-radius:16px;border:1px solid rgba(255,255,255,0.1);">
            <h1 style="color:#0057ff;text-align:center;">Hi ${order.customerName}!</h1>
            <h2 style="text-align:center;">How did we do?</h2>
            <p style="text-align:center;color:#9999bb;">It's been a week since your order <strong>${order.orderId}</strong> arrived. We hope you are loving your Hashlay products!</p>
            <div style="text-align:center;margin:2rem 0;">
              <a href="${process.env.FRONTEND_URL || 'https://hashlay.in'}#reviews" style="background:#0057ff;color:#fff;padding:1rem 2rem;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Submit a Review ⭐️</a>
            </div>
            <p style="text-align:center;color:#9999bb;font-size:0.9rem;">Need support or have any issues? We are here to help!<br/>Contact us on <strong style="color:#25D366;">WhatsApp at +91 74831 38340</strong>.</p>
            <div style="text-align:center;margin-top:2rem;font-size:0.8rem;color:#6b7280;">
              Thank you for choosing Hashlay!
            </div>
          </div>
        `;

        await sendEmail({
          to: order.customerEmail,
          subject: 'How are you liking your Hashlay products? ⭐️',
          html,
          text: 'We hope you are enjoying your order! Please leave us a review.'
        });

        order.reviewEmailSent = true;
        await order.save();
      }
    } catch (err) {
      console.error('[Review Cron Error]', err);
    }
  }, 60 * 60 * 1000); // run every 1 hour
};

module.exports = { startCartCron };
