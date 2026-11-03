/**
 * Utilidades de interfaz: formato, componentes HTML y diálogos.
 * Todo el contenido dinámico se escapa antes de insertarse en el DOM.
 */

import { icon } from './icons.js';

export { icon };

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const STATUS_TONES = {
  pendiente: 'amber',
  en_revision: 'blue',
  aprobado: 'green',
  rechazado: 'red',
  cancelado: 'gray',
  vencido: 'slate',
  validado: 'green',
  firmado: 'green',
};

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
  vencido: 'Vencido',
  validado: 'Validado',
  firmado: 'Firmado',
};

export const ROLE_NAMES = {
  alumno: 'Alumno',
  tutor: 'Tutor educativo',
  directora: 'Dirección de carrera',
  admin: 'Administrador',
};

export const DOCUMENT_STATUS = {
  pendiente: 'Pendiente de validación',
  validado: 'Validado',
  rechazado: 'Rechazado',
};

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttr(value) {
  return escapeHtml(value);
}

export function parseLocalDate(value) {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = parseLocalDate(value);
  if (!date) return '—';
  return `${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

export function formatDateShort(value) {
  const date = parseLocalDate(value);
  if (!date) return '—';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function formatDateKey(value) {
  const date = parseLocalDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDateLong(value) {
  const date = parseLocalDate(value);
  if (!date) return '—';
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const text = String(value);
  const date = parseLocalDate(text);
  if (!date) return '—';
  const hasTime = /\d{2}:\d{2}/.test(text);
  if (!hasTime) return formatDate(value);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatDateRange(start, end) {
  const first = parseLocalDate(start);
  const last = parseLocalDate(end);
  if (!first && !last) return '—';
  if (!last || (first && first.getTime() === last.getTime())) return formatDate(start);
  if (!first) return formatDate(end);
  if (first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()) {
    return `${first.getDate()} – ${last.getDate()} de ${MONTHS[last.getMonth()]} de ${last.getFullYear()}`;
  }
  if (first.getFullYear() === last.getFullYear()) {
    return `${first.getDate()} de ${MONTHS[first.getMonth()]} – ${last.getDate()} de ${MONTHS[last.getMonth()]} de ${last.getFullYear()}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function weekdayShort(value) {
  const date = parseLocalDate(value);
  if (!date) return '';
  return WEEKDAYS[date.getDay()].slice(0, 3);
}

export function relativeTime(value) {
  const date = parseLocalDate(value);
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  return formatDateShort(value);
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'UT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function statusTone(code, explicit) {
  return explicit || STATUS_TONES[code] || 'gray';
}

export function statusLabel(code, explicit) {
  return explicit || STATUS_LABELS[code] || code || '—';
}

export function statusBadge(code, name, tone) {
  return `<span class="badge badge-${escapeAttr(statusTone(code, tone))}">${escapeHtml(statusLabel(code, name))}</span>`;
}

export function docStatusBadge(status) {
  return `<span class="badge badge-${escapeAttr(statusTone(status))} badge-plain">${escapeHtml(DOCUMENT_STATUS[status] || status)}</span>`;
}

export function roleName(code) {
  return ROLE_NAMES[code] || code;
}

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function debounce(fn, wait = 350) {
  let timer = null;
  const debounced = (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => window.clearTimeout(timer);
  return debounced;
}

export function setBusy(button, busy, text = 'Procesando…') {
  if (!button) return;
  if (busy) {
    if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.innerHTML = `<span class="spinner small" aria-hidden="true"></span><span>${escapeHtml(text)}</span>`;
  } else {
    button.removeAttribute('aria-busy');
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

export function pageHeader({ eyebrow = '', title = '', description = '', actions = '' } = {}) {
  return `
    <header class="page-head">
      <div>
        ${eyebrow ? `<span class="page-eyebrow">${escapeHtml(eyebrow)}</span>` : ''}
        <h1>${escapeHtml(title)}</h1>
        ${description ? `<p class="page-description">${escapeHtml(description)}</p>` : ''}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </header>
  `;
}

export function statCard({ label, value, iconName = 'file-text', hint = '', tone = '', href = '' }) {
  const tag = href ? 'a' : 'div';
  const attrs = href ? ` href="${escapeAttr(href)}"` : '';
  return `
    <${tag} class="stat-card ${escapeAttr(tone)}"${attrs}>
      <div class="stat-card-top">
        <span class="stat-label">${escapeHtml(label)}</span>
        <span class="stat-icon">${icon(iconName, 17)}</span>
      </div>
      <strong class="stat-value">${escapeHtml(value)}</strong>
      ${hint ? `<span class="stat-foot">${escapeHtml(hint)}</span>` : ''}
    </${tag}>
  `;
}

export function emptyState({ iconName = 'file-text', title = 'Sin registros', text = '', action = '' } = {}) {
  return `
    <div class="empty-state">
      <span class="empty-icon">${icon(iconName, 24)}</span>
      <h3>${escapeHtml(title)}</h3>
      ${text ? `<p>${escapeHtml(text)}</p>` : ''}
      ${action || ''}
    </div>
  `;
}

export function alertBox(message, type = 'info', title = '') {
  const iconName = type === 'error' ? 'alert-circle'
    : type === 'warning' ? 'alert-triangle'
      : type === 'success' ? 'check-circle'
        : 'info';
  return `
    <div class="alert alert-${escapeAttr(type)}">
      ${icon(iconName, 18)}
      <div>${title ? `<strong>${escapeHtml(title)}</strong><br>` : ''}${escapeHtml(message)}</div>
    </div>
  `;
}

export function errorBox(error) {
  if (!error) return '';
  const details = Array.isArray(error.details) ? error.details.filter(Boolean) : [];
  const base = escapeHtml(error.message || 'Ocurrió un error inesperado.');
  const list = details.length > 1
    ? `<ul style="margin:6px 0 0;padding-left:18px">${details.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  return `
    <div class="alert alert-error" role="alert">
      ${icon('alert-circle', 18)}
      <div><strong>No se pudo completar la operación</strong><br>${base}${list}</div>
    </div>
  `;
}

let toastStack = null;

function ensureToastStack() {
  if (toastStack && document.body.contains(toastStack)) return toastStack;
  toastStack = document.createElement('div');
  toastStack.className = 'toast-stack';
  toastStack.setAttribute('aria-live', 'polite');
  toastStack.setAttribute('aria-atomic', 'false');
  document.body.appendChild(toastStack);
  return toastStack;
}

export function toast(message, { type = 'success', title = '', duration = 5200 } = {}) {
  const stack = ensureToastStack();
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const iconName = type === 'error' ? 'alert-circle'
    : type === 'warning' ? 'alert-triangle'
      : type === 'info' ? 'info'
        : 'check-circle';
  node.innerHTML = `
    ${icon(iconName, 19)}
    <div>${title ? `<strong>${escapeHtml(title)}</strong>` : ''}${escapeHtml(message)}</div>
  `;
  stack.appendChild(node);
  const remove = () => {
    node.classList.add('leaving');
    window.setTimeout(() => node.remove(), 180);
  };
  node.addEventListener('click', remove);
  if (duration > 0) window.setTimeout(remove, duration);
  return remove;
}

export function openModal({ title, subtitle = '', body = '', footer = '', wide = false, onOpen = null } = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = `modal${wide ? ' wide' : ''}`;
  dialog.innerHTML = `
    <div class="modal-head">
      <div>
        <h2>${escapeHtml(title)}</h2>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <button type="button" class="modal-close" data-modal-close aria-label="Cerrar">${icon('x', 18)}</button>
    </div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
  `;
  document.body.appendChild(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelectorAll('[data-modal-close]').forEach((button) => {
    button.addEventListener('click', () => dialog.close());
  });
  dialog.showModal();
  if (typeof onOpen === 'function') onOpen(dialog);
  else {
    const first = dialog.querySelector('input:not([type="hidden"]), select, textarea, button:not(.modal-close)');
    if (first) window.setTimeout(() => first.focus(), 40);
  }
  return dialog;
}

export function closeModal(dialog) {
  if (dialog && dialog.open) dialog.close();
}

export function confirmAction({
  title = 'Confirmar acción',
  message = '¿Desea continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  tone = 'primary',
  details = '',
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      dialog.close();
      resolve(value);
    };
    const dialog = openModal({
      title,
      body: `<p class="muted" style="font-size:13.5px;line-height:1.6">${escapeHtml(message)}</p>${details}`,
      footer: `
        <button type="button" class="btn btn-secondary" data-cancel>${escapeHtml(cancelText)}</button>
        <button type="button" class="btn btn-${tone === 'primary' ? 'primary' : tone}" data-confirm>${escapeHtml(confirmText)}</button>
      `,
      onOpen: (node) => {
        node.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
        node.querySelector('[data-confirm]').addEventListener('click', () => finish(true));
        window.setTimeout(() => node.querySelector('[data-confirm]').focus(), 40);
      },
    });
    dialog.addEventListener('close', () => finish(false));
  });
}

export function parseHashQuery(hash = window.location.hash) {
  const raw = String(hash || '').replace(/^#/, '');
  const index = raw.indexOf('?');
  const path = index >= 0 ? raw.slice(0, index) : raw;
  const params = new URLSearchParams(index >= 0 ? raw.slice(index + 1) : '');
  return { path: path || '/inicio', params };
}

export function routeFor(path, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    params.set(key, value === true ? '1' : value);
  });
  const text = params.toString();
  return `#${path}${text ? `?${text}` : ''}`;
}

export function setQueryParam(key, value) {
  const { path, params } = parseHashQuery();
  if (value === undefined || value === null || value === '' || value === false) params.delete(key);
  else params.set(key, value === true ? '1' : value);
  const text = params.toString();
  window.location.hash = `${path}${text ? `?${text}` : ''}`;
}

export function pluralize(count, singular, plural) {
  return `${count} ${Number(count) === 1 ? singular : plural}`;
}

export function toTitleCase(value = '') {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function pagination(page, pages, label = 'Paginación') {
  const current = Number(page) || 1;
  const total = Number(pages) || 1;
  if (total <= 1) return '';
  const visible = new Set([1, total, current - 1, current, current + 1]);
  const parts = [];
  let previous = 0;

  for (let number = 1; number <= total; number += 1) {
    if (!visible.has(number)) continue;
    if (previous && number - previous > 1) {
      parts.push('<span class="muted small" aria-hidden="true">…</span>');
    }
    parts.push(`
      <button type="button" data-page="${number}" class="${number === current ? 'active' : ''}"
        ${number === current ? 'aria-current="page"' : ''} aria-label="Página ${number}">${number}</button>
    `);
    previous = number;
  }

  return `
    <div class="pagination" role="navigation" aria-label="${escapeAttr(label)}">
      <button type="button" data-page="${current - 1}" ${current <= 1 ? 'disabled' : ''} aria-label="Página anterior">
        ${icon('chevron-left', 16)}
      </button>
      ${parts.join('')}
      <button type="button" data-page="${current + 1}" ${current >= total ? 'disabled' : ''} aria-label="Página siguiente">
        ${icon('chevron-right', 16)}
      </button>
    </div>
  `;
}

export function operationBadge(operation) {
  const map = {
    INSERT: ['green', 'Alta'],
    UPDATE: ['blue', 'Cambio'],
    DELETE: ['red', 'Baja'],
  };
  const [tone, label] = map[operation] || ['gray', operation];
  return `<span class="badge badge-${tone} badge-plain">${escapeHtml(label)}</span>`;
}

export function tableNameLabel(name = '') {
  const map = {
    tb_justifications: 'Justificantes',
    tb_supporting_documents: 'Comprobantes',
    tb_justification_signatures: 'Firmas',
    tb_institutional_stamps: 'Sellos',
    tb_justification_status_history: 'Historial',
    tb_users: 'Usuarios',
    tb_students: 'Estudiantes',
    tb_system_settings: 'Configuración',
    tb_audit_logs: 'Auditoría',
  };
  return map[name] || toTitleCase(name.replace(/^tb[d]?_/, ''));
}

export function workspaceContent() {
  const main = document.getElementById('view');
  if (!main) throw new Error('No se encontró el contenedor de la vista');
  return main;
}

export function loadingView(message = 'Cargando información…') {
  return `
    <div class="view-loading" role="status">
      <span class="spinner" aria-hidden="true"></span>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

export function fileTypeIcon(name = '', mime = '') {
  const lower = String(name).toLowerCase();
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'file-text';
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png)$/.test(lower)) return 'image';
  return 'file';
}

export function signedBadge(status) {
  if (status === 'firmado') return '<span class="badge badge-green">Firmado</span>';
  if (status === 'rechazado') return '<span class="badge badge-red">Rechazado</span>';
  return '<span class="badge badge-gray">Pendiente</span>';
}
