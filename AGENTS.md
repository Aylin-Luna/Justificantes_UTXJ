# AGENTS.md

Sistema de gestion de justificantes academicos (UTXJ): Node 18+ / Express 4 + MySQL 8, frontend HTML/CSS/JS sin bundler con Bootstrap 5 por CDN. Sin tests, linter ni build.

## Comandos

- `npm install`
- Configurar `.env` a partir de `.env.example`. Sin `.env` la app arranca pero `/api/health` responde 500 (MySQL usa `root` sin contrasena por defecto).
- Crear la base: `mysql -u root -p < database.sql`. En PowerShell el redirect `<` no funciona: `Get-Content database.sql | mysql -u root -p`.
- `npm run dev` (Node `--watch`) o `npm start`. Servidor en `http://localhost:3000`.
- Verificacion: `GET /api/health` debe devolver `{"ok":true}`. No hay suite de tests; probar por API o UI.

## Arquitectura

- `src/server.js` es el unico entrypoint: carga dotenv, sirve `public/` y `uploads/` (bajo `/uploads`), monta los routers y centraliza el manejo de errores.
- `src/db.js` crea el pool `mysql2/promise` con `dateStrings: true` y lee `process.env` al importarse. Cualquier entrypoint nuevo debe ejecutar `require('dotenv').config()` antes de importar `db.js`.
- `src/routes/estudiantes.js` y `src/routes/justificantes.js` contienen validacion y SQL directo; no hay capa de servicios ni ORM.
- `public/`: JS vanilla. `index.html` (lista, busqueda, alta de estudiantes), `form.html` (crear/editar via `?id=`), `imprimir.html?id=` (vista imprimible).
- `database.sql` es la unica fuente del esquema. No hay migraciones: los cambios se aplican a mano.
- Tablas reales: `estudiantes` y `justificantes`. No existe `tb_students`; no renombrar las consultas.

## Reglas que no romper

- El folio se genera solo en el servidor con formato `JUS-AAAAMMDD-####` y no se acepta desde el cliente.
- Solo se edita un justificante `pendiente`; `aprobado`/`rechazado` son inmutables (responde 409).
- El rechazo exige `comentario`.
- `caso_critico` exige comprobante, tanto al crear como al editar si se queda sin archivo.
- Comprobantes: solo PDF/JPG/PNG, maximo 5 MB, en `uploads/` con nombre aleatorio. La BD guarda solo el nombre; al reemplazar se borra el anterior.
- Errores de API: `{ error }` o `{ errores: string[] }`. El JS del frontend maneja ambas formas.
- La UI y los nombres de campos/columnas estan en espanol; mantenerlos asi.
