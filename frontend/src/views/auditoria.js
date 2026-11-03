/**
 * Bitácora de auditoría: consulta de los cambios registrados por los
 * disparadores de base de datos y los eventos de autenticación.
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
  debounce,
  pluralize,
  tableNameLabel,
  operationBadge,
  pagination,
  toast,
} from '../ui.js';

const OPERATIONS = [
  { value: 'INSERT', label: 'Alta' },
  { value: 'UPDATE', label: 'Cambio' },
  { value: 'DELETE', label: 'Baja' },
];

const stateFromQuery = (query) => ({
  tabla: query.get('tabla') || '',
  operacion: query.get('operacion') || '',
  buscar: query.get('buscar') || '',
  desde: query.get('desde') || '',
  hasta: query.get('hasta') || '',
  page: Number(query.get('page')) > 0 ? Number(query.get('page')) : 1,
});

const eventRow = (item) => `
  <tr>
    <td class="nowrap">
      <span class="cell-main">${escapeHtml(formatDateTime(item.changedAt))}</span>
    </td>
    <td>
      <span class="cell-main">${escapeHtml(tableNameLabel(item.table))}</span>
      <span class="cell-sub mono">${escapeHtml(item.table)}</span>
    </td>
    <td>${operationBadge(item.operation)}</td>
    <td class="nowrap"><span class="mono small">${escapeHtml(item.recordId || '—')}</span></td>
    <td>
      <span class="cell-main">${escapeHtml(item.userName || 'Sistema')}</span>
      <span class="cell-sub">${escapeHtml(item.dbUser ? `BD: ${item.dbUser}` : 'Sin usuario de base de datos')}</span>
    </td>
    <td class="hide-md"><span class="mono small">${escapeHtml(item.clientIp || '—')}</span></td>
    <td class="hide-md"><span class="cell-sub">${escapeHtml(item.source || '—')}</span></td>
    <td class="hide-sm">
      <span class="small" style="line-height:1.45;display:block;max-width:340px">${escapeHtml(item.description || 'Sin descripción')}</span>
    </td>
  </tr>
`;

export async function render(container, ctx) {
  if (!ctx.user?.roles?.includes('admin')) {
    container.innerHTML = errorBox({ message: 'Esta sección requiere el rol de administrador.' });
    return;
  }

  const state = stateFromQuery(ctx.query);
  const resumenData = await api.get('/auditoria/resumen');
  if (!ctx.isCurrent()) return;

  const resumen = resumenData.resumen || {};
  const tables = resumenData.tablas || [];

  container.innerHTML = `
    ${pageHeader({
      eyebrow: 'Seguridad y trazabilidad',
      title: 'Bitácora de auditoría',
      description: 'Registro inmutable de altas, cambios y bajas sobre las tablas del sistema, además de los eventos de autenticación.',
      actions: `<button type="button" class="btn btn-secondary" id="refresh-audit">${icon('refresh', 16)} Actualizar</button>`,
    })}

    <div class="stats-grid">
      ${statCard({ label: 'Eventos totales', value: resumen.total || 0, iconName: 'shield', tone: 'green', hint: 'Registros históricos' })}
      ${statCard({ label: 'Altas', value: resumen.inserts || 0, iconName: 'plus-circle', tone: 'blue', hint: 'Nuevos registros' })}
      ${statCard({ label: 'Cambios', value: resumen.updates || 0, iconName: 'edit', tone: 'amber', hint: 'Actualizaciones' })}
      ${statCard({ label: 'Bajas', value: resumen.deletes || 0, iconName: 'trash', tone: 'red', hint: 'Eliminaciones' })}
    </div>

    <div class="alert alert-info mt-2" role="status">
      ${icon('activity', 18)}
      <div>${Number(resumen.last24h) || 0} ${Number(resumen.last24h) === 1 ? 'evento registrado' : 'eventos registrados'} en las últimas 24 horas.</div>
    </div>

    <section class="card mt-2" aria-label="Filtros de auditoría">
      <form class="table-toolbar" id="audit-filters" style="border-bottom:0">
        <div class="search-box">
          ${icon('search', 17)}
          <label class="sr-only" for="audit-search">Buscar en la bitácora</label>
          <input class="input" type="search" id="audit-search" name="buscar" autocomplete="off"
            placeholder="Descripción, registro o usuario" value="${escapeHtml(state.buscar)}">
        </div>

        <label class="sr-only" for="audit-table">Tabla</label>
        <select class="select" id="audit-table" name="tabla">
          <option value="">Todas las tablas</option>
          ${tables.map((table) => `
            <option value="${escapeAttr(table)}" ${state.tabla === table ? 'selected' : ''}>${escapeHtml(tableNameLabel(table))}</option>
          `).join('')}
        </select>

        <label class="sr-only" for="audit-operation">Operación</label>
        <select class="select" id="audit-operation" name="operacion">
          <option value="">Todas las operaciones</option>
          ${OPERATIONS.map((operation) => `
            <option value="${operation.value}" ${state.operacion === operation.value ? 'selected' : ''}>${operation.label}</option>
          `).join('')}
        </select>

        <label class="sr-only" for="audit-from">Desde</label>
        <input class="input" type="date" id="audit-from" name="desde" style="width:auto"
          value="${escapeHtml(state.desde)}" title="Desde">

        <label class="sr-only" for="audit-to">Hasta</label>
        <input class="input" type="date" id="audit-to" name="hasta" style="width:auto"
          value="${escapeHtml(state.hasta)}" title="Hasta">

        <button type="button" class="btn btn-ghost btn-sm" id="clear-audit-filters">
          ${icon('rotate-ccw', 15)} Limpiar
        </button>
      </form>
    </section>

    <div id="audit-results" class="mt-2">${loadingView('Consultando la bitácora…')}</div>
  `;

  const results = document.getElementById('audit-results');
  const form = document.getElementById('audit-filters');
  const search = document.getElementById('audit-search');
  let requestId = 0;

  const syncUrl = () => {
    const params = new URLSearchParams();
    if (state.tabla) params.set('tabla', state.tabla);
    if (state.operacion) params.set('operacion', state.operacion);
    if (state.buscar) params.set('buscar', state.buscar);
    if (state.desde) params.set('desde', state.desde);
    if (state.hasta) params.set('hasta', state.hasta);
    if (state.page > 1) params.set('page', String(state.page));
    const text = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}#/auditoria${text ? `?${text}` : ''}`
    );
  };

  const readFilters = () => ({
    tabla: form.tabla.value,
    operacion: form.operacion.value,
    buscar: search.value.trim(),
    desde: form.desde.value,
    hasta: form.hasta.value,
  });

  const load = async () => {
    requestId += 1;
    const current = requestId;
    results.innerHTML = loadingView('Consultando la bitácora…');
    try {
      const data = await api.get('/auditoria', {
        query: {
          tabla: state.tabla || undefined,
          operacion: state.operacion || undefined,
          buscar: state.buscar || undefined,
          desde: state.desde || undefined,
          hasta: state.hasta || undefined,
          page: state.page,
          limit: 25,
        },
      });
      if (!ctx.isCurrent() || current !== requestId) return;

      const total = Number(data.total) || 0;
      const pages = Number(data.pages) || 1;
      const items = data.items || [];
      state.page = Math.min(Number(data.page) || 1, pages);
      const filtered = Boolean(state.tabla || state.operacion || state.buscar || state.desde || state.hasta);

      results.innerHTML = items.length === 0
        ? `
          <div class="table-card">
            <div class="card-body">
              ${emptyState({
                iconName: 'shield',
                title: filtered ? 'Sin eventos que coincidan' : 'La bitácora está vacía',
                text: filtered
                  ? 'Ajuste los filtros o amplíe el rango de fechas para consultar más eventos.'
                  : 'Los cambios del sistema aparecerán aquí en cuanto se registren.',
                action: filtered
                  ? '<button type="button" class="btn btn-primary mt-2" id="empty-audit-clear">Limpiar filtros</button>'
                  : '',
              })}
            </div>
          </div>
        `
        : `
          <div class="table-card">
            <div class="table-toolbar">
              <span class="small muted">${escapeHtml(pluralize(total, 'evento encontrado', 'eventos encontrados'))}</span>
              <span class="spacer"></span>
              <span class="badge badge-gray badge-plain">Página ${state.page} de ${pages}</span>
            </div>
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col">Fecha y hora</th>
                    <th scope="col">Tabla</th>
                    <th scope="col">Operación</th>
                    <th scope="col">Registro</th>
                    <th scope="col">Usuario</th>
                    <th scope="col" class="hide-md">IP</th>
                    <th scope="col" class="hide-md">Origen</th>
                    <th scope="col" class="hide-sm">Descripción</th>
                  </tr>
                </thead>
                <tbody>${items.map(eventRow).join('')}</tbody>
              </table>
            </div>
            <div class="table-foot">
              <span>${escapeHtml(pluralize(total, 'evento', 'eventos'))} · Página ${state.page} de ${pages}</span>
              ${pagination(state.page, pages, 'Paginación de auditoría')}
            </div>
          </div>
        `;

      document.getElementById('empty-audit-clear')?.addEventListener('click', () => {
        search.value = '';
        form.tabla.value = '';
        form.operacion.value = '';
        form.desde.value = '';
        form.hasta.value = '';
        applyFilters();
      });
    } catch (error) {
      if (!ctx.isCurrent() || current !== requestId) return;
      results.innerHTML = `
        ${errorBox(error)}
        <div class="cluster mt-2">
          <button type="button" class="btn btn-primary" id="retry-audit">${icon('refresh', 16)} Reintentar</button>
        </div>
      `;
      document.getElementById('retry-audit')?.addEventListener('click', load);
    }
  };

  const applyFilters = () => {
    Object.assign(state, readFilters());
    state.page = 1;
    syncUrl();
    load();
  };

  const debouncedSearch = debounce(applyFilters, 420);
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

  document.getElementById('clear-audit-filters').addEventListener('click', () => {
    debouncedSearch.cancel();
    search.value = '';
    form.tabla.value = '';
    form.operacion.value = '';
    form.desde.value = '';
    form.hasta.value = '';
    applyFilters();
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

  document.getElementById('refresh-audit').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await load();
      toast('Bitácora actualizada.', { type: 'success', duration: 2600 });
    } finally {
      button.disabled = false;
    }
  });

  await load();
}
