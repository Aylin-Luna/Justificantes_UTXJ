/**
 * Listado de justificantes con búsqueda, filtros, paginación y alcance por rol.
 * El backend aplica el ámbito de datos: alumnado, tutoría, dirección o administración.
 */

import api from '../api.js';
import { hasRole } from '../auth.js';
import { justificantesTable } from '../components/justificantes.js';
import {
  escapeHtml,
  icon,
  pageHeader,
  loadingView,
  errorBox,
  debounce,
  pluralize,
  setBusy,
  toast,
} from '../ui.js';

const DEFAULT_STATUSES = [
  { code: 'pendiente', name: 'Pendiente' },
  { code: 'en_revision', name: 'En revisión' },
  { code: 'aprobado', name: 'Aprobado' },
  { code: 'rechazado', name: 'Rechazado' },
  { code: 'cancelado', name: 'Cancelado' },
  { code: 'vencido', name: 'Vencido' },
];

const paginationMarkup = (page, pages) => {
  if (pages <= 1) return '';
  const visible = new Set([1, pages, page - 1, page, page + 1]);
  const parts = [];
  let previous = 0;

  for (let number = 1; number <= pages; number += 1) {
    if (!visible.has(number)) continue;
    if (previous && number - previous > 1) {
      parts.push('<span class="muted small" aria-hidden="true">…</span>');
    }
    parts.push(`
      <button type="button" data-page="${number}" class="${number === page ? 'active' : ''}"
        ${number === page ? 'aria-current="page"' : ''} aria-label="Página ${number}">${number}</button>
    `);
    previous = number;
  }

  return `
    <div class="pagination" role="navigation" aria-label="Paginación de justificantes">
      <button type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Página anterior">
        ${icon('chevron-left', 16)}
      </button>
      ${parts.join('')}
      <button type="button" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Página siguiente">
        ${icon('chevron-right', 16)}
      </button>
    </div>
  `;
};

const stateFromQuery = (query) => ({
  estado: query.get('estado') || '',
  buscar: query.get('buscar') || '',
  carrera: query.get('carrera') || '',
  criticos: query.get('criticos') === '1',
  desde: query.get('desde') || '',
  hasta: query.get('hasta') || '',
  pendientes: query.get('pendientes') === '1',
  page: Number(query.get('page')) > 0 ? Number(query.get('page')) : 1,
});

const isStudent = () => hasRole('alumno') && !hasRole('tutor', 'directora', 'admin');

const headerFor = () => {
  if (isStudent()) {
    return {
      eyebrow: 'Portal del alumnado',
      title: 'Mis justificantes',
      description: 'Consulte el estado de sus trámites, los comprobantes adjuntos y el historial de cada folio.',
    };
  }
  if (hasRole('directora')) {
    return {
      eyebrow: 'Dirección de carrera',
      title: 'Justificantes',
      description: 'Expedientes de su ámbito académico. Revise la revisión del tutor, los comprobantes y el dictamen de dirección.',
    };
  }
  if (hasRole('tutor')) {
    return {
      eyebrow: 'Tutoría educativa',
      title: 'Justificantes',
      description: 'Bandeja de expedientes de su ámbito. Inicie la revisión, valide comprobantes y registre su firma.',
    };
  }
  if (hasRole('admin')) {
    return {
      eyebrow: 'Administración',
      title: 'Justificantes',
      description: 'Vista institucional completa. Consulte, filtre y supervise todos los expedientes registrados.',
    };
  }
  return {
    eyebrow: 'Expedientes',
    title: 'Justificantes',
    description: 'Consulte los expedientes disponibles para su perfil.',
  };
};

export async function render(container, ctx) {
  const studentView = isStudent();
  const state = stateFromQuery(ctx.query);
  const [catalogos] = await Promise.all([
    api.get('/catalogos').catch(() => null),
  ]);
  if (!ctx.isCurrent()) return;

  const statuses = catalogos?.estados?.length ? catalogos.estados : DEFAULT_STATUSES;
  const careers = catalogos?.carreras || [];
  const header = headerFor();

  const actions = [];
  if (hasRole('alumno')) {
    actions.push(`<a class="btn btn-primary" href="#/justificantes/nuevo">${icon('file-plus', 17)} Nuevo justificante</a>`);
  }
  if (hasRole('admin')) {
    actions.push(`<button type="button" class="btn btn-secondary" id="expire-button">${icon('refresh-cw', 17)} Actualizar vencidos</button>`);
  }

  container.innerHTML = `
    ${pageHeader({ ...header, actions: actions.join('') })}

    <section class="card" aria-label="Filtros de búsqueda">
      <form class="table-toolbar" id="filters" style="border-bottom:0">
        <div class="search-box">
          ${icon('search', 17)}
          <label class="sr-only" for="filter-buscar">Buscar por folio, matrícula o nombre</label>
          <input class="input" type="search" id="filter-buscar" name="buscar" autocomplete="off"
            placeholder="Buscar por folio, matrícula o nombre" value="${escapeHtml(state.buscar)}">
        </div>

        <label class="sr-only" for="filter-estado">Estado</label>
        <select class="select" id="filter-estado" name="estado">
          <option value="">Todos los estados</option>
          ${statuses.map((status) => `
            <option value="${escapeHtml(status.code)}" ${state.estado === status.code ? 'selected' : ''}>
              ${escapeHtml(status.name)}
            </option>
          `).join('')}
        </select>

        ${studentView ? '' : `
          <label class="sr-only" for="filter-carrera">Carrera</label>
          <select class="select" id="filter-carrera" name="carrera">
            <option value="">Todas las carreras</option>
            ${careers.map((career) => `
              <option value="${Number(career.id)}" ${String(state.carrera) === String(career.id) ? 'selected' : ''}>
                ${escapeHtml(career.name)}
              </option>
            `).join('')}
          </select>
        `}

        <label class="sr-only" for="filter-desde">Desde</label>
        <input class="input" type="date" id="filter-desde" name="desde" style="width:auto"
          value="${escapeHtml(state.desde)}" title="Periodo desde">

        <label class="sr-only" for="filter-hasta">Hasta</label>
        <input class="input" type="date" id="filter-hasta" name="hasta" style="width:auto"
          value="${escapeHtml(state.hasta)}" title="Periodo hasta">

        <label class="check">
          <input type="checkbox" id="filter-criticos" name="criticos" ${state.criticos ? 'checked' : ''}>
          Casos críticos
        </label>

        <button type="button" class="btn btn-ghost btn-sm" id="clear-filters">
          ${icon('rotate-ccw', 15)} Limpiar
        </button>
      </form>
    </section>

    ${state.pendientes ? `
      <div class="alert alert-info mt-2" role="status">
        ${icon('clipboard-check', 18)}
        <div class="spread" style="flex:1;gap:12px;flex-wrap:wrap">
          <span>Mostrando únicamente expedientes pendientes de revisión o en revisión.</span>
          <button type="button" class="btn btn-ghost btn-sm" id="clear-pending">Quitar filtro</button>
        </div>
      </div>
    ` : ''}

    <div id="list-results" class="mt-2">${loadingView('Consultando justificantes…')}</div>
  `;

  const results = document.getElementById('list-results');
  const form = document.getElementById('filters');
  const searchInput = document.getElementById('filter-buscar');
  let requestId = 0;

  const readForm = () => ({
    estado: form.estado.value,
    buscar: searchInput.value.trim(),
    carrera: form.carrera ? form.carrera.value : state.carrera,
    criticos: form.criticos.checked,
    desde: form.desde.value,
    hasta: form.hasta.value,
  });

  const syncUrl = () => {
    const params = new URLSearchParams();
    if (state.estado) params.set('estado', state.estado);
    if (state.buscar) params.set('buscar', state.buscar);
    if (state.carrera) params.set('carrera', state.carrera);
    if (state.criticos) params.set('criticos', '1');
    if (state.desde) params.set('desde', state.desde);
    if (state.hasta) params.set('hasta', state.hasta);
    if (state.pendientes) params.set('pendientes', '1');
    if (state.page > 1) params.set('page', String(state.page));
    const text = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/justificantes${text ? `?${text}` : ''}`);
  };

  const applyFilters = ({ resetPage = true } = {}) => {
    Object.assign(state, readForm());
    if (resetPage) state.page = 1;
    syncUrl();
    load();
  };

  const load = async () => {
    requestId += 1;
    const current = requestId;
    results.innerHTML = loadingView('Consultando justificantes…');

    try {
      const data = await api.get('/justificantes', {
        query: {
          estado: state.estado || undefined,
          buscar: state.buscar || undefined,
          carrera: state.carrera || undefined,
          criticos: state.criticos ? 1 : undefined,
          desde: state.desde || undefined,
          hasta: state.hasta || undefined,
          pendientes: state.pendientes ? 1 : undefined,
          page: state.page,
          limit: 15,
        },
      });
      if (!ctx.isCurrent() || current !== requestId) return;

      state.page = Number(data.page) || 1;
      const total = Number(data.total) || 0;
      const pages = Number(data.pages) || 1;
      state.page = Math.min(state.page, pages);

      const foot = total > 0 ? `
        <div class="table-foot">
          <span>${escapeHtml(pluralize(total, 'justificante', 'justificantes'))} · Página ${state.page} de ${pages}</span>
          ${paginationMarkup(state.page, pages)}
        </div>
      ` : '';

      results.innerHTML = justificantesTable(data.items || [], {
        showStudent: !studentView,
        footer: foot,
        empty: {
          iconName: 'search',
          title: state.buscar || state.estado || state.criticos || state.desde || state.hasta
            ? 'Sin coincidencias'
            : 'Aún no hay justificantes',
          text: state.buscar || state.estado || state.criticos || state.desde || state.hasta
            ? 'Ajuste los filtros o limpie la búsqueda para ver más resultados.'
            : (studentView
              ? 'Registre su primer justificante de inasistencia para iniciar el trámite.'
              : 'Los expedientes aparecerán aquí en cuanto se registren.'),
          action: studentView
            ? '<a class="btn btn-primary mt-2" href="#/justificantes/nuevo">Registrar justificante</a>'
            : '',
        },
      });
    } catch (error) {
      if (!ctx.isCurrent() || current !== requestId) return;
      results.innerHTML = `
        ${errorBox(error)}
        <div class="cluster mt-2">
          <button type="button" class="btn btn-primary" id="retry-list">${icon('refresh', 16)} Reintentar</button>
        </div>
      `;
      document.getElementById('retry-list')?.addEventListener('click', load);
    }
  };

  const debouncedSearch = debounce(() => applyFilters(), 420);
  searchInput?.addEventListener('input', debouncedSearch);
  form?.addEventListener('change', (event) => {
    if (event.target === searchInput) return;
    debouncedSearch.cancel();
    applyFilters();
  });
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    applyFilters();
  });

  document.getElementById('clear-filters')?.addEventListener('click', () => {
    searchInput.value = '';
    form.estado.value = '';
    if (form.carrera) form.carrera.value = '';
    form.criticos.checked = false;
    form.desde.value = '';
    form.hasta.value = '';
    applyFilters();
  });

  document.getElementById('clear-pending')?.addEventListener('click', () => {
    state.pendientes = false;
    state.page = 1;
    syncUrl();
    load();
    document.getElementById('clear-pending')?.closest('.alert')?.remove();
  });

  results.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    const page = Number(button.dataset.page);
    if (!Number.isInteger(page) || page < 1) return;
    state.page = page;
    syncUrl();
    load();
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const expireButton = document.getElementById('expire-button');
  expireButton?.addEventListener('click', async () => {
    setBusy(expireButton, true, 'Actualizando…');
    try {
      const data = await api.post('/dashboard/vencer');
      toast(data.mensaje || 'Se actualizaron los justificantes vencidos.', { type: 'success' });
      await load();
    } catch (error) {
      toast(error.message || 'No se pudieron actualizar los vencidos.', { type: 'error' });
    } finally {
      setBusy(expireButton, false);
    }
  });

  await load();
}
