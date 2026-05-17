const nodemailer = require('nodemailer');
const logger = require('../config/logger');

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: parseInt(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await getTransporter().sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to, subject, html, text,
    });
    logger.info(`[Email] Sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error('[Email] Error:', err.message);
    return { success: false, error: err.message };
  }
};

exports.sendOrderConfirmation = async (order) => {
  const itemsHtml = order.items.map(i =>
    `<tr><td>${i.name}</td><td>×${i.quantity}</td><td>₹${i.price}</td><td>₹${i.total}</td></tr>`
  ).join('');

  return sendEmail({
    to: order.customerEmail,
    subject: `Order Confirmed — ${order.orderId} | Hashlay`,
    html: `
      <div style="font-family:DM Sans,Arial,sans-serif;max-width:600px;margin:auto;background:#080810;color:#fff;padding:2rem;border-radius:12px;">
        <h1 style="color:#0057ff;font-size:2rem;letter-spacing:.1em;">HASHLAY</h1>
        <h2>Order Confirmed! 🎉</h2>
        <p>Hi ${order.customerName}, your order <strong>${order.orderId}</strong> has been confirmed.</p>
        <table style="width:100%;border-collapse:collapse;margin:1.5rem 0;">
          <thead><tr style="border-bottom:1px solid #1e1e35;">
            <th style="text-align:left;padding:.5rem;">Product</th>
            <th>Qty</th><th>Price</th><th>Total</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p><strong>Total: ₹${order.total}</strong></p>
        <p style="color:#6666aa;font-size:.85rem;">Questions? Reply to this email or contact us at contacthashlay@gmail.com</p>
      </div>`,
  });
};

exports.sendCampaignEmail = async (toList, subject, html) => {
  const results = await Promise.allSettled(
    toList.map(to => sendEmail({ to, subject, html }))
  );
  return results;
};

exports.sendEmail = sendEmail;
