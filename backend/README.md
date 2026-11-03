# Backend — API de Justificantes UTXJ

API REST en Express 4 con MySQL 8 para el Sistema de Justificantes Académicos.

## Inicio rápido

```bash
cd backend
cp .env.example .env      # Windows: copy .env.example .env
npm install
npm run dev               # o npm start
```

El servidor escucha en `http://localhost:3000` y sirve también el frontend.

## Variables de entorno

Todas las variables se cargan desde `backend/.env` antes de importar el pool.

| Variable | Predeterminado | Descripción |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` activa HSTS, cookies seguras y caché. |
| `PORT` | `3000` | Puerto HTTP. |
| `DB_HOST` | `127.0.0.1` | Host de MySQL. |
| `DB_PORT` | `3306` | Puerto de MySQL. |
| `DB_USER` | `root` | Usuario. |
| `DB_PASSWORD` | vacío | Contraseña. |
| `DB_NAME` | `db_justificantes_utxj` | Base de datos. |
| `DB_CONNECTION_LIMIT` | `10` | Conexiones del pool. |
| `JWT_SECRET` | valor local | Firma de sesión. **Cambiar en producción.** |
| `JWT_EXPIRES_IN` | `8h` | Vigencia del token. |
| `COOKIE_NAME` | `utxj_sesion` | Cookie de sesión. |
| `COOKIE_SECURE` | `false` | `true` con HTTPS. |
| `CORS_ORIGIN` | `http://localhost:3000` | Origen permitido. |
| `UPLOAD_ROOT` | `uploads` | Raíz de archivos privados. |
| `MAX_FILE_SIZE_MB` | `5` | Tamaño máximo de comprobante. |
| `BCRYPT_ROUNDS` | `12` | Coste del hash. |
| `LOGIN_MAX_ATTEMPTS` | `5` | Intentos antes de bloqueo. |
| `LOGIN_LOCK_MINUTES` | `15` | Duración del bloqueo. |

## Estructura

```text
backend/
├── app.js                 Entrypoint: dotenv, middlewares, rutas, estáticos, errores
├── config/index.js        Lectura tipada de variables
├── database/pool.js       Pool mysql2, query/execute/transacciones
├── src/
│   ├── controllers/       Adaptadores HTTP
│   ├── models/            SQL y mapeo de resultados
│   ├── routes/            Endpoints y roles
│   ├── services/          Reglas de negocio
│   ├── middlewares/       auth, csrf, upload, rateLimit, error
│   └── utils/             dates, errors, files, signatures, validators
└── uploads/private/       documents, signatures, stamps
```

## Flujo de seguridad

1. `helmet` aplica CSP y cabeceras.
2. `apiLimiter` limita `/api`.
3. `verifyCsrf` exige `X-CSRF-Token` en escrituras (excepto login).
4. `authenticate` valida la cookie/JWT y carga el usuario.
5. `requireRole` / `requireStudent` aplican RBAC.
6. El servicio valida alcance, propiedad y estado.
7. La base aplica procedimientos, triggers y auditoría.

## Respuestas de error

```json
{ "error": "Mensaje" }
```

```json
{ "errores": ["Campo obligatorio", "Formato inválido"] }
```

## Archivos privados

Los comprobantes, firmas y sellos se guardan en `uploads/private/`. La base solo conserva metadatos, ruta relativa y SHA-256. Se sirven por endpoints autenticados, nunca como estáticos públicos.

## Verificación

- `GET /api/health` → `{ "ok": true }`.
- Consulte `database/07_test_queries.sql` para validar el esquema.
- La referencia completa de endpoints está en `../documentation/api.md`.
