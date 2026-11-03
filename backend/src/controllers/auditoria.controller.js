'use strict';

const auditoria = require('../models/auditoria.model');
const { asyncHandler } = require('../utils/errors');
const validators = require('../utils/validators');

const list = asyncHandler(async (req, res) => {
  const page = validators.clampInt(req.query.page, 1, 10000, 1);
  const limit = validators.clampInt(req.query.limit, 1, 100, 25);
  const result = await auditoria.list({
    filters: {
      table: req.query.tabla || null,
      operation: req.query.operacion || null,
      userId: validators.toInt(req.query.usuario, null),
      search: req.query.buscar || null,
      from: req.query.desde || null,
      to: req.query.hasta || null,
    },
    page,
    limit,
  });
  res.json(result);
});

const resumen = asyncHandler(async (req, res) => {
  const [summary, tables] = await Promise.all([
    auditoria.summary(),
    auditoria.getTables(),
  ]);
  res.json({ resumen: summary, tablas: tables });
});

module.exports = { list, resumen };
