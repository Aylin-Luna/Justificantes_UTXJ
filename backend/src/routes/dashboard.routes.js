'use strict';

const express = require('express');
const controller = require('../controllers/justificantes.controller');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', controller.dashboard);
router.post('/vencer', requireRole('admin'), controller.expire);

module.exports = router;
