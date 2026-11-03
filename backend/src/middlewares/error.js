'use strict';

const multer = require('multer');
const { AppError } = require('../utils/errors');

const notFound = (req, res, next) => {
  next(new AppError(404, 'La ruta solicitada no existe', { code: 'RUTA_NO_ENCONTRADA' }));
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  let status = error.status || 500;
  let message = error.message || 'Error interno del servidor';
  let code = error.code || 'ERROR_INTERNO';
  let details = error.details || null;

  if (error instanceof multer.MulterError) {
    status = 400;
    code = 'ARCHIVO_INVALIDO';
    if (error.code === 'LIMIT_FILE_SIZE') {
      message = 'El archivo excede el tamaño máximo permitido (5 MB)';
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Se recibió un archivo en un campo no esperado';
    } else {
      message = `No se pudo procesar el archivo: ${error.message}`;
    }
  }

  if (error.sqlMessage) {
    if (error.code === 'ER_DUP_ENTRY') {
      status = 409;
      code = 'REGISTRO_DUPLICADO';
      message = 'Ya existe un registro con esos datos';
    } else if (['ER_SIGNAL_EXCEPTION', 'ER_TRUNCATED_WRONG_VALUE', 'ER_DATA_TOO_LONG',
      'ER_WARN_DATA_OUT_OF_RANGE', 'ER_CHECK_CONSTRAINT_VIOLATED'].includes(error.code)) {
      status = 422;
      code = 'REGLA_NEGOCIO';
      message = error.sqlMessage;
    } else if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
      status = 400;
      code = 'REFERENCIA_INVALIDA';
      message = 'Uno de los datos relacionados no existe';
    } else if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      status = 409;
      code = 'REGISTRO_EN_USO';
      message = 'No se puede eliminar porque tiene información relacionada';
    }
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'PROTOCOL_CONNECTION_LOST') {
    status = 503;
    code = 'BASE_DATOS_NO_DISPONIBLE';
    message = 'No hay conexión con la base de datos. Intente más tarde.';
  }

  if (status >= 500) {
    console.error('[error]', {
      method: req.method,
      path: req.originalUrl,
      message: error.message,
      stack: error.stack,
    });
    if (process.env.NODE_ENV === 'production' && !error.expose) {
      message = 'Ocurrió un error interno. Contacte al administrador.';
    }
  }

  const body = { error: message, codigo: code };
  if (Array.isArray(details) && details.length > 0) body.errores = details;
  else if (details) body.detalles = details;

  return res.status(status).json(body);
};

module.exports = { notFound, errorHandler };
