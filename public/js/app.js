const $ = (selector, root = document) => root.querySelector(selector);

const CLASES_ESTADO = {
  pendiente: 'text-bg-warning',
  aprobado: 'text-bg-success',
  rechazado: 'text-bg-danger',
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function fmtFecha(value) {
  if (!value) return '-';
  const [anio, mes, dia] = String(value).slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function badgeEstado(estado) {
  return `<span class="badge ${CLASES_ESTADO[estado] || 'text-bg-secondary'}">${esc(estado)}</span>`;
}

function mostrarAlerta(mensaje, tipo = 'success') {
  const alerta = $('#alerta');
  alerta.className = `alert alert-${tipo}`;
  alerta.textContent = mensaje;
  clearTimeout(mostrarAlerta.timer);
  mostrarAlerta.timer = setTimeout(() => alerta.classList.add('d-none'), 4000);
}

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Error de servidor');
    err.errores = data.errores;
    throw err;
  }
  return data;
}

function filaJustificante(j) {
  const critico = j.caso_critico ? ' <span class="badge text-bg-danger">Critico</span>' : '';
  const acciones = j.estado === 'pendiente'
    ? `<a class="btn btn-sm btn-outline-primary" href="form.html?id=${j.id}">Editar</a>
       <button class="btn btn-sm btn-success" data-accion="aprobar" data-id="${j.id}">Aprobar</button>
       <button class="btn btn-sm btn-danger" data-accion="rechazar" data-id="${j.id}">Rechazar</button>`
    : '';

  return `<tr>
    <td><code>${esc(j.folio)}</code>${critico}</td>
    <td>
      <div class="fw-semibold">${esc(j.nombre)}</div>
      <div class="text-muted small">${esc(j.matricula)}</div>
    </td>
    <td>
      <div>${esc(j.carrera)}</div>
      <div class="text-muted small">Grupo ${esc(j.grupo)}</div>
    </td>
    <td class="small">${fmtFecha(j.fecha_inicio)} - ${fmtFecha(j.fecha_fin)}</td>
    <td>${badgeEstado(j.estado)}</td>
    <td class="text-end text-nowrap">
      <a class="btn btn-sm btn-outline-secondary" href="imprimir.html?id=${j.id}">Ver</a>
      ${acciones}
    </td>
  </tr>`;
}

async function cargarJustificantes() {
  const params = new URLSearchParams();
  const q = $('#q').value.trim();
  const estado = $('#estado').value;
  if (q) params.set('q', q);
  if (estado) params.set('estado', estado);

  const tbody = $('#tabla');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Cargando...</td></tr>';

  try {
    const justificantes = await api(`/api/justificantes?${params.toString()}`);
    $('#contador').textContent = `${justificantes.length} registro(s)`;
    tbody.innerHTML = justificantes.length
      ? justificantes.map(filaJustificante).join('')
      : '<tr><td colspan="6" class="text-center text-muted py-4">Sin justificantes</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">${esc(err.message)}</td></tr>`;
  }
}

async function cargarEstudiantes() {
  const tbody = $('#tabla-estudiantes');
  try {
    const estudiantes = await api('/api/estudiantes');
    tbody.innerHTML = estudiantes.length
      ? estudiantes.map((e) => `<tr>
          <td><code>${esc(e.matricula)}</code></td>
          <td>${esc(e.nombre)}</td>
          <td class="small">${esc(e.carrera)}</td>
          <td>${esc(e.grupo)}</td>
        </tr>`).join('')
      : '<tr><td colspan="4" class="text-center text-muted py-3">Sin estudiantes</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">${esc(err.message)}</td></tr>`;
  }
}

async function resolver(id, accion) {
  const cuerpo = { estado: accion === 'aprobar' ? 'aprobado' : 'rechazado' };
  if (accion === 'rechazar') {
    const comentario = window.prompt('Motivo del rechazo:');
    if (comentario === null) return;
    if (!comentario.trim()) {
      mostrarAlerta('El rechazo requiere un comentario', 'danger');
      return;
    }
    cuerpo.comentario = comentario.trim();
  } else if (!window.confirm('Aprobar este justificante?')) {
    return;
  }

  try {
    await api(`/api/justificantes/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    mostrarAlerta('Justificante actualizado');
    cargarJustificantes();
  } catch (err) {
    mostrarAlerta((err.errores || [err.message]).join('. '), 'danger');
  }
}

$('#filtros').addEventListener('submit', (event) => {
  event.preventDefault();
  cargarJustificantes();
});

$('#tabla').addEventListener('click', (event) => {
  const boton = event.target.closest('button[data-accion]');
  if (!boton) return;
  resolver(boton.dataset.id, boton.dataset.accion);
});

$('#form-estudiante').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const datos = Object.fromEntries(new FormData(form).entries());
  try {
    await api('/api/estudiantes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    form.reset();
    mostrarAlerta('Estudiante registrado');
    cargarEstudiantes();
  } catch (err) {
    mostrarAlerta((err.errores || [err.message]).join('. '), 'danger');
  }
});

cargarJustificantes();
cargarEstudiantes();
