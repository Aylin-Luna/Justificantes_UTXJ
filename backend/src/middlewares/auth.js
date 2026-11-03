'use strict';

const config = require('../../config');
const authModel = require('../models/auth.model');
const authService = require('../services/auth.service');
const { asyncHandler, unauthorized, forbidden } = require('../utils/errors');

const extractToken = (req) => {
  const cookieToken = req.cookies ? req.cookies[config.cookie.name] : null;
  if (cookieToken) return cookieToken;
  const header = req.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return null;
};

const loadUser = async (req) => {
  const token = extractToken(req);
  if (!token) return null;
  let payload;
  try {
    payload = authService.verifyToken(token);
  } catch (error) {
    return null;
  }
  const user = await authModel.findPublicById(payload.sub);
  if (!user || !user.active) return null;
  return user;
};

const authenticate = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw unauthorized();
  const user = await loadUser(req);
  if (!user) throw unauthorized('La sesión expiró o no es válida. Inicie sesión de nuevo.');
  req.user = user;
  next();
});

const optionalAuth = asyncHandler(async (req, res, next) => {
  req.user = await loadUser(req);
  next();
});

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(unauthorized());
  const allowed = roles.some((role) => req.user.roles.includes(role));
  if (!allowed) {
    return next(forbidden('Su perfil no tiene permiso para esta operación'));
  }
  return next();
};

const requireStudent = (req, res, next) => {
  if (!req.user) return next(unauthorized());
  if (!req.user.roles.includes('alumno') || !req.user.idStudent) {
    return next(forbidden('Esta operación es exclusiva del alumnado'));
  }
  return next();
};

module.exports = {
  authenticate,
  optionalAuth,
  requireRole,
  requireStudent,
  extractToken,
};
