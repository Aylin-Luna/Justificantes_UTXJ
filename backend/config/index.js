'use strict';

const path = require('path');

const number = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'si', 'sí'].includes(String(value).toLowerCase());
};

const backendRoot = path.resolve(__dirname, '..');

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: number(process.env.PORT, 3000),
  backendRoot,
  frontendRoot: path.resolve(backendRoot, '..', 'frontend'),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: number(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'db_justificantes_utxj',
    connectionLimit: number(process.env.DB_CONNECTION_LIMIT, 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'utxj-desarrollo-clave-local-no-usar-en-produccion',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  cookie: {
    name: process.env.COOKIE_NAME || 'utxj_sesion',
    secure: bool(process.env.COOKIE_SECURE, false),
    maxAgeMs: 8 * 60 * 60 * 1000,
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  uploads: {
    root: path.resolve(backendRoot, process.env.UPLOAD_ROOT || 'uploads'),
    documents: 'private/documents',
    signatures: 'private/signatures',
    stamps: 'private/stamps',
    maxBytes: number(process.env.MAX_FILE_SIZE_MB, 5) * 1024 * 1024,
    allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  security: {
    bcryptRounds: number(process.env.BCRYPT_ROUNDS, 12),
    loginMaxAttempts: number(process.env.LOGIN_MAX_ATTEMPTS, 5),
    loginLockMinutes: number(process.env.LOGIN_LOCK_MINUTES, 15),
  },
};

config.cookie.maxAgeMs = config.cookie.maxAgeMs;

module.exports = config;
