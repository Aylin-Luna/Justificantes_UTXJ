'use strict';

const bcrypt = require('bcryptjs');
const config = require('../../config');
const authModel = require('../models/auth.model');
const justificantesModel = require('../models/justificantes.model');
const auditoriaModel = require('../models/auditoria.model');
const catalogos = require('../models/catalogos.model');
const { asyncHandler, badRequest, notFound, forbidden } = require('../utils/errors');
const validators = require('../utils/validators');

const list = asyncHandler(async (req, res) => {
  const filters = {
    search: req.query.buscar || null,
    role: req.query.rol || null,
    active: req.query.activo === undefined ? null : validators.toBoolean(req.query.activo, true),
  };
  const usuarios = await authModel.listUsers(filters);
  res.json({ usuarios, total: usuarios.length });
});

const setActive = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('El identificador del usuario es inválido');
  if (id === req.user.id && req.body.activo === false) {
    throw forbidden('No puede desactivar su propia cuenta');
  }
  const activo = validators.toBoolean(req.body.activo, true);
  const user = await authModel.setActive(id, activo);
  if (!user) throw notFound('El usuario no existe');
  await authModel.logAuthEvent({
    idUser: req.user.id,
    username: req.user.username,
    action: activo ? 'ACTIVAR_USUARIO' : 'DESACTIVAR_USUARIO',
    description: `Usuario ${user.username} ${activo ? 'activado' : 'desactivado'}`,
    ip: req.ip,
  });
  res.json({ mensaje: `Usuario ${activo ? 'activado' : 'desactivado'} correctamente`, usuario: user });
});

const setRoles = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('El identificador del usuario es inválido');
  const roles = Array.isArray(req.body.roles)
    ? [...new Set(req.body.roles.map((role) => String(role).trim()).filter(Boolean))]
    : [];
  if (roles.length === 0) throw badRequest('Seleccione al menos un rol');

  const disponibles = await catalogos.getRoles();
  const codes = disponibles.map((role) => role.code);
  if (roles.some((role) => !codes.includes(role))) {
    throw badRequest('Uno o más roles no existen');
  }
  if (id === req.user.id && !roles.includes('admin')) {
    throw forbidden('No puede retirar su propio rol de administrador');
  }

  const user = await authModel.setRoles(id, roles, req.user.id);
  if (!user) throw notFound('El usuario no existe');
  await authModel.logAuthEvent({
    idUser: req.user.id,
    username: req.user.username,
    action: 'CAMBIAR_ROLES',
    description: `Roles de ${user.username}: ${roles.join(', ')}`,
    ip: req.ip,
  });
  res.json({ mensaje: 'Roles actualizados correctamente', usuario: user });
});

const resetPassword = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('El identificador del usuario es inválido');
  const password = String(req.body.password ?? req.body.password_nueva ?? '');
  if (password.length < 8) throw badRequest('La contraseña debe tener al menos 8 caracteres');
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw badRequest('La contraseña debe incluir letras y números');
  }
  const user = await authModel.findById(id);
  if (!user) throw notFound('El usuario no existe');
  const hash = await bcrypt.hash(password, config.security.bcryptRounds);
  await authModel.resetPassword(id, hash);
  await authModel.logAuthEvent({
    idUser: req.user.id,
    username: req.user.username,
    action: 'RESET_CONTRASENA',
    description: `Contraseña restablecida para ${user.username}`,
    ip: req.ip,
  });
  res.json({ mensaje: 'Contraseña restablecida correctamente' });
});

const resumen = asyncHandler(async (req, res) => {
  const [usuarios, auditoria, ajustes, estadisticas] = await Promise.all([
    authModel.listUsers({}),
    auditoriaModel.summary(),
    catalogos.getSettings(),
    justificantesModel.stats({ sql: '1 = 1', params: [] }),
  ]);

  const porRol = {};
  for (const usuario of usuarios) {
    for (const rol of usuario.roles) {
      porRol[rol] = (porRol[rol] || 0) + 1;
    }
  }

  res.json({
    usuarios: {
      total: usuarios.length,
      activos: usuarios.filter((usuario) => usuario.active).length,
      inactivos: usuarios.filter((usuario) => !usuario.active).length,
      porRol,
    },
    justificantes: estadisticas,
    auditoria,
    configuracion: ajustes.length,
  });
});

module.exports = { list, setActive, setRoles, resetPassword, resumen };
