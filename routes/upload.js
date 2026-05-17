const express = require('express');
const r = express.Router();
const { verifyToken } = require('../middleware/auth');
const { uploadProduct, uploadBanner, cloudinary } = require('../config/cloudinary');
const multer = require('multer');

// ── Helper: wrap multer middleware to catch errors gracefully ──
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: 'Upload error: ' + err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
  }
  next();
}

// ── Product Images ──
r.post('/product', verifyToken, (req, res, next) => {
  uploadProduct.array('images', 8)(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files uploaded' });
    const urls = req.files.map(f => {
      if (f.path.startsWith('http')) return f.path;
      return `${req.protocol}://${req.get('host')}/uploads/${f.filename}`;
    });
    res.json({ success: true, urls, message: `${urls.length} image(s) uploaded` });
  });
});

// ── Banner Images ──
r.post('/banner', verifyToken, (req, res, next) => {
  const memUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  }).single('image');

  memUpload(req, res, async (err) => {
    try {
      if (err) return handleMulterError(err, req, res, next);
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'hashlay/banners',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            transformation: [{ width: 1920, height: 800, crop: 'limit', quality: 'auto:best' }]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        // Prevent stream errors from causing unhandled exceptions
        uploadStream.on('error', (e) => reject(e));
        uploadStream.end(req.file.buffer);
      });
      res.json({ success: true, url: result.secure_url });
    } catch (e) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Image upload failed: ' + e.message });
      }
    }
  });
});

// ── Video Upload (MP4, WebM, etc.) via Cloudinary ──
r.post('/video', verifyToken, async (req, res) => {
  // Use multer for basic file handling (memory storage for video)
  const memUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max for videos
    fileFilter: (req, file, cb) => {
      const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only video files (MP4, WebM, MOV, AVI) are allowed'));
      }
    }
  }).single('video');

  memUpload(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Video upload failed' });
      if (!req.file) return res.status(400).json({ success: false, message: 'No video file selected' });

      // Upload to Cloudinary as video resource
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
            folder: 'hashlay/videos',
            allowed_formats: ['mp4', 'webm', 'mov', 'avi'],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        // Prevent stream errors from causing unhandled exceptions
        uploadStream.on('error', (e) => reject(e));
        uploadStream.end(req.file.buffer);
      });

      res.json({ success: true, url: result.secure_url });
    } catch (e) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Video upload failed: ' + e.message });
      }
    }
  });
});

// ── Delete Image/Video ──
r.delete('/image', verifyToken, async (req, res) => {
  const { publicId } = req.body;
  if (!publicId) return res.status(400).json({ success: false, message: 'publicId required' });
  try {
    await cloudinary.uploader.destroy(publicId);
    res.json({ success: true, message: 'Image deleted' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = r;
