const contenedor = document.querySelector('#documento');
const id = new URLSearchParams(window.location.search).get('id');

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

function plantilla(j) {
  const comprobante = j.comprobante
    ? `<a href="/uploads/${encodeURIComponent(j.comprobante)}" target="_blank" rel="noopener">Ver comprobante</a>`
    : 'Sin comprobante';

  const comentario = j.comentario
    ? `<tr><th>Comentario</th><td colspan="3">${esc(j.comentario)}</td></tr>`
    : '';

  return `<header class="doc-encabezado">
    <div>
      <h1>UTXJ</h1>
      <p>Universidad Tecnologica de Xicotepec de Juarez</p>
    </div>
    <div class="text-end">
      <div class="doc-folio">${esc(j.folio)}</div>
      <div class="small text-muted">Solicitado: ${fmtFecha(j.fecha_solicitud)}</div>
    </div>
  </header>

  <h2 class="doc-titulo">Justificante Academico</h2>

  <table class="table table-bordered doc-tabla">
    <tbody>
      <tr><th>Matricula</th><td>${esc(j.matricula)}</td><th>Nombre</th><td>${esc(j.nombre)}</td></tr>
      <tr><th>Carrera</th><td colspan="3">${esc(j.carrera)}</td></tr>
      <tr><th>Grupo</th><td>${esc(j.grupo)}</td><th>Estado</th><td class="text-uppercase">${esc(j.estado)}</td></tr>
      <tr><th>Periodo</th><td colspan="3">${fmtFecha(j.fecha_inicio)} al ${fmtFecha(j.fecha_fin)}</td></tr>
      <tr><th>Materias afectadas</th><td colspan="3">${esc(j.materias)}</td></tr>
      <tr><th>Motivo</th><td colspan="3">${esc(j.motivo)}</td></tr>
      <tr><th>Caso critico</th><td>${j.caso_critico ? 'Si' : 'No'}</td><th>Comprobante</th><td>${comprobante}</td></tr>
      ${comentario}
    </tbody>
  </table>

  <div class="doc-firmas">
    <div>Firma del estudiante</div>
    <div>Sello y firma de Control Escolar</div>
  </div>`;
}

async function cargar() {
  if (!id) {
    contenedor.innerHTML = '<p class="text-danger">Falta el id del justificante.</p>';
    return;
  }

  try {
    const res = await fetch(`/api/justificantes/${id}`);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Justificante no encontrado');
    document.title = `Justificante ${j.folio}`;
    contenedor.innerHTML = plantilla(j);
  } catch (err) {
    contenedor.innerHTML = `<p class="text-danger">${esc(err.message)}</p>`;
  }
}

cargar();
