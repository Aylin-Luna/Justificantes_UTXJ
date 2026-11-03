'use strict';

const express = require('express');
const controller = require('../controllers/auditoria.controller');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

router.get('/', controller.list);
router.get('/resumen', controller.resumen);

module.exports = router;
