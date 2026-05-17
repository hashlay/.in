const logger = require('../config/logger');

/**
 * Send an automated WhatsApp message for Order Confirmation.
 * To make this fully live, you need to sign up for a WhatsApp API provider 
 * (like Twilio, WATI, Interakt, or Meta Cloud API) and replace the URL/Token below.
 */
exports.sendOrderWhatsApp = async (order) => {
  try {
    if (!order.customerPhone) {
      logger.info(`[WhatsApp] Skipped: No phone number for order ${order.orderId}`);
      return { success: false, message: 'No phone number provided' };
    }

    // Format phone number (Assuming India +91 if not provided)
    let phone = order.customerPhone.replace(/[^0-9]/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const messageBody = `🎉 *Thank you for your order, ${order.customerName}!* \n\nYour order *${order.orderId}* is confirmed.\n\n*Order Total:* ₹${order.total}\n*Status:* Preparing for dispatch\n\nWe will notify you once it's shipped! 🚚`;

    // ---------------------------------------------------------
    // 🔗 EXAMPLE HTTP REQUEST TO WHATSAPP API PROVIDER
    // ---------------------------------------------------------
    const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || ''; 
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';

    if (!WHATSAPP_API_URL || !WHATSAPP_TOKEN) {
      logger.info(`[WhatsApp] Simulated sending to ${phone}. (Add WHATSAPP_API_URL in .env for real sending)`);
      return { success: true, simulated: true };
    }

    // Example payload (Structure depends on your specific provider like Interakt/Wati)
    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: messageBody }
      })
    });

    if (!response.ok) {
      throw new Error(`WhatsApp API Error: ${response.statusText}`);
    }

    logger.info(`[WhatsApp] Successfully sent confirmation to ${phone}`);
    return { success: true };

  } catch (err) {
    logger.error('[WhatsApp] Failed to send:', err.message);
    return { success: false, error: err.message };
  }
};
