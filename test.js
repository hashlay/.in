const mongoose = require('mongoose');
const Order = require('./models/Order');

async function run() {
  await mongoose.connect('mongodb+srv://adminanti:ycNFxFoUiVN0fxxf@hashlay.qr6bfyn.mongodb.net/?appName=HASHLAY');
  
  try {
    const o1 = new Order({
      customerName: 'Test1', total: 100, subtotal: 100,
      items: [{name: 'Item', price: 100, quantity: 1, total: 100}]
    });
    await o1.save();
    console.log('Order 1 saved:', o1.orderId);

    const o2 = new Order({
      customerName: 'Test2', total: 100, subtotal: 100,
      items: [{name: 'Item', price: 100, quantity: 1, total: 100}]
    });
    await o2.save();
    console.log('Order 2 saved:', o2.orderId);
  } catch (err) {
    console.error('ERROR:', err);
  }
  process.exit();
}
run();
