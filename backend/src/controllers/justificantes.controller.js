'use strict';

const service = require('../services/justificantes.service');
const { asyncHandler, badRequest } = require('../utils/errors');
const validators = require('../utils/validators');

const parseId = (value, label = 'justificante') => {
  const id = validators.toInt(value, null);
  if (!id || id <= 0) throw badRequest(`El identificador del ${label} es inválido`);
  return id;
};

const list = asyncHandler(async (req, res) => {
  const result = await service.list(req.user, req.query);
  res.json(result);
});

const detail = asyncHandler(async (req, res) => {
  const result = await service.detail(parseId(req.params.id), req.user);
  res.json({ justificante: result });
});

const formContext = asyncHandler(async (req, res) => {
  const result = await service.formContext(req.user);
  res.json(result);
});

const create = asyncHandler(async (req, res) => {
  const result = await service.create(req.user, req.body, req.file, req.ip);
  res.status(201).json({
    mensaje: `Justificante ${result.folio} registrado correctamente`,
    justificante: result,
  });
});

const update = asyncHandler(async (req, res) => {
  const result = await service.update(parseId(req.params.id), req.user, req.body, req.file, req.ip);
  res.json({ mensaje: 'Justificante actualizado correctamente', justificante: result });
});

const startReview = asyncHandler(async (req, res) => {
  const result = await service.startReview(parseId(req.params.id), req.user, req.ip);
  res.json({ mensaje: 'El justificante pasó a revisión', justificante: result });
});

const signTutor = asyncHandler(async (req, res) => {
  const result = await service.sign(parseId(req.params.id), req.user, 'tutor', req.ip);
  res.json({ mensaje: 'Firma del tutor registrada correctamente', justificante: result });
});

const signDirector = asyncHandler(async (req, res) => {
  const result = await service.sign(parseId(req.params.id), req.user, 'director', req.ip);
  res.json({ mensaje: 'Firma de la dirección registrada correctamente', justificante: result });
});

const approve = asyncHandler(async (req, res) => {
  const result = await service.approve(parseId(req.params.id), req.user, req.body, req.ip);
  res.json({ mensaje: 'Justificante aprobado, firmado y sellado', justificante: result });
});

const reject = asyncHandler(async (req, res) => {
  const result = await service.reject(parseId(req.params.id), req.user, req.body, req.ip);
  res.json({ mensaje: 'Justificante rechazado', justificante: result });
});

const cancel = asyncHandler(async (req, res) => {
  const result = await service.cancel(parseId(req.params.id), req.user, req.body, req.ip);
  res.json({ mensaje: 'Justificante cancelado', justificante: result });
});

const uploadDocument = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!req.file) throw badRequest('Seleccione un archivo PDF, JPG o PNG');
  const result = await service.addDocument(id, req.user, req.file, req.body.tipo_documento_id, req.ip);
  res.status(201).json({ mensaje: 'Comprobante cargado correctamente', justificante: result });
});

const validateDocument = asyncHandler(async (req, res) => {
  const justificationId = parseId(req.params.id);
  const documentId = parseId(req.params.documentId, 'documento');
  const result = await service.validateDocument(justificationId, documentId, req.user, req.body, req.ip);
  res.json({ mensaje: 'Validación del comprobante registrada', justificante: result });
});

const deleteDocument = asyncHandler(async (req, res) => {
  const justificationId = parseId(req.params.id);
  const documentId = parseId(req.params.documentId, 'documento');
  const result = await service.deleteDocument(justificationId, documentId, req.user, req.ip);
  res.json({ mensaje: 'Comprobante eliminado', justificante: result });
});

const downloadDocument = asyncHandler(async (req, res) => {
  const justificationId = parseId(req.params.id);
  const documentId = parseId(req.params.documentId, 'documento');
  await service.downloadDocument(justificationId, documentId, req.user, res);
});

const print = asyncHandler(async (req, res) => {
  const result = await service.printPayload(parseId(req.params.id), req.user);
  res.json({ justificante: result });
});

const dashboard = asyncHandler(async (req, res) => {
  const result = await service.dashboard(req.user);
  res.json(result);
});

const expire = asyncHandler(async (req, res) => {
  await service.expire(req.user);
  res.json({ mensaje: 'Se actualizaron los justificantes vencidos' });
});

module.exports = {
  list,
  detail,
  formContext,
  create,
  update,
  startReview,
  signTutor,
  signDirector,
  approve,
  reject,
  cancel,
  uploadDocument,
  validateDocument,
  deleteDocument,
  downloadDocument,
  print,
  dashboard,
  expire,
  parseId,
};
