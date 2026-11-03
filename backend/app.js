'use strict';

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envFile = path.resolve(__dirname, '.env');
dotenv.config({ path: envFile });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');

const config = require('./config');
const { checkHealth, closePool } = require('./database/pool');
const { ensureDirectories } = require('./src/utils/files');
const { verifyCsrf } = require('./src/middlewares/csrf');
const { notFound, errorHandler } = require('./src/middlewares/error');
const { apiLimiter } = require('./src/middlewares/rateLimit');
const authRoutes = require('./src/routes/auth.routes');
const justificantesRoutes = require('./src/routes/justificantes.routes');
const catalogosRoutes = require('./src/routes/catalogos.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const usuariosRoutes = require('./src/routes/usuarios.routes');
const auditoriaRoutes = require('./src/routes/auditoria.routes');
const justificantesModel = require('./src/models/justificantes.model');

const app = express();

app.disable('x-powered-by');
if (config.isProduction) app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: config.isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: config.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
  referrerPolicy: { policy: 'same-origin' },
}));

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
}));

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (!config.isProduction) {
  app.use(morgan('dev'));
} else {
  app.use(morgan(':remote-addr - :method :url :status :response-time ms'));
}

app.use('/api', apiLimiter);
app.use('/api', (req, res, next) => {
  const safe = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const csrfExempt = ['/auth/login', '/auth/registro'].includes(req.path);
  if (safe || csrfExempt) return next();
  return verifyCsrf(req, res, next);
});

app.get('/api/health', async (req, res) => {
  try {
    const database = await checkHealth();
    res.json({
      ok: true,
      service: 'justificantes-utxj',
      version: '2.0.0',
      database: database.base,
      time: database.ahora,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'No se pudo conectar con la base de datos' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/justificantes', justificantesRoutes);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/auditoria', auditoriaRoutes);

const publicDir = path.join(config.frontendRoot, 'public');
const sourceDir = path.join(config.frontendRoot, 'src');

app.use('/assets', express.static(path.join(sourceDir, 'assets'), {
  maxAge: config.isProduction ? '7d' : 0,
  etag: true,
}));
app.use('/src', express.static(sourceDir, {
  maxAge: config.isProduction ? '1h' : 0,
  etag: true,
  index: false,
}));
app.use(express.static(publicDir, {
  maxAge: config.isProduction ? '1h' : 0,
  etag: true,
  index: 'index.html',
}));

app.get('/app', (req, res) => res.sendFile(path.join(publicDir, 'app.html')));
app.get('/imprimir', (req, res) => res.sendFile(path.join(publicDir, 'imprimir.html')));

app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && req.accepts('html')) {
    const page = path.join(publicDir, '404.html');
    if (fs.existsSync(page)) return res.status(404).sendFile(page);
  }
  return notFound(req, res, next);
});

app.use(errorHandler);

const start = async () => {
  ensureDirectories();
  try {
    await checkHealth();
    console.log(`[db] Conectado a ${config.db.database} en ${config.db.host}:${config.db.port}`);
  } catch (error) {
    console.error('[db] No se pudo conectar con MySQL:', error.message);
    console.error('[db] Verifique backend/.env y que la base db_justificantes_utxj exista.');
  }

  const server = app.listen(config.port, () => {
    console.log('============================================================');
    console.log(' Sistema de Justificantes Académicos UTXJ');
    console.log(` Entorno: ${config.env}`);
    console.log(` Servidor: http://localhost:${config.port}`);
    console.log(' Usuarios demo: alumno / tutor / directora / admin');
    console.log('============================================================');
  });

  const expireJob = setInterval(async () => {
    try {
      await justificantesModel.pendingExpiration(4);
    } catch (error) {
      console.error('[job] No se pudieron vencer justificantes:', error.message);
    }
  }, 6 * 60 * 60 * 1000);
  expireJob.unref();

  const shutdown = async (signal) => {
    console.log(`\n[server] Recibido ${signal}. Cerrando...`);
    clearInterval(expireJob);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
};

if (require.main === module) {
  start();
}

module.exports = { app, start };
