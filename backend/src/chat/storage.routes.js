const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errors');

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, and common doc types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new AppError('File type not supported', 400, 'UNSUPPORTED_FILE_TYPE'));
  }
});

/**
 * POST /chat/upload
 * Upload a file and return its metadata
 */
router.post('/upload', authMiddleware, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400, 'NO_FILE_UPLOADED');
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  
  res.status(201).json({
    url: fileUrl,
    filename: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
  });
}));

module.exports = router;
