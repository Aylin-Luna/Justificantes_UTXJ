'use strict';

class AppError extends Error {
  constructor(status, message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = options.code || 'ERROR';
    this.details = options.details || null;
    this.expose = options.expose !== false;
    Error.captureStackTrace(this, this.constructor);
  }
}

const badRequest = (message, details = null) =>
  new AppError(400, message, { code: 'SOLICITUD_INVALIDA', details });

const unauthorized = (message = 'Se requiere iniciar sesión') =>
  new AppError(401, message, { code: 'NO_AUTENTICADO' });

const forbidden = (message = 'No tiene permiso para realizar esta acción') =>
  new AppError(403, message, { code: 'SIN_PERMISO' });

const notFound = (message = 'El recurso solicitado no existe') =>
  new AppError(404, message, { code: 'NO_ENCONTRADO' });

const conflict = (message, details = null) =>
  new AppError(409, message, { code: 'CONFLICTO', details });

const unprocessable = (message, details = null) =>
  new AppError(422, message, { code: 'REGLA_NEGOCIO', details });

const tooManyRequests = (message = 'Demasiadas solicitudes. Intente más tarde.') =>
  new AppError(429, message, { code: 'LIMITE_SOLICITUDES' });

/**
 * Envuelve controladores async para que los errores lleguen al middleware.
 */
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  tooManyRequests,
  asyncHandler,
};
