'use strict';

const { badRequest } = require('./errors');

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const toText = (value) => (value === undefined || value === null ? '' : String(value).trim());

const requiredString = (errors, value, field, label, options = {}) => {
  const text = toText(value);
  if (!text) {
    errors.push(`${label} es obligatorio`);
    return undefined;
  }
  if (options.min && text.length < options.min) {
    errors.push(`${label} debe tener al menos ${options.min} caracteres`);
  }
  if (options.max && text.length > options.max) {
    errors.push(`${label} no debe exceder ${options.max} caracteres`);
  }
  if (options.pattern && !options.pattern.test(text)) {
    errors.push(options.message || `${label} tiene un formato inválido`);
  }
  return text;
};

const optionalString = (errors, value, field, label, options = {}) => {
  const text = toText(value);
  if (!text) return null;
  if (options.max && text.length > options.max) {
    errors.push(`${label} no debe exceder ${options.max} caracteres`);
  }
  if (options.pattern && !options.pattern.test(text)) {
    errors.push(options.message || `${label} tiene un formato inválido`);
  }
  return text;
};

const requiredEmail = (errors, value, label = 'El correo electrónico') => {
  const text = requiredString(errors, value, 'email', label, { max: 150 });
  if (text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    errors.push(`${label} no tiene un formato válido`);
    return undefined;
  }
  return text ? text.toLowerCase() : undefined;
};

const requiredDate = (errors, value, label) => {
  const text = toText(value);
  if (!text) {
    errors.push(`${label} es obligatoria`);
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    errors.push(`${label} debe tener el formato AAAA-MM-DD`);
    return undefined;
  }
  const date = new Date(`${text}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${label} no es una fecha válida`);
    return undefined;
  }
  return text;
};

const optionalDate = (errors, value, label) => {
  if (value === undefined || value === null || value === '') return null;
  return requiredDate(errors, value, label) || null;
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'si', 'sí', 'on', 'yes'].includes(String(value).toLowerCase());
};

const toInt = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const ensureNoErrors = (errors) => {
  if (errors.length > 0) {
    throw badRequest('Revise la información capturada', errors);
  }
};

const pickAllowed = (source, allowed) => {
  if (!isPlainObject(source)) return {};
  const result = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key)) result[key] = source[key];
  }
  return result;
};

const clampInt = (value, min, max, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

module.exports = {
  isPlainObject,
  toText,
  requiredString,
  optionalString,
  requiredEmail,
  requiredDate,
  optionalDate,
  toBoolean,
  toInt,
  clampInt,
  ensureNoErrors,
  pickAllowed,
};
