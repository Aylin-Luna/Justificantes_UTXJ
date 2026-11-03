# AGENTS.md

Sistema de gestión de justificantes académicos (UTXJ): Node 18+ / Express 4 + MySQL 8, frontend HTML/CSS/JS sin bundler. Sin suite de tests, linter ni build.

## Comandos

- `npm install` en la raíz (scripts de mantenimiento) y `npm run setup` (dependencias del backend).
- Configurar `backend/.env` a partir de `backend/.env.example`. El `.env` de la raíz no se usa.
- Crear la base ejecutando en orden `database/01_create_database.sql` … `06_seed_data.sql`.
- Importación canónica: `mysql --default-character-set=utf8mb4 -u root -p -e "source database/<archivo>"`. En PowerShell no usar tuberías (`Get-Content | mysql`): corrompen UTF-8.
- `npm start` o `npm run dev` (Node `--watch`). Servidor en `http://localhost:3000`.
- Verificación: `GET /api/health` debe devolver `{"ok":true}` y `database/07_test_queries.sql` debe terminar en `TODO OK` (37/37).
- Regenerar documentación: `npm run docs` (ERD + diccionario). Archivos demo: `npm run demo:files`.

## Arquitectura

- `backend/app.js` es el único entrypoint: carga `backend/.env`, sirve el frontend y monta `/api/*`.
- `backend/src/`: `controllers/` (HTTP), `services/` (reglas), `models/` (SQL), `routes/` (endpoints y roles), `middlewares/` (auth, CSRF, uploads, rate limit, errores), `utils/`.
- `backend/database/pool.js` crea el pool `mysql2/promise` con `dateStrings: true`. Cualquier entrypoint nuevo debe cargar dotenv antes de importarlo.
- `frontend/public/`: `index.html` (login), `app.html` (shell), `imprimir.html`, `404.html`.
- `frontend/src/`: router hash (`main.js`), vistas por rol (`views/`), `api.js`, `auth.js`, `ui.js`, `print.js`, CSS y assets.
- `database/` es la única fuente del esquema (01–07). No hay migraciones automáticas.
- `scripts/` genera ERD, diccionario y archivos demo. `legacy/` es respaldo histórico, no runtime.

## Reglas que no romper

- El folio se genera solo en el servidor con formato `JUS-AAAAMMDD-####`; no se acepta del cliente.
- Solo se edita un justificante `pendiente`; `aprobado`/`rechazado`/`cancelado`/`vencido` son inmutables (409).
- El rechazo exige `comentario` (mínimo 5 caracteres) y solo lo realiza `directora`.
- `caso_critico` exige comprobante; para aprobar exige al menos un comprobante `validado`.
- Aprobar requiere firma del tutor; la firma de dirección y el sello se generan si faltan.
- Comprobantes: solo PDF/JPG/PNG, máximo 5 MB, en almacenamiento privado; la BD guarda metadatos y SHA-256.
- Firmas y sellos se generan como SVG privados con SHA-256.
- Sesión: JWT en cookie `HttpOnly`; CSRF de doble envío (`utxj_csrf` + `X-CSRF-Token`) en escrituras.
- Archivos privados se sirven por endpoints autenticados, nunca como estáticos públicos.
- Errores de API: `{ error }` o `{ errores: string[] }`. El frontend maneja ambas formas.
- La UI, los nombres de campos/columnas y los mensajes están en español; mantenerlos así.
- No usar CDN ni frameworks CSS: la CSP es estricta y el diseño vive en `frontend/src/assets/css/styles.css`.
- Los datos de `06_seed_data.sql` son ficticios; no introducir datos personales reales.

## Credenciales demo

`alumno`/`Alumno123!`, `tutor`/`Tutor123!`, `directora`/`Directora123!`, `admin`/`Admin123!`.

## Documentación

`README.md` (instalación y Workbench 8.0), `documentation/` (arquitectura, diseño, diccionario, reglas, seguridad, API, manual, supuestos de impresión) y `diagrams/` (ERD Mermaid + HTML).
