/**
 * Vista imprimible del justificante académico.
 *
 * Consume `GET /api/justificantes/:id/imprimir`, que devuelve el expediente
 * completo junto con las firmas y el sello en SVG. El documento solo se
 * considera oficial cuando el estado es `aprobado`; en cualquier otro caso se
 * muestra una marca de agua de vista previa.
 */

import api from './api.js';
import {
  escapeHtml,
  escapeAttr,
  icon,
  formatDate,
  formatDateShort,
  formatDateRange,
  formatDateTime,
  pluralize,
  toTitleCase,
} from './ui.js';

const root = document.getElementById('print-root');
const toolbarNote = document.getElementById('print-toolbar-note');
const printButton = document.getElementById('print-button');
const backLink = document.getElementById('back-link');

const params = new URLSearchParams(window.location.search);
const justificationId = Number(params.get('id'));

const SIGNER_FALLBACKS = {
  padre_madre_tutor: 'Padre, madre o tutor',
  tutor_educativo: 'Tutor educativo',
  director_carrera: 'Dirección de carrera',
};

const SIGNER_ORDER = ['padre_madre_tutor', 'tutor_educativo', 'director_carrera'];

/**
 * Convierte el SVG devuelto por el servidor en una URL de datos segura para
 * usarla en una etiqueta <img>. La política CSP permite `data:` en imágenes.
 */
function svgDataUrl(svg) {
  if (!svg || typeof svg !== 'string') return null;
  const text = svg.trim();
  if (!text) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
}

/** Normaliza la ruta del logotipo institucional al recurso servido por Express. */
function logoSrc(value) {
  const fallback = '/assets/img/logo-utxj.svg';
  if (!value) return fallback;
  const text = String(value).trim();
  if (!text) return fallback;
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith('/assets/')) return text;
  if (text.startsWith('assets/')) return `/${text}`;
  if (text.startsWith('/public/')) return `/assets/${text.slice('/public/'.length)}`;
  if (text.startsWith('public/')) return `/assets/${text.slice('public/'.length)}`;
  return `/${text.replace(/^\/+/, '')}`;
}

function errorView({ title, message, detail = '', action = '' }) {
  return `
    <div class="print-error">
      <div>
        <span class="print-error-icon" aria-hidden="true">${icon('alert-triangle', 30)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        ${detail ? `<p class="small muted">${escapeHtml(detail)}</p>` : ''}
        <div class="cluster" style="justify-content:center;gap:8px;margin-top:16px">
          ${action}
          <a class="btn btn-secondary" href="/app#/justificantes">Ir a mis justificantes</a>
        </div>
      </div>
    </div>
  `;
}

function signatureCard(meta, signatures) {
  const signature = signatures.find((item) => item.signerType === meta);
  const signed = Boolean(signature && signature.status === 'firmado');
  const image = signed ? svgDataUrl(signature.svg) : null;
  const name = signature?.signerName || SIGNER_FALLBACKS[meta] || 'Responsable';
  const roleLabel = signature?.signerTypeLabel || SIGNER_FALLBACKS[meta] || 'Firma';
  const dateLabel = signed && signature?.signedAt
    ? `Firmado el ${formatDateShort(signature.signedAt)}`
    : 'Pendiente de firma';

  return `
    <div class="sheet-sign">
      <div class="sign-img">
        ${image
          ? `<img src="${escapeAttr(image)}" alt="Firma de ${escapeAttr(name)}">`
          : `<span class="sign-pending">${escapeHtml(signed ? 'Firma registrada' : 'Sin firma')}</span>`}
      </div>
      <div class="sign-line">
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(roleLabel)}</span>
        <span>${escapeHtml(dateLabel)}</span>
      </div>
    </div>
  `;
}

function stampCard(stamp, acronym) {
  const image = svgDataUrl(stamp.svg);
  if (!image) return '';
  return `
    <div class="sheet-sign sheet-stamp-card">
      <div class="sign-img">
        <img src="${escapeAttr(image)}" alt="Sello institucional de ${escapeAttr(acronym)}">
      </div>
      <div class="sign-line">
        <strong>Sello institucional</strong>
        <span>${escapeHtml(acronym || 'UTXJ')}</span>
        <span>${escapeHtml(stamp.appliedAt ? `Aplicado el ${formatDateShort(stamp.appliedAt)}` : 'Sello digital')}</span>
      </div>
    </div>
  `;
}

function render(j) {
  const approved = j.status === 'aprobado';
  const signatures = Array.isArray(j.signatures) ? j.signatures : [];
  const absences = Array.isArray(j.absences) ? j.absences : [];
  const subjects = Array.isArray(j.subjects) ? j.subjects : [];
  const documents = Array.isArray(j.documents) ? j.documents : [];
  const stampImage = approved && j.stamp ? svgDataUrl(j.stamp.svg) : null;
  const studentName = j.studentName
    || [j.studentFirstName, j.studentLastName, j.studentSecondLastName].filter(Boolean).join(' ');
  const groupShift = [j.groupName, toTitleCase(j.shift || '')].filter(Boolean).join(' · ');
  const validity = `${Number(j.validityDays) || 0} días hábiles${j.expiresAt ? ` · vence el ${formatDate(j.expiresAt)}` : ''}`;
  const documentsSummary = documents.length
    ? `${pluralize(documents.length, 'comprobante', 'comprobantes')} · ${Number(j.validatedDocuments) || 0} ${Number(j.validatedDocuments) === 1 ? 'validado' : 'validados'}${documents.length > 0 ? ` (${[...new Set(documents.map((item) => item.typeName || 'Comprobante'))].join(', ')})` : ''}`
    : 'Sin comprobantes registrados';
  const verificationCode = j.stamp?.sha256
    ? j.stamp.sha256.slice(0, 16).toUpperCase()
    : signatures.find((item) => item.sha256)?.sha256?.slice(0, 16).toUpperCase() || '';

  return `
    <article class="sheet ${approved ? '' : 'watermarked'}" aria-labelledby="sheet-title">
      <header class="sheet-head">
        <div class="sheet-brand">
          <img src="${escapeAttr(logoSrc(j.institutionLogo))}" alt="${escapeAttr(j.institutionAcronym || 'UTXJ')}">
          <div class="sheet-brand-text">
            <strong>${escapeHtml(j.institutionAcronym || 'UTXJ')}</strong>
            <span>Control Escolar</span>
          </div>
        </div>
        <div class="sheet-institution">
          <strong>${escapeHtml(j.institutionName || 'Universidad Tecnológica de Xicotepec de Juárez')}</strong>
          ${j.institutionAddress ? `<span>${escapeHtml(j.institutionAddress)}</span>` : ''}
          <span>${escapeHtml([j.institutionCity, j.institutionState].filter(Boolean).join(', '))}</span>
          <span>${escapeHtml([j.institutionPhone, j.institutionEmail].filter(Boolean).join(' · '))}</span>
        </div>
      </header>

      <div class="sheet-title">
        <div>
          <h1 id="sheet-title">Justificante académico</h1>
          <p>Documento oficial de control escolar · ${escapeHtml(j.schoolPeriod || 'Periodo escolar')}</p>
        </div>
        <div class="folio-box">
          <span>Folio institucional</span>
          <strong>${escapeHtml(j.folio)}</strong>
        </div>
      </div>

      <div class="sheet-status">
        <span>Estado del documento: <strong>${escapeHtml(j.statusName || j.status)}</strong></span>
        <span>Emisión: <strong>${escapeHtml(formatDate(j.issueDate))}</strong></span>
        <span>Vigencia: <strong>${escapeHtml(validity)}</strong></span>
      </div>

      <section class="sheet-section" aria-label="Datos del estudiante">
        <h2 class="sheet-section-title">Datos del estudiante</h2>
        <table class="sheet-data">
          <tbody>
            <tr>
              <th scope="row">Estudiante</th>
              <td colspan="3" class="strong">${escapeHtml(studentName || '—')}</td>
            </tr>
            <tr>
              <th scope="row">Matrícula</th>
              <td class="strong">${escapeHtml(j.enrollment || '—')}</td>
              <th scope="row">Carrera</th>
              <td>${escapeHtml(j.careerName || '—')}</td>
            </tr>
            <tr>
              <th scope="row">Grupo y turno</th>
              <td>${escapeHtml(groupShift || '—')}</td>
              <th scope="row">Grado</th>
              <td>${escapeHtml(j.grade ? `${j.grade}.º` : '—')}</td>
            </tr>
            <tr>
              <th scope="row">Periodo escolar</th>
              <td>${escapeHtml(j.schoolPeriod || '—')}</td>
              <th scope="row">Correo</th>
              <td>${escapeHtml(j.email || '—')}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="sheet-section" aria-label="Datos del justificante">
        <h2 class="sheet-section-title">Datos del justificante</h2>
        <table class="sheet-data">
          <tbody>
            <tr>
              <th scope="row">Motivo</th>
              <td>${escapeHtml(j.reasonType || 'Sin motivo registrado')}</td>
              <th scope="row">Tipo de caso</th>
              <td>${j.isCritical ? 'Caso crítico' : 'Caso ordinario'}</td>
            </tr>
            <tr>
              <th scope="row">Periodo justificado</th>
              <td>${escapeHtml(formatDateRange(j.startDate, j.endDate))}</td>
              <th scope="row">Días registrados</th>
              <td>${escapeHtml(pluralize(absences.length, 'día', 'días'))}</td>
            </tr>
            <tr>
              <th scope="row">Fecha de emisión</th>
              <td>${escapeHtml(formatDate(j.issueDate))}</td>
              <th scope="row">Vigencia</th>
              <td>${escapeHtml(validity)}</td>
            </tr>
            <tr>
              <th scope="row">Comprobantes</th>
              <td colspan="3">${escapeHtml(documentsSummary)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="sheet-section" aria-label="Motivo declarado">
        <h2 class="sheet-section-title">Motivo y observaciones</h2>
        <div class="sheet-reason">${escapeHtml(j.reason || 'Sin descripción registrada.')}</div>
        ${j.observations ? `<div class="sheet-note"><strong>Observaciones:</strong> ${escapeHtml(j.observations)}</div>` : ''}
      </section>

      <section class="sheet-section" aria-label="Faltas y materias">
        <h2 class="sheet-section-title">Faltas registradas y materias afectadas</h2>
        ${absences.length === 0
          ? '<p class="sheet-empty">No se registraron fechas de inasistencia.</p>'
          : `<div class="sheet-dates">
              ${absences.map((absence) => `
                <span class="sheet-date" title="${escapeAttr(absence.notes || 'Inasistencia registrada')}">
                  ${escapeHtml(formatDateShort(absence.date))}
                </span>
              `).join('')}
            </div>`}
        ${subjects.length === 0
          ? '<p class="sheet-empty">No se registraron materias afectadas.</p>'
          : `
            <table class="sheet-subjects">
              <thead>
                <tr>
                  <th scope="col">Materia</th>
                  <th scope="col">Código</th>
                  <th scope="col">Docente</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                ${subjects.map((subject) => `
                  <tr>
                    <td>${escapeHtml(subject.name || '—')}</td>
                    <td>${escapeHtml(subject.code || '—')}</td>
                    <td>${escapeHtml(subject.teacherName || '—')}</td>
                    <td>${escapeHtml(formatDateShort(subject.date))}</td>
                    <td>${escapeHtml(subject.observations || '—')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
      </section>

      <section class="sheet-section" aria-label="Firmas">
        <h2 class="sheet-section-title">Firmas y responsabilidades</h2>
        <div class="sheet-signatures ${stampImage ? 'with-stamp' : ''}">
          ${SIGNER_ORDER.map((meta) => signatureCard(meta, signatures)).join('')}
          ${stampImage ? stampCard(j.stamp, j.institutionAcronym) : ''}
        </div>
        <p class="sheet-legal">
          Las firmas mostradas fueron generadas y resguardadas digitalmente por el Sistema de Gestión de
          Justificantes Académicos. La autenticidad del documento se verifica con el folio institucional y
          los registros electrónicos del expediente.
        </p>
      </section>

      <footer class="sheet-foot">
        <div class="verify">
          <strong>${escapeHtml(j.verificationText || `Documento verificable con el folio ${j.folio}`)}</strong><br>
          ${escapeHtml(j.issuedBy || 'Universidad Tecnológica de Xicotepec de Juárez')}<br>
          Documento generado el ${escapeHtml(formatDateTime(new Date()))}.
        </div>
        <div class="sheet-code">
          ${escapeHtml(j.folio)} · v${Number(j.version) || 1}<br>
          ${verificationCode ? `Código de verificación: ${escapeHtml(verificationCode)}<br>` : ''}
          ${approved ? 'Documento aprobado' : 'Vista previa sin validez oficial'}
        </div>
      </footer>
    </article>
  `;
}

async function load() {
  if (!Number.isInteger(justificationId) || justificationId <= 0) {
    root.innerHTML = errorView({
      title: 'Justificante no identificado',
      message: 'La dirección no incluye un identificador de justificante válido.',
      detail: 'Abra la vista imprimible desde el expediente del justificante.',
    });
    toolbarNote.textContent = 'No se pudo identificar el justificante.';
    return;
  }

  backLink.href = `/app#/justificantes/${justificationId}`;

  try {
    const data = await api.get(`/justificantes/${justificationId}/imprimir`);
    const justification = data.justificante;
    if (!justification) throw new Error('El servidor no devolvió el justificante.');

    root.innerHTML = render(justification);
    document.title = `Justificante ${justification.folio} · UTXJ`;

    if (justification.status === 'aprobado') {
      toolbarNote.innerHTML = `${icon('shield-check', 15)} Documento oficial aprobado. Puede imprimirlo o guardarlo como PDF.`;
    } else {
      toolbarNote.innerHTML = `${icon('info', 15)} Vista previa sin validez oficial. El documento podrá imprimirse como oficial una vez aprobado.`;
    }
    printButton.disabled = false;
  } catch (error) {
    if (error?.status === 401) {
      root.innerHTML = errorView({
        title: 'Sesión no iniciada',
        message: 'Necesita iniciar sesión para consultar este justificante.',
        detail: 'Inicie sesión y vuelva a abrir la vista imprimible desde el expediente.',
        action: '<a class="btn btn-primary" href="/">Iniciar sesión</a>',
      });
      toolbarNote.textContent = 'Sesión no iniciada.';
      return;
    }

    if (error?.status === 403) {
      root.innerHTML = errorView({
        title: 'Acceso restringido',
        message: 'Su cuenta no tiene permisos para consultar este justificante.',
        detail: 'Si considera que se trata de un error, contacte a Control Escolar.',
      });
      toolbarNote.textContent = 'Acceso restringido.';
      return;
    }

    if (error?.status === 404) {
      root.innerHTML = errorView({
        title: 'Justificante no encontrado',
        message: 'El justificante solicitado no existe o fue dado de baja.',
        detail: 'Verifique el enlace o consulte el expediente desde el sistema.',
      });
      toolbarNote.textContent = 'Justificante no encontrado.';
      return;
    }

    root.innerHTML = errorView({
      title: 'No se pudo cargar el documento',
      message: error?.message || 'Ocurrió un error inesperado al consultar el justificante.',
      detail: 'Revise su conexión e intente nuevamente.',
      action: '<button type="button" class="btn btn-primary" id="retry-print">Reintentar</button>',
    });
    toolbarNote.textContent = 'Error al cargar el documento.';
    document.getElementById('retry-print')?.addEventListener('click', load);
  }
}

printButton.addEventListener('click', () => {
  if (!printButton.disabled) window.print();
});

load();
