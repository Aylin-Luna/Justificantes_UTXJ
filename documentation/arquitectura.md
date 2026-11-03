# Arquitectura del sistema — Justificantes UTXJ

## 1. Visión general

Aplicación web monolítica con separación clara entre frontend estático y API REST:

```
Navegador
   │  HTML + CSS + ES Modules (sin bundler)
   ▼
Express 4 (backend/app.js)
   ├─ Middlewares: helmet, CORS, compresión, cookies, JSON, morgan
   ├─ Seguridad: rate limit, JWT, RBAC, CSRF
   ├─ Rutas /api/*
   ├─ Servicios de negocio
   ├─ Modelos con SQL preparado
   └─ MySQL 8 (mysql2/promise)
        └─ Procedimientos, triggers y auditoría
```

El servidor también sirve el frontend (`frontend/public`, `frontend/src/assets` y módulos ES). No hay proceso de build ni dependencias de CDN.

## 2. Estructura del repositorio

```
JUSTIFICANTES_UTXJ/
├── backend/
│   ├── app.js                  Entrypoint de Express
│   ├── config/index.js         Configuración desde .env
│   ├── database/pool.js        Pool MySQL y helpers de transacción
│   ├── src/
│   │   ├── controllers/        Adaptadores HTTP
│   │   ├── models/             Consultas SQL y mapeo
│   │   ├── routes/             Definición de endpoints y roles
│   │   ├── services/           Reglas de negocio y flujo
│   │   ├── middlewares/        Auth, CSRF, uploads, errores, rate limit
│   │   └── utils/              Fechas, validaciones, archivos, firmas
│   ├── uploads/                Archivos privados (no versionados)
│   └── .env.example            Contrato de variables
├── frontend/
│   ├── public/                 index.html, app.html, imprimir.html, 404.html
│   └── src/
│       ├── assets/             CSS institucional, logo, favicon
│       ├── components/         Componentes reutilizables
│       ├── views/              Vistas por rol
│       ├── api.js              Cliente HTTP + CSRF
│       ├── auth.js             Sesión y roles
│       ├── main.js             Router y shell
│       ├── login.js            Pantalla de acceso
│       ├── print.js            Vista imprimible
│       └── ui.js               Componentes y utilidades DOM
├── database/
│   ├── 01_create_database.sql
│   ├── 02_create_tables.sql
│   ├── 03_foreign_keys_indexes.sql
│   ├── 04_stored_procedures.sql
│   ├── 05_triggers.sql
│   ├── 06_seed_data.sql
│   └── 07_test_queries.sql
├── diagrams/                   ERD Mermaid + HTML interactivo
├── documentation/              Este documento y anexos
├── scripts/                    Generadores de ERD, diccionario y archivos demo
├── legacy/                     Código anterior conservado como respaldo
└── README.md
```

## 3. Capas del backend

| Capa | Responsabilidad | Ejemplo |
| --- | --- | --- |
| Rutas | Declarar método, ruta, middlewares de rol y controlador. | `justificantes.routes.js` |
| Middlewares | Autenticación, autorización, CSRF, uploads, rate limit, errores. | `auth.js`, `csrf.js` |
| Controladores | Validar parámetros HTTP y dar forma a la respuesta. | `justificantes.controller.js` |
| Servicios | Reglas de negocio, permisos finos, transacciones y orquestación. | `justificantes.service.js` |
| Modelos | SQL, mapeo de filas y llamadas a procedimientos. | `justificantes.model.js` |
| Base de datos | Integridad, folio, vigencia, historial y auditoría. | `04_stored_procedures.sql`, `05_triggers.sql` |

## 4. Flujo de una petición

1. El navegador envía la solicitud con la cookie de sesión y, si es escritura, `X-CSRF-Token`.
2. `helmet` aplica cabeceras y CSP.
3. `apiLimiter` limita la tasa global; `loginLimiter`/`writeLimiter` aplican límites específicos.
4. `verifyCsrf` valida el doble envío en métodos no seguros.
5. La ruta aplica `authenticate` y `requireRole`/`requireStudent`.
6. El controlador valida el identificador y delega en el servicio.
7. El servicio carga el recurso con el alcance del usuario, valida estado/permisos y ejecuta el modelo.
8. El modelo usa SQL parametrizado o un procedimiento almacenado; la base aplica triggers y auditoría.
9. El controlador responde JSON; el frontend actualiza la vista con `ctx.reload()`.

## 5. Frontend

- **Sin bundler**: módulos ES nativos, CSS propio y Bootstrap no se usa.
- **Rutas hash**: `#/inicio`, `#/justificantes`, `#/justificantes/nuevo`, `#/justificantes/:id`, `#/usuarios`, `#/configuracion`, `#/auditoria`, `#/perfil`.
- **Shell**: barra lateral por rol, barra superior, menú de usuario y área `#view`.
- **Vistas**:
  - `dashboard.js`: indicadores y pendientes por rol.
  - `justificantes.js`: listado, filtros, búsqueda y paginación (estado en URL).
  - `detalle.js`: expediente, documentos, firmas, historial y acciones de flujo.
  - `formulario.js`: alta/edición con validación y carga de comprobante.
  - `usuarios.js`: administración de cuentas, roles y contraseñas.
  - `configuracion.js`: parámetros, institución, días inhábiles y catálogos.
  - `auditoria.js`: eventos con filtros y resumen.
  - `perfil.js`: datos de la cuenta y cambio de contraseña.
- **Reimpresión**: `imprimir.html` independiente, carga `print.js`, no comparte shell.
- **Modales**: `ui.js` centraliza `openModal`, toasts, badges y utilidades.

## 6. Gestión de errores

- `asyncHandler` captura promesas rechazadas.
- `utils/errors.js` define errores con código HTTP (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `unprocessable`).
- `middlewares/error.js` normaliza la respuesta a `{ error }` o `{ errores }`.
- El frontend muestra el mensaje del servidor y limpia estados de carga.

## 7. Archivos y almacenamiento

- `uploads/private/documents`: comprobantes.
- `uploads/private/signatures`: firmas SVG.
- `uploads/private/stamps`: sellos SVG.
- La base guarda ruta relativa, nombre original, MIME, tamaño y SHA-256.
- Los archivos se sirven por endpoints autenticados; no hay carpeta pública de uploads.

## 8. Operación

- `backend/app.js` carga `backend/.env` antes de importar el pool.
- Al iniciar verifica la conexión y crea directorios privados.
- Un job periódico marca vencidos los aprobados.
- `GET /api/health` reporta estado del servicio y base de datos.
- Los scripts de mantenimiento (`scripts/`) generan ERD, diccionario y archivos demo.

## 9. Despliegue

1. Instalar Node.js 18+ y MySQL 8.0.
2. Crear la base con `database/01`–`06`.
3. Copiar `backend/.env.example` a `backend/.env` y ajustar credenciales.
4. `npm install` en `backend/`.
5. `npm start` desde la raíz o `npm --prefix backend start`.
6. Publicar detrás de HTTPS y habilitar `COOKIE_SECURE=true`.

## 10. Decisiones técnicas

| Decisión | Motivo |
| --- | --- |
| CSS propio en lugar de Tailwind/CDN | CSP limpia, sin build, control institucional y funcionamiento offline. |
| JWT en cookie `HttpOnly` | Evita exponer el token a JavaScript. |
| CSRF de doble envío | Compatible con SPA sin sesión de servidor. |
| Procedimientos almacenados | Centralizan folio, vigencia y transiciones críticas. |
| Triggers de auditoría | Trazabilidad uniforme incluso fuera de la API. |
| Archivos fuera de la BD | Rendimiento y respaldo independiente. |
| Hash en lugar de cifrado reversible | Contraseñas no recuperables. |
