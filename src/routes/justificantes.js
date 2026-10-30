const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const pool = require('../db');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'];
const ESTADOS = ['pendiente', 'aprobado', 'rechazado'];
const SELECT_BASE = `SELECT j.*, e.nombre
  FROM justificantes j
  JOIN estudiantes e ON e.matricula = j.matricula`;

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const valido = TIPOS_PERMITIDOS.includes(file.mimetype);
    cb(valido ? null : new Error('TIPO_ARCHIVO_INVALIDO'), valido);
  },
});

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

function borrarArchivo(ruta) {
  if (ruta) fs.promises.unlink(ruta).catch(() => {});
}

function fechaValida(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(valor));
}

function parsear(body) {
  return {
    matricula: texto(body.matricula),
    carrera: texto(body.carrera),
    grupo: texto(body.grupo),
    fecha_solicitud: texto(body.fecha_solicitud),
    fecha_inicio: texto(body.fecha_inicio),
    fecha_fin: texto(body.fecha_fin),
    materias: texto(body.materias),
    motivo: texto(body.motivo),
    caso_critico: ['1', 'true', 'on'].includes(String(body.caso_critico).toLowerCase()),
  };
}

function validar(d) {
  const errores = [];
  if (!d.matricula) errores.push('La matricula es obligatoria');
  if (!d.carrera) errores.push('La carrera es obligatoria');
  if (!d.grupo) errores.push('El grupo es obligatorio');
  if (!fechaValida(d.fecha_solicitud)) errores.push('Fecha de solicitud invalida');
  if (!fechaValida(d.fecha_inicio)) errores.push('Fecha de inicio invalida');
  if (!fechaValida(d.fecha_fin)) errores.push('Fecha de fin invalida');
  if (fechaValida(d.fecha_inicio) && fechaValida(d.fecha_fin) && d.fecha_fin < d.fecha_inicio) {
    errores.push('La fecha de fin no puede ser anterior a la fecha de inicio');
  }
  if (!d.materias) errores.push('Indica al menos una materia afectada');
  if (!d.motivo) errores.push('El motivo es obligatorio');
  return errores;
}

async function generarFolio() {
  const hoy = new Date();
  const ymd = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}`;
  for (let intento = 0; intento < 10; intento += 1) {
    const folio = `JUS-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
    const [rows] = await pool.query('SELECT id FROM justificantes WHERE folio = ?', [folio]);
    if (!rows.length) return folio;
  }
  throw new Error('No se pudo generar un folio unico');
}

async function buscarPorId(id) {
  const [rows] = await pool.query(`${SELECT_BASE} WHERE j.id = ?`, [id]);
  return rows[0] || null;
}

router.get('/', async (req, res, next) => {
  try {
    const q = texto(req.query.q);
    const estado = texto(req.query.estado);
    const where = [];
    const params = [];

    if (q) {
      where.push('(j.folio LIKE ? OR j.matricula LIKE ? OR e.nombre LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (ESTADOS.includes(estado)) {
      where.push('j.estado = ?');
      params.push(estado);
    }

    const sql = `${SELECT_BASE} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY j.creado_en DESC`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const justificante = await buscarPorId(req.params.id);
    if (!justificante) return res.status(404).json({ error: 'Justificante no encontrado' });
    res.json(justificante);
  } catch (err) {
    next(err);
  }
});

router.post('/', upload.single('comprobante'), async (req, res, next) => {
  try {
    const d = parsear(req.body);
    const errores = validar(d);
    if (d.caso_critico && !req.file) errores.push('El comprobante es obligatorio para un caso critico');
    if (errores.length) {
      borrarArchivo(req.file?.path);
      return res.status(400).json({ errores });
    }

    const [estudiante] = await pool.query('SELECT matricula FROM estudiantes WHERE matricula = ?', [d.matricula]);
    if (!estudiante.length) {
      borrarArchivo(req.file?.path);
      return res.status(400).json({ errores: ['La matricula no esta registrada'] });
    }

    const folio = await generarFolio();
    const [result] = await pool.query(
      `INSERT INTO justificantes
        (folio, matricula, carrera, grupo, fecha_solicitud, fecha_inicio, fecha_fin, materias, motivo, caso_critico, comprobante)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        folio,
        d.matricula,
        d.carrera,
        d.grupo,
        d.fecha_solicitud,
        d.fecha_inicio,
        d.fecha_fin,
        d.materias,
        d.motivo,
        d.caso_critico ? 1 : 0,
        req.file ? req.file.filename : null,
      ]
    );

    res.status(201).json(await buscarPorId(result.insertId));
  } catch (err) {
    borrarArchivo(req.file?.path);
    next(err);
  }
});

router.put('/:id', upload.single('comprobante'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM justificantes WHERE id = ?', [req.params.id]);
    const actual = rows[0];
    if (!actual) {
      borrarArchivo(req.file?.path);
      return res.status(404).json({ error: 'Justificante no encontrado' });
    }
    if (actual.estado !== 'pendiente') {
      borrarArchivo(req.file?.path);
      return res.status(409).json({ error: 'Solo se pueden editar justificantes pendientes' });
    }

    const d = parsear(req.body);
    const comprobante = req.file ? req.file.filename : actual.comprobante;
    const errores = validar(d);
    if (d.caso_critico && !comprobante) errores.push('El comprobante es obligatorio para un caso critico');
    if (errores.length) {
      borrarArchivo(req.file?.path);
      return res.status(400).json({ errores });
    }

    const [estudiante] = await pool.query('SELECT matricula FROM estudiantes WHERE matricula = ?', [d.matricula]);
    if (!estudiante.length) {
      borrarArchivo(req.file?.path);
      return res.status(400).json({ errores: ['La matricula no esta registrada'] });
    }

    await pool.query(
      `UPDATE justificantes
       SET matricula = ?, carrera = ?, grupo = ?, fecha_solicitud = ?, fecha_inicio = ?, fecha_fin = ?,
           materias = ?, motivo = ?, caso_critico = ?, comprobante = ?
       WHERE id = ?`,
      [
        d.matricula,
        d.carrera,
        d.grupo,
        d.fecha_solicitud,
        d.fecha_inicio,
        d.fecha_fin,
        d.materias,
        d.motivo,
        d.caso_critico ? 1 : 0,
        comprobante,
        req.params.id,
      ]
    );

    if (req.file && actual.comprobante) {
      borrarArchivo(path.join(UPLOAD_DIR, actual.comprobante));
    }

    res.json(await buscarPorId(req.params.id));
  } catch (err) {
    borrarArchivo(req.file?.path);
    next(err);
  }
});

router.patch('/:id/estado', async (req, res, next) => {
  try {
    const estado = texto(req.body.estado);
    const comentario = texto(req.body.comentario);

    if (!['aprobado', 'rechazado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado invalido' });
    }
    if (estado === 'rechazado' && !comentario) {
      return res.status(400).json({ error: 'Indica el motivo del rechazo' });
    }

    const [rows] = await pool.query('SELECT estado FROM justificantes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Justificante no encontrado' });
    if (rows[0].estado !== 'pendiente') {
      return res.status(409).json({ error: 'El justificante ya fue resuelto' });
    }

    await pool.query('UPDATE justificantes SET estado = ?, comentario = ? WHERE id = ?', [
      estado,
      comentario || null,
      req.params.id,
    ]);

    res.json(await buscarPorId(req.params.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
