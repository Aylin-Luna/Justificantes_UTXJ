'use strict';

const crypto = require('crypto');
const config = require('../../config');
const { forbidden } = require('../utils/errors');

const CSRF_COOKIE = 'utxj_csrf';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const cookieOptions = {
  httpOnly: false,
  secure: config.cookie.secure,
  sameSite: 'strict',
  path: '/',
  maxAge: config.cookie.maxAgeMs,
};

const issueCsrfToken = (res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, cookieOptions);
  return token;
};

const clearCsrfToken = (res) => {
  res.clearCookie(CSRF_COOKIE, { ...cookieOptions, maxAge: undefined });
};

const safeEqual = (first, second) => {
  if (typeof first !== 'string' || typeof second !== 'string') return false;
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const verifyCsrf = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken = req.cookies ? req.cookies[CSRF_COOKIE] : null;
  const headerToken = req.get(CSRF_HEADER);
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return next(forbidden('La solicitud no incluye un token de seguridad válido. Recargue la página.'));
  }
  return next();
};

module.exports = {
  CSRF_COOKIE,
  CSRF_HEADER,
  issueCsrfToken,
  clearCsrfToken,
  verifyCsrf,
};
