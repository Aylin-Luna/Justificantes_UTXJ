'use strict';

const express = require('express');
const controller = require('../controllers/justificantes.controller');
const { authenticate, requireRole, requireStudent } = require('../middlewares/auth');
const { singleFile } = require('../middlewares/upload');
const { writeLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

router.use(authenticate);

router.get('/formulario', requireStudent, controller.formContext);
router.get('/', controller.list);
router.post('/', requireStudent, writeLimiter, singleFile('archivo'), controller.create);
router.get('/:id', controller.detail);
router.get('/:id/imprimir', controller.print);
router.put('/:id', requireRole('alumno', 'admin'), writeLimiter, singleFile('archivo'), controller.update);
router.post('/:id/revision', requireRole('tutor'), writeLimiter, controller.startReview);
router.post('/:id/firmar-tutor', requireRole('tutor'), writeLimiter, controller.signTutor);
router.post('/:id/firmar-direccion', requireRole('directora'), writeLimiter, controller.signDirector);
router.post('/:id/aprobar', requireRole('directora'), writeLimiter, controller.approve);
router.post('/:id/rechazar', requireRole('directora'), writeLimiter, controller.reject);
router.post('/:id/cancelar', requireRole('alumno', 'admin'), writeLimiter, controller.cancel);
router.post('/:id/documentos', requireRole('alumno', 'tutor', 'directora', 'admin'), writeLimiter, singleFile('archivo'), controller.uploadDocument);
router.post('/:id/documentos/:documentId/validar', requireRole('tutor', 'directora'), writeLimiter, controller.validateDocument);
router.delete('/:id/documentos/:documentId', requireRole('alumno', 'admin'), writeLimiter, controller.deleteDocument);
router.get('/:id/documentos/:documentId/archivo', controller.downloadDocument);
router.post('/:id/vencer', requireRole('admin'), writeLimiter, controller.expire);

module.exports = router;
