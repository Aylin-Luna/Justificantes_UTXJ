/**
 * Cliente HTTP del sistema.
 * - Envía el token CSRF en cada operación mutante.
 * - Normaliza los errores del backend (`{ error }` o `{ errores: [] }`).
 * - Notifica a la aplicación cuando la sesión expira.
 */

const API_PREFIX = '/api';
const CSRF_COOKIE = 'utxj_csrf';
const CSRF_HEADER = 'X-CSRF-Token';

let csrfToken = null;
let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(message, { status = 0, code = null, details = [], payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.payload = payload;
  }
}

export function setCsrfToken(token) {
  csrfToken = token || null;
}

export function readCookie(name) {
  const prefix = `${name}=`;
  const parts = document.cookie ? document.cookie.split(';') : [];
  for (const part of parts) {
    const value = part.trim();
    if (value.startsWith(prefix)) {
      return decodeURIComponent(value.slice(prefix.length));
    }
  }
  return null;
}

export function currentCsrfToken() {
  return csrfToken || readCookie(CSRF_COOKIE);
}

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

const buildUrl = (path, query) => {
  const base = path.startsWith('/api') ? path : `${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return base;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else {
      params.append(key, value);
    }
  });
  const text = params.toString();
  return text ? `${base}?${text}` : base;
};

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  let body = options.body;

  if (body !== undefined && body !== null && !(body instanceof FormData) && !(body instanceof Blob)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = currentCsrfToken();
    if (token) headers.set(CSRF_HEADER, token);
  }

  headers.set('Accept', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');

  let response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: options.signal,
    });
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    throw new ApiError('No se pudo conectar con el servidor. Verifique su conexión e intente de nuevo.', {
      status: 0,
      code: 'RED',
    });
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  let payload = null;
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  } else {
    const text = await response.text().catch(() => '');
    payload = text ? { error: text.slice(0, 300) } : null;
  }

  if (!response.ok) {
    const details = Array.isArray(payload?.errores)
      ? payload.errores.filter((item) => typeof item === 'string')
      : [];
    const message = payload?.error
      || details[0]
      || (response.status === 401
        ? 'Su sesión expiró. Inicie sesión de nuevo.'
        : 'Ocurrió un error inesperado. Intente de nuevo.');

    if (response.status === 401 && !options.allowUnauthorized) {
      if (typeof unauthorizedHandler === 'function') unauthorizedHandler();
    }

    throw new ApiError(message, {
      status: response.status,
      code: payload?.code || null,
      details,
      payload,
    });
  }

  return payload;
}

export const api = {
  request,
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options = {}) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
  upload: (path, formData, options = {}) => request(path, { ...options, method: 'POST', body: formData }),
  url: buildUrl,
};

export default api;
