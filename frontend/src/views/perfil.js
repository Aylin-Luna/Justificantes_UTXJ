/**
 * Perfil del usuario autenticado: datos institucionales, roles y cambio de
 * contraseña. La contraseña se valida en el cliente y en el servidor.
 */

import api from '../api.js';
import {
  refreshSession,
  roleLabels,
  primaryRole,
} from '../auth.js';
import {
  escapeHtml,
  icon,
  pageHeader,
  errorBox,
  toast,
  setBusy,
  initials,
  formatDateTime,
  formatDate,
  roleName,
  toTitleCase,
} from '../ui.js';

const roleTone = (code) => {
  if (code === 'admin') return 'gold';
  if (code === 'directora') return 'blue';
  if (code === 'tutor') return 'green';
  return 'gray';
};

const dataItem = (label, value, { mono = false } = {}) => `
  <div class="readonly-item">
    <span>${escapeHtml(label)}</span>
    <strong class="${mono ? 'mono' : ''}">${escapeHtml(value === null || value === undefined || value === '' ? '—' : value)}</strong>
  </div>
`;

const studentCard = (student, institution) => {
  if (!student) return '';
  const name = [student.first_name, student.last_name, student.second_last_name].filter(Boolean).join(' ');
  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Datos académicos</h2>
          <p class="small muted" style="margin-top:3px">Información registrada por Control Escolar.</p>
        </div>
        <span class="badge badge-${student.status === 'activo' ? 'green' : 'gray'} badge-plain">${escapeHtml(toTitleCase(student.status || 'Sin estado'))}</span>
      </div>
      <div class="card-body">
        <div class="readonly-grid">
          ${dataItem('Nombre completo', name)}
          ${dataItem('Matrícula', student.enrollment, { mono: true })}
          ${dataItem('Carrera', student.career_name)}
          ${dataItem('Código de carrera', student.career_code, { mono: true })}
          ${dataItem('Grupo', student.group_name)}
          ${dataItem('Grado y turno', [student.grade ? `${student.grade}.º` : '', toTitleCase(student.shift || '')].filter(Boolean).join(' · '))}
          ${dataItem('Periodo escolar', student.school_period)}
          ${dataItem('Correo registrado', student.email)}
          ${dataItem('Teléfono', student.phone)}
          ${dataItem('Institución', institution?.acronym || institution?.name)}
        </div>
      </div>
    </section>
  `;
};

const teacherCard = (teacher) => {
  if (!teacher) return '';
  const name = [teacher.professional_title, teacher.first_name, teacher.last_name, teacher.second_last_name]
    .filter(Boolean)
    .join(' ');
  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Datos docentes</h2>
          <p class="small muted" style="margin-top:3px">Información del expediente docente.</p>
        </div>
      </div>
      <div class="card-body">
        <div class="readonly-grid">
          ${dataItem('Nombre completo', name)}
          ${dataItem('Número de empleado', teacher.employee_number, { mono: true })}
          ${dataItem('Departamento', teacher.department)}
          ${dataItem('Correo institucional', teacher.email)}
        </div>
      </div>
    </section>
  `;
};

const staffCard = (staff, careers) => {
  if (!staff || staff.length === 0) return '';
  const careerName = (idCareer) => {
    if (!idCareer) return 'Ámbito institucional';
    const career = careers.find((item) => Number(item.id) === Number(idCareer));
    return career ? career.name : `Carrera ${idCareer}`;
  };
  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Adscripción institucional</h2>
          <p class="small muted" style="margin-top:3px">Cargos y ámbito de gestión asignados.</p>
        </div>
      </div>
      <div class="card-body">
        <div class="readonly-grid">
          ${staff.map((item) => `
            ${dataItem('Cargo', item.position)}
            ${dataItem('Ámbito', careerName(item.id_career))}
          `).join('')}
        </div>
      </div>
    </section>
  `;
};

export async function render(container, ctx) {
  const [user, catalogos] = await Promise.all([
    refreshSession(),
    api.get('/catalogos').catch(() => null),
  ]);
  if (!ctx.isCurrent()) return;

  if (!user) {
    container.innerHTML = errorBox({ message: 'No se pudo recuperar la sesión actual.' });
    return;
  }

  const settings = catalogos?.ajustes || {};
  const minLength = Math.max(8, Number(settings.password_min_length) || 8);
  const institution = catalogos?.institucion || null;
  const careers = catalogos?.carreras || [];
  const fullName = user.student
    ? [user.student.first_name, user.student.last_name, user.student.second_last_name].filter(Boolean).join(' ')
    : user.fullName;

  const roles = (user.roles || []).map((role) => `
    <span class="badge badge-${roleTone(role)} badge-plain">${escapeHtml(roleName(role))}</span>
  `).join('');

  container.innerHTML = `
    ${pageHeader({
      eyebrow: 'Cuenta institucional',
      title: 'Mi perfil',
      description: 'Consulte sus datos de adscripción, revise sus roles de acceso y actualice su contraseña.',
    })}

    <div class="detail-grid">
      <div class="detail-main">
        <section class="card">
          <div class="card-body">
            <div class="profile-head">
              <span class="avatar xl ${primaryRole(user) === 'admin' ? 'gold' : ''}" aria-hidden="true">${escapeHtml(initials(fullName))}</span>
              <div class="profile-identity">
                <span class="page-eyebrow">${escapeHtml(roleLabels(user))}</span>
                <h2>${escapeHtml(fullName || user.username)}</h2>
                <p class="muted small">@${escapeHtml(user.username)} · ${escapeHtml(user.email || 'Sin correo registrado')}</p>
                <div class="cluster mt-1" style="gap:5px;flex-wrap:wrap">${roles || '<span class="badge badge-gray badge-plain">Sin rol</span>'}</div>
              </div>
              <div class="profile-meta">
                <span class="small muted">Último acceso</span>
                <strong>${escapeHtml(user.lastLogin ? formatDateTime(user.lastLogin) : 'Sin registro')}</strong>
                <span class="small muted">Cuenta creada</span>
                <strong>${escapeHtml(formatDate(user.createdAt))}</strong>
              </div>
            </div>
          </div>
        </section>

        ${studentCard(user.student, institution)}
        ${teacherCard(user.teacher)}
        ${staffCard(user.staff, careers)}

        <section class="card">
          <div class="card-header">
            <div>
              <h2>Privacidad y seguridad de la cuenta</h2>
              <p class="small muted" style="margin-top:3px">Buenas prácticas aplicadas por el sistema.</p>
            </div>
            <span class="badge badge-green badge-plain">${icon('lock', 13)} Protegida</span>
          </div>
          <div class="card-body">
            <div class="stack" style="gap:10px">
              <div class="requirement met">
                ${icon('shield', 16)}
                <span>La contraseña se almacena con hash bcrypt; el sistema nunca guarda texto plano ni MD5.</span>
              </div>
              <div class="requirement met">
                ${icon('lock', 16)}
                <span>La sesión usa una cookie httpOnly con SameSite estricto y token CSRF en cada operación.</span>
              </div>
              <div class="requirement">
                ${icon('activity', 16)}
                <span>Las consultas y cambios relevantes quedan registrados en la bitácora de auditoría.</span>
              </div>
              <div class="requirement">
                ${icon('mail', 16)}
                <span>Si detecta accesos no reconocidos, cambie su contraseña y notifique a Control Escolar.</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside class="detail-side">
        <section class="card">
          <div class="card-header">
            <div>
              <h2>Cambiar contraseña</h2>
              <p class="small muted" style="margin-top:3px">Mínimo ${minLength} caracteres, con letras y números.</p>
            </div>
          </div>
          <div class="card-body">
            <form id="password-form" novalidate>
              <div id="password-form-error"></div>

              <div class="field">
                <label for="current-password">Contraseña actual <span class="req">*</span></label>
                <div class="input-group">
                  <input class="input" type="password" id="current-password" autocomplete="current-password" required
                    placeholder="Su contraseña actual">
                  <button type="button" class="btn btn-ghost" data-toggle="current-password" aria-label="Mostrar contraseña actual">${icon('eye', 16)}</button>
                </div>
              </div>

              <div class="field mt-2">
                <label for="new-password">Nueva contraseña <span class="req">*</span></label>
                <div class="input-group">
                  <input class="input" type="password" id="new-password" autocomplete="new-password" required
                    minlength="${minLength}" placeholder="Mínimo ${minLength} caracteres">
                  <button type="button" class="btn btn-ghost" data-toggle="new-password" aria-label="Mostrar nueva contraseña">${icon('eye', 16)}</button>
                </div>
                <span class="field-hint">Debe incluir al menos una letra y un número.</span>
                <div class="password-meter" id="password-meter" hidden>
                  <span></span>
                  <small id="password-meter-label">Seguridad</small>
                </div>
              </div>

              <div class="field mt-2">
                <label for="confirm-password">Confirmar nueva contraseña <span class="req">*</span></label>
                <div class="input-group">
                  <input class="input" type="password" id="confirm-password" autocomplete="new-password" required
                    placeholder="Repita la nueva contraseña">
                  <button type="button" class="btn btn-ghost" data-toggle="confirm-password" aria-label="Mostrar confirmación">${icon('eye', 16)}</button>
                </div>
                <span class="field-error" id="password-error" hidden></span>
              </div>

              <button type="submit" class="btn btn-primary btn-block mt-2" id="password-submit">
                ${icon('key', 16)} Actualizar contraseña
              </button>
            </form>
          </div>
        </section>

        <section class="card">
          <div class="card-header"><h2>Accesos rápidos</h2></div>
          <div class="card-body">
            <div class="stack" style="gap:8px">
              <a class="quick-link" href="#/justificantes">${icon('files', 19)} <span>Mis justificantes</span></a>
              ${user.roles.includes('alumno') ? `<a class="quick-link" href="#/justificantes/nuevo">${icon('file-plus', 19)} <span>Nuevo justificante</span></a>` : ''}
              <a class="quick-link" href="#/inicio">${icon('home', 19)} <span>Ir al panel principal</span></a>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-header"><h2>Roles y permisos</h2></div>
          <div class="card-body">
            <dl class="summary-list">
              ${(user.roleDetails && user.roleDetails.length > 0
                ? user.roleDetails
                : (user.roles || []).map((code) => ({ code, name: roleName(code) }))
              ).map((role) => `
                <div>
                  <dt>${escapeHtml(role.name || roleName(role.code))}</dt>
                  <dd class="mono small">${escapeHtml(role.code)}</dd>
                </div>
              `).join('')}
            </dl>
            <div class="requirement mt-2">
              ${icon('info', 16)}
              <span>Los roles los asigna la administración del sistema. Si necesita un cambio de permisos, contacte a Control Escolar.</span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  `;

  const form = document.getElementById('password-form');
  const current = document.getElementById('current-password');
  const next = document.getElementById('new-password');
  const confirm = document.getElementById('confirm-password');
  const formError = document.getElementById('password-form-error');
  const fieldError = document.getElementById('password-error');
  const submit = document.getElementById('password-submit');
  const meter = document.getElementById('password-meter');
  const meterLabel = document.getElementById('password-meter-label');

  const fields = [current, next, confirm];

  document.querySelectorAll('[data-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.toggle);
      if (!input) return;
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      button.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
      button.innerHTML = icon(visible ? 'eye' : 'eye-off', 16);
    });
  });

  const strength = (value) => {
    let score = 0;
    if (value.length >= minLength) score += 1;
    if (value.length >= minLength + 4) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    if (score <= 2) return { level: 'low', label: 'Baja' };
    if (score <= 3) return { level: 'medium', label: 'Media' };
    if (score <= 4) return { level: 'good', label: 'Buena' };
    return { level: 'high', label: 'Alta' };
  };

  next.addEventListener('input', () => {
    const value = next.value;
    if (!value) {
      meter.hidden = true;
      return;
    }
    const result = strength(value);
    meter.hidden = false;
    meter.dataset.level = result.level;
    meterLabel.textContent = `Seguridad: ${result.label}`;
  });

  const clearErrors = () => {
    formError.innerHTML = '';
    fieldError.hidden = true;
    fieldError.textContent = '';
    fields.forEach((input) => input.removeAttribute('aria-invalid'));
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();

    const errors = [];
    if (!current.value) errors.push('Capture su contraseña actual.');
    if (!next.value) errors.push('Capture la nueva contraseña.');
    if (next.value && next.value.length < minLength) {
      errors.push(`La nueva contraseña debe tener al menos ${minLength} caracteres.`);
    }
    if (next.value && (!/[A-Za-z]/.test(next.value) || !/[0-9]/.test(next.value))) {
      errors.push('La nueva contraseña debe incluir letras y números.');
    }
    if (next.value && current.value && next.value === current.value) {
      errors.push('La nueva contraseña debe ser diferente a la actual.');
    }
    if (confirm.value !== next.value) {
      errors.push('La confirmación no coincide con la nueva contraseña.');
    }

    if (errors.length > 0) {
      formError.innerHTML = errorBox({ message: errors[0], details: errors.slice(1) });
      fieldError.hidden = false;
      fieldError.textContent = errors[0];
      if (!current.value) current.focus();
      else if (!next.value || next.value.length < minLength) next.focus();
      else confirm.focus();
      return;
    }

    setBusy(submit, true, 'Actualizando…');
    try {
      const response = await api.post('/auth/cambiar-password', {
        password_actual: current.value,
        password_nueva: next.value,
      });
      toast(response?.mensaje || 'Contraseña actualizada correctamente.', {
        type: 'success',
        title: 'Seguridad actualizada',
      });
      form.reset();
      meter.hidden = true;
      current.focus();
    } catch (error) {
      formError.innerHTML = errorBox(error);
      if (error?.status === 400) {
        fieldError.hidden = false;
        fieldError.textContent = error.message;
      }
    } finally {
      setBusy(submit, false);
    }
  });
}
