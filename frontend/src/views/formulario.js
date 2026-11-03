/**
 * Alta y edición de justificantes. Valida en el cliente las reglas visibles,
 * pero el servidor sigue siendo la autoridad sobre folio, fechas y documentos.
 */

import api from '../api.js';
import {
  escapeHtml,
  escapeAttr,
  icon,
  pageHeader,
  errorBox,
  toast,
  setBusy,
  formatDate,
  formatDateShort,
  formatDateKey,
  weekdayShort,
  pluralize,
  fileTypeIcon,
  formatBytes,
} from '../ui.js';

const MAX_HISTORY_DAYS = 365;
const MAX_PERIOD_DAYS = 60;

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysBetween = (start, end) => {
  const first = parseDate(start);
  const last = parseDate(end);
  if (!first || !last) return 0;
  return Math.round((last.getTime() - first.getTime()) / 86400000);
};

const weekdaysBetween = (start, end) => {
  const first = parseDate(start);
  const last = parseDate(end);
  if (!first || !last || last < first) return [];
  const dates = [];
  const cursor = new Date(first);
  while (cursor <= last) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) dates.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const formSection = (number, title, description, body) => `
  <section class="card">
    <div class="form-section">
      <div class="form-section-head">
        <span class="form-section-num">${number}</span>
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(description)}</p>
        </div>
      </div>
      ${body}
    </div>
  </section>
`;

export async function render(container, ctx) {
  const rawId = ctx.params?.[0];
  const editId = rawId ? Number(rawId) : null;
  const isEdit = Number.isInteger(editId) && editId > 0;

  let context;
  let existing = null;

  if (isEdit) {
    const [detail, catalog] = await Promise.all([
      api.get(`/justificantes/${editId}`),
      api.get('/catalogos'),
    ]);
    existing = detail.justificante;
    if (existing.status !== 'pendiente') {
      container.innerHTML = `
        ${pageHeader({
          eyebrow: 'Edición no disponible',
          title: 'El justificante ya no puede editarse',
          description: `El expediente ${existing.folio} se encuentra en estado ${existing.statusName}.`,
          actions: `<a class="btn btn-secondary" href="#/justificantes/${Number(existing.id)}">${icon('arrow-left', 16)} Volver al detalle</a>`,
        })}
        <div class="alert alert-warning">
          ${icon('lock', 18)}
          <div>Solo los justificantes en estado <strong>Pendiente</strong> admiten edición. Los expedientes en revisión o resueltos son inmutables.</div>
        </div>
      `;
      return;
    }
    context = {
      student: {
        idStudent: existing.studentId,
        fullName: existing.studentName,
        enrollment: existing.enrollment,
        idGroup: null,
        idCareer: existing.careerId,
        groupName: existing.groupName,
        grade: existing.grade,
        shift: existing.shift,
        idInstitution: existing.institutionId,
        careerName: existing.careerName,
        careerCode: existing.careerCode,
      },
      subjects: (catalog.materias || []).filter((subject) => Number(subject.careerId) === Number(existing.careerId)),
      reasonTypes: catalog.motivos || [],
      documentTypes: catalog.tiposDocumento || [],
      guardians: [],
      settings: catalog.ajustes || {},
    };
  } else {
    context = await api.get('/justificantes/formulario');
  }

  let docentes = [];
  try {
    const response = await api.get('/catalogos/docentes', { query: { carrera: context.student.idCareer } });
    docentes = response.docentes || [];
  } catch {
    docentes = [];
  }

  if (!ctx.isCurrent()) return;

  const settings = context.settings || {};
  const maxFileMb = Number(settings.max_file_size_mb) || 5;
  const maxFileBytes = maxFileMb * 1024 * 1024;
  const validityDays = Number(settings.validity_days) || 5;
  const student = context.student;
  const subjects = context.subjects || [];
  const reasonTypes = context.reasonTypes || [];
  const documentTypes = context.documentTypes || [];

  const today = new Date();
  const todayKey = formatDateKey(today);
  const initialStart = existing?.startDate || todayKey;
  const initialEnd = existing?.endDate || todayKey;
  const existingSubjectTeacher = new Map(
    (existing?.subjects || []).map((subject) => [Number(subject.subjectId), subject.teacherId])
  );
  const initialSubjects = new Set((existing?.subjects || []).map((subject) => Number(subject.subjectId)));
  const initialDates = new Set((existing?.absences || []).map((absence) => absence.date));
  let selectedFile = null;
  let selectedDates = initialDates.size > 0
    ? new Set([...initialDates])
    : new Set(weekdaysBetween(initialStart, initialEnd));

  const reasonOptions = reasonTypes.map((reason) => `
    <option value="${Number(reason.id)}" ${Number(existing?.reasonTypeId) === Number(reason.id) ? 'selected' : ''}>
      ${escapeHtml(reason.name)}${reason.requiresDocument ? ' · requiere comprobante' : ''}
    </option>
  `).join('');

  const documentOptions = documentTypes.map((type) => `
    <option value="${Number(type.id)}">${escapeHtml(type.name)}</option>
  `).join('');

  const subjectRows = subjects.length > 0
    ? subjects.map((subject) => `
      <tr data-subject-row="${Number(subject.id)}">
        <td>
          <label class="subject-check">
            <input type="checkbox" value="${Number(subject.id)}" data-subject-checkbox
              ${initialSubjects.has(Number(subject.id)) ? 'checked' : ''}
              aria-label="Seleccionar ${escapeAttr(subject.name)}">
            <span>${escapeHtml(subject.name)}</span>
          </label>
          <span class="cell-sub" style="margin-left:25px">${escapeHtml(subject.code || '')} · Semestre ${escapeHtml(subject.semester || '—')}</span>
        </td>
        <td>
          <label class="sr-only" for="teacher-${Number(subject.id)}">Docente de ${escapeHtml(subject.name)}</label>
          <select class="select" id="teacher-${Number(subject.id)}" data-teacher-for="${Number(subject.id)}">
            <option value="">Sin docente asignado</option>
            ${docentes.map((teacher) => `
              <option value="${Number(teacher.id)}" ${Number(existingSubjectTeacher.get(Number(subject.id))) === Number(teacher.id) ? 'selected' : ''}>
                ${escapeHtml(teacher.fullName)}
              </option>
            `).join('')}
          </select>
        </td>
      </tr>
    `).join('')
    : `
      <tr>
        <td colspan="2" class="muted">No hay materias activas para la carrera del estudiante.</td>
      </tr>
    `;

  container.innerHTML = `
    ${pageHeader({
      eyebrow: isEdit ? 'Edición de expediente' : 'Nuevo trámite',
      title: isEdit ? `Editar justificante ${existing.folio}` : 'Registrar justificante',
      description: isEdit
        ? 'Actualice el motivo, el periodo o las materias mientras el expediente siga pendiente.'
        : 'Capture la inasistencia, seleccione las materias afectadas y adjunte el comprobante cuando corresponda.',
      actions: `<a class="btn btn-secondary" href="${isEdit ? `#/justificantes/${Number(existing.id)}` : '#/justificantes'}">${icon('arrow-left', 16)} Cancelar</a>`,
    })}

    <div id="form-error" class="mb-2"></div>

    <div class="form-layout">
      <form id="justificante-form" novalidate>
        <div class="stack">
          ${formSection(1, 'Datos del estudiante', 'Información institucional del expediente. El folio se genera en el servidor al guardar.', `
            <dl class="info-grid">
              <div class="info-item"><dt>Estudiante</dt><dd>${escapeHtml(student.fullName)}</dd></div>
              <div class="info-item"><dt>Matrícula</dt><dd class="mono">${escapeHtml(student.enrollment)}</dd></div>
              <div class="info-item"><dt>Carrera</dt><dd>${escapeHtml(student.careerName)}</dd></div>
              <div class="info-item"><dt>Grupo</dt><dd>${escapeHtml(student.groupName)}${student.grade ? ` · ${escapeHtml(student.grade)}.º` : ''}</dd></div>
              <div class="info-item"><dt>Turno</dt><dd>${escapeHtml(student.shift || '—')}</dd></div>
              <div class="info-item"><dt>Folio</dt><dd>${isEdit ? `<span class="mono strong">${escapeHtml(existing.folio)}</span>` : 'Se asignará al guardar'}</dd></div>
            </dl>
          `)}

          ${formSection(2, 'Motivo del justificante', 'Seleccione la causa institucional y describa lo ocurrido con claridad.', `
            <div class="form-grid">
              <div class="field span-2">
                <label for="motivo-id">Motivo <span class="req">*</span></label>
                <select class="select" id="motivo-id" name="motivo_id" required>
                  <option value="">Seleccione un motivo</option>
                  ${reasonOptions}
                </select>
              </div>

              <div class="field span-2">
                <label for="motivo-texto">Descripción del motivo <span class="req">*</span></label>
                <textarea class="textarea" id="motivo-texto" name="motivo" rows="4" maxlength="2000" required
                  placeholder="Describa la situación que originó la inasistencia (mínimo 10 caracteres).">${escapeHtml(existing?.reason || '')}</textarea>
                <span class="field-hint">La descripción debe permitir a la tutoría comprender el caso.</span>
                <span class="field-error" id="motivo-error" hidden></span>
              </div>

              <div class="field span-2">
                <label for="observaciones">Observaciones adicionales</label>
                <textarea class="textarea" id="observaciones" name="observaciones" rows="3" maxlength="2000"
                  placeholder="Información complementaria para la revisión (opcional).">${escapeHtml(existing?.observations || '')}</textarea>
              </div>

              <div class="field span-2">
                <label class="check">
                  <input type="checkbox" id="caso-critico" name="caso_critico" ${existing?.isCritical ? 'checked' : ''}>
                  <span><strong>Marcar como caso crítico</strong><br>
                    <span class="small muted">Los casos críticos requieren al menos un comprobante validado por la tutoría antes de su aprobación.</span>
                  </span>
                </label>
              </div>
            </div>
          `)}

          ${formSection(3, 'Periodo de inasistencia', 'El periodo no puede incluir fechas futuras ni exceder 60 días naturales.', `
            <div class="form-grid">
              <div class="field">
                <label for="fecha-inicio">Fecha inicial <span class="req">*</span></label>
                <input class="input" type="date" id="fecha-inicio" name="fecha_inicio" required
                  max="${todayKey}" value="${escapeHtml(initialStart)}">
              </div>
              <div class="field">
                <label for="fecha-fin">Fecha final <span class="req">*</span></label>
                <input class="input" type="date" id="fecha-fin" name="fecha_fin" required
                  max="${todayKey}" value="${escapeHtml(initialEnd)}">
              </div>
            </div>
            <div class="field-error" id="fechas-error" hidden></div>

            <div class="spread mt-2" style="gap:12px;flex-wrap:wrap">
              <span class="field-label">Días de inasistencia que se justifican</span>
              <span class="cluster" style="gap:6px">
                <button type="button" class="btn btn-ghost btn-sm" id="dates-all">Todos</button>
                <button type="button" class="btn btn-ghost btn-sm" id="dates-none">Ninguno</button>
              </span>
            </div>
            <div class="date-chips mt-1" id="date-chips" aria-live="polite"></div>
            <span class="field-hint">Se excluyen sábados y domingos. Puede desmarcar días específicos si la inasistencia no cubrió todo el periodo.</span>
          `)}

          ${formSection(4, 'Materias afectadas', 'Seleccione las materias en las que se presentó la inasistencia. El docente es opcional.', `
            <div class="table-scroll">
              <table class="subject-table">
                <thead>
                  <tr>
                    <th scope="col">Materia</th>
                    <th scope="col">Docente</th>
                  </tr>
                </thead>
                <tbody>${subjectRows}</tbody>
              </table>
            </div>
            <div class="field-error mt-1" id="materias-error" hidden></div>
          `)}

          ${formSection(5, 'Comprobante', 'Adjunte evidencia cuando el motivo lo exija o se trate de un caso crítico. Formatos PDF, JPG o PNG.', `
            <div class="form-grid">
              <div class="field span-2">
                <label for="tipo-documento">Tipo de documento</label>
                <select class="select" id="tipo-documento" name="tipo_documento_id">
                  ${documentOptions || '<option value="">Sin tipos configurados</option>'}
                </select>
              </div>
            </div>

            ${existing?.documents?.length ? `
              <div class="alert alert-info mt-2">
                ${icon('files', 18)}
                <div>Este expediente ya tiene ${escapeHtml(pluralize(existing.documents.length, 'comprobante cargado', 'comprobantes cargados'))}. Puede conservarlos o adjuntar uno adicional.</div>
              </div>
            ` : ''}

            <div class="dropzone mt-2" id="file-zone">
              ${icon('upload', 22)}
              <strong>Seleccione o arrastre el comprobante</strong>
              <span>PDF, JPG o PNG · máximo ${maxFileMb} MB</span>
              <input type="file" id="archivo" name="archivo" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">
            </div>
            <div id="file-pill"></div>
            <div class="field-error mt-1" id="archivo-error" hidden></div>
          `)}

          <div class="form-actions">
            <a class="btn btn-secondary" href="${isEdit ? `#/justificantes/${Number(existing.id)}` : '#/justificantes'}">Cancelar</a>
            <button type="submit" class="btn btn-primary btn-lg" id="save-button">
              ${icon('save', 17)} ${isEdit ? 'Guardar cambios' : 'Registrar justificante'}
            </button>
          </div>
        </div>
      </form>

      <aside class="form-side">
        <section class="card">
          <div class="card-header"><h2>Resumen del trámite</h2></div>
          <div class="card-body">
            <dl class="summary-list">
              <div><dt>Periodo</dt><dd id="summary-period">—</dd></div>
              <div><dt>Días seleccionados</dt><dd id="summary-days">0</dd></div>
              <div><dt>Materias</dt><dd id="summary-subjects">0</dd></div>
              <div><dt>Comprobante</dt><dd id="summary-file">Sin archivo</dd></div>
              <div><dt>Vigencia</dt><dd>${validityDays} días hábiles</dd></div>
            </dl>
          </div>
        </section>

        <section class="card">
          <div class="card-header"><h2>Requisitos</h2></div>
          <div class="card-body">
            <div class="stack" style="gap:10px" id="requirements">
              <div class="requirement">
                ${icon('calendar', 16)}
                <span>Fechas reales, no futuras y dentro de los últimos 365 días.</span>
              </div>
              <div class="requirement">
                ${icon('file-text', 16)}
                <span>Motivo y descripción claros para facilitar la revisión.</span>
              </div>
              <div class="requirement" id="document-requirement">
                ${icon('file-text', 16)}
                <span>Adjunte comprobante si el motivo lo exige o marca un caso crítico.</span>
              </div>
              <div class="requirement">
                ${icon('lock', 16)}
                <span>El comprobante es privado y solo lo consultan los perfiles autorizados.</span>
              </div>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-body">
            <div class="requirement">
              ${icon('info', 16)}
              <span>El folio se genera automáticamente con el formato <strong>JUS-AAAAMMDD-####</strong> y no puede modificarse.</span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  `;

  if (daysBetween(initialStart, todayKey) > MAX_HISTORY_DAYS) {
    // Salvaguarda visual; el servidor aplica la misma regla.
    document.getElementById('fechas-error').hidden = false;
    document.getElementById('fechas-error').textContent = 'No se pueden justificar inasistencias de hace más de un año.';
  }

  const form = document.getElementById('justificante-form');
  const formError = document.getElementById('form-error');
  const startInput = document.getElementById('fecha-inicio');
  const endInput = document.getElementById('fecha-fin');
  const chips = document.getElementById('date-chips');
  const motivo = document.getElementById('motivo-texto');
  const motivoId = document.getElementById('motivo-id');
  const critical = document.getElementById('caso-critico');
  const fileInput = document.getElementById('archivo');
  const filePill = document.getElementById('file-pill');
  const fileError = document.getElementById('archivo-error');
  const motivoError = document.getElementById('motivo-error');
  const datesError = document.getElementById('fechas-error');
  const subjectsError = document.getElementById('materias-error');
  const saveButton = document.getElementById('save-button');

  const selectedReason = () => reasonTypes.find((reason) => Number(reason.id) === Number(motivoId.value));
  const requiresDocument = () => Boolean(selectedReason()?.requiresDocument || critical.checked);

  const renderDates = ({ reset = false } = {}) => {
    const range = weekdaysBetween(startInput.value, endInput.value);
    const rangeSet = new Set(range);
    if (reset) selectedDates = new Set(range);
    else selectedDates = new Set([...selectedDates].filter((date) => rangeSet.has(date)));

    if (range.length === 0) {
      chips.innerHTML = '<span class="muted small">Seleccione un periodo válido que incluya al menos un día hábil.</span>';
    } else {
      chips.innerHTML = range.map((date) => `
        <label class="date-chip">
          <input type="checkbox" value="${escapeHtml(date)}" data-date-checkbox ${selectedDates.has(date) ? 'checked' : ''}>
          ${escapeHtml(formatDateShort(date))}
          <span class="weekday">${escapeHtml(weekdayShort(date))}</span>
        </label>
      `).join('');
    }
    updateSummary();
  };

  const showFile = (file) => {
    fileError.hidden = true;
    fileInput.removeAttribute('aria-invalid');
    if (!file) {
      selectedFile = null;
      filePill.innerHTML = '';
      updateSummary();
      return;
    }
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) {
      selectedFile = null;
      filePill.innerHTML = '';
      fileError.hidden = false;
      fileError.textContent = 'Solo se permiten archivos PDF, JPG o PNG.';
      updateSummary();
      return;
    }
    if (file.size > maxFileBytes) {
      selectedFile = null;
      filePill.innerHTML = '';
      fileError.hidden = false;
      fileError.textContent = `El archivo excede el límite de ${maxFileMb} MB.`;
      updateSummary();
      return;
    }
    selectedFile = file;
    filePill.innerHTML = `
      <div class="file-pill mt-1">
        ${icon(fileTypeIcon(file.name, file.type), 17)}
        <strong>${escapeHtml(file.name)}</strong>
        <span class="small muted">${escapeHtml(formatBytes(file.size))}</span>
        <button type="button" id="remove-file" aria-label="Quitar archivo">${icon('x', 15)}</button>
      </div>
    `;
    filePill.querySelector('#remove-file')?.addEventListener('click', () => {
      fileInput.value = '';
      showFile(null);
    });
    updateSummary();
  };

  const updateSummary = () => {
    const range = weekdaysBetween(startInput.value, endInput.value);
    const selectedCount = new Set([...selectedDates].filter((date) => range.includes(date))).size;
    const checkedSubjects = form.querySelectorAll('[data-subject-checkbox]:checked').length;

    document.getElementById('summary-period').textContent = startInput.value && endInput.value
      ? `${formatDateShort(startInput.value)} – ${formatDateShort(endInput.value)}`
      : '—';
    document.getElementById('summary-days').textContent = String(selectedCount);
    document.getElementById('summary-subjects').textContent = String(checkedSubjects);
    document.getElementById('summary-file').textContent = selectedFile
      ? selectedFile.name
      : (existing?.documents?.length ? 'Comprobante ya cargado' : 'Sin archivo');

    const requirement = document.getElementById('document-requirement');
    if (requiresDocument()) {
      requirement.className = 'requirement missing';
      requirement.innerHTML = `
        ${icon('alert-triangle', 16)}
        <span>${existing?.documents?.length
          ? 'El expediente ya cuenta con comprobante; puede adjuntar evidencia adicional.'
          : 'Este trámite exige comprobante: adjunte un PDF, JPG o PNG.'}</span>
      `;
    } else {
      requirement.className = 'requirement met';
      requirement.innerHTML = `
        ${icon('check-circle', 16)}
        <span>El comprobante es opcional para el motivo seleccionado.</span>
      `;
    }
  };

  renderDates({ reset: false });

  startInput.addEventListener('change', () => renderDates({ reset: true }));
  endInput.addEventListener('change', () => renderDates({ reset: true }));

  chips.addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-date-checkbox]');
    if (!checkbox) return;
    if (checkbox.checked) selectedDates.add(checkbox.value);
    else selectedDates.delete(checkbox.value);
    updateSummary();
  });

  document.getElementById('dates-all').addEventListener('click', () => renderDates({ reset: true }));
  document.getElementById('dates-none').addEventListener('click', () => {
    selectedDates = new Set();
    chips.querySelectorAll('[data-date-checkbox]').forEach((checkbox) => {
      checkbox.checked = false;
    });
    updateSummary();
  });

  form.addEventListener('change', (event) => {
    if (event.target === motivoId || event.target === critical) updateSummary();
    if (event.target.matches('[data-subject-checkbox]')) updateSummary();
  });

  const zone = document.getElementById('file-zone');
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('dragover');
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    showFile(file);
  });
  fileInput.addEventListener('change', () => showFile(fileInput.files?.[0] || null));

  const clearErrors = () => {
    [motivoError, datesError, subjectsError, fileError].forEach((node) => {
      if (!node) return;
      node.hidden = true;
      node.textContent = '';
    });
    [motivo, startInput, endInput].forEach((input) => input.removeAttribute('aria-invalid'));
    formError.innerHTML = '';
  };

  const validate = () => {
    clearErrors();
    const errors = [];
    const reasonId = Number(motivoId.value);
    const reasonText = motivo.value.trim();
    const start = startInput.value;
    const end = endInput.value;

    if (!reasonId) {
      errors.push('Seleccione el motivo del justificante.');
      motivoId.setAttribute('aria-invalid', 'true');
    }
    if (reasonText.length < 10) {
      errors.push('La descripción del motivo debe tener al menos 10 caracteres.');
      motivo.setAttribute('aria-invalid', 'true');
      motivoError.hidden = false;
      motivoError.textContent = 'Describa el motivo con al menos 10 caracteres.';
    }
    if (!start || !end) {
      errors.push('Indique la fecha inicial y final del periodo.');
    } else {
      if (end < start) {
        errors.push('La fecha final no puede ser anterior a la fecha inicial.');
        endInput.setAttribute('aria-invalid', 'true');
      }
      if (end > todayKey) {
        errors.push('No se pueden justificar inasistencias futuras.');
        endInput.setAttribute('aria-invalid', 'true');
      }
      if (daysBetween(start, end) > MAX_PERIOD_DAYS) {
        errors.push('El periodo no puede exceder 60 días naturales.');
      }
      if (daysBetween(start, todayKey) > MAX_HISTORY_DAYS) {
        errors.push('No se pueden justificar inasistencias de hace más de un año.');
      }
    }

    const range = weekdaysBetween(start, end);
    const chosenDates = [...selectedDates].filter((date) => range.includes(date));
    if (chosenDates.length === 0) {
      errors.push('Seleccione al menos un día hábil de inasistencia.');
      datesError.hidden = false;
      datesError.textContent = 'Seleccione al menos un día de inasistencia.';
    }

    const chosenSubjects = [...form.querySelectorAll('[data-subject-checkbox]:checked')];
    if (chosenSubjects.length === 0) {
      errors.push('Seleccione al menos una materia afectada.');
      subjectsError.hidden = false;
      subjectsError.textContent = 'Seleccione al menos una materia.';
    }

    if (requiresDocument() && !selectedFile && !(existing?.documents?.length > 0)) {
      errors.push('Este trámite exige un comprobante PDF, JPG o PNG.');
      fileError.hidden = false;
      fileError.textContent = 'Adjunte el comprobante requerido antes de guardar.';
    }

    if (errors.length > 0) {
      formError.innerHTML = errorBox({ message: errors[0], details: errors.slice(1) });
      formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return null;
    }

    const subjectsPayload = chosenSubjects.map((checkbox) => {
      const subjectId = Number(checkbox.value);
      const teacher = form.querySelector(`[data-teacher-for="${subjectId}"]`);
      return {
        materia_id: subjectId,
        docente_id: teacher?.value ? Number(teacher.value) : null,
      };
    });

    return {
      motivo_id: reasonId,
      motivo: reasonText,
      observaciones: document.getElementById('observaciones').value.trim(),
      fecha_inicio: start,
      fecha_fin: end,
      caso_critico: critical.checked ? '1' : '0',
      fechas: JSON.stringify(chosenDates),
      materias: JSON.stringify(subjectsPayload),
      tipo_documento_id: document.getElementById('tipo-documento').value || undefined,
    };
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = validate();
    if (!payload) return;

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      formData.append(key, value);
    });
    if (selectedFile) formData.append('archivo', selectedFile);

    setBusy(saveButton, true, isEdit ? 'Guardando cambios…' : 'Registrando…');
    try {
      const response = isEdit
        ? await api.put(`/justificantes/${editId}`, formData)
        : await api.post('/justificantes', formData);
      const saved = response?.justificante;
      toast(response?.mensaje || (isEdit ? 'Justificante actualizado.' : 'Justificante registrado.'), {
        type: 'success',
        title: isEdit ? 'Cambios guardados' : 'Trámite registrado',
      });
      if (saved?.id) ctx.navigate(`/justificantes/${Number(saved.id)}`);
      else ctx.navigate('/justificantes');
    } catch (error) {
      setBusy(saveButton, false);
      formError.innerHTML = errorBox(error);
      formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}
