'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const authModel = require('../models/auth.model');
const validators = require('../utils/validators');
const { AppError, badRequest, unauthorized, forbidden, conflict } = require('../utils/errors');

const NAME_PATTERN = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const ENROLLMENT_PATTERN = /^[A-Za-z0-9-]+$/;
const PHONE_PATTERN = /^[0-9+\-()\s]{7,30}$/;

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

const registerStudent = async ({ data = {}, ip }) => {
  const errors = [];
  const enrollment = validators.requiredString(
    errors,
    data.matricula ?? data.enrollment,
    'matricula',
    'La matrícula',
    {
      min: 4,
      max: 20,
      pattern: ENROLLMENT_PATTERN,
      message: 'La matrícula solo admite letras, números y guiones',
    }
  );
  const firstName = validators.requiredString(
    errors,
    data.nombres ?? data.firstName,
    'nombres',
    'El nombre',
    { min: 2, max: 100, pattern: NAME_PATTERN, message: 'El nombre contiene caracteres no válidos' }
  );
  const lastName = validators.requiredString(
    errors,
    data.apellido_paterno ?? data.lastName,
    'apellido_paterno',
    'El apellido paterno',
    { min: 2, max: 100, pattern: NAME_PATTERN, message: 'El apellido paterno contiene caracteres no válidos' }
  );
  const secondLastName = validators.optionalString(
    errors,
    data.apellido_materno ?? data.secondLastName,
    'apellido_materno',
    'El apellido materno',
    { max: 100, pattern: NAME_PATTERN, message: 'El apellido materno contiene caracteres no válidos' }
  );
  const email = validators.requiredEmail(errors, data.correo ?? data.email, 'El correo electrónico');
  const phone = validators.optionalString(
    errors,
    data.telefono ?? data.phone,
    'telefono',
    'El teléfono',
    { max: 30, pattern: PHONE_PATTERN, message: 'El teléfono solo admite números, espacios, guiones y paréntesis' }
  );
  const idGroup = validators.toInt(data.id_grupo ?? data.idGroup ?? data.grupo, null);
  if (!idGroup) errors.push('Seleccione su grupo');
  const idCareer = validators.toInt(data.id_carrera ?? data.idCareer ?? data.carrera, null);

  const username = validators.requiredString(
    errors,
    data.usuario ?? data.username,
    'usuario',
    'El nombre de usuario',
    {
      min: 3,
      max: 60,
      pattern: USERNAME_PATTERN,
      message: 'El usuario solo admite letras, números, punto, guion y guion bajo',
    }
  );

  const password = String(data.password ?? data.contrasena ?? '');
  if (!password) {
    errors.push('Capture una contraseña');
  } else {
    if (password.length < 8) errors.push('La contraseña debe tener al menos 8 caracteres');
    if (password.length > 128) errors.push('La contraseña no debe exceder 128 caracteres');
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      errors.push('La contraseña debe incluir letras y números');
    }
  }
  const confirmation = String(
    data.confirmar_password ?? data.password_confirmacion ?? data.confirmPassword ?? ''
  );
  if (password && confirmation !== password) {
    errors.push('Las contraseñas no coinciden');
  }

  validators.ensureNoErrors(errors);

  const fullName = [firstName, lastName, secondLastName].filter(Boolean).join(' ');
  const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);

  let created;
  try {
    created = await authModel.registerStudentAccount(
      {
        enrollment,
        firstName,
        lastName,
        secondLastName,
        email,
        phone,
        idGroup,
        idCareer,
        username,
        passwordHash,
        fullName,
      },
      { ip }
    );
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw conflict('No se pudo completar el registro: la matrícula, el usuario o el correo ya están en uso.');
    }
    throw error;
  }

  await authModel.logAuthEvent({
    idUser: created.idUser,
    username,
    action: 'REGISTRO',
    description: 'Registro público de alumno',
    ip,
  });

  return login({ identifier: username, password, ip });
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
  registerStudent,
  changePassword,
  verifyToken,
  publicUser,
};
