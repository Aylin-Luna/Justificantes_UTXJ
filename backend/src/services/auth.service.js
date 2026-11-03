'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const authModel = require('../models/auth.model');
const { AppError, badRequest, unauthorized, forbidden } = require('../utils/errors');

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  fullName: user.fullName,
  roles: user.roles,
  roleDetails: user.roleDetails,
  student: user.student,
  teacher: user.teacher,
  staff: user.staff,
  lastLogin: user.lastLogin,
});

const signToken = (user) => jwt.sign(
  {
    sub: user.id,
    username: user.username,
    roles: user.roles,
  },
  config.jwt.secret,
  { expiresIn: config.jwt.expiresIn }
);

const login = async ({ identifier, password, ip }) => {
  const user = await authModel.findByUsernameOrEmail(String(identifier || '').trim());
  if (!user) {
    throw unauthorized('Usuario o contraseña incorrectos');
  }
  if (!user.active) {
    throw forbidden('La cuenta está desactivada. Contacte a control escolar.');
  }

  if (user.lockedUntil) {
    const lockedUntil = new Date(String(user.lockedUntil).replace(' ', 'T'));
    if (lockedUntil > new Date()) {
      const minutes = Math.max(1, Math.ceil((lockedUntil - new Date()) / 60000));
      throw new AppError(423, `La cuenta está bloqueada por intentos fallidos. Intente de nuevo en ${minutes} minuto(s).`, {
        code: 'CUENTA_BLOQUEADA',
      });
    }
  }

  const validPassword = await bcrypt.compare(password || '', user.passwordHash);
  if (!validPassword) {
    const attempt = await authModel.registerFailedAttempt(
      user.id,
      config.security.loginMaxAttempts,
      config.security.loginLockMinutes
    );
    await authModel.logAuthEvent({
      idUser: user.id,
      username: user.username,
      action: 'LOGIN_FALLIDO',
      description: 'Intento de inicio de sesión fallido',
      ip,
    });

    const remaining = Math.max(0, config.security.loginMaxAttempts - Number(attempt.failed_attempts));
    if (attempt.locked_until) {
      throw new AppError(423, `Se superó el número de intentos. La cuenta quedó bloqueada por ${config.security.loginLockMinutes} minutos.`, {
        code: 'CUENTA_BLOQUEADA',
      });
    }
    throw unauthorized(`Usuario o contraseña incorrectos. Intentos restantes: ${remaining}.`);
  }

  await authModel.registerSuccessfulLogin(user.id);
  await authModel.logAuthEvent({
    idUser: user.id,
    username: user.username,
    action: 'LOGIN',
    description: 'Inicio de sesión exitoso',
    ip,
  });

  const refreshed = await authModel.findPublicById(user.id);
  const token = signToken(refreshed);

  return {
    token,
    user: publicUser(refreshed),
  };
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await authModel.findById(userId);
  if (!user) throw unauthorized();

  const valid = await bcrypt.compare(currentPassword || '', user.passwordHash);
  if (!valid) {
    throw badRequest('La contraseña actual no es correcta');
  }

  const password = String(newPassword || '');
  if (password.length < 8) {
    throw badRequest('La nueva contraseña debe tener al menos 8 caracteres');
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw badRequest('La nueva contraseña debe incluir letras y números');
  }
  if (password === currentPassword) {
    throw badRequest('La nueva contraseña debe ser diferente a la actual');
  }

  const hash = await bcrypt.hash(password, config.security.bcryptRounds);
  await authModel.updatePassword(userId, hash);
  await authModel.logAuthEvent({
    idUser: userId,
    username: user.username,
    action: 'CAMBIO_CONTRASENA',
    description: 'El usuario actualizó su contraseña',
    ip: null,
  });
  return true;
};

const verifyToken = (token) => jwt.verify(token, config.jwt.secret);

module.exports = {
  login,
  changePassword,
  verifyToken,
  publicUser,
};
