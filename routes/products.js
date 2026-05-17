const express = require('express');
const r = express.Router();
const c = require('../controllers/productController');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Public routes (customer website reads these)
r.get('/',           c.getProducts);
r.get('/featured',   c.getFeaturedProducts);
r.get('/categories', c.getCategories);
r.get('/slug/:slug', c.getProductBySlug);
r.get('/:id',        c.getProduct);

// Public: reviews for a product
const { getProductReviews } = require('../controllers/miscControllers');
r.get('/:id/reviews', getProductReviews);

// Admin routes
r.post('/',                verifyToken, c.createProduct);
r.put('/:id',              verifyToken, c.updateProduct);
r.patch('/:id',            verifyToken, c.updateProduct);
r.delete('/:id',           verifyToken, c.deleteProduct);
r.patch('/:id/featured',   verifyToken, c.toggleFeatured);
r.post('/bulk/action',     verifyToken, c.bulkAction);
r.get('/export/csv',       verifyToken, c.exportCSV);
r.post('/import/csv',      verifyToken, upload.single('file'), c.importCSV);

module.exports = r;
