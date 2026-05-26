const Product = require('../models/Product');
const { notifyLowStock } = require('../services/notificationService');
const csv = require('fast-csv');
const { cloudinary } = require('../config/cloudinary');
const slugify = require('../utils/slugify');
const { getOrSet, invalidate } = require('../config/cache');

exports.getProducts = async (req, res) => {
  const { page = 1, limit = 20, search, category, status, featured, sort = '-createdAt' } = req.query;
  const query = { isActive: true };

  if (search) query.$text = { $search: search };
  if (category) query.category = category;
  if (featured === 'true') query.isFeatured = true;
  if (status === 'in_stock') { query.stock = { $gt: 9 }; }
  else if (status === 'low_stock') { query.stock = { $gt: 0, $lt: 10 }; }
  else if (status === 'out_of_stock') { query.stock = 0; }

  // Cache product listings for 30s (short TTL so stock changes reflect quickly)
  const cacheKey = `products:list:${JSON.stringify({ page, limit, search, category, status, featured, sort })}`;
  const result = await getOrSet(cacheKey, 30, async () => {
    const opts = { page: parseInt(page), limit: parseInt(limit), sort, lean: true };
    return Product.paginate(query, opts);
  });

  res.json({ success: true, data: result });
};

exports.getProduct = async (req, res) => {
  const product = await getOrSet(`products:id:${req.params.id}`, 60, async () => {
    return Product.findOne({ _id: req.params.id, isActive: true }).lean();
  });
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  res.json({ success: true, data: product });
};

exports.getProductBySlug = async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true });
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  product.views = (product.views || 0) + 1;
  await product.save();
  res.json({ success: true, data: product });
};

exports.getFeaturedProducts = async (req, res) => {
  // Cache featured products for 60s — these change rarely
  const products = await getOrSet('products:featured', 60, async () => {
    return Product.find({ isFeatured: true, isActive: true, stock: { $gt: 0 } })
      .sort('-updatedAt').limit(12).lean();
  });
  res.json({ success: true, data: products });
};

exports.createProduct = async (req, res) => {
  const data = req.body;
  if (!data.slug) data.slug = slugify(data.name) + '-' + Date.now();

  if (data.isHero) {
    await Product.updateMany({}, { isHero: false });
  }

  const product = await Product.create(data);
  if (product.stock > 0 && product.stock < 10) await notifyLowStock(product);

  // Bust product caches on create
  invalidate('products:');

  res.status(201).json({ success: true, data: product, message: 'Product created' });
};

exports.updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product || !product.isActive) return res.status(404).json({ success: false, message: 'Product not found' });

  if (req.body.isHero && !product.isHero) {
    await Product.updateMany({ _id: { $ne: product._id } }, { isHero: false });
  }

  Object.assign(product, req.body);
  if (product.stock === 0) product.inStock = false;
  if (product.stock > 0) product.inStock = true;
  await product.save();

  if (product.stock > 0 && product.stock < 10) await notifyLowStock(product);

  // Bust product caches on update
  invalidate('products:');

  res.json({ success: true, data: product, message: 'Product updated' });
};

exports.deleteProduct = async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  // Bust product caches on delete
  invalidate('products:');

  const { sendAdminNotification } = require('../services/emailService');
  await sendAdminNotification(
    `Product Deleted: ${product.name}`,
    `<div style="font-family:sans-serif;background:#fff1f2;padding:20px;border-radius:8px;">
      <h2 style="color:#be123c;margin-top:0;">Product Permanently Deleted</h2>
      <p><strong>Product ID:</strong> ${product._id}</p>
      <p><strong>Name:</strong> ${product.name}</p>
      <p><strong>Category:</strong> ${product.category}</p>
      <p><strong>Deleted By Admin IP:</strong> ${req.ip}</p>
    </div>`
  ).catch(() => {});

  res.json({ success: true, message: 'Product deleted' });
};

exports.toggleFeatured = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  product.isFeatured = !product.isFeatured;
  await product.save();

  invalidate('products:');

  res.json({ success: true, data: product, message: `Product ${product.isFeatured ? 'featured' : 'unfeatured'}` });
};

exports.bulkAction = async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || !ids.length)
    return res.status(400).json({ success: false, message: 'No IDs provided' });

  if (action === 'delete') {
    // Actually delete products from the database
    await Product.deleteMany({ _id: { $in: ids } });
  } else {
    let update = {};
    if (action === 'feature') update = { isFeatured: true };
    if (action === 'unfeature') update = { isFeatured: false };
    if (action === 'activate') update = { inStock: true };
    await Product.updateMany({ _id: { $in: ids } }, update);
  }

  invalidate('products:');

  res.json({ success: true, message: `Bulk action "${action}" applied to ${ids.length} products` });
};

exports.getCategories = async (req, res) => {
  // Cache categories for 120s — they change very rarely
  const cats = await getOrSet('products:categories', 120, async () => {
    return Product.distinct('category', { isActive: true });
  });
  res.json({ success: true, data: cats });
};

exports.exportCSV = async (req, res) => {
  const products = await Product.find({ isActive: true }).lean();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
  const csvStream = csv.format({ headers: true });
  csvStream.pipe(res);
  products.forEach(p => csvStream.write({
    Name: p.name, Category: p.category, Price: p.price, OfferPrice: p.offerPrice || '',
    Stock: p.stock, Description: p.shortDescription || '', Featured: p.isFeatured,
    Images: (p.images || []).join('|'),
  }));
  csvStream.end();
};

exports.importCSV = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
  const results = []; const errors = [];
  const parser = require('csv-parser');
  const { Readable } = require('stream');

  await new Promise((resolve) => {
    Readable.from(req.file.buffer)
      .pipe(parser())
      .on('data', row => results.push(row))
      .on('end', resolve)
      .on('error', resolve);
  });

  let imported = 0;
  for (const row of results) {
    try {
      await Product.create({
        name: row.Name || row.name,
        category: row.Category || row.category || 'General',
        price: parseFloat(row.Price || row.price) || 0,
        offerPrice: parseFloat(row.OfferPrice || row.offer_price) || null,
        stock: parseInt(row.Stock || row.stock) || 0,
        shortDescription: row.Description || row.description || '',
        images: (row.Images || row.images || '').split('|').filter(Boolean),
        isFeatured: (row.Featured || row.featured) === 'true',
      });
      imported++;
    } catch (e) { errors.push({ row, error: e.message }); }
  }

  invalidate('products:');

  res.json({ success: true, message: `Imported ${imported} products`, errors });
};
