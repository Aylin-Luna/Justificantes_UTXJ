'use strict';

const rateLimit = require('express-rate-limit');
const { tooManyRequests } = require('../utils/errors');

const handler = (req, res, next, options) => {
  next(tooManyRequests(options.message));
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Demasiados intentos de inicio de sesión. Espere 15 minutos.',
  handler,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Demasiados registros desde esta conexión. Espere una hora o acuda a Control Escolar.',
  handler,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Demasiadas solicitudes. Intente de nuevo en unos minutos.',
  handler,
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Demasiadas operaciones seguidas. Espere un momento.',
  handler,
});

module.exports = { loginLimiter, registerLimiter, apiLimiter, writeLimiter };
