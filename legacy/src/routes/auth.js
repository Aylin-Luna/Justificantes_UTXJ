const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session && req.session.usuario) {
    return res.redirect('/dashboard.html');
  }
  res.sendFile(require('path').join(__dirname, '..', '..', 'public', 'login.html'));
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
    }

    const [rows] = await pool.query('SELECT * FROM usuarios WHERE username = ? AND activo = 1', [username]);
    if (!rows.length) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const usuario = rows[0];
    const valido = await bcrypt.compare(password, usuario.password);
    if (!valido) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    req.session.usuario = {
      id: usuario.id,
      username: usuario.username,
      nombre_completo: usuario.nombre_completo,
      rol: usuario.rol,
      matricula: usuario.matricula
    };

    res.json({ ok: true, usuario: req.session.usuario });
  } catch (err) {
    next(err);
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  res.json({ usuario: req.session.usuario });
});

module.exports = router;
