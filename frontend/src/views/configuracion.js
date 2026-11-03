/**
 * Configuración institucional: parámetros del sistema, datos de la institución,
 * días inhábiles y catálogos académicos. Los parámetros se actualizan uno a uno
 * mediante la API y quedan registrados en la bitácora.
 */

import api from '../api.js';
import {
  escapeHtml,
  escapeAttr,
  icon,
  pageHeader,
  loadingView,
  errorBox,
  toast,
  setBusy,
  formatDate,
  formatDateTime,
  pluralize,
  toTitleCase,
  roleName,
} from '../ui.js';

const SETTING_META = {
  validity_days: {
    label: 'Días hábiles de vigencia',
    help: 'Días hábiles que un justificante permanece vigente desde su emisión.',
    type: 'number',
    min: 1,
    max: 90,
    unit: 'días hábiles',
  },
  critical_requires_document: {
    label: 'Comprobante obligatorio en casos críticos',
    help: 'Exige al menos un comprobante validado antes de aprobar un caso crítico.',
    type: 'boolean',
  },
  max_file_size_mb: {
    label: 'Tamaño máximo de comprobantes',
    help: 'Límite por archivo para comprobantes PDF, JPG o PNG.',
    type: 'number',
    min: 1,
    max: 25,
    unit: 'MB',
  },
  allowed_extensions: {
    label: 'Extensiones permitidas',
    help: 'Lista separada por comas. Formatos aceptados para comprobantes.',
    type: 'text',
    maxLength: 40,
  },
  folio_prefix: {
    label: 'Prefijo del folio',
    help: 'Prefijo institucional usado al generar el folio. El formato completo es PREFIJO-AAAAMMDD-####.',
    type: 'text',
    maxLength: 8,
  },
  password_min_length: {
    label: 'Longitud mínima de contraseña',
    help: 'Cantidad mínima de caracteres exigida al establecer una contraseña.',
    type: 'number',
    min: 8,
    max: 72,
    unit: 'caracteres',
  },
  max_login_attempts: {
    label: 'Intentos de acceso fallidos',
    help: 'Número de intentos fallidos antes de bloquear temporalmente la cuenta.',
    type: 'number',
    min: 1,
    max: 20,
    unit: 'intentos',
  },
  lock_minutes: {
    label: 'Duración del bloqueo',
    help: 'Minutos que permanece bloqueada una cuenta tras superar los intentos fallidos.',
    type: 'number',
    min: 1,
    max: 1440,
    unit: 'minutos',
  },
  session_hours: {
    label: 'Duración de la sesión',
    help: 'Horas que permanece válida una sesión autenticada.',
    type: 'number',
    min: 1,
    max: 72,
    unit: 'horas',
  },
};

const metaFor = (key) => SETTING_META[key] || {
  label: toTitleCase(key),
  help: 'Parámetro configurable del sistema.',
  type: 'text',
  maxLength: 120,
};

const settingInput = (setting) => {
  const meta = metaFor(setting.key);
  const id = `setting-${setting.key}`;
  if (meta.type === 'boolean') {
    const value = String(setting.value) === '1' || setting.value === true;
    return `
      <select class="select" id="${escapeAttr(id)}" data-setting-input="${escapeAttr(setting.key)}">
        <option value="1" ${value ? 'selected' : ''}>Sí, exigir comprobante</option>
        <option value="0" ${!value ? 'selected' : ''}>No, permitir sin comprobante</option>
      </select>
    `;
  }
  if (meta.type === 'number') {
    return `
      <input class="input" type="number" id="${escapeAttr(id)}" data-setting-input="${escapeAttr(setting.key)}"
        value="${escapeAttr(setting.value)}" min="${Number(meta.min) || 0}" max="${Number(meta.max) || 9999}" step="1">
    `;
  }
  return `
    <input class="input" type="text" id="${escapeAttr(id)}" data-setting-input="${escapeAttr(setting.key)}"
      value="${escapeAttr(setting.value)}" maxlength="${Number(meta.maxLength) || 120}">
  `;
};

const settingsPanel = (settings) => `
  <section class="card">
    <div class="card-header">
      <div>
        <h2>Parámetros del sistema</h2>
        <p class="small muted" style="margin-top:3px">Ajuste la vigencia, los límites de archivos y las políticas de acceso. Cada cambio se guarda por separado.</p>
      </div>
      <span class="badge badge-gray badge-plain">${escapeHtml(pluralize(settings.length, 'parámetro', 'parámetros'))}</span>
    </div>
    <div class="card-body">
      ${settings.length === 0
        ? '<p class="muted small">No hay parámetros configurados.</p>'
        : `<div class="settings-list">
            ${settings.map((setting) => {
              const meta = metaFor(setting.key);
              return `
                <div class="setting-row" data-setting-row="${escapeAttr(setting.key)}">
                  <div>
                    <span class="setting-key">${escapeHtml(meta.label)}</span>
                    <span class="setting-desc">${escapeHtml(meta.help)}</span>
                    <span class="setting-desc"><code>${escapeHtml(setting.key)}</code> · ${escapeHtml(meta.unit || 'valor del sistema')}</span>
                    <span class="setting-desc" data-setting-meta>
                      ${setting.updatedAt
                        ? `Actualizado ${escapeHtml(formatDateTime(setting.updatedAt))}${setting.updatedByName ? ` por ${escapeHtml(setting.updatedByName)}` : ''}`
                        : 'Sin actualizaciones registradas'}
                    </span>
                  </div>
                  ${settingInput(setting)}
                  <button type="button" class="btn btn-secondary btn-sm" data-save-setting="${escapeAttr(setting.key)}">
                    ${icon('save', 15)} Guardar
                  </button>
                </div>
              `;
            }).join('')}
          </div>`}
    </div>
  </section>
`;

const institutionPanel = (institution) => {
  if (!institution) {
    return `
      <div class="alert alert-warning">
        ${icon('alert-triangle', 18)}
        <div>No se encontró el registro de la institución. Verifique la base de datos.</div>
      </div>
    `;
  }
  const item = (label, value) => `
    <div class="readonly-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || '—')}</strong>
    </div>
  `;
  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Datos de la institución</h2>
          <p class="small muted" style="margin-top:3px">Información oficial que se imprime en los justificantes y sellos institucionales.</p>
        </div>
        <span class="badge badge-green badge-plain">Activa</span>
      </div>
      <div class="card-body">
        <div class="readonly-grid">
          ${item('Nombre oficial', institution.name)}
          ${item('Siglas', institution.acronym)}
          ${item('Dirección', institution.address)}
          ${item('Ciudad', institution.city)}
          ${item('Estado', institution.stateName)}
          ${item('País', institution.country)}
          ${item('Teléfono', institution.phone)}
          ${item('Correo institucional', institution.email)}
        </div>
        <div class="alert alert-info mt-2">
          ${icon('info', 18)}
          <div>Los datos de la institución son la fuente oficial del encabezado, la firma y el sello. Para modificarlos, actualice el registro institucional en la base de datos y reinicie la sesión.</div>
        </div>
      </div>
    </section>
  `;
};

const nonWorkingPanel = (days) => `
  <section class="card">
    <div class="card-header">
      <div>
        <h2>Días inhábiles institucionales</h2>
        <p class="small muted" style="margin-top:3px">No cuentan para el cálculo de la vigencia en días hábiles.</p>
      </div>
      <span class="badge badge-gray badge-plain">${escapeHtml(pluralize(days.length, 'día', 'días'))}</span>
    </div>
    ${days.length === 0
      ? '<div class="card-body"><p class="muted small">No hay días inhábiles registrados.</p></div>'
      : `
        <div class="table-scroll">
          <table class="catalog-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Descripción</th>
                <th scope="col">Recurrencia</th>
              </tr>
            </thead>
            <tbody>
              ${days.map((day) => `
                <tr>
                  <td class="nowrap mono">${escapeHtml(formatDate(day.date))}</td>
                  <td>${escapeHtml(day.description || 'Día inhábil')}</td>
                  <td>
                    <span class="badge badge-${day.isRecurring ? 'blue' : 'gray'} badge-plain">
                      ${day.isRecurring ? 'Anual' : 'Única vez'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    <div class="card-body">
      <div class="alert alert-info">
        ${icon('calendar', 18)}
        <div>La vigencia se calcula contando días hábiles y omitiendo sábados, domingos y estos días inhábiles. El catálogo se administra desde la base de datos institucional.</div>
      </div>
    </div>
  </section>
`;

const catalogTable = (title, description, headers, rows) => `
  <section class="card">
    <div class="card-header">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p class="small muted" style="margin-top:3px">${escapeHtml(description)}</p>
      </div>
      <span class="badge badge-gray badge-plain">${escapeHtml(pluralize(rows.length, 'registro', 'registros'))}</span>
    </div>
    ${rows.length === 0
      ? '<div class="card-body"><p class="muted small">Sin registros activos.</p></div>'
      : `
        <div class="table-scroll">
          <table class="catalog-table">
            <thead>
              <tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      `}
  </section>
`;

const catalogsPanel = (catalogos) => {
  const careers = catalogos.carreras || [];
  const groups = catalogos.grupos || [];
  const subjects = catalogos.materias || [];
  const reasons = catalogos.motivos || [];
  const documentTypes = catalogos.tiposDocumento || [];
  const statuses = catalogos.estados || [];
  const roles = catalogos.roles || [];

  return `
    <div class="stack">
      <div class="admin-grid">
        ${catalogTable(
          'Carreras',
          'Programas educativos activos de la institución.',
          ['Código', 'Carrera', 'Nivel', 'Grupos'],
          careers.map((career) => [
            `<span class="mono">${escapeHtml(career.code)}</span>`,
            escapeHtml(career.name),
            escapeHtml(toTitleCase(career.level || '')),
            String(Number(career.groupsCount) || 0),
          ])
        )}

        ${catalogTable(
          'Grupos',
          'Grupos activos por carrera, grado y turno.',
          ['Carrera', 'Grupo', 'Grado', 'Turno', 'Estudiantes'],
          groups.map((group) => [
            escapeHtml(group.careerCode || group.careerName || '—'),
            escapeHtml(group.name),
            group.grade ? `${Number(group.grade)}.º` : '—',
            escapeHtml(toTitleCase(group.shift || '—')),
            String(Number(group.studentsCount) || 0),
          ])
        )}
      </div>

      ${catalogTable(
        'Materias',
        'Materias activas por carrera y semestre.',
        ['Carrera', 'Código', 'Materia', 'Semestre', 'Créditos'],
        subjects.map((subject) => [
          escapeHtml(subject.careerName || '—'),
          `<span class="mono">${escapeHtml(subject.code)}</span>`,
          escapeHtml(subject.name),
          subject.semester ? String(subject.semester) : '—',
          subject.credits ? String(subject.credits) : '—',
        ])
      )}

      <div class="admin-grid">
        ${catalogTable(
          'Motivos de justificante',
          'Causas institucionales disponibles para el alumnado.',
          ['Motivo', 'Comprobante'],
          reasons.map((reason) => [
            `<span class="cell-main">${escapeHtml(reason.name)}</span><span class="cell-sub">${escapeHtml(reason.code)}</span>`,
            reason.requiresDocument
              ? '<span class="badge badge-amber badge-plain">Obligatorio</span>'
              : '<span class="badge badge-gray badge-plain">Opcional</span>',
          ])
        )}

        ${catalogTable(
          'Tipos de comprobante',
          'Documentos aceptados como evidencia del trámite.',
          ['Tipo', 'Extensiones', 'Validación'],
          documentTypes.map((type) => [
            `<span class="cell-main">${escapeHtml(type.name)}</span><span class="cell-sub">${escapeHtml(type.code)}</span>`,
            escapeHtml((type.allowedExtensions || []).join(', ')),
            type.requiresValidation
              ? '<span class="badge badge-blue badge-plain">Requiere revisión</span>'
              : '<span class="badge badge-gray badge-plain">Directa</span>',
          ])
        )}
      </div>

      <div class="admin-grid">
        ${catalogTable(
          'Estados del justificante',
          'Flujo de estados y su carácter final.',
          ['Estado', 'Descripción', 'Final'],
          statuses.map((status) => [
            `<span class="cell-main">${escapeHtml(status.name)}</span><span class="cell-sub mono">${escapeHtml(status.code)}</span>`,
            escapeHtml(status.description || '—'),
            status.isFinal
              ? '<span class="badge badge-red badge-plain">Inmutable</span>'
              : '<span class="badge badge-green badge-plain">Editable</span>',
          ])
        )}

        ${catalogTable(
          'Roles del sistema',
          'Perfiles de acceso y su propósito.',
          ['Rol', 'Descripción'],
          roles.map((role) => [
            `<span class="cell-main">${escapeHtml(role.name || roleName(role.code))}</span><span class="cell-sub mono">${escapeHtml(role.code)}</span>`,
            escapeHtml(role.description || '—'),
          ])
        )}
      </div>
    </div>
  `;
};

const TAB_LABELS = {
  parametros: 'Parámetros',
  institucion: 'Institución',
  dias: 'Días inhábiles',
  catalogos: 'Catálogos',
};

export async function render(container, ctx) {
  if (!ctx.user?.roles?.includes('admin')) {
    container.innerHTML = errorBox({ message: 'Esta sección requiere el rol de administrador.' });
    return;
  }

  const initialTab = TAB_LABELS[ctx.query.get('tab')] ? ctx.query.get('tab') : 'parametros';

  const [settingsData, institutionData, nonWorkingData, catalogsData, rolesData] = await Promise.all([
    api.get('/catalogos/configuracion'),
    api.get('/catalogos/institucion'),
    api.get('/catalogos/dias-inhabiles'),
    api.get('/catalogos'),
    api.get('/catalogos/roles').catch(() => ({ roles: [] })),
  ]);
  if (!ctx.isCurrent()) return;

  let settings = settingsData.ajustes || [];
  const institution = institutionData.institucion || null;
  const nonWorkingDays = nonWorkingData.diasInhabiles || [];
  const catalogos = { ...catalogsData, roles: rolesData.roles || [] };

  container.innerHTML = `
    ${pageHeader({
      eyebrow: 'Administración del sistema',
      title: 'Configuración institucional',
      description: 'Defina las reglas de vigencia, los límites de archivos, las políticas de acceso y consulte los catálogos que alimentan el trámite.',
      actions: `<a class="btn btn-secondary" href="#/auditoria">${icon('shield', 16)} Ver auditoría</a>`,
    })}

    <div class="tabs" role="tablist" aria-label="Secciones de configuración">
      ${Object.entries(TAB_LABELS).map(([key, label]) => `
        <button type="button" class="tab ${key === initialTab ? 'active' : ''}" role="tab"
          id="tab-${key}" aria-selected="${key === initialTab}" aria-controls="panel-${key}"
          data-tab="${key}">${escapeHtml(label)}</button>
      `).join('')}
    </div>

    <div class="mt-2">
      <div id="panel-parametros" role="tabpanel" aria-labelledby="tab-parametros" ${initialTab === 'parametros' ? '' : 'hidden'}>
        ${settingsPanel(settings)}
      </div>
      <div id="panel-institucion" role="tabpanel" aria-labelledby="tab-institucion" ${initialTab === 'institucion' ? '' : 'hidden'}>
        ${institutionPanel(institution)}
      </div>
      <div id="panel-dias" role="tabpanel" aria-labelledby="tab-dias" ${initialTab === 'dias' ? '' : 'hidden'}>
        ${nonWorkingPanel(nonWorkingDays)}
      </div>
      <div id="panel-catalogos" role="tabpanel" aria-labelledby="tab-catalogos" ${initialTab === 'catalogos' ? '' : 'hidden'}>
        ${catalogsPanel(catalogos)}
      </div>
    </div>
  `;

  const activateTab = (key) => {
    document.querySelectorAll('[data-tab]').forEach((button) => {
      const active = button.dataset.tab === key;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    Object.keys(TAB_LABELS).forEach((name) => {
      const panel = document.getElementById(`panel-${name}`);
      if (panel) panel.hidden = name !== key;
    });
    const text = key === 'parametros' ? '' : `?tab=${key}`;
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}#/configuracion${text}`
    );
  };

  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.tab));
  });

  container.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-save-setting]');
    if (!button) return;
    const key = button.dataset.saveSetting;
    const setting = settings.find((item) => item.key === key);
    if (!setting) return;
    const meta = metaFor(key);
    const input = container.querySelector(`[data-setting-input="${key}"]`);
    const row = button.closest('[data-setting-row]');
    if (!input || !row) return;

    let value = input.value.trim();
    if (!value) {
      toast('El valor del parámetro no puede estar vacío.', { type: 'warning' });
      input.focus();
      return;
    }

    if (meta.type === 'number') {
      const number = Number(value);
      if (!Number.isInteger(number) || number < (Number(meta.min) || 0) || number > (Number(meta.max) || 9999)) {
        toast(`Capture un número entero entre ${Number(meta.min) || 0} y ${Number(meta.max) || 9999}.`, { type: 'warning' });
        input.focus();
        return;
      }
      value = String(number);
    }

    if (key === 'allowed_extensions') {
      const extensions = value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
      if (extensions.length === 0 || extensions.some((item) => !/^[a-z0-9]{2,5}$/.test(item))) {
        toast('Capture extensiones válidas separadas por comas, por ejemplo: pdf,jpg,jpeg,png.', { type: 'warning' });
        input.focus();
        return;
      }
      value = [...new Set(extensions)].join(',');
    }

    if (key === 'folio_prefix' && !/^[A-Z0-9]{2,8}$/.test(value.toUpperCase())) {
      toast('El prefijo debe tener entre 2 y 8 letras o números, sin espacios.', { type: 'warning' });
      input.focus();
      return;
    }

    if (key === 'folio_prefix') value = value.toUpperCase();

    setBusy(button, true, 'Guardando…');
    try {
      const response = await api.put(`/catalogos/configuracion/${encodeURIComponent(key)}`, { valor: value });
      const updated = response?.ajuste;
      if (updated) {
        settings = settings.map((item) => (item.key === key ? updated : item));
      }
      input.value = updated?.value ?? value;
      const metaNode = row.querySelector('[data-setting-meta]');
      if (metaNode) {
        metaNode.textContent = `Actualizado ${formatDateTime(updated?.updatedAt || new Date())}${updated?.updatedByName ? ` por ${updated.updatedByName}` : ''}`;
      }
      toast(response?.mensaje || 'Configuración actualizada correctamente.', { type: 'success' });
    } catch (error) {
      toast(error.message || 'No se pudo actualizar la configuración.', { type: 'error', duration: 7000 });
    } finally {
      setBusy(button, false);
    }
  });
}
