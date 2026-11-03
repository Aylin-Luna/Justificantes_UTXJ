'use strict';

const config = require('../../config');
const authService = require('../services/auth.service');
const authModel = require('../models/auth.model');
const { asyncHandler, badRequest } = require('../utils/errors');
const { issueCsrfToken, clearCsrfToken, CSRF_COOKIE } = require('../middlewares/csrf');

const cookieOptions = {
  httpOnly: true,
  secure: config.cookie.secure,
  sameSite: 'strict',
  path: '/',
  maxAge: config.cookie.maxAgeMs,
};

const login = asyncHandler(async (req, res) => {
  const identifier = req.body.usuario ?? req.body.identifier ?? req.body.email;
  const password = req.body.password ?? req.body.contrasena;

  if (!identifier || !String(identifier).trim()) {
    throw badRequest('Capture su usuario o correo electrónico');
  }
  if (!password) {
    throw badRequest('Capture su contraseña');
  }

  const result = await authService.login({
    identifier,
    password,
    ip: req.ip,
  });

  res.cookie(config.cookie.name, result.token, cookieOptions);
  const csrfToken = issueCsrfToken(res);

  res.json({
    mensaje: 'Sesión iniciada correctamente',
    usuario: result.user,
    csrfToken,
  });
});

const register = asyncHandler(async (req, res) => {
  const result = await authService.registerStudent({
    data: req.body,
    ip: req.ip,
  });

  res.cookie(config.cookie.name, result.token, cookieOptions);
  const csrfToken = issueCsrfToken(res);

  res.status(201).json({
    mensaje: 'Cuenta creada correctamente. Bienvenido.',
    usuario: result.user,
    csrfToken,
  });
});

const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    await authModel.logAuthEvent({
      idUser: req.user.id,
      username: req.user.username,
      action: 'LOGOUT',
      description: 'Cierre de sesión',
      ip: req.ip,
    });
  }
  res.clearCookie(config.cookie.name, { ...cookieOptions, maxAge: undefined });
  clearCsrfToken(res);
  res.json({ mensaje: 'Sesión finalizada' });
});

const me = asyncHandler(async (req, res) => {
  const csrfToken = req.cookies[CSRF_COOKIE] || issueCsrfToken(res);
  res.json({ usuario: req.user, csrfToken });
});

const changePassword = asyncHandler(async (req, res) => {
  const errors = [];
  if (!req.body.password_actual) errors.push('Capture su contraseña actual');
  if (!req.body.password_nueva) errors.push('Capture la nueva contraseña');
  if (errors.length > 0) throw badRequest('Revise la información capturada', errors);

  await authService.changePassword(req.user.id, {
    currentPassword: req.body.password_actual,
    newPassword: req.body.password_nueva,
  });

  res.json({ mensaje: 'Contraseña actualizada correctamente' });
});

module.exports = { login, register, logout, me, changePassword };
