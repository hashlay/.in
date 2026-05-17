const cloudinary        = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer            = require('multer');

// cloudinary v1 config (compatible with multer-storage-cloudinary@4)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const fs = require('fs');
const path = require('path');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const useCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

let productStorage, bannerStorage, avatarStorage;

if (useCloudinary) {
  productStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder:           'hashlay/products',
      allowed_formats:  ['jpg', 'jpeg', 'png', 'webp'],
      transformation:   [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto:good' }],
    },
  });

  bannerStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder:           'hashlay/banners',
      allowed_formats:  ['jpg', 'jpeg', 'png', 'webp'],
      transformation:   [{ width: 1920, height: 800, crop: 'limit', quality: 'auto:best' }],
    },
  });

  avatarStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder:          'hashlay/avatars',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    },
  });
} else {
  // Fallback to local disk storage
  const localDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  });
  productStorage = localDiskStorage;
  bannerStorage = localDiskStorage;
  avatarStorage = localDiskStorage;
}

exports.uploadProduct = multer({
  storage: productStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/'))
      return cb(new Error('Only image files allowed'));
    cb(null, true);
  },
});

exports.uploadBanner = multer({
  storage: bannerStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

exports.uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

exports.cloudinary = cloudinary;
