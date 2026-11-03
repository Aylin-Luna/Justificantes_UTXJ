/**
 * Administración de usuarios: consulta, filtros, roles, estado y contraseña.
 * Solo accesible para el rol admin; el backend valida cada mutación.
 */

import api from '../api.js';
import {
  escapeHtml,
  escapeAttr,
  icon,
  pageHeader,
  loadingView,
  errorBox,
  statCard,
  emptyState,
  formatDateTime,
  relativeTime,
  initials,
  debounce,
  pluralize,
  roleName,
  toast,
  confirmAction,
  openModal,
  setBusy,
  pagination,
  toTitleCase,
} from '../ui.js';

const PAGE_SIZE = 12;
const ROLE_ORDER = ['admin', 'directora', 'tutor', 'alumno'];

const roleTone = (code) => {
  if (code === 'admin') return 'gold';
  if (code === 'directora') return 'blue';
  if (code === 'tutor') return 'green';
  return 'gray';
};

const roleBadges = (roles = []) => {
  const ordered = [...roles].sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a);
    const ib = ROLE_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  if (ordered.length === 0) return '<span class="small muted">Sin rol asignado</span>';
  return ordered
    .map((role) => `<span class="badge badge-${roleTone(role)} badge-plain">${escapeHtml(roleName(role))}</span>`)
    .join('');
};

const statusBadge = (active) => (active
  ? '<span class="badge badge-green badge-plain">Activo</span>'
  : '<span class="badge badge-red badge-plain">Inactivo</span>');

const userRow = (user, currentUserId) => {
  const isSelf = Number(user.id) === Number(currentUserId);
  const linked = user.idStudent
    ? `<span class="cell-sub">Estudiante vinculado</span>`
    : user.idTeacher
      ? `<span class="cell-sub">Docente vinculado</span>`
      : '<span class="cell-sub">Cuenta administrativa</span>';

  return `
    <tr>
      <td>
        <div class="user-cell">
          <span class="avatar ${user.roles.includes('admin') ? 'gold' : ''}" aria-hidden="true">${escapeHtml(initials(user.fullName))}</span>
          <div>
            <span class="cell-main">${escapeHtml(user.fullName)}${isSelf ? ' <span class="badge badge-gold badge-plain">Usted</span>' : ''}</span>
            <span class="cell-sub mono">@${escapeHtml(user.username)}</span>
            ${linked}
          </div>
        </div>
      </td>
      <td>
        <span class="cell-main">${escapeHtml(user.email || '—')}</span>
      </td>
      <td>
        <span class="cluster" style="gap:4px;flex-wrap:wrap">${roleBadges(user.roles)}</span>
      </td>
      <td>${statusBadge(user.active)}</td>
      <td class="hide-md">
        <span class="cell-main">${escapeHtml(user.lastLogin ? formatDateTime(user.lastLogin) : 'Sin acceso')}</span>
        <span class="cell-sub">${escapeHtml(user.lastLogin ? relativeTime(user.lastLogin) : 'Nunca ha iniciado sesión')}</span>
      </td>
      <td class="hide-sm">
        <span class="cell-sub">${escapeHtml(formatDateTime(user.createdAt))}</span>
      </td>
      <td>
        <div class="row-actions">
          <button type="button" class="icon-btn" title="Cambiar roles" aria-label="Cambiar roles de ${escapeAttr(user.fullName)}"
            data-action="roles" data-id="${Number(user.id)}">
            ${icon('shield-check', 16)}
          </button>
          <button type="button" class="icon-btn" title="Restablecer contraseña" aria-label="Restablecer contraseña de ${escapeAttr(user.fullName)}"
            data-action="password" data-id="${Number(user.id)}">
            ${icon('key', 16)}
          </button>
          <button type="button" class="icon-btn ${user.active ? 'danger' : ''}" title="${user.active ? 'Desactivar cuenta' : 'Activar cuenta'}"
            aria-label="${user.active ? 'Desactivar' : 'Activar'} cuenta de ${escapeAttr(user.fullName)}"
            data-action="toggle" data-id="${Number(user.id)}" ${isSelf ? 'disabled' : ''}>
            ${icon(user.active ? 'user-x' : 'user-check', 16)}
          </button>
        </div>
      </td>
    </tr>
  `;
};

const rolesModal = (user, rolesCatalog) => new Promise((resolve) => {
  let settled = false;
  const unique = rolesCatalog.length > 0
    ? rolesCatalog
    : ROLE_ORDER.map((code) => ({ code, name: roleName(code), description: '' }));

  openModal({
    title: 'Cambiar roles del usuario',
    subtitle: `${user.fullName} · @${user.username}`,
    body: `
      <div class="alert alert-info">
        ${icon('shield', 18)}
        <div>Los roles determinan las secciones y acciones disponibles. Los cambios se aplican de inmediato y quedan auditados.</div>
      </div>
      <div class="stack mt-2" style="gap:8px">
        ${unique.map((role) => `
          <label class="check role-option">
            <input type="checkbox" value="${escapeAttr(role.code)}" data-role
              ${user.roles.includes(role.code) ? 'checked' : ''}>
            <span>
              <strong>${escapeHtml(role.name || roleName(role.code))}</strong>
              <span class="small muted" style="display:block">${escapeHtml(role.description || `Código: ${role.code}`)}</span>
            </span>
          </label>
        `).join('')}
      </div>
      <span class="field-error" id="roles-error" hidden></span>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-cancel>Cancelar</button>
      <button type="button" class="btn btn-primary" data-confirm>${icon('save', 16)} Guardar roles</button>
    `,
    onOpen: (node) => {
      const error = node.querySelector('#roles-error');
      const finish = (value) => {
        if (settled) return;
        settled = true;
        node.close();
        resolve(value);
      };
      node.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      node.querySelector('[data-confirm]').addEventListener('click', () => {
        const selected = [...node.querySelectorAll('[data-role]:checked')].map((input) => input.value);
        if (selected.length === 0) {
          error.hidden = false;
          error.textContent = 'Seleccione al menos un rol para la cuenta.';
          return;
        }
        finish(selected);
      });
      node.addEventListener('close', () => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      });
    },
  });
});

const randomPassword = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const pick = (source) => source[Math.floor(Math.random() * source.length)];
  const base = [
    pick(letters.toUpperCase()),
    pick(letters.toLowerCase()),
    pick(digits),
    pick(symbols),
  ];
  for (let index = 0; index < 8; index += 1) {
    base.push(pick(letters + digits));
  }
  return base.sort(() => Math.random() - 0.5).join('');
};

const passwordModal = (user) => new Promise((resolve) => {
  let settled = false;
  let visible = false;
  const suggestion = randomPassword();

  openModal({
    title: 'Restablecer contraseña',
    subtitle: `${user.fullName} · @${user.username}`,
    body: `
      <div class="alert alert-warning">
        ${icon('key', 18)}
        <div>La contraseña actual dejará de funcionar. Comparta la nueva contraseña por un canal seguro.</div>
      </div>

      <div class="field mt-2">
        <label for="new-password">Nueva contraseña <span class="req">*</span></label>
        <div class="input-group">
          <input class="input" type="password" id="new-password" autocomplete="new-password"
            placeholder="Mínimo 8 caracteres, con letras y números" value="${escapeAttr(suggestion)}">
          <button type="button" class="btn btn-ghost" id="toggle-password" aria-label="Mostrar contraseña">${icon('eye', 16)}</button>
        </div>
        <span class="field-hint">Use al menos 8 caracteres e incluya letras y números.</span>
      </div>

      <div class="field mt-2">
        <label for="confirm-password">Confirmar contraseña <span class="req">*</span></label>
        <input class="input" type="password" id="confirm-password" autocomplete="new-password"
          placeholder="Repita la nueva contraseña" value="${escapeAttr(suggestion)}">
      </div>

      <div class="cluster mt-2" style="gap:6px">
        <button type="button" class="btn btn-ghost btn-sm" id="generate-password">${icon('refresh-cw', 15)} Generar otra</button>
        <button type="button" class="btn btn-ghost btn-sm" id="copy-password">${icon('files', 15)} Copiar</button>
      </div>
      <span class="field-error" id="password-error" hidden></span>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-cancel>Cancelar</button>
      <button type="button" class="btn btn-primary" data-confirm>${icon('key', 16)} Restablecer</button>
    `,
    onOpen: (node) => {
      const input = node.querySelector('#new-password');
      const confirm = node.querySelector('#confirm-password');
      const error = node.querySelector('#password-error');
      const toggle = node.querySelector('#toggle-password');

      const setValues = (value) => {
        input.value = value;
        confirm.value = value;
        input.focus();
        input.select();
      };

      const finish = (value) => {
        if (settled) return;
        settled = true;
        node.close();
        resolve(value);
      };

      toggle.addEventListener('click', () => {
        visible = !visible;
        [input, confirm].forEach((field) => {
          field.type = visible ? 'text' : 'password';
        });
        toggle.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
        toggle.innerHTML = icon(visible ? 'eye-off' : 'eye', 16);
      });

      node.querySelector('#generate-password').addEventListener('click', () => setValues(randomPassword()));
      node.querySelector('#copy-password').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(input.value);
          toast('Contraseña copiada al portapapeles.', { type: 'success', duration: 2600 });
        } catch {
          toast('No se pudo copiar automáticamente. Seleccione el texto y cópielo manualmente.', { type: 'warning' });
        }
      });

      node.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      node.querySelector('[data-confirm]').addEventListener('click', () => {
        const value = input.value;
        error.hidden = true;
        if (value.length < 8) {
          error.hidden = false;
          error.textContent = 'La contraseña debe tener al menos 8 caracteres.';
          input.focus();
          return;
        }
        if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
          error.hidden = false;
          error.textContent = 'La contraseña debe incluir letras y números.';
          input.focus();
          return;
        }
        if (value !== confirm.value) {
          error.hidden = false;
          error.textContent = 'La confirmación no coincide con la nueva contraseña.';
          confirm.focus();
          return;
        }
        finish(value);
      });
      node.addEventListener('close', () => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      });
      window.setTimeout(() => {
        input.focus();
        input.select();
      }, 60);
    },
  });
});

export async function render(container, ctx) {
  if (!ctx.user?.roles?.includes('admin')) {
    container.innerHTML = errorBox({ message: 'Esta sección requiere el rol de administrador.' });
    return;
  }

  const state = {
    buscar: ctx.query.get('buscar') || '',
    rol: ctx.query.get('rol') || '',
    activo: ctx.query.get('activo') || '',
    page: Number(ctx.query.get('page')) > 0 ? Number(ctx.query.get('page')) : 1,
  };

  let users = [];
  let summary = null;
  let rolesCatalog = [];

  const [summaryData, rolesData] = await Promise.all([
    api.get('/usuarios/resumen'),
    api.get('/catalogos/roles'),
  ]);
  summary = summaryData;
  rolesCatalog = rolesData.roles || [];

  const porRol = summary?.usuarios?.porRol || {};
  const total = Number(summary?.usuarios?.total) || 0;
  const activos = Number(summary?.usuarios?.activos) || 0;
  const inactivos = Number(summary?.usuarios?.inactivos) || 0;

  const roleOptions = (rolesCatalog.length > 0
    ? rolesCatalog
    : ROLE_ORDER.map((code) => ({ code, name: roleName(code) })))
    .map((role) => `<option value="${escapeAttr(role.code)}" ${state.rol === role.code ? 'selected' : ''}>${escapeHtml(role.name)}</option>`)
    .join('');

  container.innerHTML = `
    ${pageHeader({
      eyebrow: 'Administración del sistema',
      title: 'Usuarios y accesos',
      description: 'Administre cuentas institucionales, asigne roles y restablezca contraseñas. Toda modificación queda registrada en auditoría.',
      actions: `<a class="btn btn-secondary" href="#/auditoria">${icon('shield', 16)} Ver auditoría</a>`,
    })}

    <div class="stats-grid">
      ${statCard({ label: 'Cuentas registradas', value: total, iconName: 'users', tone: 'green', hint: 'Usuarios del sistema' })}
      ${statCard({ label: 'Cuentas activas', value: activos, iconName: 'user-check', tone: 'blue', hint: 'Con acceso habilitado' })}
      ${statCard({ label: 'Cuentas inactivas', value: inactivos, iconName: 'user-x', tone: 'red', hint: 'Acceso bloqueado' })}
      ${statCard({ label: 'Administradores', value: Number(porRol.admin) || 0, iconName: 'shield-check', tone: 'gold', hint: 'Con permisos completos' })}
    </div>

    <section class="card mt-2" aria-label="Filtros de usuarios">
      <form class="table-toolbar" id="user-filters" style="border-bottom:0">
        <div class="search-box">
          ${icon('search', 17)}
          <label class="sr-only" for="user-search">Buscar usuario</label>
          <input class="input" type="search" id="user-search" name="buscar" autocomplete="off"
            placeholder="Buscar por nombre, usuario o correo" value="${escapeHtml(state.buscar)}">
        </div>

        <label class="sr-only" for="user-role">Rol</label>
        <select class="select" id="user-role" name="rol">
          <option value="">Todos los roles</option>
          ${roleOptions}
        </select>

        <label class="sr-only" for="user-status">Estado</label>
        <select class="select" id="user-status" name="activo">
          <option value="">Todos los estados</option>
          <option value="1" ${state.activo === '1' ? 'selected' : ''}>Activas</option>
          <option value="0" ${state.activo === '0' ? 'selected' : ''}>Inactivas</option>
        </select>

        <button type="button" class="btn btn-ghost btn-sm" id="clear-user-filters">
          ${icon('rotate-ccw', 15)} Limpiar
        </button>
      </form>
    </section>

    <div id="users-results" class="mt-2">${loadingView('Consultando usuarios…')}</div>
  `;

  const results = document.getElementById('users-results');
  const form = document.getElementById('user-filters');
  const search = document.getElementById('user-search');
  let requestId = 0;

  const syncUrl = () => {
    const params = new URLSearchParams();
    if (state.buscar) params.set('buscar', state.buscar);
    if (state.rol) params.set('rol', state.rol);
    if (state.activo) params.set('activo', state.activo);
    if (state.page > 1) params.set('page', String(state.page));
    const text = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}#/usuarios${text ? `?${text}` : ''}`
    );
  };

  const readFilters = () => ({
    buscar: search.value.trim(),
    rol: form.rol.value,
    activo: form.activo.value,
  });

  const renderTable = () => {
    const pages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), pages);
    const start = (state.page - 1) * PAGE_SIZE;
    const visible = users.slice(start, start + PAGE_SIZE);
    const filtered = Boolean(state.buscar || state.rol || state.activo);

    if (users.length === 0) {
      results.innerHTML = `
        <div class="table-card">
          <div class="card-body">
            ${emptyState({
              iconName: 'users',
              title: filtered ? 'Sin coincidencias' : 'No hay usuarios registrados',
              text: filtered
                ? 'Ajuste los filtros o limpie la búsqueda para ver más cuentas.'
                : 'Las cuentas institucionales aparecerán aquí cuando se registren.',
              action: filtered
                ? '<button type="button" class="btn btn-primary mt-2" id="empty-clear">Limpiar filtros</button>'
                : '',
            })}
          </div>
        </div>
      `;
      document.getElementById('empty-clear')?.addEventListener('click', () => {
        search.value = '';
        form.rol.value = '';
        form.activo.value = '';
        applyFilters();
      });
      return;
    }

    results.innerHTML = `
      <div class="table-card">
        <div class="table-toolbar">
          <span class="small muted">${escapeHtml(pluralize(users.length, 'cuenta encontrada', 'cuentas encontradas'))}</span>
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost btn-sm" id="reload-users">${icon('refresh', 15)} Actualizar</button>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Usuario</th>
                <th scope="col">Correo</th>
                <th scope="col">Roles</th>
                <th scope="col">Estado</th>
                <th scope="col" class="hide-md">Último acceso</th>
                <th scope="col" class="hide-sm">Creado</th>
                <th scope="col"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              ${visible.map((user) => userRow(user, ctx.user.id)).join('')}
            </tbody>
          </table>
        </div>
        <div class="table-foot">
          <span>${escapeHtml(pluralize(users.length, 'cuenta', 'cuentas'))} · Página ${state.page} de ${pages}</span>
          ${pagination(state.page, pages, 'Paginación de usuarios')}
        </div>
      </div>
    `;

    document.getElementById('reload-users')?.addEventListener('click', () => load());
  };

  const load = async () => {
    requestId += 1;
    const current = requestId;
    results.innerHTML = loadingView('Consultando usuarios…');
    try {
      const data = await api.get('/usuarios', {
        query: {
          buscar: state.buscar || undefined,
          rol: state.rol || undefined,
          activo: state.activo === '' ? undefined : state.activo,
        },
      });
      if (!ctx.isCurrent() || current !== requestId) return;
      users = data.usuarios || [];
      syncUrl();
      renderTable();
    } catch (error) {
      if (!ctx.isCurrent() || current !== requestId) return;
      results.innerHTML = `
        ${errorBox(error)}
        <div class="cluster mt-2">
          <button type="button" class="btn btn-primary" id="retry-users">${icon('refresh', 16)} Reintentar</button>
        </div>
      `;
      document.getElementById('retry-users')?.addEventListener('click', load);
    }
  };

  const applyFilters = () => {
    Object.assign(state, readFilters());
    state.page = 1;
    load();
  };

  const debouncedSearch = debounce(applyFilters, 400);
  search.addEventListener('input', debouncedSearch);
  form.addEventListener('change', (event) => {
    if (event.target === search) return;
    debouncedSearch.cancel();
    applyFilters();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    debouncedSearch.cancel();
    applyFilters();
  });
  document.getElementById('clear-user-filters').addEventListener('click', () => {
    debouncedSearch.cancel();
    search.value = '';
    form.rol.value = '';
    form.activo.value = '';
    applyFilters();
  });

  results.addEventListener('click', (event) => {
    const pageButton = event.target.closest('[data-page]');
    if (pageButton && !pageButton.disabled) {
      const page = Number(pageButton.dataset.page);
      if (Number.isInteger(page) && page > 0) {
        state.page = page;
        syncUrl();
        renderTable();
        results.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const user = users.find((item) => Number(item.id) === Number(actionButton.dataset.id));
    if (!user) return;

    if (actionButton.dataset.action === 'roles') {
      (async () => {
        const roles = await rolesModal(user, rolesCatalog);
        if (!roles) return;
        const unchanged = roles.length === user.roles.length && roles.every((role) => user.roles.includes(role));
        if (unchanged) {
          toast('No se detectaron cambios en los roles.', { type: 'info', duration: 3000 });
          return;
        }
        actionButton.disabled = true;
        try {
          const response = await api.patch(`/usuarios/${user.id}/roles`, { roles });
          toast(response?.mensaje || 'Roles actualizados correctamente.', { type: 'success' });
          await load();
        } catch (error) {
          toast(error.message || 'No se pudieron actualizar los roles.', { type: 'error', duration: 7000 });
        } finally {
          actionButton.disabled = false;
        }
      })();
      return;
    }

    if (actionButton.dataset.action === 'password') {
      (async () => {
        const password = await passwordModal(user);
        if (!password) return;
        setBusy(actionButton, true);
        try {
          const response = await api.patch(`/usuarios/${user.id}/password`, { password });
          toast(response?.mensaje || 'Contraseña restablecida correctamente.', { type: 'success' });
        } catch (error) {
          toast(error.message || 'No se pudo restablecer la contraseña.', { type: 'error', duration: 7000 });
        } finally {
          setBusy(actionButton, false);
        }
      })();
      return;
    }

    if (actionButton.dataset.action === 'toggle') {
      (async () => {
        const activating = !user.active;
        const confirmed = await confirmAction({
          title: activating ? 'Activar cuenta' : 'Desactivar cuenta',
          message: activating
            ? `La cuenta de ${user.fullName} podrá iniciar sesión nuevamente.`
            : `La cuenta de ${user.fullName} quedará bloqueada y no podrá iniciar sesión hasta que se active de nuevo.`,
          confirmText: activating ? 'Activar cuenta' : 'Desactivar cuenta',
          tone: activating ? 'primary' : 'danger',
        });
        if (!confirmed) return;
        setBusy(actionButton, true);
        try {
          const response = await api.patch(`/usuarios/${user.id}/estado`, { activo: activating });
          toast(response?.mensaje || 'Estado actualizado correctamente.', { type: 'success' });
          await load();
        } catch (error) {
          toast(error.message || 'No se pudo cambiar el estado de la cuenta.', { type: 'error', duration: 7000 });
        } finally {
          setBusy(actionButton, false);
        }
      })();
    }
  });

  await load();
}

export { roleTone, toTitleCase };
