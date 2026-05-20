const PDFDocument = require('pdfkit');

let cachedLogoBuffer = null;
let cachedRegularFontBuffer = null;
let cachedBoldFontBuffer = null;

const generateInvoiceBuffer = (order) => {
  return new Promise(async (resolve, reject) => {
    const doc     = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];

    doc.on('data',  chunk => buffers.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });

    // Fetch and load fonts dynamically
    try {
      if (!cachedRegularFontBuffer) {
        const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
        const res = await fetch(fontUrl);
        const arrayBuffer = await res.arrayBuffer();
        cachedRegularFontBuffer = Buffer.from(arrayBuffer);
      }
      if (!cachedBoldFontBuffer) {
        const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf';
        const res = await fetch(fontUrl);
        const arrayBuffer = await res.arrayBuffer();
        cachedBoldFontBuffer = Buffer.from(arrayBuffer);
      }
      doc.registerFont('Custom-Regular', cachedRegularFontBuffer);
      doc.registerFont('Custom-Bold', cachedBoldFontBuffer);
      doc.font('Custom-Regular');
    } catch (err) {
      console.error('[PDF] Custom fonts loading failed, using Helvetica:', err.message);
    }

    const hasCustomFont = !!cachedRegularFontBuffer;
    const currencySym = hasCustomFont ? '₹' : 'Rs. ';
    const fontRegular = hasCustomFont ? 'Custom-Regular' : 'Helvetica';
    const fontBold = hasCustomFont ? 'Custom-Bold' : 'Helvetica-Bold';

    const fmtMoney = (val) => `${currencySym}${parseFloat(val || 0).toFixed(2)}`;

    // Fetch and draw logo
    try {
      if (!cachedLogoBuffer) {
        const logoUrl = 'https://res.cloudinary.com/drj19ghhl/image/upload/v1777176961/f47e171f-1606-4005-9edd-41239b24ea44_ovi6oo.jpg';
        const imgRes = await fetch(logoUrl);
        const arrayBuffer = await imgRes.arrayBuffer();
        cachedLogoBuffer = Buffer.from(arrayBuffer);
      }
      // Draw logo
      doc.image(cachedLogoBuffer, 50, 40, { width: 40 });
      doc.fontSize(16).font(fontBold).fillColor('#0057ff').text('HASHLAY', 95, 45);
    } catch (err) {
      // Fallback if image fails to load
      doc.fontSize(28).font(fontBold).fillColor('#0057ff').text('HASHLAY', 50, 50);
    }

    // Header info matches HTML invoice exactly!
    doc.fontSize(9).font(fontBold).fillColor('#6b7280').text('Protect What Moves You', 50, 85);
    doc.fontSize(8).font(fontRegular).fillColor('#6b7280')
      .text('contacthashlay@gmail.com · hashlay.in', 50, 98)
      .text('Puttur, Karnataka, India', 50, 110);

    // ── Invoice Title ────────────────────────────────────────────────
    const invNum = `INV-${order.orderId}-${new Date(order.createdAt).getFullYear()}`;
    doc.fontSize(20).font(fontBold).fillColor('#000000').text('INVOICE', 400, 50, { align: 'right' });
    doc.fontSize(10).font(fontRegular).fillColor('#6b7280')
      .text(invNum, 400, 80, { align: 'right' })
      .text(`Order: #${order.orderId}`, 400, 95, { align: 'right' })
      .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, 400, 110, { align: 'right' })
      .text(`Status: ${order.orderStatus?.toUpperCase()}`, 400, 125, { align: 'right' });

    // ── Divider ──────────────────────────────────────────────────────
    doc.moveTo(50, 145).lineTo(545, 145).strokeColor('#0057ff').lineWidth(2).stroke();

    // ── Billing / Shipping ───────────────────────────────────────────
    const addr = order.address || {};
    let addrStr = '';
    if (typeof addr === 'string') {
      addrStr = addr;
    } else {
      addrStr = [addr.fullName || order.customerName, addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.pincode, addr.country || 'India'].filter(Boolean).join(', ');
    }

    doc.fontSize(9).font(fontBold).fillColor('#9ca3af').text('BILL TO', 50, 165);
    doc.fontSize(9).font(fontRegular).fillColor('#111111')
      .text(order.customerName || '', 50, 180, { width: 250 })
      .text(`Phone: ${order.customerPhone || addr.phone || ''}`, 50, 192, { width: 250 })
      .text(`Email: ${order.customerEmail || ''}`, 50, 204, { width: 250 })
      .text(addrStr, 50, 216, { width: 250, lineGap: 2 });

    doc.fontSize(9).font(fontBold).fillColor('#9ca3af').text('PAYMENT DETAILS', 350, 165);
    
    let displayMethod = 'Online Payment (Razorpay)';
    if (order.paymentMethod === 'cod') {
      displayMethod = 'Cash on Delivery';
    } else if (order.paymentMethod === 'upi') {
      displayMethod = 'UPI Payment';
    }
    
    doc.fontSize(9).font(fontRegular).fillColor('#111111')
      .text(`Method: ${displayMethod}`, 350, 180, { width: 195 })
      .text(`Payment Status: ${order.paymentStatus?.toUpperCase()}`, 350, 192, { width: 195 });

    // ── Items Table ──────────────────────────────────────────────────
    const tableTop = 275;
    doc.moveTo(50, tableTop - 10).lineTo(545, tableTop - 10).strokeColor('#e5e7eb').lineWidth(1).stroke();

    doc.font(fontBold).fontSize(8).fillColor('#9ca3af')
      .text('#',         50,  tableTop)
      .text('PRODUCT',   70,  tableTop)
      .text('QTY',      370,  tableTop, { width: 40,  align: 'center' })
      .text('UNIT PRICE', 420,  tableTop, { width: 60,  align: 'right'  })
      .text('TOTAL',    490,  tableTop, { width: 55,  align: 'right'  });

    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor('#e5e7eb').stroke();

    let y = tableTop + 25;
    (order.items || []).forEach((item, i) => {
      const rowBg = i % 2 === 0 ? '#f9fafb' : '#ffffff';
      doc.rect(50, y - 4, 495, 18).fill(rowBg);
      doc.font(fontRegular).fontSize(8).fillColor('#111111')
        .text(i + 1,              50,  y)
        .text(item.name,          70,  y, { width: 290 })
        .text(item.quantity,     370,  y, { width: 40,  align: 'center' })
        .text(fmtMoney(item.price), 420, y, { width: 60, align: 'right' })
        .text(fmtMoney(item.total || (item.price * item.quantity)), 490, y, { width: 55, align: 'right' });
      y += 22;
    });

    doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor('#e5e7eb').stroke();

    // ── Totals ───────────────────────────────────────────────────────
    y += 15;
    const addTotalRow = (label, val, bold = false, color = '#111111') => {
      doc.font(bold ? fontBold : fontRegular).fontSize(bold ? 10 : 8.5)
        .fillColor(color)
        .text(label,  350, y, { width: 130 })
        .text(val, 480, y, { width: 65, align: 'right' });
      y += bold ? 18 : 14;
    };

    const subtotal = order.subtotal || order.total;
    const deliveryCharge = order.deliveryCharge || 0;
    const codCharge = order.codCharge || 0;
    const discount = order.discount || 0;

    addTotalRow('Subtotal', fmtMoney(subtotal));
    addTotalRow('Delivery Charge', deliveryCharge === 0 ? 'FREE' : fmtMoney(deliveryCharge), false, deliveryCharge === 0 ? '#22c55e' : '#111111');
    if (codCharge) addTotalRow('COD Handling', fmtMoney(codCharge));
    if (discount) addTotalRow(`Discount${order.couponCode ? ' (' + order.couponCode + ')' : ''}`, `-${fmtMoney(discount)}`, false, '#22c55e');
    
    doc.moveTo(350, y).lineTo(545, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
    y += 8;
    addTotalRow('TOTAL', fmtMoney(order.total), true, '#0057ff');

    // ── Footer ───────────────────────────────────────────────────────
    doc.fontSize(8.5).font(fontRegular).fillColor('#9ca3af')
      .text('Thank you for shopping with Hashlay!', 50, 720, { align: 'center', width: 495 })
      .text('For support: contacthashlay@gmail.com | WhatsApp: +917483138340', 50, 735, { align: 'center', width: 495 })
      .text('This is a computer-generated invoice and does not require a signature.', 50, 750, { align: 'center', width: 495 });

    doc.end(); // triggers 'end' event → sends buffer
  });
};

const generateInvoicePDF = async (order, res) => {
  try {
    const pdfBuffer = await generateInvoiceBuffer(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=invoice-' + order.orderId + '.pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error generating invoice' });
  }
};

module.exports = { generateInvoicePDF, generateInvoiceBuffer };