'use strict';

const express = require('express');
const controller = require('../controllers/usuarios.controller');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

router.get('/', controller.list);
router.get('/resumen', controller.resumen);
router.patch('/:id/estado', controller.setActive);
router.patch('/:id/roles', controller.setRoles);
router.patch('/:id/password', controller.resetPassword);

module.exports = router;
