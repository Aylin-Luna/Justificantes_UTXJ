/**
 * Shell de la aplicación: sesión, navegación lateral, menú de usuario y router
 * basado en hash. Cada vista se encarga de consultar su información y pintar
 * el contenedor principal.
 */

import api from './api.js';
import {
  bootstrapSession,
  logout,
  installSessionExpiryHandler,
  getUser,
  hasRole,
  displayName,
  primaryRole,
  roleLabels,
} from './auth.js';
import {
  escapeHtml,
  initials,
  icon,
  formatDateLong,
  toast,
  confirmAction,
  parseHashQuery,
  loadingView,
  pageHeader,
  errorBox,
} from './ui.js';

import * as dashboardView from './views/dashboard.js';
import * as listadoView from './views/justificantes.js';
import * as detalleView from './views/detalle.js';
import * as formularioView from './views/formulario.js';
import * as usuariosView from './views/usuarios.js';
import * as configuracionView from './views/configuracion.js';
import * as auditoriaView from './views/auditoria.js';
import * as perfilView from './views/perfil.js';

const shell = document.getElementById('app-shell');
const loading = document.getElementById('app-loading');

const ROUTES = [
  { pattern: /^\/inicio$/, view: dashboardView, title: 'Inicio', nav: 'inicio' },
  { pattern: /^\/justificantes$/, view: listadoView, title: 'Justificantes', nav: 'justificantes' },
  { pattern: /^\/justificantes\/nuevo$/, view: formularioView, title: 'Nuevo justificante', nav: 'nuevo', roles: ['alumno'] },
  { pattern: /^\/justificantes\/(\d+)\/editar$/, view: formularioView, title: 'Editar justificante', nav: 'justificantes', roles: ['alumno', 'admin'] },
  { pattern: /^\/justificantes\/(\d+)$/, view: detalleView, title: 'Detalle del justificante', nav: 'justificantes' },
  { pattern: /^\/usuarios$/, view: usuariosView, title: 'Usuarios', nav: 'usuarios', roles: ['admin'] },
  { pattern: /^\/configuracion$/, view: configuracionView, title: 'Configuración', nav: 'configuracion', roles: ['admin'] },
  { pattern: /^\/auditoria$/, view: auditoriaView, title: 'Auditoría', nav: 'auditoria', roles: ['admin'] },
  { pattern: /^\/perfil$/, view: perfilView, title: 'Mi perfil', nav: 'perfil' },
];

let currentRoute = null;
let routeToken = 0;
let lastFocusBeforeMenu = null;

const navLink = (href, nav, iconName, label) => `
  <a class="nav-link" href="${href}" data-nav="${nav}">
    ${icon(iconName, 18)}
    <span>${escapeHtml(label)}</span>
  </a>
`;

const buildSidebar = (user) => {
  const isAdmin = hasRole('admin');
  const isTutor = hasRole('tutor');
  const isDirector = hasRole('directora');
  const isStudent = hasRole('alumno');

  return `
    <aside class="sidebar" id="sidebar" aria-label="Navegación principal">
      <a class="sidebar-brand" href="#/inicio" aria-label="Ir al inicio">
        <img src="/assets/img/logo-utxj.svg" alt="UTXJ">
        <span class="sidebar-brand-text">
          <strong>UTXJ</strong>
          <span>Justificantes<br>académicos</span>
        </span>
      </a>

      <nav class="sidebar-nav">
        <p class="nav-label">Principal</p>
        ${navLink('#/inicio', 'inicio', 'home', 'Inicio')}
        ${navLink('#/justificantes', 'justificantes', 'file-text', 'Justificantes')}
        ${isStudent ? navLink('#/justificantes/nuevo', 'nuevo', 'file-plus', 'Nuevo justificante') : ''}

        ${(isTutor || isDirector || isAdmin) ? `
          <p class="nav-label">Gestión</p>
          ${isTutor ? navLink('#/justificantes?pendientes=1', 'revision', 'clipboard-check', 'Revisión') : ''}
          ${isDirector ? navLink('#/justificantes?estado=en_revision', 'aprobacion', 'award', 'Por aprobar') : ''}
          ${isAdmin ? navLink('#/usuarios', 'usuarios', 'users', 'Usuarios') : ''}
          ${isAdmin ? navLink('#/auditoria', 'auditoria', 'shield', 'Auditoría') : ''}
          ${isAdmin ? navLink('#/configuracion', 'configuracion', 'settings', 'Configuración') : ''}
        ` : ''}

        <p class="nav-label">Cuenta</p>
        ${navLink('#/perfil', 'perfil', 'user', 'Mi perfil')}
      </nav>

      <div class="sidebar-foot">
        <strong>Control Escolar</strong>
        Sistema de Justificantes Académicos<br>
        Versión 2.0 · 2026
      </div>
    </aside>
  `;
};

const buildShell = (user) => {
  const role = primaryRole(user);
  return `
    <div class="app-layout">
      ${buildSidebar(user)}
      <div class="sidebar-scrim" id="sidebar-scrim" aria-hidden="true"></div>

      <div class="app-main">
        <header class="topbar">
          <button type="button" class="icon-btn" id="menu-toggle" aria-label="Abrir menú" aria-controls="sidebar" aria-expanded="false">
            ${icon('menu', 21)}
          </button>
          <div class="topbar-title">
            <span class="topbar-eyebrow">Sistema de Justificantes</span>
            <strong id="page-title">Inicio</strong>
          </div>
          <div class="topbar-actions">
            <span class="topbar-date" id="topbar-date">${escapeHtml(formatDateLong(new Date()))}</span>
            <div class="user-menu" id="user-menu">
              <button type="button" class="user-button" id="user-button" aria-haspopup="true" aria-expanded="false" aria-controls="user-dropdown">
                <span class="avatar ${role === 'admin' ? 'gold' : ''}" aria-hidden="true">${escapeHtml(initials(displayName(user)))}</span>
                <span class="user-button-text">
                  <strong>${escapeHtml(displayName(user))}</strong>
                  <span>${escapeHtml(roleLabels(user))}</span>
                </span>
                ${icon('chevron-down', 15)}
              </button>
              <div class="user-dropdown" id="user-dropdown" hidden>
                <div class="user-dropdown-head">
                  <strong>${escapeHtml(user.username)}</strong>
                  <span>${escapeHtml(user.email || '')}</span>
                </div>
                <a class="dropdown-item" href="#/perfil">${icon('user', 16)} Mi perfil</a>
                ${hasRole('admin') ? `<a class="dropdown-item" href="#/configuracion">${icon('settings', 16)} Configuración</a>` : ''}
                <button type="button" class="dropdown-item danger" id="logout-button">${icon('log-out', 16)} Cerrar sesión</button>
              </div>
            </div>
          </div>
        </header>

        <main id="view" class="view" tabindex="-1"></main>

        <footer class="app-footer">
          <span>Universidad Tecnológica de Xicotepec de Juárez · Control Escolar</span>
          <span>Sistema de Justificantes Académicos · 2026</span>
        </footer>
      </div>
    </div>
  `;
};

const closeMobileMenu = () => {
  document.body.classList.remove('sidebar-open');
  const toggle = document.getElementById('menu-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  if (lastFocusBeforeMenu) {
    lastFocusBeforeMenu.focus();
    lastFocusBeforeMenu = null;
  }
};

const openMobileMenu = () => {
  lastFocusBeforeMenu = document.activeElement;
  document.body.classList.add('sidebar-open');
  const toggle = document.getElementById('menu-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
  const first = document.querySelector('.sidebar .nav-link');
  if (first) window.setTimeout(() => first.focus(), 160);
};

const bindShellEvents = () => {
  const toggle = document.getElementById('menu-toggle');
  const scrim = document.getElementById('sidebar-scrim');
  const userButton = document.getElementById('user-button');
  const dropdown = document.getElementById('user-dropdown');
  const logoutButton = document.getElementById('logout-button');

  toggle?.addEventListener('click', () => {
    if (document.body.classList.contains('sidebar-open')) closeMobileMenu();
    else openMobileMenu();
  });

  scrim?.addEventListener('click', closeMobileMenu);

  document.querySelectorAll('.sidebar .nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      if (document.body.classList.contains('sidebar-open')) closeMobileMenu();
    });
  });

  userButton?.addEventListener('click', () => {
    const expanded = userButton.getAttribute('aria-expanded') === 'true';
    userButton.setAttribute('aria-expanded', String(!expanded));
    dropdown.hidden = expanded;
    if (!expanded) {
      const firstItem = dropdown.querySelector('.dropdown-item');
      if (firstItem) window.setTimeout(() => firstItem.focus(), 20);
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#user-menu') && dropdown && !dropdown.hidden) {
      dropdown.hidden = true;
      userButton.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (dropdown && !dropdown.hidden) {
        dropdown.hidden = true;
        userButton.setAttribute('aria-expanded', 'false');
        userButton.focus();
      }
      if (document.body.classList.contains('sidebar-open')) closeMobileMenu();
    }
  });

  logoutButton?.addEventListener('click', async () => {
    const confirmed = await confirmAction({
      title: 'Cerrar sesión',
      message: '¿Desea salir del sistema de justificantes?',
      confirmText: 'Cerrar sesión',
      tone: 'danger',
    });
    if (!confirmed) return;
    await logout();
    window.location.replace('/');
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 960 && document.body.classList.contains('sidebar-open')) {
      closeMobileMenu();
    }
  });
};

const updateNav = (navKey, path) => {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('active', link.dataset.nav === navKey);
    if (link.dataset.nav === navKey) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const roleBadge = document.querySelector('.sidebar-foot');
  if (roleBadge && path && path.startsWith('/justificantes')) {
    roleBadge.setAttribute('data-context', 'justificantes');
  }
};

const renderAccessDenied = (container, user) => {
  container.innerHTML = `
    ${pageHeader({
    eyebrow: 'Acceso restringido',
    title: 'Esta sección no está disponible para su perfil',
    description: 'El sistema aplica controles de acceso por rol. Si considera que se trata de un error, contacte a Control Escolar.',
  })}
    <div class="card">
      <div class="card-body">
        <div class="alert alert-warning">
          ${icon('shield', 18)}
          <div>Su cuenta tiene el perfil <strong>${escapeHtml(roleLabels(user))}</strong>. Esta operación requiere otro nivel de permisos.</div>
        </div>
        <div class="cluster mt-3">
          <a class="btn btn-primary" href="#/inicio">Volver al inicio</a>
          <a class="btn btn-secondary" href="#/justificantes">Ver justificantes</a>
        </div>
      </div>
    </div>
  `;
};

const renderNotFound = (container) => {
  container.innerHTML = `
    ${pageHeader({
    eyebrow: 'Página no encontrada',
    title: 'No encontramos esa sección',
    description: 'La dirección solicitada no existe o cambió de lugar.',
  })}
    <div class="card">
      <div class="card-body">
        <div class="empty-state">
          <span class="empty-icon">${icon('search', 24)}</span>
          <h3>Ruta desconocida</h3>
          <p>Verifique el enlace o regrese al panel principal.</p>
          <a class="btn btn-primary" href="#/inicio">Ir al inicio</a>
        </div>
      </div>
    </div>
  `;
};

const resolveRoute = (path) => {
  for (const route of ROUTES) {
    const match = route.pattern.exec(path);
    if (match) return { route, params: match.slice(1) };
  }
  return null;
};

const handleRoute = async () => {
  const user = getUser();
  if (!user) {
    window.location.replace('/?motivo=sesion');
    return;
  }

  const { path, params: query } = parseHashQuery();
  const resolved = resolveRoute(path);
  const previousContainer = document.getElementById('view');
  if (!previousContainer) return;
  // Se reemplaza el contenedor en cada navegación para descartar los
  // listeners que las vistas registran sobre él y evitar acciones duplicadas.
  const container = previousContainer.cloneNode(false);
  previousContainer.replaceWith(container);

  routeToken += 1;
  const token = routeToken;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (!resolved) {
    renderNotFound(container);
    updateNav(null, path);
    document.getElementById('page-title').textContent = 'Página no encontrada';
    document.title = 'Página no encontrada · Justificantes UTXJ';
    return;
  }

  const { route, params } = resolved;
  currentRoute = route;

  if (route.roles && !hasRole(...route.roles)) {
    renderAccessDenied(container, user);
    updateNav(null, path);
    document.getElementById('page-title').textContent = 'Acceso restringido';
    document.title = 'Acceso restringido · Justificantes UTXJ';
    return;
  }

  updateNav(route.nav, path);
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = route.title;
  document.title = `${route.title} · Justificantes UTXJ`;

  container.innerHTML = loadingView();
  container.focus({ preventScroll: true });

  const ctx = {
    params,
    query,
    user,
    path,
    token,
    isCurrent: () => token === routeToken,
    setPageTitle: (value) => {
      if (token !== routeToken) return;
      if (pageTitle) pageTitle.textContent = value;
      document.title = `${value} · Justificantes UTXJ`;
    },
    navigate: (hash) => {
      window.location.hash = hash.startsWith('#') ? hash : `#${hash}`;
    },
    reload: () => handleRoute(),
  };

  try {
    await route.view.render(container, ctx);
  } catch (error) {
    if (token !== routeToken) return;
    if (error?.status === 401) return;
    container.innerHTML = `
      ${pageHeader({ eyebrow: 'Error', title: 'No se pudo cargar la información' })}
      ${errorBox(error)}
      <div class="cluster mt-3">
        <button type="button" class="btn btn-primary" id="retry-view">${icon('refresh', 16)} Reintentar</button>
        <a class="btn btn-secondary" href="#/inicio">Ir al inicio</a>
      </div>
    `;
    document.getElementById('retry-view')?.addEventListener('click', handleRoute);
  }
};

const bindGlobalNavigation = () => {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-route]');
    if (!target) return;
    if (target.tagName === 'A' && target.getAttribute('href')) return;
    event.preventDefault();
    const route = target.dataset.route;
    if (route) window.location.hash = route.startsWith('#') ? route : `#${route}`;
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest('[data-route][tabindex]');
    if (!target) return;
    if (target.tagName === 'A') return;
    event.preventDefault();
    window.location.hash = target.dataset.route;
  });

  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('utxj:session-expired', () => {
    toast('Su sesión expiró. Ingrese de nuevo para continuar.', {
      type: 'warning',
      title: 'Sesión finalizada',
      duration: 2500,
    });
    window.setTimeout(() => window.location.replace('/?motivo=sesion'), 1400);
  });
};

const boot = async () => {
  installSessionExpiryHandler();

  let user;
  try {
    user = await bootstrapSession();
  } catch (error) {
    loading.innerHTML = `
      <div class="app-loading-inner" style="max-width:480px;text-align:center">
        <img src="/assets/img/logo-utxj.svg" alt="UTXJ" style="width:180px">
        <div class="alert alert-error" style="text-align:left">
          ${icon('alert-circle', 18)}
          <div><strong>No se pudo iniciar el sistema</strong><br>${escapeHtml(error.message || 'Verifique la conexión con el servidor.')}</div>
        </div>
        <button type="button" class="btn btn-primary" id="boot-retry">Reintentar</button>
      </div>
    `;
    document.getElementById('boot-retry')?.addEventListener('click', () => window.location.reload());
    return;
  }

  if (!user) {
    window.location.replace('/');
    return;
  }

  shell.innerHTML = buildShell(user);
  shell.hidden = false;
  loading.hidden = true;
  loading.remove();

  bindShellEvents();
  bindGlobalNavigation();

  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = '#/inicio';
  } else {
    handleRoute();
  }
};

boot();
