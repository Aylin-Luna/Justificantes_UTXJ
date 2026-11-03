'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { badRequest, notFound } = require('./errors');

const EXTENSION_BY_MIME = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

const MIME_BY_EXTENSION = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

const ensureDirectories = () => {
  [
    config.uploads.root,
    path.join(config.uploads.root, config.uploads.documents),
    path.join(config.uploads.root, config.uploads.signatures),
    path.join(config.uploads.root, config.uploads.stamps),
  ].forEach((directory) => fs.mkdirSync(directory, { recursive: true }));
};

const randomFileName = (extension) => {
  const safeExtension = String(extension).toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${Date.now()}-${crypto.randomBytes(12).toString('hex')}.${safeExtension}`;
};

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const relativeStoragePath = (folder, storedName) => `${folder}/${storedName}`;

const absolutePathFromStorage = (storagePath) => {
  if (!storagePath || typeof storagePath !== 'string') {
    throw badRequest('La ruta del archivo es inválida');
  }
  const normalized = storagePath.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/') || normalized.includes(':')) {
    throw badRequest('La ruta del archivo es inválida');
  }
  const absolute = path.resolve(config.uploads.root, normalized);
  const root = path.resolve(config.uploads.root);
  if (!absolute.startsWith(root + path.sep)) {
    throw badRequest('La ruta del archivo está fuera del directorio permitido');
  }
  return absolute;
};

const writePrivateFile = (folder, storedName, buffer) => {
  const absolute = absolutePathFromStorage(`${folder}/${storedName}`);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, buffer);
  return absolute;
};

const removePrivateFile = (storagePath) => {
  try {
    const absolute = absolutePathFromStorage(storagePath);
    if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
    return true;
  } catch (error) {
    console.error('[archivos] No se pudo eliminar el archivo:', error.message);
    return false;
  }
};

const readPrivateFile = (storagePath) => {
  const absolute = absolutePathFromStorage(storagePath);
  if (!fs.existsSync(absolute)) throw notFound('El archivo ya no está disponible');
  return fs.readFileSync(absolute);
};

const fileExists = (storagePath) => {
  try {
    return fs.existsSync(absolutePathFromStorage(storagePath));
  } catch (error) {
    return false;
  }
};

const extensionFromUpload = (file) => {
  const fromName = path.extname(file.originalname || '').replace('.', '').toLowerCase();
  if (config.uploads.allowedExtensions.includes(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName;
  return EXTENSION_BY_MIME[file.mimetype] || null;
};

const validateUploadedFile = (file) => {
  if (!file) return null;
  const extension = extensionFromUpload(file);
  if (!extension || !config.uploads.allowedExtensions.includes(extension)) {
    throw badRequest('Solo se permiten archivos PDF, JPG o PNG');
  }
  if (!config.uploads.allowedMimeTypes.includes(file.mimetype)) {
    throw badRequest('El tipo de archivo no es válido. Solo PDF, JPG o PNG');
  }
  if (!file.size || file.size > config.uploads.maxBytes) {
    throw badRequest(`El archivo debe pesar más de 0 bytes y máximo ${config.uploads.maxBytes / (1024 * 1024)} MB`);
  }
  return {
    extension,
    mimeType: MIME_BY_EXTENSION[extension],
    size: file.size,
    originalName: path.basename(file.originalname || `archivo.${extension}`).slice(0, 255),
  };
};

/**
 * Guarda el archivo subido en la carpeta privada de documentos y devuelve
 * los metadatos que espera la base de datos.
 */
const persistUploadedDocument = (file) => {
  const metadata = validateUploadedFile(file);
  if (!metadata) return null;
  const storedName = randomFileName(metadata.extension);
  const folder = config.uploads.documents;
  writePrivateFile(folder, storedName, file.buffer);
  return {
    ...metadata,
    storedName,
    storagePath: relativeStoragePath(folder, storedName),
    checksum: sha256(file.buffer),
  };
};

const persistGeneratedSvg = (folder, prefix, svg) => {
  const buffer = Buffer.from(svg, 'utf8');
  const storedName = `${prefix}-${randomFileName('svg').replace(/\.svg$/, '')}.svg`;
  writePrivateFile(folder, storedName, buffer);
  return {
    storedName,
    storagePath: relativeStoragePath(folder, storedName),
    checksum: sha256(buffer),
  };
};

module.exports = {
  ensureDirectories,
  randomFileName,
  sha256,
  relativeStoragePath,
  absolutePathFromStorage,
  writePrivateFile,
  removePrivateFile,
  readPrivateFile,
  fileExists,
  validateUploadedFile,
  persistUploadedDocument,
  persistGeneratedSvg,
  MIME_BY_EXTENSION,
  EXTENSION_BY_MIME,
};
