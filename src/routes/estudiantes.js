const express = require('express');
const pool = require('../db');

const router = express.Router();

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

router.get('/', async (req, res, next) => {
  try {
    const q = texto(req.query.q);
    if (q) {
      const [rows] = await pool.query(
        'SELECT * FROM estudiantes WHERE matricula LIKE ? OR nombre LIKE ? ORDER BY nombre',
        [`%${q}%`, `%${q}%`]
      );
      return res.json(rows);
    }
    const [rows] = await pool.query('SELECT * FROM estudiantes ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:matricula', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM estudiantes WHERE matricula = ?', [req.params.matricula]);
    if (!rows.length) return res.status(404).json({ error: 'Estudiante no registrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const matricula = texto(req.body.matricula);
    const nombre = texto(req.body.nombre);
    const carrera = texto(req.body.carrera);
    const grupo = texto(req.body.grupo);
    const correo = texto(req.body.correo) || null;

    const errores = [];
    if (!matricula) errores.push('La matricula es obligatoria');
    if (!nombre) errores.push('El nombre es obligatorio');
    if (!carrera) errores.push('La carrera es obligatoria');
    if (!grupo) errores.push('El grupo es obligatorio');
    if (errores.length) return res.status(400).json({ errores });

    const [result] = await pool.query(
      'INSERT INTO estudiantes (matricula, nombre, carrera, grupo, correo) VALUES (?, ?, ?, ?, ?)',
      [matricula, nombre, carrera, grupo, correo]
    );
    const [rows] = await pool.query('SELECT * FROM estudiantes WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'La matricula ya esta registrada' });
    }
    next(err);
  }
});

module.exports = router;
