const $ = (selector) => document.querySelector(selector);

const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const form = $('#form');

let estudiantes = [];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function hoyISO() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
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

function mostrarErrores(errores) {
  const alerta = $('#alerta');
  alerta.className = 'alert alert-danger';
  alerta.innerHTML = `<ul class="mb-0">${errores.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
}

function autocompletar(matricula) {
  const est = estudiantes.find((e) => e.matricula === matricula.trim());
  $('#nombre-estudiante').textContent = est
    ? est.nombre
    : 'Matricula no registrada. Registrala en el inicio antes de guardar.';
  if (est) {
    form.elements.carrera.value = est.carrera;
    form.elements.grupo.value = est.grupo;
  }
}

async function cargarEstudiantes() {
  estudiantes = await api('/api/estudiantes');
  $('#estudiantes').innerHTML = estudiantes
    .map((e) => `<option value="${esc(e.matricula)}">${esc(e.nombre)}</option>`)
    .join('');
}

async function cargarJustificante() {
  const j = await api(`/api/justificantes/${id}`);

  $('#titulo').textContent = `Editar justificante ${j.folio}`;
  $('#folio').textContent = j.folio;

  for (const campo of ['matricula', 'carrera', 'grupo', 'fecha_solicitud', 'fecha_inicio', 'fecha_fin', 'materias', 'motivo']) {
    form.elements[campo].value = j[campo] ?? '';
  }
  form.elements.caso_critico.checked = Boolean(j.caso_critico);
  $('#nombre-estudiante').textContent = j.nombre;

  if (j.comprobante) {
    $('#comprobante-actual').innerHTML =
      `Comprobante actual: <a href="/uploads/${encodeURIComponent(j.comprobante)}" target="_blank" rel="noopener">ver archivo</a>`;
  }

  if (j.estado !== 'pendiente') {
    mostrarErrores([`Este justificante ya esta ${j.estado} y no se puede editar.`]);
    for (const elemento of form.elements) elemento.disabled = true;
    $('#btn-guardar').disabled = true;
  }
}

form.elements.matricula.addEventListener('change', () => autocompletar(form.elements.matricula.value));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#alerta').className = 'alert d-none';

  const boton = $('#btn-guardar');
  boton.disabled = true;

  try {
    const resultado = await api(id ? `/api/justificantes/${id}` : '/api/justificantes', {
      method: id ? 'PUT' : 'POST',
      body: new FormData(form),
    });
    window.location.href = `imprimir.html?id=${resultado.id}`;
  } catch (err) {
    mostrarErrores(err.errores || [err.message]);
    boton.disabled = false;
  }
});

async function iniciar() {
  form.elements.fecha_solicitud.value = hoyISO();
  try {
    await cargarEstudiantes();
    if (id) await cargarJustificante();
  } catch (err) {
    mostrarErrores(err.errores || [err.message]);
  }
}

iniciar();
