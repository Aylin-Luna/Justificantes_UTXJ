'use strict';

const express = require('express');
const controller = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');
const { loginLimiter, registerLimiter } = require('../middlewares/rateLimit');

const router = express.Router();

router.post('/login', loginLimiter, controller.login);
router.post('/registro', registerLimiter, controller.register);
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.me);
router.post('/cambiar-password', authenticate, controller.changePassword);

module.exports = router;
