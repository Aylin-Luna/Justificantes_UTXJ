# Sistema de Justificantes Académicos — UTXJ

Aplicación web institucional para registrar, revisar, firmar, aprobar, sellar, consultar e imprimir justificantes de inasistencia académica.

- **Backend:** Node.js 18+, Express 4, MySQL 8.0, `mysql2/promise`.
- **Frontend:** HTML5, CSS institucional propio y JavaScript ES Modules (sin bundler ni CDN).
- **Base de datos:** `db_justificantes_utxj`, InnoDB, `utf8mb4`, normalizada a 3FN.
- **Seguridad:** JWT en cookie `HttpOnly`, bcrypt, CSRF de doble envío, RBAC, rate limiting, archivos privados y auditoría inmutable.

## Funcionalidades

- Login por usuario o correo con redirección por rol.
- Paneles diferenciados para alumno, tutor, directora y administrador.
- Alta de justificantes con folio automático `JUS-AAAAMMDD-####`.
- Vigencia configurable en días hábiles (5 por defecto), con catálogo de días inhábiles.
- Fechas de inasistencia, materias y docentes afectados.
- Comprobantes PDF/JPG/PNG de hasta 5 MB, con validación y almacenamiento privado.
- Flujo de revisión: tutor firma y valida; dirección aprueba o rechaza.
- Casos críticos: exigen comprobante validado para aprobar.
- Firmas electrónicas SVG y sello institucional con SHA-256.
- Rechazo con comentario obligatorio; estados finales inmutables.
- Búsqueda y filtros por folio, matrícula, nombre, estado, carrera, criticidad y fechas.
- Vista imprimible A4 con marca de agua para documentos no aprobados.
- Administración de usuarios, roles, contraseñas, parámetros, catálogos y auditoría.
- Historial de estados y bitácora de auditoría generada por triggers.

## Estructura

```text
JUSTIFICANTES_UTXJ/
├── backend/               API REST y servidor Express
│   ├── app.js
│   ├── config/            Configuración desde backend/.env
│   ├── database/          Pool y transacciones MySQL
│   ├── src/               Controllers, models, services, routes, middlewares, utils
│   ├── uploads/           Archivos privados (comprobantes, firmas, sellos)
│   └── .env.example
├── database/
│   ├── 01_create_database.sql
│   ├── 02_create_tables.sql
│   ├── 03_foreign_keys_indexes.sql
│   ├── 04_stored_procedures.sql
│   ├── 05_triggers.sql
│   ├── 06_seed_data.sql
│   └── 07_test_queries.sql
├── frontend/
│   ├── public/            index.html, app.html, imprimir.html, 404.html
│   └── src/               assets, components, views, api, auth, main, print, ui
├── diagrams/              ERD Mermaid + ERD HTML interactivo
├── documentation/         Arquitectura, diseño, reglas, seguridad, API, manual
├── scripts/               Generadores de ERD, diccionario y archivos demo
├── legacy/                Código y respaldo de la versión anterior
├── package.json           Scripts de operación
└── README.md
```

## Requisitos

- Node.js 18 o superior.
- MySQL Server 8.0.
- MySQL Workbench 8.0 (opcional, para administrar la base).
- Sistema operativo Windows, Linux o macOS.

## Instalación paso a paso

### 1. Obtener el proyecto

```bash
git clone <url-del-repositorio>
cd JUSTIFICANTES_UTXJ
```

Si ya tiene la carpeta, sitúese en ella.

### 2. Crear la base de datos

El esquema se compone de seis archivos que deben ejecutarse **en orden**:

| Orden | Archivo | Contenido |
| ---: | --- | --- |
| 1 | `database/01_create_database.sql` | Crea `db_justificantes_utxj` con `utf8mb4`. |
| 2 | `database/02_create_tables.sql` | Tablas, columnas, comentarios y restricciones iniciales. |
| 3 | `database/03_foreign_keys_indexes.sql` | Llaves foráneas e índices. |
| 4 | `database/04_stored_procedures.sql` | Función y procedimientos almacenados. |
| 5 | `database/05_triggers.sql` | Triggers de integridad, historial y auditoría. |
| 6 | `database/06_seed_data.sql` | Datos ficticios de demostración. |

#### Opción A — MySQL Workbench 8.0 (recomendada en Windows)

1. Abra **MySQL Workbench 8.0** y conéctese a su servidor MySQL (`localhost` o `127.0.0.1`).
2. Verifique la conexión: en la barra superior debe aparecer el servidor activo.
3. Abra cada archivo en orden:
   - **File → Open SQL Script…**
   - Seleccione `database/01_create_database.sql`.
4. Ejecute el script completo con el botón **Execute** (rayo) o `Ctrl + Shift + Enter`.
5. Repita los pasos 3 y 4 con `02`, `03`, `04`, `05` y `06`.
6. Refresque el panel **SCHEMAS** (botón de recarga) y confirme que existe `db_justificantes_utxj` con sus 25 tablas.
7. Opcional: abra `database/07_test_queries.sql` y ejecútelo. Debe terminar con **37/37 pruebas correctas** y el mensaje `TODO OK`.

> **Codificación:** Workbench 8.0 usa `utf8mb4` por defecto. Si los acentos se ven mal, ejecute `SET NAMES utf8mb4;` al inicio de la pestaña y vuelva a abrir el archivo. No pegue los scripts en una consola de Windows que no sea UTF-8.

#### Opción B — Cliente `mysql` (PowerShell, CMD o Bash)

```bash
mysql --default-character-set=utf8mb4 -u root -p -e "source database/01_create_database.sql"
mysql --default-character-set=utf8mb4 -u root -p -e "source database/02_create_tables.sql"
mysql --default-character-set=utf8mb4 -u root -p -e "source database/03_foreign_keys_indexes.sql"
mysql --default-character-set=utf8mb4 -u root -p -e "source database/04_stored_procedures.sql"
mysql --default-character-set=utf8mb4 -u root -p -e "source database/05_triggers.sql"
mysql --default-character-set=utf8mb4 -u root -p -e "source database/06_seed_data.sql"
mysql --default-character-set=utf8mb4 -u root -p -e "source database/07_test_queries.sql"
```

Si su servidor usa otro puerto:

```bash
mysql --default-character-set=utf8mb4 -h 127.0.0.1 -P 40235 -u root -p -e "source database/01_create_database.sql"
```

> En PowerShell **no** use `Get-Content archivo.sql | mysql`; la tubería puede corromper los acentos. Use `source` como se muestra arriba.

### 3. Configurar variables de entorno

```bash
copy backend\.env.example backend\.env
```

En Linux/macOS:

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env`:

```env
NODE_ENV=development
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=su_contraseña
DB_NAME=db_justificantes_utxj
JWT_SECRET=una-cadena-larga-y-aleatoria
COOKIE_SECURE=false
CORS_ORIGIN=http://localhost:3000
```

- `DB_PORT` debe coincidir con el puerto real de MySQL (por ejemplo `3306` o `40235`).
- En producción use `COOKIE_SECURE=true`, HTTPS y un `JWT_SECRET` de 64+ caracteres.
- El archivo `backend/.env` está ignorado por Git.

### 4. Instalar dependencias

Desde la raíz:

```bash
npm install
npm run setup
```

`npm install` instala las dependencias de los scripts de mantenimiento. `npm run setup` instala las del backend (`express`, `mysql2`, `bcryptjs`, `helmet`, etc.).

También puede hacerlo directamente:

```bash
cd backend
npm install
```

### 5. Ejecutar

```bash
npm start
```

o en modo desarrollo con recarga automática:

```bash
npm run dev
```

Abra **http://localhost:3000**.

### 6. Verificar

- Salud del servicio: **http://localhost:3000/api/health** → `{"ok":true,...}`.
- Consultas de prueba: ejecute `database/07_test_queries.sql`; debe mostrar `TODO OK` y 37/37.
- Archivos demo: si faltan comprobantes, firmas o sellos de ejemplo, ejecute:

```bash
npm run demo:files
```

## Usuarios demo

| Perfil | Usuario | Contraseña | Acceso principal |
| --- | --- | --- | --- |
| Alumno | `alumno` | `Alumno123!` | Crear y consultar sus justificantes |
| Tutor educativo | `tutor` | `Tutor123!` | Revisar, firmar y validar comprobantes |
| Directora de carrera | `directora` | `Directora123!` | Aprobar, rechazar, firmar y sellar |
| Administrador | `admin` | `Admin123!` | Usuarios, configuración y auditoría |

> Son credenciales ficticias de demostración. Cámbielas antes de un despliegue real.

## Registro público de alumnos

Desde la pantalla de acceso, la pestaña **Crear cuenta** permite que un alumno genere su
propia cuenta sin intervención del administrador:

1. Capture matrícula, nombre(s), apellidos, correo, teléfono opcional, carrera, grupo,
   usuario y contraseña.
2. Si la matrícula no existe, el sistema crea el expediente en `tb_students`.
3. Si la matrícula ya existe en Control Escolar y aún no tiene cuenta, solo se vincula
   cuando el correo capturado coincide exactamente con el registrado en el expediente.
4. Se crea el usuario con contraseña bcrypt y se le asigna únicamente el rol `alumno`.
5. Al terminar, la sesión se inicia automáticamente y se redirige al panel del alumno.

Reglas del registro:

- Solo se pueden auto-registrar alumnos; tutores, dirección y administración se crean
  desde el módulo de usuarios o directamente en la base de datos.
- No se permite apropiarse de un expediente existente sin la coincidencia de matrícula y
  correo, ni registrar matrículas, usuarios o correos duplicados.
- La contraseña debe tener al menos 8 caracteres e incluir letras y números.
- La ruta está limitada por rate limiting para evitar registros masivos.

## Flujo resumido

```text
Alumno crea (pendiente)
   │
   ├─ Adjunta comprobante (si aplica)
   ▼
Tutor revisa (en_revision), valida comprobante y firma
   │
   ▼
Directora firma y aprueba (aprobado + sello)  ──►  Impresión oficial
   │
   └─ Rechaza con comentario (rechazado)
```

Reglas clave:

- El folio se genera solo en el servidor.
- Solo se edita un justificante `pendiente`.
- El rechazo exige comentario.
- Un caso crítico exige comprobante validado para aprobar.
- Los estados `aprobado`, `rechazado`, `cancelado` y `vencido` son inmutables.
- Las firmas de tutor y dirección son requisitos de aprobación; la firma del padre/madre/tutor es opcional.

## API

Base: `/api`. Las rutas de escritura requieren `X-CSRF-Token`.

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/health` | Estado del servicio y MySQL. |
| POST | `/auth/login` | Inicia sesión. |
| POST | `/auth/registro` | Registro público de alumnos y sesión automática. |
| POST | `/auth/logout` | Cierra sesión. |
| GET | `/auth/me` | Usuario actual y token CSRF. |
| POST | `/auth/cambiar-password` | Cambia la contraseña propia. |
| GET | `/justificantes` | Lista paginada con filtros. |
| GET | `/justificantes/formulario` | Contexto de alta para alumno. |
| POST | `/justificantes` | Crea justificante (multipart). |
| GET | `/justificantes/:id` | Detalle completo. |
| GET | `/justificantes/:id/imprimir` | Payload de impresión. |
| PUT | `/justificantes/:id` | Edita un pendiente. |
| POST | `/justificantes/:id/revision` | Inicia revisión (tutor). |
| POST | `/justificantes/:id/firmar-tutor` | Firma del tutor. |
| POST | `/justificantes/:id/firmar-direccion` | Firma de dirección. |
| POST | `/justificantes/:id/aprobar` | Aprueba y sella. |
| POST | `/justificantes/:id/rechazar` | Rechaza con comentario. |
| POST | `/justificantes/:id/cancelar` | Cancela un pendiente. |
| POST | `/justificantes/:id/documentos` | Carga comprobante. |
| POST | `/justificantes/:id/documentos/:docId/validar` | Valida/rechaza comprobante. |
| DELETE | `/justificantes/:id/documentos/:docId` | Elimina comprobante. |
| GET | `/justificantes/:id/documentos/:docId/archivo` | Descarga privada. |
| GET | `/dashboard` | Indicadores por rol. |
| GET | `/catalogos` | Catálogos y ajustes públicos. |
| GET | `/catalogos/registro` | Carreras y grupos activos para el registro público. |
| GET | `/usuarios` | Lista de usuarios (admin). |
| PATCH | `/usuarios/:id/roles` | Cambia roles (admin). |
| PATCH | `/usuarios/:id/estado` | Activa/desactiva (admin). |
| PATCH | `/usuarios/:id/password` | Restablece contraseña (admin). |
| GET | `/auditoria` | Bitácora filtrada (admin). |
| GET | `/auditoria/resumen` | Resumen de auditoría (admin). |

La referencia completa, con cuerpos y parámetros, está en [`documentation/api.md`](documentation/api.md).

## Seguridad

- Contraseñas con `bcrypt`, nunca en texto plano ni MD5.
- JWT en cookie `HttpOnly`, `SameSite=Strict`; `Secure` en producción.
- CSRF de doble envío: cookie `utxj_csrf` + cabecera `X-CSRF-Token`.
- Autorización por rol y por carrera.
- Rate limiting global, de login y de escritura.
- `helmet` con CSP estricta (sin CDN).
- Archivos privados servidos solo por endpoints autenticados.
- Comprobantes de 5 MB máx., PDF/JPG/PNG, con validación de tipo y SHA-256.
- Auditoría inmutable por triggers; los estados finales no se modifican.
- `backend/.env` ignorado por Git.

Detalle en [`documentation/seguridad.md`](documentation/seguridad.md).

## Base de datos

- 25 tablas en 3FN, 43 llaves foráneas, 235 columnas.
- Folio diario transaccional con `sp_generar_folio`.
- Vigencia en días hábiles con `fn_calcular_vigencia_habiles`.
- Transiciones validadas por `sp_cambiar_estado_justificante`.
- Triggers de historial y auditoría.
- Diccionario completo: [`documentation/diccionario_datos.md`](documentation/diccionario_datos.md).
- Diagramas: [`diagrams/entity_relationship.md`](diagrams/entity_relationship.md) y [`diagrams/erd.html`](diagrams/erd.html).

Regenere la documentación desde la base viva:

```bash
npm run docs
```

## Vista imprimible

- URL: `/imprimir?id=<id>`.
- Formato A4 vertical, una página.
- Muestra encabezado institucional, datos del alumno, fechas, materias, firmas y sello.
- Si el estado no es `aprobado`, aparece la marca de agua **VISTA PREVIA**.
- El documento aprobado incluye firmas de tutor y dirección, sello y pie de verificación.

> El archivo `JUSTIFICANTE.pdf` de referencia llegó con **0 bytes**, por lo que el formato se reconstruyó con los campos del sistema y el diseño institucional. Si se requiere una reproducción exacta, vuelva a cargar el PDF con contenido. Supuestos completos en [`documentation/supuestos_impresion.md`](documentation/supuestos_impresion.md).

## Documentación

| Documento | Contenido |
| --- | --- |
| [`documentation/arquitectura.md`](documentation/arquitectura.md) | Capas, flujo, estructura y despliegue. |
| [`documentation/diseno_base_datos.md`](documentation/diseno_base_datos.md) | Modelo, integridad, índices, SP y triggers. |
| [`documentation/diccionario_datos.md`](documentation/diccionario_datos.md) | Diccionario generado de las 25 tablas. |
| [`documentation/reglas_negocio.md`](documentation/reglas_negocio.md) | Reglas, estados, permisos y errores. |
| [`documentation/seguridad.md`](documentation/seguridad.md) | Controles y checklist de producción. |
| [`documentation/api.md`](documentation/api.md) | Referencia de endpoints. |
| [`documentation/manual_uso.md`](documentation/manual_uso.md) | Guía por rol. |
| [`documentation/supuestos_impresion.md`](documentation/supuestos_impresion.md) | Supuestos del formato imprimible. |

## Scripts

| Comando | Función |
| --- | --- |
| `npm start` | Inicia el servidor. |
| `npm run dev` | Servidor con recarga automática. |
| `npm run setup` | Instala dependencias del backend. |
| `npm run check` | Verifica la sintaxis del entrypoint. |
| `npm run erd` | Regenera el ERD Mermaid y HTML. |
| `npm run docs:data` | Regenera el diccionario de datos. |
| `npm run docs` | Ejecuta ambos generadores. |
| `npm run demo:files` | Genera PDFs, firmas, sellos y logo demo. |

## Solución de problemas

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `/api/health` responde 500 | MySQL no conecta o falta la base | Revise `backend/.env`, inicie MySQL y ejecute `01`–`06`. |
| `Access denied for user` | Usuario/contraseña incorrectos | Ajuste `DB_USER` y `DB_PASSWORD`. |
| `Unknown database` | No se creó la base | Ejecute `database/01_create_database.sql`. |
| Acentos corruptos | Codificación del cliente | Use `--default-character-set=utf8mb4` o Workbench 8.0. |
| `Table ... doesn't exist` | Scripts incompletos o fuera de orden | Ejecute `01`–`06` en orden. |
| Error `Cannot access 'dialog'` | Caché de un JS antiguo | Recargue con `Ctrl + F5`. |
| No aparece el logo | Falta el asset | Ejecute `npm run demo:files` o verifique `frontend/src/assets/img/logo-utxj.svg`. |
| No se ven comprobantes demo | Faltan archivos en `backend/uploads` | Ejecute `npm run demo:files`. |
| La sesión expira | JWT de 8 h o cambio de fecha del sistema | Inicie sesión de nuevo. |
| `429 Too Many Requests` | Rate limit | Espere la ventana o reinicie el servidor. |

## Versión anterior

La carpeta `legacy/` conserva el código, los SQL y el respaldo de la base de la versión previa (`legacy/db_justificantes_utxj_backup_20261031.sql`, `legacy/README_OLD.md`). No forma parte del runtime actual; se mantiene como respaldo.

## Licencia y uso

Proyecto académico para la Universidad Tecnológica de Xicotepec de Juárez. Los datos incluidos en `database/06_seed_data.sql` son ficticios y solo sirven para demostración.
