require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const session = require('express-session');

const pool = require('./db');
const estudiantesRouter = require('./routes/estudiantes');
const justificantesRouter = require('./routes/justificantes');
const authRouter = require('./routes/auth');

const app = express();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'utxj-justificantes-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOAD_DIR));

function mensajeError(err) {
  switch (err.code) {
    case 'ER_ACCESS_DENIED_ERROR':
      return 'MySQL rechazo las credenciales. Revisa DB_USER y DB_PASSWORD en .env.';
    case 'ECONNREFUSED':
      return 'No se pudo conectar a MySQL. Verifica que el servicio este activo y DB_HOST/DB_PORT.';
    case 'ER_BAD_DB_ERROR':
      return 'La base de datos indicada en DB_NAME no existe.';
    case 'ER_NO_SUCH_TABLE': {
      const tabla = /Table '([^']+)'/.exec(err.sqlMessage || '');
      return `No existe la tabla${tabla ? ` ${tabla[1]}` : ''} en la base de datos.`;
    }
    case 'ER_BAD_FIELD_ERROR': {
      const columna = /Unknown column '([^']+)'/.exec(err.sqlMessage || '');
      return `No existe la columna${columna ? ` ${columna[1]}` : ''} en la base de datos.`;
    }
    default:
      return 'Error interno del servidor';
  }
}

function requiereAuth(req, res, next) {
  if (!req.session || !req.session.usuario) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    return res.redirect('/login.html');
  }
  next();
}

app.get('/', (req, res) => {
  if (req.session && req.session.usuario) {
    return res.redirect('/dashboard.html');
  }
  res.redirect('/login.html');
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: mensajeError(err) });
  }
});

app.use('/auth', authRouter);
app.use('/api/estudiantes', requiereAuth, estudiantesRouter);
app.use('/api/justificantes', requiereAuth, justificantesRouter);

app.get('/dashboard.html', requiereAuth, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
});

app.get('/form.html', requiereAuth, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'form.html'));
});

app.get('/index.html', requiereAuth, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/imprimir.html', requiereAuth, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'imprimir.html'));
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'El archivo excede el limite de 5 MB' : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err.message === 'TIPO_ARCHIVO_INVALIDO') {
    return res.status(400).json({ error: 'Solo se permiten archivos PDF, JPG o PNG' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalido en la solicitud' });
  }
  console.error(err);
  res.status(500).json({ error: mensajeError(err) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Justificantes UTXJ en http://localhost:${PORT}`);
  pool.query('SELECT 1')
    .then(() => console.log('Conexion a MySQL OK'))
    .catch((err) => {
      console.error(`No se pudo conectar a MySQL (${err.code || err.message}). Revisa .env.`);
    });
});
