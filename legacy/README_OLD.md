# Justificantes UTXJ

Sistema web para registrar, consultar, aprobar y rechazar justificantes academicos.

## Tecnologias

- Frontend: HTML5, CSS3, JavaScript y Bootstrap 5 (CDN)
- Backend: Node.js 18+ y Express
- Base de datos: MySQL 8.0 (`db_justificantes_utxj`)
- Dependencias: express, mysql2, dotenv, multer

## Instalacion

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear la base de datos:

   ```bash
   mysql -u root -p < database.sql
   ```

   En PowerShell usa: `Get-Content database.sql | mysql -u root -p`

3. Configurar variables de entorno:

   ```bash
   cp .env.example .env
   ```

   Editar `.env` con el usuario y contrasena de MySQL.

4. Ejecutar:

   ```bash
   npm run dev
   ```

   Abrir http://localhost:3000

## Verificacion

- Salud del servidor y conexion a MySQL: http://localhost:3000/api/health
- Los comprobantes se guardan en `uploads/` y se sirven en `/uploads/<archivo>`.

## Problemas de conexion

- `MySQL rechazo las credenciales`: revisar `DB_USER` y `DB_PASSWORD` en `.env`.
- `No se pudo conectar a MySQL`: el servicio MySQL no esta activo o `DB_HOST`/`DB_PORT` son incorrectos.
- `La base de datos indicada en DB_NAME no existe`: crear `db_justificantes_utxj` con `database.sql`.
- `No existe la tabla ...` o `No existe la columna ...`: el esquema no coincide; revisar `database.sql`.

## Funcionalidades

- Registro de estudiantes (matricula unica).
- Alta de justificantes con folio automatico `JUS-AAAAMMDD-####`.
- Busqueda por folio, matricula o nombre, y filtro por estado.
- Edicion de solicitudes pendientes.
- Aprobacion o rechazo (el rechazo exige comentario).
- Vista imprimible del justificante en `/imprimir.html?id=<id>`.
- Comprobante PDF/JPG/PNG de maximo 5 MB; obligatorio si el caso es critico.

## API

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| GET | `/api/health` | Estado del servidor y MySQL |
| GET | `/api/estudiantes?q=` | Lista o busca estudiantes |
| GET | `/api/estudiantes/:matricula` | Consulta por matricula |
| POST | `/api/estudiantes` | Registra estudiante |
| GET | `/api/justificantes?q=&estado=` | Lista o busca justificantes |
| GET | `/api/justificantes/:id` | Consulta por id |
| POST | `/api/justificantes` | Crea justificante (multipart) |
| PUT | `/api/justificantes/:id` | Edita justificante pendiente (multipart) |
| PATCH | `/api/justificantes/:id/estado` | Aprueba o rechaza |

## Reglas de negocio

- Un justificante solo se edita mientras su estado sea `pendiente`.
- Un justificante resuelto (`aprobado` o `rechazado`) no se puede modificar.
- El rechazo requiere `comentario`.
- El folio se genera en el servidor; no se recibe desde el cliente.

## Estructura

```text
database.sql          Esquema y datos de ejemplo
src/server.js         Express, estaticos y manejo de errores
src/db.js             Pool mysql2/promise
src/routes/           Endpoints de estudiantes y justificantes
public/               Paginas HTML, CSS y JS del frontend
uploads/              Comprobantes subidos (ignorados por git)
```
