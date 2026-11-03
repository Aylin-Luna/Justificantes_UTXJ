/**
 * Página de acceso. Verifica la sesión existente, presenta el formulario y
 * redirige a la aplicación según el resultado del inicio de sesión.
 */

import api from './api.js';
import { bootstrapSession, login, homePathFor } from './auth.js';
import { escapeHtml } from './ui.js';

const form = document.getElementById('login-form');
const identifier = document.getElementById('usuario');
const password = document.getElementById('password');
const submit = document.getElementById('login-submit');
const alertBox = document.getElementById('login-alert');
const toggle = document.getElementById('toggle-password');
const serverStatus = document.getElementById('server-status');
const serverStatusText = document.getElementById('server-status-text');

const showAlert = (message, type = 'error') => {
  if (!alertBox) return;
  alertBox.hidden = false;
  const iconName = type === 'error' ? 'alert-circle' : type === 'warning' ? 'alert-triangle' : 'info';
  alertBox.className = `alert alert-${type}`;
  alertBox.setAttribute('role', type === 'error' ? 'alert' : 'status');
  alertBox.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:0 0 auto;margin-top:1px">
      ${iconName === 'alert-circle'
      ? '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>'
      : iconName === 'alert-triangle'
        ? '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'
        : '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'}
    </svg>
    <div>${escapeHtml(message)}</div>
  `;
};

const hideAlert = () => {
  if (alertBox) alertBox.hidden = true;
};

const setLoading = (loading) => {
  submit.disabled = loading;
  submit.innerHTML = loading
    ? '<span class="spinner small" aria-hidden="true"></span><span>Verificando…</span>'
    : 'Iniciar sesión';
};

const checkHealth = async () => {
  try {
    await api.get('/health', { allowUnauthorized: true });
    serverStatus.classList.add('online');
    serverStatus.classList.remove('offline');
    serverStatusText.textContent = 'Servidor disponible';
  } catch {
    serverStatus.classList.add('offline');
    serverStatus.classList.remove('online');
    serverStatusText.textContent = 'Servidor no disponible';
  }
};

const redirectToApp = (user) => {
  window.location.replace(homePathFor(user));
};

const init = async () => {
  checkHealth();

  const params = new URLSearchParams(window.location.search);
  if (params.get('motivo') === 'sesion') {
    showAlert('Su sesión expiró por seguridad. Ingrese nuevamente con sus credenciales.', 'info');
  }

  const existing = await bootstrapSession().catch(() => null);
  if (existing) {
    redirectToApp(existing);
    return;
  }

  if (identifier) identifier.focus();
};

toggle?.addEventListener('click', () => {
  const visible = password.type === 'text';
  password.type = visible ? 'password' : 'text';
  toggle.setAttribute('aria-pressed', String(!visible));
  toggle.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
  toggle.innerHTML = visible
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.1 4.1M6.7 6.7A17.6 17.6 0 0 0 2 12s3.5 7 10 7a10.6 10.6 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
});

document.querySelectorAll('[data-demo-user]').forEach((button) => {
  button.addEventListener('click', () => {
    identifier.value = button.dataset.demoUser || '';
    password.value = button.dataset.demoPassword || '';
    hideAlert();
    submit.focus();
  });
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAlert();

  const user = identifier.value.trim();
  const pass = password.value;

  if (!user) {
    showAlert('Capture su usuario o correo institucional.');
    identifier.focus();
    return;
  }
  if (!pass) {
    showAlert('Capture su contraseña.');
    password.focus();
    return;
  }

  setLoading(true);
  try {
    const authenticated = await login(user, pass);
    submit.innerHTML = '<span class="spinner small" aria-hidden="true"></span><span>Accediendo…</span>';
    redirectToApp(authenticated);
  } catch (error) {
    setLoading(false);
    const message = error?.message || 'No se pudo iniciar sesión. Intente de nuevo.';
    showAlert(message, error?.status === 423 ? 'warning' : 'error');
    password.select();
  }
});

init();
