const nodemailer = require('nodemailer');
const logger = require('../config/logger');

let resendTransporter;
let brevoTransporter;

const getResendTransporter = () => {
  if (!resendTransporter) {
    resendTransporter = nodemailer.createTransport({
      host: process.env.RESEND_SMTP_HOST || process.env.SMTP_HOST || 'smtp.resend.com',
      port: parseInt(process.env.RESEND_SMTP_PORT || process.env.SMTP_PORT) || 465,
      secure: parseInt(process.env.RESEND_SMTP_PORT || process.env.SMTP_PORT) === 465,
      auth: { 
        user: process.env.RESEND_SMTP_USER || process.env.SMTP_USER, 
        pass: process.env.RESEND_SMTP_PASS || process.env.SMTP_PASS 
      },
    });
  }
  return resendTransporter;
};

const getBrevoTransporter = () => {
  if (!brevoTransporter) {
    brevoTransporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT) || 587,
      secure: parseInt(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT) === 465,
      auth: { 
        user: process.env.BREVO_SMTP_USER || process.env.SMTP_USER, 
        pass: process.env.BREVO_SMTP_PASS || process.env.SMTP_PASS 
      },
    });
  }
  return brevoTransporter;
};

const sendResendEmail = async ({ to, subject, html, text, attachments }) => {
  try {
    const fromStr = `"${process.env.RESEND_FROM_NAME || process.env.FROM_NAME}" <${process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL}>`;
    const info = await getResendTransporter().sendMail({ from: fromStr, to, subject, html, text, attachments });
    logger.info(`[Resend Email] Sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error('[Resend Email] Error:', err.message);
    return { success: false, error: err.message };
  }
};

const sendBrevoEmail = async ({ to, subject, html, text, attachments }) => {
  try {
    const fromStr = `"${process.env.BREVO_FROM_NAME || process.env.FROM_NAME}" <${process.env.BREVO_FROM_EMAIL || process.env.FROM_EMAIL}>`;
    const info = await getBrevoTransporter().sendMail({ from: fromStr, to, subject, html, text, attachments });
    logger.info(`[Brevo Email] Sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error('[Brevo Email] Error:', err.message);
    return { success: false, error: err.message };
  }
};

exports.sendOrderConfirmation = async (order, invoiceBuffer = null) => {
  const itemsHtml = order.items.map(i =>
    `<tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
      <td style="padding:.75rem .5rem;text-align:left;font-size:.88rem;">${i.name}</td>
      <td style="padding:.75rem .5rem;text-align:center;font-size:.88rem;color:#9999bb;">×${i.quantity}</td>
      <td style="padding:.75rem .5rem;text-align:right;font-size:.88rem;">&#8377;${parseFloat(i.price || 0).toFixed(2)}</td>
      <td style="padding:.75rem .5rem;text-align:right;font-size:.88rem;font-weight:600;color:#0057ff;">&#8377;${parseFloat(i.total || (i.price * i.quantity)).toFixed(2)}</td>
    </tr>`
  ).join('');

  const subtotal = order.subtotal || order.total;
  const deliveryCharge = order.deliveryCharge || 0;
  const codCharge = order.codCharge || 0;
  const discount = order.discount || 0;

  let totalsHtml = `
    <tr style="font-size:.85rem;color:#9999bb;">
      <td colspan="2" style="padding:.4rem .5rem;text-align:left;">Subtotal</td>
      <td colspan="2" style="padding:.4rem .5rem;text-align:right;">&#8377;${parseFloat(subtotal).toFixed(2)}</td>
    </tr>
    <tr style="font-size:.85rem;color:#9999bb;">
      <td colspan="2" style="padding:.4rem .5rem;text-align:left;">Delivery Charge</td>
      <td colspan="2" style="padding:.4rem .5rem;text-align:right;color:${deliveryCharge === 0 ? '#22c55e' : '#9999bb'};">${deliveryCharge === 0 ? 'FREE' : '&#8377;' + parseFloat(deliveryCharge).toFixed(2)}</td>
    </tr>
  `;
  if (codCharge) {
    totalsHtml += `
      <tr style="font-size:.85rem;color:#9999bb;">
        <td colspan="2" style="padding:.4rem .5rem;text-align:left;">COD Handling</td>
        <td colspan="2" style="padding:.4rem .5rem;text-align:right;">&#8377;${parseFloat(codCharge).toFixed(2)}</td>
      </tr>
    `;
  }
  if (discount) {
    totalsHtml += `
      <tr style="font-size:.85rem;color:#22c55e;">
        <td colspan="2" style="padding:.4rem .5rem;text-align:left;">Discount ${order.couponCode ? '(' + order.couponCode + ')' : ''}</td>
        <td colspan="2" style="padding:.4rem .5rem;text-align:right;">-&#8377;${parseFloat(discount).toFixed(2)}</td>
      </tr>
    `;
  }
  totalsHtml += `
    <tr style="font-size:1.1rem;font-weight:700;color:#fff;">
      <td colspan="2" style="padding:1rem .5rem .5rem .5rem;text-align:left;border-top:1px solid #1e1e35;">TOTAL AMOUNT</td>
      <td colspan="2" style="padding:1rem .5rem .5rem .5rem;text-align:right;color:#0057ff;border-top:1px solid #1e1e35;">&#8377;${parseFloat(order.total).toFixed(2)}</td>
    </tr>
  `;

  const addr = order.address || {};
  let addrStr = typeof addr === 'string' ? addr : [addr.fullName || order.customerName, addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.pincode, addr.country || 'India'].filter(Boolean).join(', ');

  let displayMethod = 'Online Payment (Razorpay)';
  if (order.paymentMethod === 'cod') displayMethod = 'Cash on Delivery';
  else if (order.paymentMethod === 'upi') displayMethod = 'UPI Payment';

  const html = `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:auto;background:#080810;color:#fff;padding:2.5rem;border-radius:16px;border:1px solid rgba(255,255,255,0.06);box-shadow: 0 20px 40px rgba(0,0,0,0.8);">
      <div style="text-align:center;margin-bottom:2rem;border-bottom:1px solid #1e1e35;padding-bottom:1.5rem;">
        <h1 style="color:#0057ff;font-size:2.2rem;letter-spacing:.12em;margin:0;font-weight:800;">HASHLAY</h1>
        <p style="color:#6b7280;font-size:.75rem;letter-spacing:.15em;text-transform:uppercase;margin:.4rem 0 0 0;font-weight:700;">Protect What Moves You</p>
      </div>
      <h2 style="font-size:1.5rem;margin-top:0;font-weight:700;text-align:center;color:#ffffff;">Order Confirmed! 🎉</h2>
      <p style="color:#9999bb;line-height:1.6;font-size:.95rem;text-align:center;">Hi <strong>${order.customerName}</strong>, thank you for shopping with us. Your order <strong>${order.orderId}</strong> has been successfully placed and is being processed.</p>
      <div style="background:#0f0f1a;border-radius:12px;padding:1.5rem;margin:2rem 0;border:1px solid rgba(255,255,255,0.04);">
        <h3 style="margin-top:0;color:#0057ff;font-size:1rem;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:.5rem;">Order Summary</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid #1e1e35;color:#6b7280;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;">
              <th style="text-align:left;padding:.5rem;font-weight:600;">Product</th>
              <th style="text-align:center;padding:.5rem;font-weight:600;width:50px;">Qty</th>
              <th style="text-align:right;padding:.5rem;font-weight:600;width:80px;">Price</th>
              <th style="text-align:right;padding:.5rem;font-weight:600;width:90px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            ${totalsHtml}
          </tbody>
        </table>
      </div>
      <div style="background:#0f0f1a;border-radius:12px;padding:1.5rem;margin:2rem 0;border:1px solid rgba(255,255,255,0.04);font-size:.9rem;">
        <h3 style="margin-top:0;color:#0057ff;font-size:1rem;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:.5rem;">Delivery Details</h3>
        <p style="margin:.5rem 0;color:#9999bb;"><strong style="color:#fff;">Name:</strong> ${order.customerName}</p>
        <p style="margin:.5rem 0;color:#9999bb;"><strong style="color:#fff;">Phone:</strong> ${order.customerPhone}</p>
        <p style="margin:.5rem 0;color:#9999bb;"><strong style="color:#fff;">Address:</strong> ${addrStr}</p>
        <p style="margin:.5rem 0;color:#9999bb;"><strong style="color:#fff;">Payment Method:</strong> ${displayMethod}</p>
      </div>
      <div style="text-align:center;margin-top:2.5rem;border-top:1px solid #1e1e35;padding-top:1.5rem;">
        <p style="color:#9999bb;font-size:.85rem;margin:0 0 .5rem 0;">We've attached your official invoice to this email.</p>
        <p style="color:#6b7280;font-size:.8rem;margin:0;">Questions or assistance? WhatsApp us at <a href="https://wa.me/917483138340" style="color:#22c55e;text-decoration:none;font-weight:600;">+91 74831 38340</a> or reply to this email.</p>
        <p style="color:#0057ff;font-weight:700;font-size:.9rem;letter-spacing:.1em;margin:1.2rem 0 0 0;text-transform:uppercase;">Hashlay — Protect What Moves You</p>
      </div>
    </div>`;

  const attachments = invoiceBuffer ? [{ filename: `Invoice-${order.orderId}.pdf`, content: invoiceBuffer, contentType: 'application/pdf' }] : [];
  
  // Also notify Admin about the new order!
  await exports.sendAdminNotification(
    `New Order Placed: ${order.orderId}`,
    `<div style="font-family:sans-serif;background:#f9fafb;padding:20px;border-radius:8px;">
      <h2 style="color:#111827;margin-top:0;">New Order Alert!</h2>
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Customer:</strong> ${order.customerName}</p>
      <p><strong>Email:</strong> ${order.customerEmail}</p>
      <p><strong>Phone:</strong> ${order.customerPhone}</p>
      <p><strong>Address:</strong> ${addrStr}</p>
      <p><strong>Total Amount:</strong> ₹${parseFloat(order.total).toFixed(2)}</p>
      <p><strong>Payment Method:</strong> ${displayMethod}</p>
      <p><strong>Source:</strong> ${order.source || 'website'}</p>
      <p><em>Check the attached invoice or log into the admin dashboard to manage.</em></p>
    </div>`,
    attachments
  ).catch(() => {});

  return sendResendEmail({ to: order.customerEmail, subject: `Order Confirmed — ${order.orderId} | Hashlay`, html, attachments });
};

exports.sendCampaignEmail = async (toList, subject, html) => {
  const results = await Promise.allSettled(
    toList.map(to => sendBrevoEmail({ to, subject, html }))
  );
  return results;
};

exports.sendAdminNotification = async (subject, html, attachments = []) => {
  return sendBrevoEmail({
    to: 'contacthashlay@gmail.com',
    subject: `[ADMIN ALERT] ${subject}`,
    html,
    attachments
  });
};

exports.sendEmail = sendResendEmail;
