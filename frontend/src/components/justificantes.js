/**
 * Componentes compartidos para listar justificantes.
 */

import {
  escapeHtml,
  statusBadge,
  formatDateRange,
  formatDateShort,
  emptyState,
  icon,
} from '../ui.js';

export function justificanteRow(item, { showStudent = true } = {}) {
  const student = showStudent
    ? `<td>
         <span class="cell-main">${escapeHtml([item.studentFirstName, item.studentLastName, item.studentSecondLastName].filter(Boolean).join(' '))}</span>
         <span class="cell-sub">Matrícula ${escapeHtml(item.enrollment)}</span>
       </td>`
    : '';

  const docs = `${item.documentsCount ?? 0} comprobante${Number(item.documentsCount) === 1 ? '' : 's'}`;
  const signatures = `${item.signaturesCount ?? 0} firma${Number(item.signaturesCount) === 1 ? '' : 's'}`;

  return `
    <tr data-route="#/justificantes/${Number(item.id)}" tabindex="0" aria-label="Abrir justificante ${escapeHtml(item.folio)}">
      <td>
        <span class="folio">${escapeHtml(item.folio)}</span>
        <span class="cell-sub">${escapeHtml(formatDateShort(item.issueDate))}</span>
      </td>
      ${student}
      <td class="hide-md">
        <span class="cell-main">${escapeHtml(item.careerCode || item.careerName || '—')}</span>
        <span class="cell-sub">${escapeHtml(item.groupName || '')}${item.grade ? ` · ${escapeHtml(item.grade)}.º` : ''}</span>
      </td>
      <td class="hide-sm">
        <span class="cell-main nowrap">${escapeHtml(formatDateRange(item.startDate, item.endDate))}</span>
        <span class="cell-sub">${escapeHtml(item.reasonType || 'Sin motivo')}</span>
      </td>
      <td>${statusBadge(item.status, item.statusName, item.statusTone)}</td>
      <td class="hide-md">
        <span class="cell-sub">${escapeHtml(docs)}</span>
        <span class="cell-sub">${escapeHtml(signatures)}</span>
        ${item.isCritical ? '<span class="critical-flag">Caso crítico</span>' : ''}
      </td>
      <td class="actions-cell hide-sm">${icon('chevron-right', 17)}</td>
    </tr>
  `;
}

export function justificantesTable(items, options = {}) {
  const { showStudent = true, empty = {}, footer = '' } = options;
  if (!items || items.length === 0) {
    return `
      <div class="table-card">
        ${emptyState({
          iconName: 'file-text',
          title: empty.title || 'No hay justificantes',
          text: empty.text || 'Cuando existan registros que coincidan con los filtros aparecerán aquí.',
          action: empty.action || '',
        })}
      </div>
    `;
  }

  return `
    <div class="table-card">
      <div class="table-scroll">
        <table class="data-table clickable">
          <thead>
            <tr>
              <th scope="col">Folio</th>
              ${showStudent ? '<th scope="col">Estudiante</th>' : ''}
              <th scope="col" class="hide-md">Carrera / grupo</th>
              <th scope="col" class="hide-sm">Periodo</th>
              <th scope="col">Estado</th>
              <th scope="col" class="hide-md">Expediente</th>
              <th scope="col" class="actions-cell hide-sm"><span class="sr-only">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item) => justificanteRow(item, { showStudent })).join('')}
          </tbody>
        </table>
      </div>
      ${footer}
    </div>
  `;
}

export function queueItem(item) {
  return `
    <a class="queue-item" href="#/justificantes/${Number(item.id)}" style="color:inherit">
      <div class="queue-main">
        <strong>${escapeHtml(item.folio)} · ${escapeHtml(item.studentFirstName || '')} ${escapeHtml(item.studentLastName || '')}</strong>
        <span>${escapeHtml(item.reasonType || 'Sin motivo')} · ${escapeHtml(formatDateRange(item.startDate, item.endDate))}</span>
      </div>
      <div class="queue-side">
        ${statusBadge(item.status, item.statusName, item.statusTone)}
        <span class="small muted">${escapeHtml(formatDateShort(item.issueDate))}</span>
      </div>
    </a>
  `;
}

export function statusChart(stats, statuses = []) {
  const colors = {
    pendiente: 'var(--amber-600)',
    en_revision: 'var(--blue-600)',
    aprobado: 'var(--green-600)',
    rechazado: 'var(--red-600)',
    cancelado: 'var(--slate-600)',
    vencido: '#7b8f83',
  };
  const labels = {
    pendiente: 'Pendientes',
    en_revision: 'En revisión',
    aprobado: 'Aprobados',
    rechazado: 'Rechazados',
    cancelado: 'Cancelados',
    vencido: 'Vencidos',
  };
  const order = statuses.length > 0
    ? statuses.map((status) => status.code)
    : ['pendiente', 'en_revision', 'aprobado', 'rechazado', 'cancelado', 'vencido'];
  const total = Math.max(1, Number(stats.total) || 0);

  return `
    <div class="chart-legend">
      ${order.map((code) => {
    const value = Number(stats[code] || 0);
    const width = Math.round((value / total) * 100);
    return `
          <div class="chart-row" style="--chart-color:${colors[code] || 'var(--ink-300)'}">
            <span class="chart-name">${escapeHtml(labels[code] || code)}</span>
            <div class="chart-track" role="img" aria-label="${escapeHtml(`${labels[code] || code}: ${value}`)}">
              <div class="chart-bar" style="width:${value > 0 ? Math.max(width, 3) : 0}%"></div>
            </div>
            <span class="chart-value">${value}</span>
          </div>
        `;
  }).join('')}
    </div>
  `;
}
