const PDFDocument = require('pdfkit');
const fs = require('fs');

async function test() {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream('test_output.pdf');
  doc.pipe(stream);

  try {
    console.log('Fetching fonts...');
    const regularRes = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf');
    const regularArrayBuffer = await regularRes.arrayBuffer();
    const regularBuffer = Buffer.from(regularArrayBuffer);
    console.log('Regular font loaded:', regularBuffer.length, 'bytes');

    const boldRes = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf');
    const boldArrayBuffer = await boldRes.arrayBuffer();
    const boldBuffer = Buffer.from(boldArrayBuffer);
    console.log('Bold font loaded:', boldBuffer.length, 'bytes');

    doc.registerFont('Roboto-Regular', regularBuffer);
    doc.registerFont('Roboto-Bold', boldBuffer);

    doc.font('Roboto-Regular').fontSize(12).text('Hello World! Indian Rupee: ₹249.00');
    doc.font('Roboto-Bold').fontSize(12).text('Bold text! Indian Rupee: ₹249.00');
  } catch (err) {
    console.error('Error fetching/registering fonts:', err);
    doc.font('Helvetica').fontSize(12).text('Hello World! Fallback Rs. 249.00');
  }

  doc.end();
  console.log('PDF generation initiated.');
}

test();
