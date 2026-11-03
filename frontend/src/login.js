/**
 * Página de acceso y registro. Verifica la sesión existente, presenta los
 * formularios y redirige a la aplicación según el resultado.
 */

import api from './api.js';
import { bootstrapSession, login, registerStudent, homePathFor } from './auth.js';
import { escapeHtml } from './ui.js';

const form = document.getElementById('login-form');
const identifier = document.getElementById('usuario');
const passwordInput = document.getElementById('password');
const submit = document.getElementById('login-submit');
const alertBox = document.getElementById('login-alert');
const toggle = document.getElementById('toggle-password');
const serverStatus = document.getElementById('server-status');
const serverStatusText = document.getElementById('server-status-text');

const tabLogin = document.getElementById('tab-login');
const tabRegistro = document.getElementById('tab-registro');
const panelLogin = document.getElementById('panel-login');
const panelRegistro = document.getElementById('panel-registro');

const registroForm = document.getElementById('registro-form');
const registroAlert = document.getElementById('registro-alert');
const registroSubmit = document.getElementById('registro-submit');
const regMatricula = document.getElementById('reg-matricula');
const regNombres = document.getElementById('reg-nombres');
const regApellidoPaterno = document.getElementById('reg-apellido-paterno');
const regApellidoMaterno = document.getElementById('reg-apellido-materno');
const regCorreo = document.getElementById('reg-correo');
const regTelefono = document.getElementById('reg-telefono');
const regCarrera = document.getElementById('reg-carrera');
const regGrupo = document.getElementById('reg-grupo');
const regUsuario = document.getElementById('reg-usuario');
const regPassword = document.getElementById('reg-password');
const regPasswordConfirm = document.getElementById('reg-password-confirm');

let groupsCatalog = [];
let catalogRequest = null;

const showAlertFor = (box, message, type = 'error') => {
  if (!box) return;
  box.hidden = false;
  const iconName = type === 'error' ? 'alert-circle' : type === 'warning' ? 'alert-triangle' : 'info';
  box.className = `alert alert-${type}`;
  box.setAttribute('role', type === 'error' ? 'alert' : 'status');
  box.innerHTML = `
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

const hideAlert = (box) => {
  if (box) box.hidden = true;
};

const setLoginLoading = (loading) => {
  submit.disabled = loading;
  submit.innerHTML = loading
    ? '<span class="spinner small" aria-hidden="true"></span><span>Verificando…</span>'
    : 'Iniciar sesión';
};

const setRegistroLoading = (loading) => {
  registroSubmit.disabled = loading;
  registroSubmit.innerHTML = loading
    ? '<span class="spinner small" aria-hidden="true"></span><span>Creando cuenta…</span>'
    : 'Crear cuenta';
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

/* --------------------------------------------------------------------------
   Registro público de alumnos
   -------------------------------------------------------------------------- */

const groupLabel = (group) => {
  const shift = group.shift ? group.shift.charAt(0).toUpperCase() + group.shift.slice(1) : '';
  return [group.name, group.grade ? `${group.grade}°` : '', shift, group.schoolPeriod]
    .filter(Boolean)
    .join(' · ');
};

const fillGroups = () => {
  if (!regGrupo) return;
  const careerId = Number(regCarrera?.value || 0);
  if (!careerId) {
    regGrupo.disabled = true;
    regGrupo.innerHTML = '<option value="">Seleccione su carrera</option>';
    return;
  }

  const groups = groupsCatalog.filter((group) => Number(group.careerId) === careerId);
  if (groups.length === 0) {
    regGrupo.disabled = true;
    regGrupo.innerHTML = '<option value="">Sin grupos disponibles</option>';
    return;
  }

  regGrupo.disabled = false;
  regGrupo.innerHTML = '<option value="">Seleccione su grupo</option>'
    + groups.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(groupLabel(group))}</option>`).join('');
};

const loadCatalogs = () => {
  if (catalogRequest) return catalogRequest;

  catalogRequest = api.get('/catalogos/registro', { allowUnauthorized: true })
    .then((data) => {
      const careers = Array.isArray(data?.carreras) ? data.carreras : [];
      groupsCatalog = Array.isArray(data?.grupos) ? data.grupos : [];

      if (regCarrera) {
        regCarrera.innerHTML = '<option value="">Seleccione su carrera</option>'
          + careers.map((career) => `<option value="${escapeHtml(career.id)}">${escapeHtml(career.name)}</option>`).join('');
      }
      fillGroups();
      return data;
    })
    .catch((error) => {
      catalogRequest = null;
      if (regCarrera) {
        regCarrera.innerHTML = '<option value="">No se pudieron cargar las carreras</option>';
      }
      throw error;
    });

  return catalogRequest;
};

const activatePanel = (name) => {
  if (!panelLogin || !panelRegistro) return;
  const isRegistro = name === 'registro';

  panelLogin.hidden = isRegistro;
  panelRegistro.hidden = !isRegistro;

  [tabLogin, tabRegistro].forEach((tab) => {
    if (!tab) return;
    const active = tab === (isRegistro ? tabRegistro : tabLogin);
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });

  hideAlert(alertBox);
  hideAlert(registroAlert);

  if (isRegistro) {
    if (window.location.hash !== '#registro') {
      window.history.replaceState(null, '', '#registro');
    }
    loadCatalogs()
      .catch(() => {
        showAlertFor(registroAlert, 'No se pudieron cargar las carreras y grupos. Recargue la página o acuda a Control Escolar.', 'error');
      })
      .finally(() => {
        regMatricula?.focus();
      });
  } else {
    if (window.location.hash === '#registro') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    identifier?.focus();
  }
};

tabLogin?.addEventListener('click', () => activatePanel('login'));
tabRegistro?.addEventListener('click', () => activatePanel('registro'));

regCarrera?.addEventListener('change', () => {
  fillGroups();
  hideAlert(registroAlert);
});

/* --------------------------------------------------------------------------
   Inicio de sesión
   -------------------------------------------------------------------------- */

const init = async () => {
  checkHealth();

  const params = new URLSearchParams(window.location.search);
  if (params.get('motivo') === 'sesion') {
    showAlertFor(alertBox, 'Su sesión expiró por seguridad. Ingrese nuevamente con sus credenciales.', 'info');
  }

  const existing = await bootstrapSession().catch(() => null);
  if (existing) {
    redirectToApp(existing);
    return;
  }

  if (window.location.hash === '#registro') {
    activatePanel('registro');
  } else if (identifier) {
    identifier.focus();
  }
};

toggle?.addEventListener('click', () => {
  const visible = passwordInput.type === 'text';
  passwordInput.type = visible ? 'password' : 'text';
  toggle.setAttribute('aria-pressed', String(!visible));
  toggle.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
  toggle.innerHTML = visible
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.1 4.1M6.7 6.7A17.6 17.6 0 0 0 2 12s3.5 7 10 7a10.6 10.6 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
});

document.querySelectorAll('[data-demo-user]').forEach((button) => {
  button.addEventListener('click', () => {
    identifier.value = button.dataset.demoUser || '';
    passwordInput.value = button.dataset.demoPassword || '';
    hideAlert(alertBox);
    submit.focus();
  });
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAlert(alertBox);

  const user = identifier.value.trim();
  const pass = passwordInput.value;

  if (!user) {
    showAlertFor(alertBox, 'Capture su usuario o correo institucional.');
    identifier.focus();
    return;
  }
  if (!pass) {
    showAlertFor(alertBox, 'Capture su contraseña.');
    passwordInput.focus();
    return;
  }

  setLoginLoading(true);
  try {
    const authenticated = await login(user, pass);
    submit.innerHTML = '<span class="spinner small" aria-hidden="true"></span><span>Accediendo…</span>';
    redirectToApp(authenticated);
  } catch (error) {
    setLoginLoading(false);
    const message = error?.message || 'No se pudo iniciar sesión. Intente de nuevo.';
    showAlertFor(alertBox, message, error?.status === 423 ? 'warning' : 'error');
    passwordInput.select();
  }
});

/* --------------------------------------------------------------------------
   Envío del registro
   -------------------------------------------------------------------------- */

registroForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAlert(registroAlert);

  const matricula = regMatricula.value.trim();
  const nombres = regNombres.value.trim();
  const apellidoPaterno = regApellidoPaterno.value.trim();
  const apellidoMaterno = regApellidoMaterno.value.trim();
  const correo = regCorreo.value.trim();
  const telefono = regTelefono.value.trim();
  const idCarrera = regCarrera.value;
  const idGrupo = regGrupo.value;
  const usuario = regUsuario.value.trim();
  const password = regPassword.value;
  const confirmacion = regPasswordConfirm.value;

  let error = null;
  if (!matricula) error = 'Capture su matrícula.';
  else if (!nombres) error = 'Capture su nombre.';
  else if (!apellidoPaterno) error = 'Capture su apellido paterno.';
  else if (!correo) error = 'Capture su correo electrónico.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) error = 'El correo electrónico no tiene un formato válido.';
  else if (!idCarrera) error = 'Seleccione su carrera.';
  else if (!idGrupo) error = 'Seleccione su grupo.';
  else if (!usuario) error = 'Elija un nombre de usuario.';
  else if (usuario.length < 3) error = 'El nombre de usuario debe tener al menos 3 caracteres.';
  else if (!/^[A-Za-z0-9._-]+$/.test(usuario)) error = 'El usuario solo admite letras, números, punto, guion y guion bajo.';
  else if (!password) error = 'Capture una contraseña.';
  else if (password.length < 8) error = 'La contraseña debe tener al menos 8 caracteres.';
  else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) error = 'La contraseña debe incluir letras y números.';
  else if (password !== confirmacion) error = 'Las contraseñas no coinciden.';

  if (error) {
    showAlertFor(registroAlert, error, 'error');
    return;
  }

  setRegistroLoading(true);
  try {
    const authenticated = await registerStudent({
      matricula,
      nombres,
      apellido_paterno: apellidoPaterno,
      apellido_materno: apellidoMaterno || undefined,
      correo,
      telefono: telefono || undefined,
      id_carrera: idCarrera,
      id_grupo: idGrupo,
      usuario,
      password,
      confirmar_password: confirmacion,
    });
    registroSubmit.innerHTML = '<span class="spinner small" aria-hidden="true"></span><span>Accediendo…</span>';
    redirectToApp(authenticated);
  } catch (err) {
    setRegistroLoading(false);
    const details = Array.isArray(err?.details) ? err.details.filter(Boolean) : [];
    const message = details.length > 0
      ? details[0]
      : err?.message || 'No se pudo crear la cuenta. Intente de nuevo.';
    showAlertFor(registroAlert, message, err?.status === 409 ? 'warning' : 'error');
  }
});

init();
