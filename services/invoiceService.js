const PDFDocument = require('pdfkit');

let cachedLogoBuffer = null;

const generateInvoicePDF = (order, res) => {
  return new Promise(async (resolve, reject) => {
    const doc     = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];

    doc.on('data',  chunk => buffers.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
      resolve();
    });

    // Fetch and draw logo
    try {
      if (!cachedLogoBuffer) {
        const logoUrl = 'https://res.cloudinary.com/drj19ghhl/image/upload/v1777176961/f47e171f-1606-4005-9edd-41239b24ea44_ovi6oo.jpg';
        const imgRes = await fetch(logoUrl);
        const arrayBuffer = await imgRes.arrayBuffer();
        cachedLogoBuffer = Buffer.from(arrayBuffer);
      }
      // Draw image
      doc.image(cachedLogoBuffer, 50, 40, { width: 40 });
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0057ff').text('HASHLAY', 95, 45);
    } catch (err) {
      // Fallback if image fails to load
      doc.fontSize(28).font('Helvetica-Bold').fillColor('#0057ff').text('HASHLAY', 50, 50);
    }

    doc.fontSize(10).fillColor('#666666').text('Deserved Care For Everything You Own', 50, 85);
    doc.fontSize(9).text('support@hashlay.in  |  www.hashlay.in', 50, 100);

    // ── Invoice Title ────────────────────────────────────────────────
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#000000').text('INVOICE', 400, 50, { align: 'right' });
    doc.fontSize(10).font('Helvetica').fillColor('#333333')
      .text(`Invoice #: ${order.orderId}`, 400, 80, { align: 'right' })
      .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 400, 95, { align: 'right' })
      .text(`Status: ${order.orderStatus?.toUpperCase()}`, 400, 110, { align: 'right' });

    // ── Divider ──────────────────────────────────────────────────────
    doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#0057ff').lineWidth(2).stroke();

    // ── Billing / Shipping ───────────────────────────────────────────
    const addr = order.address || {};
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text('BILL TO:', 50, 150);
    doc.font('Helvetica').fillColor('#333')
      .text(order.customerName || '', 50, 165)
      .text(addr.addressLine1 || '', 50, 180)
      .text(`${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`, 50, 195)
      .text(`Phone: ${order.customerPhone || addr.phone || ''}`, 50, 210);

    doc.font('Helvetica-Bold').fillColor('#000').text('PAYMENT:', 350, 150);
    doc.font('Helvetica').fillColor('#333')
      .text(`Method: ${order.paymentMethod?.toUpperCase()}`, 350, 165)
      .text(`Status: ${order.paymentStatus?.toUpperCase()}`, 350, 180);

    // ── Items Table ──────────────────────────────────────────────────
    const tableTop = 245;
    doc.moveTo(50, tableTop - 10).lineTo(545, tableTop - 10).strokeColor('#dddddd').lineWidth(1).stroke();

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0057ff')
      .text('#',         50,  tableTop)
      .text('PRODUCT',   70,  tableTop)
      .text('QTY',      370,  tableTop, { width: 40,  align: 'center' })
      .text('PRICE',    420,  tableTop, { width: 60,  align: 'right'  })
      .text('TOTAL',    490,  tableTop, { width: 55,  align: 'right'  });

    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).strokeColor('#dddddd').stroke();

    let y = tableTop + 25;
    (order.items || []).forEach((item, i) => {
      const rowBg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
      doc.rect(50, y - 4, 495, 18).fill(rowBg);
      doc.font('Helvetica').fontSize(9).fillColor('#333')
        .text(i + 1,              50,  y)
        .text(item.name,          70,  y, { width: 290 })
        .text(item.quantity,     370,  y, { width: 40,  align: 'center' })
        .text(`₹${item.price?.toFixed(2)}`, 420, y, { width: 60, align: 'right' })
        .text(`₹${item.total?.toFixed(2)}`, 490, y, { width: 55, align: 'right' });
      y += 22;
    });

    doc.moveTo(50, y + 5).lineTo(545, y + 5).strokeColor('#dddddd').stroke();

    // ── Totals ───────────────────────────────────────────────────────
    y += 15;
    const addTotalRow = (label, amount, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9)
        .fillColor(bold ? '#0057ff' : '#333')
        .text(label,  380, y, { width: 100 })
        .text(`₹${parseFloat(amount || 0).toFixed(2)}`, 490, y, { width: 55, align: 'right' });
      y += bold ? 18 : 14;
    };

    addTotalRow('Subtotal:',     order.subtotal);
    if (order.discount)       addTotalRow('Discount:',      `-${order.discount}`);
    if (order.deliveryCharge) addTotalRow('Delivery:',       order.deliveryCharge);
    if (order.codCharge)      addTotalRow('COD Charge:',     order.codCharge);
    doc.moveTo(380, y).lineTo(545, y).strokeColor('#0057ff').lineWidth(1).stroke();
    y += 8;
    addTotalRow('GRAND TOTAL:',  order.total, true);

    // ── Footer ───────────────────────────────────────────────────────
    doc.fontSize(8).font('Helvetica').fillColor('#999999')
      .text('Thank you for shopping with Hashlay!', 50, 740, { align: 'center', width: 495 })
      .text('This is a computer-generated invoice and does not require a signature.', 50, 755, { align: 'center', width: 495 });

    doc.end(); // triggers 'end' event → sends buffer
  });
};

module.exports = generateInvoicePDF;