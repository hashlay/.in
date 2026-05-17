const mongoose = require('mongoose');
const paginate = require('mongoose-paginate-v2');
const slugify  = require('../utils/slugify');

const productSchema = new mongoose.Schema({
  name:             { type: String, required: true, trim: true },
  slug:             { type: String, unique: true, lowercase: true },
  category:         { type: String, required: true, trim: true },
  price:            { type: Number, required: true, min: 0 },
  offerPrice:       { type: Number, default: null, min: 0 },
  shortDescription: { type: String, trim: true, maxlength: 300 },
  description:      { type: String, trim: true },
  aboutProduct:     { type: String, trim: true },
  keyFeatures:      [{ type: String, trim: true }],
  usageInstructions:{ type: String, trim: true },
  reviewCount:      { type: Number, default: 0 },
  rating:           { type: Number, default: 4.5, min: 0, max: 5 },
  stock:            { type: Number, default: 0, min: 0 },
  images:           [{ type: String }],
  offerBadge:       { type: String, default: '' },
  inStock:          { type: Boolean, default: true },
  isFeatured:       { type: Boolean, default: false },
  isHero:           { type: Boolean, default: false },
  tags:             [{ type: String, trim: true }],
  ratings:          { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
  sales:            { type: Number, default: 0 },
  views:            { type: Number, default: 0 },
  isActive:         { type: Boolean, default: true },
  meta: {
    title:          { type: String },
    description:    { type: String },
    keywords:       { type: String },
  },
}, { timestamps: true });

productSchema.pre('save', function (next) {
  if (!this.slug || this.isModified('name')) {
    this.slug = slugify(this.name) + '-' + Date.now();
  }
  if (this.stock === 0)  this.inStock = false;
  if (this.stock > 0  && !this.inStock) this.inStock = true;
  next();
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

productSchema.virtual('stockStatus').get(function () {
  if (this.stock === 0)  return 'out_of_stock';
  if (this.stock < 10)   return 'low_stock';
  return 'in_stock';
});

productSchema.plugin(paginate);
productSchema.index({ name: 'text', category: 'text', tags: 'text' });
productSchema.index({ category: 1, isFeatured: 1, isActive: 1 });

module.exports = mongoose.model('Product', productSchema);
