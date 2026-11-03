'use strict';

const catalogos = require('../models/catalogos.model');
const { asyncHandler } = require('../utils/errors');
const validators = require('../utils/validators');

const registro = asyncHandler(async (req, res) => {
  const [institucion, carreras, grupos] = await Promise.all([
    catalogos.getInstitution(1),
    catalogos.getCareers(),
    catalogos.getGroups(),
  ]);
  res.json({ institucion, carreras, grupos });
});

const all = asyncHandler(async (req, res) => {
  const [institucion, carreras, grupos, materias, motivos, tiposDocumento, estados, ajustes] =
    await Promise.all([
      catalogos.getInstitution(1),
      catalogos.getCareers(),
      catalogos.getGroups(),
      catalogos.getSubjects(),
      catalogos.getReasonTypes(),
      catalogos.getDocumentTypes(),
      catalogos.getStatuses(),
      catalogos.getPublicSettings(),
    ]);

  res.json({
    institucion,
    carreras,
    grupos,
    materias,
    motivos,
    tiposDocumento,
    estados,
    ajustes,
  });
});

const institucion = asyncHandler(async (req, res) => {
  res.json({ institucion: await catalogos.getInstitution(1) });
});

const carreras = asyncHandler(async (req, res) => {
  res.json({ carreras: await catalogos.getCareers() });
});

const grupos = asyncHandler(async (req, res) => {
  const careerId = validators.toInt(req.query.carrera, null);
  res.json({ grupos: await catalogos.getGroups(careerId) });
});

const materias = asyncHandler(async (req, res) => {
  const careerId = validators.toInt(req.query.carrera, null);
  res.json({ materias: await catalogos.getSubjects(careerId) });
});

const docentes = asyncHandler(async (req, res) => {
  const careerId = validators.toInt(req.query.carrera, null);
  res.json({ docentes: await catalogos.getTeachers(careerId) });
});

const motivos = asyncHandler(async (req, res) => {
  res.json({ motivos: await catalogos.getReasonTypes() });
});

const tiposDocumento = asyncHandler(async (req, res) => {
  res.json({ tiposDocumento: await catalogos.getDocumentTypes() });
});

const estados = asyncHandler(async (req, res) => {
  res.json({ estados: await catalogos.getStatuses() });
});

const roles = asyncHandler(async (req, res) => {
  res.json({ roles: await catalogos.getRoles() });
});

const ajustes = asyncHandler(async (req, res) => {
  res.json({ ajustes: await catalogos.getSettings() });
});

const actualizarAjuste = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const value = String(req.body.valor ?? req.body.value ?? '').trim();
  if (!value) {
    const { badRequest } = require('../utils/errors');
    throw badRequest('El valor de la configuración es obligatorio');
  }
  const updated = await catalogos.updateSetting(key, value, req.user.id);
  if (!updated) {
    const { notFound } = require('../utils/errors');
    throw notFound('La configuración no existe');
  }
  res.json({ mensaje: 'Configuración actualizada', ajuste: updated });
});

const diasInhabiles = asyncHandler(async (req, res) => {
  res.json({ diasInhabiles: await catalogos.getNonWorkingDays(1) });
});

module.exports = {
  registro,
  all,
  institucion,
  carreras,
  grupos,
  materias,
  docentes,
  motivos,
  tiposDocumento,
  estados,
  roles,
  ajustes,
  actualizarAjuste,
  diasInhabiles,
};
