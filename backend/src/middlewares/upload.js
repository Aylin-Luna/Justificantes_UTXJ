'use strict';

const multer = require('multer');
const config = require('../../config');
const { AppError } = require('../utils/errors');

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  const allowedMime = config.uploads.allowedMimeTypes.includes(file.mimetype);
  const extension = String(file.originalname || '').split('.').pop().toLowerCase();
  const allowedExtension = config.uploads.allowedExtensions.includes(extension);
  if (!allowedMime || !allowedExtension) {
    return callback(new AppError(400, 'Solo se permiten comprobantes PDF, JPG o PNG', {
      code: 'ARCHIVO_INVALIDO',
    }));
  }
  return callback(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.uploads.maxBytes,
    files: 1,
    fields: 60,
  },
});

const singleFile = (field = 'archivo') => (req, res, next) => {
  upload.single(field)(req, res, (error) => {
    if (error) return next(error);
    return next();
  });
};

module.exports = { singleFile };
