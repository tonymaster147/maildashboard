const multer = require('multer');
const path = require('path');

// Allowed file types
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-rar-compressed',
  'video/mp4',
  'audio/mpeg'
];

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB per file
const MAX_FILES = 10;

const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueSuffix + '-' + safeName);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES
  }
});

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 30MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 10 files.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

// ────────────── Chat attachment uploader (10 MB, single file, narrower whitelist) ──────────────

const CHAT_ALLOWED_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/rtf',
  'text/rtf',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

const CHAT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const chatFileFilter = (req, file, cb) => {
  if (CHAT_ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`File type ${file.mimetype} is not allowed in chat`), false);
};

const chatUpload = multer({
  storage,
  fileFilter: chatFileFilter,
  limits: { fileSize: CHAT_MAX_FILE_SIZE, files: 1 }
});

const handleChatUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Chat attachments are limited to 10 MB.' });
    if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'Only one file per message.' });
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
};

// ────────────── Profile photo uploader (5 MB, single image, modern formats) ──────────────
// Used by the admin tutor-photo upload. We accept the modern image MIME
// types (avif, heic, heif) that Chrome and iPhone camera roll emit by
// default — the general document uploader above doesn't know about these.

const PHOTO_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
];

const PHOTO_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const photoFileFilter = (req, file, cb) => {
  if (PHOTO_ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`Image type ${file.mimetype} is not supported (use JPG, PNG, WEBP, GIF, AVIF, or HEIC).`), false);
};

const photoUpload = multer({
  storage,
  fileFilter: photoFileFilter,
  limits: { fileSize: PHOTO_MAX_FILE_SIZE, files: 1 },
});

const handlePhotoUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Photo too large. Maximum is 5 MB.' });
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
};

module.exports = {
  upload, handleUploadError,
  chatUpload, handleChatUploadError,
  photoUpload, handlePhotoUploadError,
};
