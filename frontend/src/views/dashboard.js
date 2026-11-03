/**
 * Panel de inicio. Adapta el contenido y las acciones al rol del usuario.
 */

import api from '../api.js';
import { hasRole, firstName, displayName, roleLabels } from '../auth.js';
import { justificantesTable, queueItem, statusChart } from '../components/justificantes.js';
import {
  escapeHtml,
  icon,
  pageHeader,
  statCard,
  toast,
  emptyState,
  formatDateLong,
} from '../ui.js';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

const heroFor = (user) => {
  if (hasRole('admin')) {
    return {
      kicker: 'Administración del sistema',
      title: `Hola, ${firstName(user)}`,
      text: 'Supervise la operación institucional, administre cuentas, revise la configuración y consulte la bitácora de auditoría.',
      actions: `
        <a class="btn btn-gold" href="#/usuarios">${icon('users', 17)} Administrar usuarios</a>
        <a class="btn btn-secondary" href="#/auditoria">${icon('shield', 17)} Ver auditoría</a>
      `,
      seal: 'shield',
    };
  }
  if (hasRole('directora')) {
    return {
      kicker: 'Dirección de carrera',
      title: `Hola, ${firstName(user)}`,
      text: 'Revise los justificantes en revisión, valide comprobantes y registre la aprobación con firma y sello institucional.',
      actions: `
        <a class="btn btn-gold" href="#/justificantes?estado=en_revision">${icon('award', 17)} Ver por aprobar</a>
        <a class="btn btn-secondary" href="#/justificantes">${icon('files', 17)} Todos los justificantes</a>
      `,
      seal: 'award',
    };
  }
  if (hasRole('tutor')) {
    return {
      kicker: 'Tutoría educativa',
      title: `Hola, ${firstName(user)}`,
      text: 'Atienda la bandeja de revisión, valide los comprobantes del alumnado y registre su firma para dar paso a la dirección.',
      actions: `
        <a class="btn btn-gold" href="#/justificantes?pendientes=1">${icon('clipboard-check', 17)} Revisar pendientes</a>
        <a class="btn btn-secondary" href="#/justificantes">${icon('files', 17)} Todos los justificantes</a>
      `,
      seal: 'clipboard-check',
    };
  }
  return {
    kicker: 'Portal del alumnado',
    title: `${greeting()}, ${firstName(user)}`,
    text: 'Registra tus justificantes de inasistencia, adjunta comprobantes y consulta el avance de tu trámite en tiempo real.',
    actions: `
      <a class="btn btn-gold" href="#/justificantes/nuevo">${icon('file-plus', 17)} Nuevo justificante</a>
      <a class="btn btn-secondary" href="#/justificantes">${icon('files', 17)} Mi historial</a>
    `,
    seal: 'graduation-cap',
  };
};

const quickActions = (user) => {
  const actions = [
    { href: '#/justificantes', icon: 'files', label: 'Consultar expedientes' },
    { href: '#/perfil', icon: 'user', label: 'Mi perfil y seguridad' },
  ];

  if (hasRole('alumno')) {
    actions.unshift({ href: '#/justificantes/nuevo', icon: 'file-plus', label: 'Registrar justificante' });
  }
  if (hasRole('tutor') || hasRole('directora')) {
    actions.unshift({ href: '#/justificantes?pendientes=1', icon: 'clipboard-check', label: 'Bandeja de revisión' });
  }
  if (hasRole('admin')) {
    actions.unshift({ href: '#/usuarios', icon: 'users', label: 'Gestionar usuarios' });
    actions.push({ href: '#/configuracion', icon: 'settings', label: 'Configuración institucional' });
    actions.push({ href: '#/auditoria', icon: 'shield', label: 'Bitácora de auditoría' });
  }

  return `
    <div class="quick-grid">
      ${actions.slice(0, 6).map((action) => `
        <a class="quick-link" href="${action.href}">
          ${icon(action.icon, 20)}
          <span>${escapeHtml(action.label)}</span>
        </a>
      `).join('')}
    </div>
  `;
};

const studentGuide = () => `
  <div class="section-head">
    <h2>Antes de registrar</h2>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="stack" style="gap:12px">
        <div class="requirement">
          ${icon('calendar', 16)}
          <span>El periodo debe corresponder a inasistencias reales y no puede incluir fechas futuras.</span>
        </div>
        <div class="requirement">
          ${icon('file-text', 16)}
          <span>Enfermedad general, consulta médica y todo caso crítico requieren un comprobante PDF, JPG o PNG de máximo 5 MB.</span>
        </div>
        <div class="requirement">
          ${icon('clock', 16)}
          <span>La vigencia se calcula en días hábiles institucionales a partir de la fecha de emisión.</span>
        </div>
        <div class="requirement">
          ${icon('lock', 16)}
          <span>Los comprobantes son privados: solo usted, su tutor y la dirección pueden consultarlos.</span>
        </div>
      </div>
    </div>
  </div>
`;

const staffGuide = () => `
  <div class="section-head">
    <h2>Flujo institucional</h2>
  </div>
  <div class="card">
    <div class="card-body">
      <div class="stack" style="gap:12px">
        <div class="requirement met">
          ${icon('user-check', 16)}
          <span><strong>Tutor:</strong> inicia la revisión, valida comprobantes y firma.</span>
        </div>
        <div class="requirement met">
          ${icon('award', 16)}
          <span><strong>Dirección:</strong> firma, aplica el sello y aprueba o rechaza con comentario.</span>
        </div>
        <div class="requirement missing">
          ${icon('alert-triangle', 16)}
          <span>Un caso crítico solo puede aprobarse con al menos un comprobante validado.</span>
        </div>
        <div class="requirement">
          ${icon('shield', 16)}
          <span>Las decisiones quedan registradas en el historial y en la bitácora de auditoría.</span>
        </div>
      </div>
    </div>
  </div>
`;

export async function render(container, ctx) {
  const [dashboard, adminSummary] = await Promise.all([
    api.get('/dashboard'),
    hasRole('admin')
      ? api.get('/usuarios/resumen').catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!ctx.isCurrent()) return;

  const { stats, recent = [], reviewQueue = [], approvalQueue = [] } = dashboard;
  const user = ctx.user;
  const hero = heroFor(user);
  const isStaff = hasRole('tutor') || hasRole('directora');

  const primaryStats = hasRole('alumno')
    ? [
      statCard({ label: 'Mis justificantes', value: stats.total, iconName: 'files', tone: 'green', href: '#/justificantes', hint: 'Historial completo' }),
      statCard({ label: 'Pendientes', value: stats.pendiente, iconName: 'clock', tone: 'amber', href: '#/justificantes?estado=pendiente', hint: 'En espera de revisión' }),
      statCard({ label: 'Aprobados', value: stats.aprobado, iconName: 'check-circle', tone: 'green', href: '#/justificantes?estado=aprobado', hint: 'Con validez institucional' }),
      statCard({ label: 'Rechazados', value: stats.rechazado, iconName: 'ban', tone: 'red', href: '#/justificantes?estado=rechazado', hint: 'Consulte el comentario' }),
    ]
    : [
      statCard({ label: 'Expedientes', value: stats.total, iconName: 'files', tone: 'green', href: '#/justificantes', hint: 'En su ámbito de gestión' }),
      statCard({ label: 'En revisión', value: stats.en_revision, iconName: 'clipboard-check', tone: 'blue', href: '#/justificantes?estado=en_revision', hint: 'Pendientes de dictamen' }),
      statCard({ label: 'Aprobados', value: stats.aprobado, iconName: 'check-circle', tone: 'green', href: '#/justificantes?estado=aprobado', hint: 'Concluidos con firma' }),
      statCard({ label: 'Docs. por validar', value: stats.documentosPendientes, iconName: 'file-text', tone: 'gold', href: '#/justificantes?pendientes=1', hint: `${stats.documentosTotal} comprobantes en total` }),
      statCard({ label: 'Casos críticos', value: stats.criticos, iconName: 'alert-triangle', tone: 'red', href: '#/justificantes?criticos=1', hint: 'Requieren comprobante validado' }),
      statCard({ label: 'Rechazados', value: stats.rechazado, iconName: 'ban', tone: 'slate', href: '#/justificantes?estado=rechazado', hint: 'Con comentario obligatorio' }),
    ];

  let queueCard = '';
  if (hasRole('tutor') && reviewQueue.length > 0) {
    queueCard = `
      <section class="card">
        <div class="card-header">
          <div>
            <h2>Bandeja de revisión</h2>
            <p class="small muted" style="margin-top:3px">Justificantes que esperan su revisión o firma.</p>
          </div>
          <a class="link small" href="#/justificantes?pendientes=1">Ver todos</a>
        </div>
        <div class="card-body" style="padding-top:8px">
          ${reviewQueue.map(queueItem).join('')}
        </div>
      </section>
    `;
  } else if (hasRole('directora') && approvalQueue.length > 0) {
    queueCard = `
      <section class="card">
        <div class="card-header">
          <div>
            <h2>Por aprobar</h2>
            <p class="small muted" style="margin-top:3px">Expedientes en revisión que requieren firma y sello de dirección.</p>
          </div>
          <a class="link small" href="#/justificantes?estado=en_revision">Ver todos</a>
        </div>
        <div class="card-body" style="padding-top:8px">
          ${approvalQueue.map(queueItem).join('')}
        </div>
      </section>
    `;
  }

  const adminCard = adminSummary ? `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Estado del sistema</h2>
          <p class="small muted" style="margin-top:3px">Resumen operativo de la plataforma.</p>
        </div>
        <a class="link small" href="#/auditoria">Auditoría</a>
      </div>
      <div class="card-body">
        <div class="readonly-grid">
          <div class="readonly-item"><span>Usuarios activos</span><strong>${Number(adminSummary.usuarios.activos)} de ${Number(adminSummary.usuarios.total)}</strong></div>
          <div class="readonly-item"><span>Eventos en auditoría</span><strong>${Number(adminSummary.auditoria.total)}</strong></div>
          <div class="readonly-item"><span>Últimas 24 horas</span><strong>${Number(adminSummary.auditoria.last24h)} eventos</strong></div>
          <div class="readonly-item"><span>Parámetros</span><strong>${Number(adminSummary.configuracion)} configurados</strong></div>
        </div>
      </div>
    </section>
  ` : '';

  const recentEmpty = hasRole('alumno')
    ? {
      title: 'Aún no tienes justificantes',
      text: 'Registra tu primer justificante de inasistencia y da seguimiento a su revisión.',
      action: '<a class="btn btn-primary mt-2" href="#/justificantes/nuevo">Registrar justificante</a>',
    }
    : {
      title: 'Sin actividad reciente',
      text: 'Los justificantes de su ámbito aparecerán aquí en cuanto se registren.',
    };

  container.innerHTML = `
    ${pageHeader({
    eyebrow: 'Panel principal',
    title: 'Resumen institucional',
    description: `${formatDateLong(new Date())} · ${roleLabels(user)}`,
  })}

    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <span class="hero-kicker">${escapeHtml(hero.kicker)}</span>
        <h1 id="hero-title">${escapeHtml(hero.title)}</h1>
        <p>${escapeHtml(hero.text)}</p>
        <div class="hero-actions">${hero.actions}</div>
      </div>
      <div class="hero-seal" aria-hidden="true">${icon(hero.seal, 50)}</div>
    </section>

    <div class="stats-grid">
      ${primaryStats.join('')}
    </div>

    <div class="dashboard-grid">
      <div class="stack">
        ${queueCard}
        ${adminCard}
        <section>
          <div class="section-head">
            <h2>Justificantes recientes</h2>
            <a class="link" href="#/justificantes">Ver todos ${icon('arrow-right', 14)}</a>
          </div>
          ${justificantesTable(recent, {
    showStudent: !hasRole('alumno'),
    empty: recentEmpty,
  })}
        </section>
      </div>

      <div class="stack">
        <section class="card chart-card">
          <div class="section-head">
            <h2>Distribución por estado</h2>
            <span class="badge badge-gray badge-plain">${Number(stats.total)} total</span>
          </div>
          ${statusChart(stats)}
        </section>

        <section class="card">
          <div class="card-header"><h2>Accesos rápidos</h2></div>
          <div class="card-body">${quickActions(user)}</div>
        </section>

        ${hasRole('alumno') ? studentGuide() : staffGuide()}
      </div>
    </div>
  `;

  if (isStaff && stats.documentosPendientes > 0) {
    toast(`Hay ${stats.documentosPendientes} comprobante(s) pendiente(s) de validación.`, {
      type: 'info',
      title: 'Atención requerida',
      duration: 6000,
    });
  }

  const welcome = hasRole('alumno') ? `${greeting()}, ${displayName(user).split(' ')[0]}` : null;
  if (welcome) ctx.setPageTitle('Inicio');
}
