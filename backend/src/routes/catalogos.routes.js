'use strict';

const express = require('express');
const controller = require('../controllers/catalogos.controller');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();

// Catálogo mínimo para el formulario público de registro de alumnos.
router.get('/registro', controller.registro);

router.use(authenticate);

router.get('/', controller.all);
router.get('/institucion', controller.institucion);
router.get('/carreras', controller.carreras);
router.get('/grupos', controller.grupos);
router.get('/materias', controller.materias);
router.get('/docentes', controller.docentes);
router.get('/motivos', controller.motivos);
router.get('/tipos-documento', controller.tiposDocumento);
router.get('/estados', controller.estados);
router.get('/dias-inhabiles', controller.diasInhabiles);
router.get('/roles', requireRole('admin'), controller.roles);
router.get('/configuracion', requireRole('admin'), controller.ajustes);
router.put('/configuracion/:key', requireRole('admin'), controller.actualizarAjuste);

module.exports = router;
