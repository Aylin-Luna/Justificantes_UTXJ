/**
 * Estado de sesión y utilidades de autorización del lado del cliente.
 * La sesión real vive en una cookie httpOnly emitida por el servidor; este
 * módulo solo conserva el perfil público para pintar la interfaz.
 */

import api, { setCsrfToken, onUnauthorized } from './api.js';

const ROLE_LABELS = {
  alumno: 'Alumno',
  tutor: 'Tutor educativo',
  directora: 'Dirección de carrera',
  admin: 'Administrador',
};

const ROLE_HOME = {
  alumno: '/app#/inicio',
  tutor: '/app#/inicio',
  directora: '/app#/inicio',
  admin: '/app#/inicio',
};

let currentUser = null;

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const cacheUser = (user) => {
  try {
    if (user) sessionStorage.setItem('utxj:user', JSON.stringify(user));
    else sessionStorage.removeItem('utxj:user');
  } catch {
    /* sessionStorage puede no estar disponible en modo privado estricto */
  }
};

export function getUser() {
  return currentUser;
}

export function hasRole(...roles) {
  if (!currentUser) return false;
  return roles.some((role) => currentUser.roles.includes(role));
}

export function hasAnyRole(roles = []) {
  return hasRole(...roles);
}

export function primaryRole(user = currentUser) {
  if (!user) return null;
  const order = ['admin', 'directora', 'tutor', 'alumno'];
  return order.find((role) => user.roles.includes(role)) || user.roles[0] || null;
}

export function roleLabel(code) {
  return ROLE_LABELS[code] || code;
}

export function roleLabels(user = currentUser) {
  return (user?.roles || []).map(roleLabel).join(' · ');
}

export function firstName(user = currentUser) {
  const source = user?.student?.first_name || user?.fullName || '';
  return source.trim().split(/\s+/)[0] || 'Usuario';
}

export function homePathFor(user = currentUser) {
  return ROLE_HOME[primaryRole(user)] || '/app#/inicio';
}

export function displayName(user = currentUser) {
  if (!user) return 'Invitado';
  if (user.student) {
    return [user.student.first_name, user.student.last_name, user.student.second_last_name]
      .filter(Boolean)
      .join(' ');
  }
  return user.fullName || user.username || 'Usuario';
}

export async function login(identifier, password) {
  const data = await api.post('/auth/login', {
    usuario: identifier,
    password,
  }, { allowUnauthorized: true });

  setCsrfToken(data.csrfToken);
  currentUser = data.usuario;
  cacheUser(currentUser);
  return currentUser;
}

export async function bootstrapSession() {
  try {
    const data = await api.get('/auth/me', { allowUnauthorized: true });
    setCsrfToken(data.csrfToken);
    currentUser = data.usuario;
    cacheUser(currentUser);
    return currentUser;
  } catch (error) {
    currentUser = null;
    cacheUser(null);
    if (error?.status === 401) return null;
    throw error;
  }
}

export async function refreshSession() {
  const data = await api.get('/auth/me');
  setCsrfToken(data.csrfToken);
  currentUser = data.usuario;
  cacheUser(currentUser);
  return currentUser;
}

export async function logout() {
  try {
    if (currentUser) await api.post('/auth/logout');
  } catch {
    /* El cierre local debe ocurrir aunque el servidor no responda */
  } finally {
    currentUser = null;
    cacheUser(null);
    setCsrfToken(null);
  }
}

export function cachedUser() {
  try {
    return safeParse(sessionStorage.getItem('utxj:user'));
  } catch {
    return null;
  }
}

export function requireSession() {
  if (!currentUser) {
    window.location.replace('/?motivo=sesion');
    return false;
  }
  return true;
}

export function requireAnyRole(roles = []) {
  if (!requireSession()) return false;
  if (roles.length === 0 || hasAnyRole(roles)) return true;
  window.location.hash = '#/inicio';
  return false;
}

export function installSessionExpiryHandler() {
  onUnauthorized(() => {
    currentUser = null;
    cacheUser(null);
    window.dispatchEvent(new CustomEvent('utxj:session-expired'));
  });
}

export { ROLE_LABELS };
