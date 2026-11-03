/**
 * Detalle de un justificante: datos, comprobantes, firmas, sellos, historial y
 * acciones disponibles según el rol y el estado del expediente.
 */

import api from '../api.js';
import { hasRole } from '../auth.js';
import {
  escapeHtml,
  escapeAttr,
  icon,
  pageHeader,
  loadingView,
  errorBox,
  statusBadge,
  docStatusBadge,
  formatDate,
  formatDateShort,
  formatDateRange,
  formatDateTime,
  formatBytes,
  statusLabel,
  toast,
  confirmAction,
  openModal,
  setBusy,
  fileTypeIcon,
  signedBadge,
  toTitleCase,
  pluralize,
} from '../ui.js';

const FINAL_STATUSES = ['aprobado', 'rechazado', 'cancelado', 'vencido'];

const infoItem = (label, value, { full = false } = {}) => `
  <div class="info-item${full ? ' full' : ''}">
    <dt>${escapeHtml(label)}</dt>
    <dd>${value === null || value === undefined || value === '' ? '—' : value}</dd>
  </div>
`;

const commentModal = ({
  title,
  message,
  confirmText = 'Confirmar',
  tone = 'primary',
  required = false,
  placeholder = 'Escriba un comentario…',
  label = 'Comentario',
}) => new Promise((resolve) => {
  let settled = false;
  openModal({
    title,
    body: `
      <p class="muted" style="font-size:13.5px;line-height:1.6">${escapeHtml(message)}</p>
      <div class="field mt-2">
        <label for="comment-input">${escapeHtml(label)}${required ? ' <span class="req">*</span>' : ''}</label>
        <textarea class="textarea" id="comment-input" rows="4" maxlength="500"
          placeholder="${escapeAttr(placeholder)}"></textarea>
        <span class="field-hint">${required ? 'Mínimo 5 caracteres.' : 'Opcional, máximo 500 caracteres.'}</span>
        <span class="field-error" id="comment-error" hidden></span>
      </div>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-cancel>Cancelar</button>
      <button type="button" class="btn btn-${tone === 'primary' ? 'primary' : tone}" data-confirm>${escapeHtml(confirmText)}</button>
    `,
    onOpen: (node) => {
      const textarea = node.querySelector('#comment-input');
      const error = node.querySelector('#comment-error');
      const finish = (value) => {
        if (settled) return;
        settled = true;
        node.close();
        resolve(value);
      };
      node.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      node.querySelector('[data-confirm]').addEventListener('click', () => {
        const value = textarea.value.trim();
        if (required && value.length < 5) {
          textarea.setAttribute('aria-invalid', 'true');
          error.hidden = false;
          error.textContent = 'Capture al menos 5 caracteres para continuar.';
          textarea.focus();
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
      window.setTimeout(() => textarea.focus(), 50);
    },
  });
});

const documentValidationModal = ({ title, documentName }) => new Promise((resolve) => {
  let settled = false;
  openModal({
    title,
    subtitle: documentName,
    body: `
      <div class="field">
        <label for="doc-status">Resultado de la validación</label>
        <select class="select" id="doc-status">
          <option value="validado">Validado</option>
          <option value="rechazado">Rechazado</option>
          <option value="pendiente">Regresar a pendiente</option>
        </select>
      </div>
      <div class="field mt-2">
        <label for="doc-notes">Observaciones</label>
        <textarea class="textarea" id="doc-notes" rows="3" maxlength="500"
          placeholder="Indique el motivo del rechazo o las observaciones de la validación."></textarea>
        <span class="field-hint">Obligatorio cuando el comprobante se rechaza.</span>
        <span class="field-error" id="doc-notes-error" hidden></span>
      </div>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-cancel>Cancelar</button>
      <button type="button" class="btn btn-primary" data-confirm>Registrar validación</button>
    `,
    onOpen: (node) => {
      const status = node.querySelector('#doc-status');
      const notes = node.querySelector('#doc-notes');
      const error = node.querySelector('#doc-notes-error');
      const finish = (value) => {
        if (settled) return;
        settled = true;
        node.close();
        resolve(value);
      };
      node.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      node.querySelector('[data-confirm]').addEventListener('click', () => {
        const value = notes.value.trim();
        if (status.value === 'rechazado' && value.length < 3) {
          notes.setAttribute('aria-invalid', 'true');
          error.hidden = false;
          error.textContent = 'Explique el motivo del rechazo del comprobante.';
          notes.focus();
          return;
        }
        finish({ estado: status.value, notas: value });
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

const uploadDocumentModal = async (documentTypes) => new Promise((resolve) => {
  let settled = false;
  let selectedFile = null;

  openModal({
    title: 'Adjuntar comprobante',
    body: `
      <div class="field">
        <label for="upload-type">Tipo de documento</label>
        <select class="select" id="upload-type">
          ${documentTypes.map((type) => `
            <option value="${Number(type.id)}">${escapeHtml(type.name)}</option>
          `).join('')}
        </select>
      </div>

      <div class="dropzone mt-2" id="upload-zone">
        ${icon('upload', 22)}
        <strong>Seleccione o arrastre un archivo</strong>
        <span>PDF, JPG o PNG · máximo 5 MB</span>
        <input type="file" id="upload-file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png">
      </div>
      <div id="upload-file-pill"></div>
      <span class="field-error" id="upload-error" hidden></span>
    `,
    footer: `
      <button type="button" class="btn btn-secondary" data-cancel>Cancelar</button>
      <button type="button" class="btn btn-primary" data-confirm disabled>${icon('upload', 16)} Cargar comprobante</button>
    `,
    onOpen: (node) => {
      const input = node.querySelector('#upload-file');
      const zone = node.querySelector('#upload-zone');
      const pill = node.querySelector('#upload-file-pill');
      const error = node.querySelector('#upload-error');
      const confirm = node.querySelector('[data-confirm]');

      const finish = (value) => {
        if (settled) return;
        settled = true;
        node.close();
        resolve(value);
      };

      const showFile = (file) => {
        error.hidden = true;
        input.removeAttribute('aria-invalid');
        if (!file) {
          selectedFile = null;
          pill.innerHTML = '';
          confirm.disabled = true;
          return;
        }
        const allowed = /\.(pdf|jpe?g|png)$/i.test(file.name);
        if (!allowed) {
          selectedFile = null;
          pill.innerHTML = '';
          confirm.disabled = true;
          error.hidden = false;
          error.textContent = 'Solo se permiten archivos PDF, JPG o PNG.';
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          selectedFile = null;
          pill.innerHTML = '';
          confirm.disabled = true;
          error.hidden = false;
          error.textContent = 'El archivo excede el límite de 5 MB.';
          return;
        }
        selectedFile = file;
        confirm.disabled = false;
        pill.innerHTML = `
          <div class="file-pill">
            ${icon(fileTypeIcon(file.name, file.type), 17)}
            <strong>${escapeHtml(file.name)}</strong>
            <span class="small muted">${escapeHtml(formatBytes(file.size))}</span>
            <button type="button" id="remove-upload" aria-label="Quitar archivo">${icon('x', 15)}</button>
          </div>
        `;
        pill.querySelector('#remove-upload')?.addEventListener('click', () => {
          input.value = '';
          showFile(null);
        });
      };

      input.addEventListener('change', () => showFile(input.files?.[0] || null));
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
        input.files = transfer.files;
        showFile(file);
      });

      node.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      confirm.addEventListener('click', () => {
        if (!selectedFile) {
          error.hidden = false;
          error.textContent = 'Seleccione un archivo para cargar.';
          return;
        }
        finish({
          file: selectedFile,
          tipoDocumentoId: node.querySelector('#upload-type').value,
        });
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

const workflowStep = (number, label, { done = false, current = false } = {}) => `
  <div class="workflow-step${done ? ' done' : ''}${current ? ' current' : ''}">
    <span class="workflow-dot">${done ? icon('check', 12) : number}</span>
    <span>${escapeHtml(label)}</span>
  </div>
`;

export async function render(container, ctx) {
  const id = Number(ctx.params?.[0]);
  if (!Number.isInteger(id) || id <= 0) {
    container.innerHTML = `${pageHeader({ title: 'Justificante inválido' })}${errorBox({ message: 'El identificador del justificante no es válido.' })}`;
    return;
  }

  const data = await api.get(`/justificantes/${id}`);
  if (!ctx.isCurrent()) return;
  const j = data.justificante;
  ctx.setPageTitle(`Justificante ${j.folio}`);

  const user = ctx.user;
  const isOwner = hasRole('alumno') && Number(user.idStudent) === Number(j.studentId);
  const isAdmin = hasRole('admin');
  const isTutor = hasRole('tutor');
  const isDirector = hasRole('directora');
  const isFinal = FINAL_STATUSES.includes(j.status);
  const editable = j.status === 'pendiente' && (isOwner || isAdmin);
  const canCancel = j.status === 'pendiente' && (isOwner || isAdmin);
  const canReview = isTutor && !isFinal;
  const canSignTutor = isTutor && j.status === 'en_revision' && !j.hasTutorSignature;
  const canSignDirector = isDirector && j.status === 'en_revision' && !j.hasDirectorSignature;
  const canApprove = isDirector && j.status === 'en_revision';
  const canReject = isDirector && ['pendiente', 'en_revision'].includes(j.status);
  const canValidateDocs = (isTutor || isDirector) && !isFinal;
  const canUploadDoc = !isFinal && (isAdmin || isTutor || isDirector || (isOwner && j.status === 'pendiente'));
  const canDeleteDoc = !isFinal && (isAdmin || (isOwner && j.status === 'pendiente'));
  const hasValidatedDocument = j.documents.some((document) => document.validationStatus === 'validado');

  const signatureFor = (type) => j.signatures.find(
    (signature) => signature.signerType === type && signature.status === 'firmado'
  );

  const signatureSlots = [
    { type: 'padre_madre_tutor', label: 'Padre / madre / tutor', note: 'Firma opcional' },
    { type: 'tutor_educativo', label: 'Tutor educativo', note: 'Requerida para la aprobación' },
    { type: 'director_carrera', label: 'Dirección de carrera', note: 'Requerida para la aprobación' },
  ];

  const signatureCards = signatureSlots.map((slot) => {
    const signature = signatureFor(slot.type);
    return `
      <article class="signature-card ${signature ? 'signed' : 'pending'}">
        <span class="sig-label">${escapeHtml(slot.label)}</span>
        ${signature ? `
          <span class="sig-ok">${icon('check-circle', 15)} ${escapeHtml(toTitleCase(signature.status))}</span>
          <strong class="sig-name">${escapeHtml(signature.signerName || 'Firma registrada')}</strong>
          <span class="sig-meta">${escapeHtml(formatDateTime(signature.signedAt))}</span>
        ` : `
          <span class="sig-ok">${icon('clock', 15)} Pendiente</span>
          <strong class="sig-name">${escapeHtml(slot.note)}</strong>
          <span class="sig-meta">Sin registro de firma</span>
        `}
      </article>
    `;
  }).join('');

  const documents = j.documents.length > 0
    ? `
      <div class="doc-list">
        ${j.documents.map((document) => `
          <div class="doc-item">
            <span class="doc-icon">${icon(fileTypeIcon(document.originalName, document.mimeType), 19)}</span>
            <div class="doc-main">
              <strong>${escapeHtml(document.originalName)}</strong>
              <span>${escapeHtml(document.typeName)} · ${escapeHtml(formatBytes(document.fileSize))} · ${escapeHtml(formatDateTime(document.uploadedAt))}</span>
              <span>Cargado por ${escapeHtml(document.uploadedByName || 'Usuario')}</span>
              <span class="cluster" style="gap:6px;margin-top:4px">
                ${docStatusBadge(document.validationStatus)}
                ${document.validatedByName ? `<span class="small muted">Revisado por ${escapeHtml(document.validatedByName)}</span>` : ''}
              </span>
              ${document.notes ? `<span class="small muted" style="margin-top:4px">${escapeHtml(document.notes)}</span>` : ''}
            </div>
            <div class="doc-actions">
              <a class="btn btn-secondary btn-sm" href="${escapeAttr(document.downloadUrl)}" target="_blank" rel="noopener">
                ${icon('eye', 15)} Ver
              </a>
              ${canValidateDocs ? `
                <button type="button" class="btn btn-ghost btn-sm" data-validate-doc="${Number(document.id)}"
                  data-doc-name="${escapeAttr(document.originalName)}">
                  ${icon('user-check', 15)} Validar
                </button>
              ` : ''}
              ${canDeleteDoc ? `
                <button type="button" class="btn btn-ghost btn-sm" data-delete-doc="${Number(document.id)}"
                  data-doc-name="${escapeAttr(document.originalName)}" aria-label="Eliminar ${escapeAttr(document.originalName)}">
                  ${icon('trash', 15)}
                </button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `
    : `
      <div class="requirement ${j.isCritical ? 'missing' : ''}">
        ${icon(j.isCritical ? 'alert-triangle' : 'info', 16)}
        <span>${j.isCritical
          ? 'Este expediente está marcado como caso crítico y no tiene comprobantes adjuntos.'
          : 'No se han adjuntado comprobantes a este expediente.'}</span>
      </div>
    `;

  const subjectRows = j.subjects.length > 0
    ? j.subjects.map((subject) => `
      <tr>
        <td class="nowrap">${escapeHtml(formatDateShort(subject.date))}</td>
        <td>
          <span class="cell-main">${escapeHtml(subject.name)}</span>
          <span class="cell-sub">${escapeHtml(subject.code || '')}</span>
        </td>
        <td>${escapeHtml(subject.teacherName || 'Sin docente asignado')}</td>
        <td class="hide-sm">${escapeHtml(subject.observations || '—')}</td>
      </tr>
    `).join('')
    : `
      <tr>
        <td colspan="4" class="muted">No se registraron materias afectadas.</td>
      </tr>
    `;

  const dateChips = j.absences.length > 0
    ? j.absences.map((absence) => `
      <span class="sheet-date">${escapeHtml(formatDateShort(absence.date))}</span>
    `).join('')
    : '<span class="muted small">Sin fechas registradas</span>';

  const history = j.history.length > 0
    ? `
      <div class="timeline">
        ${j.history.map((entry) => `
          <div class="timeline-item">
            <span class="t-title">${escapeHtml(entry.statusFromName ? `${entry.statusFromName} → ${entry.statusToName}` : entry.statusToName)}</span>
            <span class="t-meta">${escapeHtml(formatDateTime(entry.changedAt))} · ${escapeHtml(entry.changedByName || 'Sistema')}</span>
            ${entry.comment ? `<p class="t-comment">${escapeHtml(entry.comment)}</p>` : ''}
          </div>
        `).join('')}
      </div>
    `
    : '<p class="muted small">Sin movimientos registrados.</p>';

  const actionButtons = [];
  if (canReview && j.status === 'pendiente') {
    actionButtons.push(`<button type="button" class="btn btn-primary btn-block" data-action="review">${icon('clipboard-check', 16)} Iniciar revisión</button>`);
  }
  if (canSignTutor) {
    actionButtons.push(`<button type="button" class="btn btn-success-soft btn-block" data-action="sign-tutor">${icon('pen-tool', 16)} Registrar firma de tutoría</button>`);
  }
  if (canSignDirector) {
    actionButtons.push(`<button type="button" class="btn btn-success-soft btn-block" data-action="sign-director">${icon('pen-tool', 16)} Registrar firma de dirección</button>`);
  }
  if (canApprove) {
    actionButtons.push(`<button type="button" class="btn btn-primary btn-block" data-action="approve">${icon('stamp', 16)} Aprobar, firmar y sellar</button>`);
  }
  if (canReject) {
    actionButtons.push(`<button type="button" class="btn btn-danger-soft btn-block" data-action="reject">${icon('ban', 16)} Rechazar con comentario</button>`);
  }
  if (canCancel) {
    actionButtons.push(`<button type="button" class="btn btn-ghost btn-block" data-action="cancel">${icon('x', 16)} Cancelar justificante</button>`);
  }
  if (isAdmin && !isFinal) {
    actionButtons.push(`<button type="button" class="btn btn-ghost btn-block" data-action="expire">${icon('clock', 16)} Marcar como vencido</button>`);
  }

  let actionHint = '';
  if (isFinal) {
    actionHint = j.status === 'rechazado'
      ? `Expediente rechazado. Comentario: ${j.rejectionComment || 'Sin comentario registrado.'}`
      : 'El expediente está resuelto y ya no admite modificaciones.';
  } else if (canApprove && !j.hasTutorSignature) {
    actionHint = 'La dirección no puede aprobar hasta que el tutor educativo registre su firma.';
  } else if (canApprove && j.isCritical && !hasValidatedDocument) {
    actionHint = 'Caso crítico: se requiere al menos un comprobante validado antes de aprobar.';
  } else if (actionButtons.length === 0) {
    actionHint = 'No hay acciones disponibles para su perfil en este estado del expediente.';
  }

  const resolutionInfo = j.status === 'aprobado'
    ? `Aprobado el ${escapeHtml(formatDateTime(j.resolvedAt))}`
    : j.status === 'rechazado'
      ? `Rechazado el ${escapeHtml(formatDateTime(j.resolvedAt))}`
      : 'En proceso';

  const workflowDone = {
    registro: true,
    revision: j.status !== 'pendiente' || j.hasTutorSignature,
    firma: Boolean(j.hasTutorSignature),
    aprobacion: j.status === 'aprobado',
  };
  const workflowCurrent = {
    revision: j.status === 'pendiente',
    firma: j.status === 'en_revision' && !j.hasTutorSignature,
    aprobacion: j.status === 'en_revision',
  };

  container.innerHTML = `
    ${pageHeader({
      eyebrow: 'Expediente académico',
      title: `Justificante ${j.folio}`,
      description: `${j.studentName} · ${j.careerName} · ${j.groupName}`,
      actions: `
        <a class="btn btn-secondary" href="#/justificantes">${icon('arrow-left', 16)} Volver</a>
        <a class="btn btn-secondary" href="/imprimir.html?id=${Number(j.id)}" target="_blank" rel="noopener">
          ${icon('printer', 16)} Imprimir
        </a>
        ${editable ? `<a class="btn btn-primary" href="#/justificantes/${Number(j.id)}/editar">${icon('edit', 16)} Editar</a>` : ''}
      `,
    })}

    <div class="detail-grid">
      <div class="detail-main">
        <section class="card">
          <div class="card-body">
            <div class="detail-head">
              <div class="detail-title">
                <span class="detail-sub">Estudiante</span>
                <h2 style="font-size:21px;color:var(--green-900)">${escapeHtml(j.studentName)}</h2>
                <span class="detail-sub">Matrícula ${escapeHtml(j.enrollment)} · ${escapeHtml(j.careerCode || j.careerName)} · Grupo ${escapeHtml(j.groupName)}</span>
              </div>
              <div class="detail-badges">
                ${statusBadge(j.status, j.statusName, j.statusTone)}
                ${j.isCritical ? '<span class="badge badge-red badge-plain">Caso crítico</span>' : '<span class="badge badge-gray badge-plain">Ordinario</span>'}
                <span class="badge badge-gray badge-plain">${escapeHtml(pluralize(j.documents.length, 'comprobante', 'comprobantes'))}</span>
              </div>
            </div>

            <dl class="info-grid">
              ${infoItem('Folio', `<span class="mono strong">${escapeHtml(j.folio)}</span>`)}
              ${infoItem('Estado', statusBadge(j.status, j.statusName, j.statusTone))}
              ${infoItem('Motivo', escapeHtml(j.reasonType || 'Sin motivo'))}
              ${infoItem('Periodo justificado', escapeHtml(formatDateRange(j.startDate, j.endDate)))}
              ${infoItem('Fecha de emisión', escapeHtml(formatDate(j.issueDate)))}
              ${infoItem('Vigencia', `${Number(j.validityDays) || 0} días hábiles · ${escapeHtml(formatDate(j.expiresAt))}`)}
              ${infoItem('Carrera', escapeHtml(j.careerName || '—'), { full: true })}
              ${infoItem('Grupo y turno', `${escapeHtml(j.groupName || '—')} · ${escapeHtml(toTitleCase(j.shift || '—'))}`, { full: true })}
              ${infoItem('Resolución', escapeHtml(resolutionInfo))}
              ${infoItem('Última actualización', escapeHtml(formatDateTime(j.updatedAt)))}
            </dl>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Motivo y observaciones</h2>
          </div>
          <div class="card-body">
            <div class="section-block">
              <h3>${icon('file-text', 16)} Motivo declarado</h3>
              <p class="prose">${escapeHtml(j.reason)}</p>
            </div>
            <div class="section-block">
              <h3>${icon('list', 16)} Observaciones</h3>
              <p class="prose observations">${escapeHtml(j.observations || 'Sin observaciones adicionales.')}</p>
            </div>
            <div class="section-block">
              <h3>${icon('calendar', 16)} Fechas de inasistencia</h3>
              <div class="sheet-dates">${dateChips}</div>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Materias afectadas</h2>
            <span class="badge badge-gray badge-plain">${escapeHtml(pluralize(j.subjects.length, 'registro', 'registros'))}</span>
          </div>
          <div class="table-scroll">
            <table class="data-table subject-table">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Materia</th>
                  <th scope="col">Docente</th>
                  <th scope="col" class="hide-sm">Observaciones</th>
                </tr>
              </thead>
              <tbody>${subjectRows}</tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <div>
              <h2>Comprobantes</h2>
              <p class="small muted" style="margin-top:3px">Documentos privados; solo el alumnado, la tutoría y la dirección pueden consultarlos.</p>
            </div>
            ${canUploadDoc ? `<button type="button" class="btn btn-secondary btn-sm" data-action="upload">${icon('upload', 15)} Adjuntar</button>` : ''}
          </div>
          <div class="card-body">
            ${documents}
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Firmas</h2>
            <span class="badge badge-gray badge-plain">${escapeHtml(pluralize(j.signatures.filter((signature) => signature.status === 'firmado').length, 'firma', 'firmas'))}</span>
          </div>
          <div class="card-body">
            <div class="signature-grid">${signatureCards}</div>
            ${j.stamp ? `
              <div class="stamp-card mt-2">
                <span class="stamp-emblem">${icon('stamp', 24)}</span>
                <div>
                  <strong>Sello institucional aplicado</strong>
                  <span class="small muted">${escapeHtml(j.stamp.institutionName || j.institutionName)} · ${escapeHtml(formatDateTime(j.stamp.appliedAt))}</span>
                  <span class="small muted mono">SHA-256 ${escapeHtml(String(j.stamp.sha256 || '').slice(0, 24))}…</span>
                </div>
              </div>
            ` : '<p class="small muted mt-2">El sello institucional se aplica automáticamente al aprobar el justificante.</p>'}
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Historial del expediente</h2>
          </div>
          <div class="card-body">${history}</div>
        </section>
      </div>

      <aside class="detail-side">
        <section class="card">
          <div class="card-header">
            <h2>Flujo del trámite</h2>
          </div>
          <div class="card-body">
            <div class="workflow">
              ${workflowStep(1, 'Registro', { done: workflowDone.registro })}
              ${workflowStep(2, 'Revisión', { done: workflowDone.revision, current: workflowCurrent.revision })}
              ${workflowStep(3, 'Firma tutoría', { done: workflowDone.firma, current: workflowCurrent.firma })}
              ${workflowStep(4, 'Aprobación', { done: workflowDone.aprobacion, current: workflowCurrent.aprobacion })}
            </div>
            ${j.status === 'rechazado' ? `
              <div class="alert alert-error mt-2">
                ${icon('ban', 17)}
                <div><strong>Expediente rechazado</strong><br>${escapeHtml(j.rejectionComment || 'Sin comentario registrado.')}</div>
              </div>
            ` : ''}
            ${j.status === 'vencido' ? `
              <div class="alert alert-warning mt-2">
                ${icon('clock', 17)}
                <div>El justificante superó su vigencia sin resolución.</div>
              </div>
            ` : ''}
            ${j.status === 'cancelado' ? `
              <div class="alert alert-warning mt-2">
                ${icon('x', 17)}
                <div>El justificante fue cancelado por su propietario o la administración.</div>
              </div>
            ` : ''}
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Acciones disponibles</h2>
          </div>
          <div class="card-body">
            <div class="action-panel">
              ${actionButtons.length > 0 ? actionButtons.join('') : ''}
            </div>
            ${actionHint ? `<p class="action-hint">${escapeHtml(actionHint)}</p>` : ''}
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Validez institucional</h2>
          </div>
          <div class="card-body">
            <dl class="summary-list">
              <div><dt>Emitido</dt><dd>${escapeHtml(formatDate(j.issueDate))}</dd></div>
              <div><dt>Vence</dt><dd>${escapeHtml(formatDate(j.expiresAt))}</dd></div>
              <div><dt>Días hábiles</dt><dd>${Number(j.validityDays) || 0}</dd></div>
              <div><dt>Versión</dt><dd>${Number(j.version) || 1}</dd></div>
              <div><dt>Institución</dt><dd>${escapeHtml(j.institutionAcronym || 'UTXJ')}</dd></div>
            </dl>
            <div class="requirement mt-2">
              ${icon('shield', 16)}
              <span>La aprobación requiere firma del tutor y de la dirección. El sello se genera en el servidor y queda vinculado al folio.</span>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Privacidad</h2>
          </div>
          <div class="card-body">
            <p class="small muted" style="line-height:1.65">
              Los comprobantes médicos y personales son información sensible. El acceso se limita al alumnado propietario,
              su tutoría, la dirección de carrera y la administración del sistema. Cada consulta y cambio queda registrado
              en la bitácora de auditoría.
            </p>
          </div>
        </section>
      </aside>
    </div>
  `;

  const runAction = async (button, action, successMessage) => {
    setBusy(button, true);
    try {
      const response = await action();
      toast(response?.mensaje || successMessage, { type: 'success' });
      ctx.reload();
    } catch (error) {
      setBusy(button, false);
      toast(error.message || 'No se pudo completar la operación.', {
        type: 'error',
        title: 'Operación rechazada',
        duration: 7000,
      });
    }
  };

  container.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      const action = actionButton.dataset.action;

      if (action === 'review') {
        const confirmed = await confirmAction({
          title: 'Iniciar revisión',
          message: 'El expediente pasará a estado En revisión para que la tutoría valide comprobantes y registre su firma.',
          confirmText: 'Iniciar revisión',
        });
        if (!confirmed) return;
        await runAction(actionButton, () => api.post(`/justificantes/${id}/revision`), 'Revisión iniciada.');
        return;
      }

      if (action === 'sign-tutor') {
        const confirmed = await confirmAction({
          title: 'Registrar firma de tutoría',
          message: 'Se generará la firma electrónica del tutor educativo y el expediente quedará listo para la dirección.',
          confirmText: 'Firmar',
        });
        if (!confirmed) return;
        await runAction(actionButton, () => api.post(`/justificantes/${id}/firmar-tutor`), 'Firma registrada.');
        return;
      }

      if (action === 'sign-director') {
        const confirmed = await confirmAction({
          title: 'Registrar firma de dirección',
          message: 'Se generará la firma electrónica de la dirección de carrera y el expediente podrá aprobarse.',
          confirmText: 'Firmar',
        });
        if (!confirmed) return;
        await runAction(actionButton, () => api.post(`/justificantes/${id}/firmar-direccion`), 'Firma registrada.');
        return;
      }

      if (action === 'approve') {
        const comment = await commentModal({
          title: 'Aprobar justificante',
          message: 'Se aplicará la firma de dirección y el sello institucional. El expediente será inmutable una vez aprobado.',
          confirmText: 'Aprobar y sellar',
          placeholder: 'Comentario de aprobación (opcional).',
        });
        if (comment === null) return;
        await runAction(actionButton, () => api.post(`/justificantes/${id}/aprobar`, { comentario: comment || undefined }), 'Justificante aprobado.');
        return;
      }

      if (action === 'reject') {
        const comment = await commentModal({
          title: 'Rechazar justificante',
          message: 'El rechazo es definitivo y requiere un comentario que explique el motivo al alumnado.',
          confirmText: 'Rechazar',
          tone: 'danger',
          required: true,
          label: 'Motivo del rechazo',
          placeholder: 'Explique con claridad por qué se rechaza el justificante.',
        });
        if (comment === null) return;
        await runAction(actionButton, () => api.post(`/justificantes/${id}/rechazar`, { comentario: comment }), 'Justificante rechazado.');
        return;
      }

      if (action === 'cancel') {
        const comment = await commentModal({
          title: 'Cancelar justificante',
          message: 'El expediente quedará cancelado y ya no podrá editarse. Esta acción no se puede deshacer.',
          confirmText: 'Cancelar justificante',
          tone: 'danger',
          required: false,
          label: 'Motivo de la cancelación',
          placeholder: 'Comentario opcional.',
        });
        if (comment === null) return;
        await runAction(actionButton, () => api.post(`/justificantes/${id}/cancelar`, { comentario: comment || undefined }), 'Justificante cancelado.');
        return;
      }

      if (action === 'expire') {
        const confirmed = await confirmAction({
          title: 'Marcar como vencido',
          message: 'El expediente se marcará como vencido por superar su vigencia. Solo proceda si corresponde.',
          confirmText: 'Marcar vencido',
          tone: 'danger',
        });
        if (!confirmed) return;
        await runAction(actionButton, () => api.post(`/justificantes/${id}/vencer`), 'Justificante marcado como vencido.');
        return;
      }

      if (action === 'upload') {
        setBusy(actionButton, true, 'Preparando…');
        let payload;
        try {
          const catalog = await api.get('/catalogos/tipos-documento');
          setBusy(actionButton, false);
          payload = await uploadDocumentModal(catalog.tiposDocumento || []);
        } catch (error) {
          setBusy(actionButton, false);
          toast(error.message || 'No se pudieron cargar los tipos de documento.', { type: 'error' });
          return;
        }
        if (!payload) return;

        const formData = new FormData();
        formData.append('archivo', payload.file);
        formData.append('tipo_documento_id', payload.tipoDocumentoId);
        setBusy(actionButton, true, 'Cargando…');
        try {
          const response = await api.upload(`/justificantes/${id}/documentos`, formData);
          toast(response?.mensaje || 'Comprobante cargado correctamente.', { type: 'success' });
          ctx.reload();
        } catch (error) {
          setBusy(actionButton, false);
          toast(error.message || 'No se pudo cargar el comprobante.', { type: 'error', title: 'Carga rechazada', duration: 7000 });
        }
      }
    }

    const validateButton = event.target.closest('[data-validate-doc]');
    if (validateButton) {
      const documentId = Number(validateButton.dataset.validateDoc);
      const payload = await documentValidationModal({
        title: 'Validar comprobante',
        documentName: validateButton.dataset.docName || '',
      });
      if (!payload) return;
      await runAction(
        validateButton,
        () => api.post(`/justificantes/${id}/documentos/${documentId}/validar`, payload),
        'Validación registrada.'
      );
    }

    const deleteButton = event.target.closest('[data-delete-doc]');
    if (deleteButton) {
      const documentId = Number(deleteButton.dataset.deleteDoc);
      const confirmed = await confirmAction({
        title: 'Eliminar comprobante',
        message: `Se eliminará el archivo «${deleteButton.dataset.docName || 'comprobante'}» de forma permanente.`,
        confirmText: 'Eliminar archivo',
        tone: 'danger',
      });
      if (!confirmed) return;
      await runAction(
        deleteButton,
        () => api.delete(`/justificantes/${id}/documentos/${documentId}`),
        'Comprobante eliminado.'
      );
    }
  });
}

export { loadingView, signedBadge };
