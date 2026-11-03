let usuarioActual = null;
let justificantes = [];

async function cargarUsuario() {
  try {
    const res = await fetch('/auth/me');
    if (!res.ok) throw new Error('No autenticado');
    const data = await res.json();
    usuarioActual = data.usuario;
    
    document.getElementById('userName').textContent = usuarioActual.nombre_completo;
    document.getElementById('userRole').textContent = usuarioActual.rol.toUpperCase();
    
    mostrarAcciones();
  } catch (err) {
    window.location.href = '/login.html';
  }
}

function mostrarAcciones() {
  const contenedor = document.getElementById('accionesPrincipales');
  if (usuarioActual.rol === 'alumna') {
    contenedor.innerHTML = `
      <a href="form.html" class="btn btn-primary">
        <i class="bi bi-plus-circle"></i> Nuevo Justificante
      </a>
    `;
  } else if (usuarioActual.rol === 'tutor' || usuarioActual.rol === 'directora') {
    contenedor.innerHTML = `
      <a href="index.html" class="btn btn-outline-primary">
        <i class="bi bi-gear"></i> Gestión Completa
      </a>
    `;
  }
}

async function cargarJustificantes() {
  try {
    const q = document.getElementById('q').value;
    const estado = document.getElementById('estado').value;
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (estado) params.append('estado', estado);
    
    const res = await fetch('/api/justificantes?' + params.toString());
    if (!res.ok) throw new Error('Error al cargar');
    justificantes = await res.json();
    
    actualizarEstadisticas();
    renderTabla();
  } catch (err) {
    console.error(err);
  }
}

function actualizarEstadisticas() {
  document.getElementById('statTotal').textContent = justificantes.length;
  document.getElementById('statPendiente').textContent = justificantes.filter(j => j.estado === 'pendiente').length;
  document.getElementById('statAprobado').textContent = justificantes.filter(j => j.estado === 'aprobado').length;
  document.getElementById('statRechazado').textContent = justificantes.filter(j => j.estado === 'rechazado').length;
}

function renderTabla() {
  const tbody = document.getElementById('tabla');
  const sinRegistros = document.getElementById('sinRegistros');
  const contador = document.getElementById('contador');
  
  contador.textContent = `${justificantes.length} registro${justificantes.length !== 1 ? 's' : ''}`;
  
  if (justificantes.length === 0) {
    tbody.innerHTML = '';
    sinRegistros.classList.remove('d-none');
    return;
  }
  
  sinRegistros.classList.add('d-none');
  tbody.innerHTML = justificantes.map(j => {
    const estadoClase = j.estado === 'aprobado' ? 'badge-aprobado' : j.estado === 'rechazado' ? 'badge-rechazado' : 'badge-pendiente';
    const puedeResolver = (usuarioActual.rol === 'tutor' || usuarioActual.rol === 'directora') && j.estado === 'pendiente';
    
    return `
      <tr>
        <td>
          <span class="fw-semibold text-primary">${j.folio}</span>
        </td>
        <td>
          <div class="fw-semibold">${j.nombre || j.matricula}</div>
          <small class="text-muted">${j.matricula}</small>
        </td>
        <td>
          <div>${j.carrera}</div>
          <small class="text-muted">Grupo: ${j.grupo}</small>
        </td>
        <td>
          <small>${j.fecha_inicio} al ${j.fecha_fin}</small>
        </td>
        <td>
          <small class="text-truncate d-inline-block" style="max-width: 200px;" title="${j.motivo}">${j.motivo}</small>
        </td>
        <td>
          ${j.caso_critico ? '<span class="badge-critico"><i class="bi bi-exclamation-triangle"></i> Sí</span>' : '<span class="text-muted">No</span>'}
        </td>
        <td>
          <span class="badge-estado ${estadoClase}">${j.estado}</span>
        </td>
        <td class="text-center">
          <div class="btn-group btn-group-sm">
            <a href="imprimir.html?id=${j.id}" class="btn btn-outline-secondary btn-action" title="Imprimir">
              <i class="bi bi-printer"></i>
            </a>
            ${puedeResolver ? `<button class="btn btn-outline-primary btn-action" onclick="abrirResolver(${j.id})" title="Resolver">
              <i class="bi bi-check2-square"></i>
            </button>` : ''}
            ${usuarioActual.rol === 'alumna' && j.estado === 'pendiente' ? `<a href="form.html?id=${j.id}" class="btn btn-outline-warning btn-action" title="Editar">
              <i class="bi bi-pencil"></i>
            </a>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function abrirResolver(id) {
  document.getElementById('resolverId').value = id;
  document.getElementById('resolverComentario').value = '';
  const modal = new bootstrap.Modal(document.getElementById('modalResolver'));
  modal.show();
}

document.getElementById('btnResolver').addEventListener('click', async () => {
  const id = document.getElementById('resolverId').value;
  const accion = document.getElementById('resolverAccion').value;
  const comentario = document.getElementById('resolverComentario').value.trim();
  
  if (accion === 'rechazado' && !comentario) {
    alert('El comentario es obligatorio al rechazar');
    return;
  }
  
  try {
    const res = await fetch(`/api/justificantes/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: accion, comentario })
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Error al resolver');
    }
    
    bootstrap.Modal.getInstance(document.getElementById('modalResolver')).hide();
    cargarJustificantes();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('filtros').addEventListener('submit', (e) => {
  e.preventDefault();
  cargarJustificantes();
});

document.getElementById('btnLimpiar').addEventListener('click', () => {
  document.getElementById('q').value = '';
  document.getElementById('estado').value = '';
  cargarJustificantes();
});

cargarUsuario().then(() => cargarJustificantes());
setInterval(cargarJustificantes, 30000);
