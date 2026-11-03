# Referencia de la API — Justificantes UTXJ

Base URL: `http://localhost:3000/api` (configurable con `PORT`).

Todas las respuestas son JSON salvo la descarga de comprobantes. Las rutas marcadas con 🔒 requieren sesión; con 🔐 requieren uno o más roles.

## Autenticación y CSRF

- La sesión se transporta en la cookie `utxj_sesion` (`HttpOnly`, `SameSite=Strict`).
- Al iniciar sesión se emite también la cookie `utxj_csrf`.
- Toda petición de escritura (`POST`, `PUT`, `PATCH`, `DELETE`) debe enviar la cabecera `X-CSRF-Token` con el valor de `utxj_csrf`, **excepto** `/auth/login` y `/auth/registro`.
- El cliente puede obtener un token actualizado en `GET /auth/me`.

### `POST /auth/login`

```json
{
  "usuario": "alumno",
  "password": "Alumno123!"
}
```

`usuario` también acepta el correo. Respuesta:

```json
{
  "mensaje": "Sesión iniciada correctamente",
  "usuario": { "id": 1, "username": "alumno", "roles": ["alumno"], "...": "..." },
  "csrfToken": "…"
}
```

### `POST /auth/registro`

Registro público de alumnos. No requiere sesión ni token CSRF (igual que el login) y está
limitado por rate limiting. Crea el expediente si la matrícula no existe o lo vincula si
la matrícula y el correo coinciden con un expediente sin cuenta.

```json
{
  "matricula": "240545",
  "nombres": "Ana Sofía",
  "apellido_paterno": "López",
  "apellido_materno": "García",
  "correo": "240545@utxicotepec.edu.mx",
  "telefono": "7641000009",
  "id_carrera": 1,
  "id_grupo": 1,
  "usuario": "ana.lopez",
  "password": "Alumna2026!",
  "confirmar_password": "Alumna2026!"
}
```

Respuesta `201` con la misma estructura del login (`mensaje`, `usuario`, `csrfToken`) y la
cookie de sesión ya emitida. Errores habituales: `400` por validaciones y `409` cuando la
matrícula, el usuario o el correo ya están en uso, o cuando el expediente no puede
vincularse de forma segura.

### `POST /auth/logout` 🔒

Cierra la sesión y limpia cookies.

### `GET /auth/me` 🔒

Devuelve `{ usuario, csrfToken }`.

### `POST /auth/cambiar-password` 🔒

```json
{ "password_actual": "…", "password_nueva": "…" }
```

La nueva contraseña debe tener al menos 8 caracteres, letras y números.

## Salud

### `GET /health`

```json
{ "ok": true, "service": "justificantes-utxj", "version": "2.0.0", "database": "db_justificantes_utxj", "time": "…" }
```

## Justificantes

### `GET /justificantes` 🔒

Lista paginada con alcance por rol.

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| `page` | entero | Página, desde 1. |
| `limit` | entero | Tamaño de página, 1–100 (15 por defecto). |
| `estado` | texto | `pendiente`, `en_revision`, `aprobado`, `rechazado`, `cancelado`, `vencido`. |
| `folio` | texto | Búsqueda parcial por folio. |
| `matricula` | texto | Búsqueda parcial por matrícula. |
| `buscar` | texto | Folio, matrícula o nombre completo. |
| `carrera` | entero | Identificador de carrera. |
| `criticos` | booleano | Solo casos críticos. |
| `desde` / `hasta` | fecha `YYYY-MM-DD` | Rango de periodo. |
| `pendientes` | booleano | Solo `pendiente` y `en_revision`. |

Respuesta: `{ items, total, page, limit, pages }`.

### `GET /justificantes/formulario` 🔒 alumno

Devuelve el contexto para crear: estudiante, carrera, materias, motivos, tipos de documento, tutores y ajustes.

### `POST /justificantes` 🔒 alumno · `multipart/form-data`

| Campo | Tipo | Obligatorio | Descripción |
| --- | --- | :---: | --- |
| `motivo_id` | entero | Sí | Motivo del catálogo. |
| `motivo` | texto | Sí | Descripción, mínimo 10 caracteres. |
| `observaciones` | texto | No | Máximo 2 000 caracteres. |
| `fecha_inicio` | fecha | Sí | `YYYY-MM-DD`. |
| `fecha_fin` | fecha | Sí | `YYYY-MM-DD`, no futura. |
| `caso_critico` | booleano | No | `1`, `true`, `on`. |
| `fechas` | JSON | No | Arreglo de fechas de inasistencia. |
| `materias` | JSON | No | `[{"materia_id":1,"docente_id":2}]`. |
| `tipo_documento_id` | entero | No | Tipo del comprobante. |
| `archivo` | archivo | Condicional | Obligatorio si el motivo o caso crítico lo exige. |

Respuesta `201`: `{ mensaje, justificante }`.

### `GET /justificantes/:id` 🔒

Detalle completo: estudiante, carrera, fechas, materias, documentos, firmas, sello e historial.

### `GET /justificantes/:id/imprimir` 🔒

Payload de la vista imprimible, con firmas y sello como SVG y datos institucionales.

### `PUT /justificantes/:id` 🔒 alumno propietario / admin · `multipart/form-data`

Mismos campos que la creación. Solo en estado `pendiente`. Si se envía `archivo`, se agrega un comprobante.

### `POST /justificantes/:id/revision` 🔒 tutor

Pasa de `pendiente` a `en_revision`. Si ya está en revisión, es idempotente.

### `POST /justificantes/:id/firmar-tutor` 🔒 tutor

Registra la firma del tutor educativo. Si el expediente estaba `pendiente`, lo pasa a `en_revision`.

### `POST /justificantes/:id/firmar-direccion` 🔒 directora

Registra la firma de dirección. Requiere estado `en_revision`.

### `POST /justificantes/:id/aprobar` 🔒 directora

```json
{ "comentario": "Opcional, máximo 500 caracteres" }
```

Requiere firma de tutor y, en casos críticos, comprobante validado. Genera firma de dirección y sello si faltan.

### `POST /justificantes/:id/rechazar` 🔒 directora

```json
{ "comentario": "Motivo del rechazo (mínimo 5 caracteres)" }
```

### `POST /justificantes/:id/cancelar` 🔒 alumno propietario / admin

```json
{ "comentario": "Opcional" }
```

Solo desde `pendiente`.

### `POST /justificantes/:id/documentos` 🔒 alumno/tutor/directora/admin · `multipart/form-data`

| Campo | Tipo | Obligatorio |
| --- | --- | :---: |
| `archivo` | PDF/JPG/PNG ≤ 5 MB | Sí |
| `tipo_documento_id` | entero | No (usa “Otro” si se omite) |

### `POST /justificantes/:id/documentos/:documentId/validar` 🔒 tutor/directora

```json
{ "estado": "validado", "notas": "Opcional; obligatorio si se rechaza" }
```

Valores de `estado`: `pendiente`, `validado`, `rechazado`.

### `DELETE /justificantes/:id/documentos/:documentId` 🔒 alumno propietario / admin

No permite eliminar el único comprobante de un expediente que lo exige ni documentos de expedientes finales.

### `GET /justificantes/:id/documentos/:documentId/archivo` 🔒

Descarga el archivo con `Content-Disposition: attachment` y tipo MIME controlado.

### `POST /justificantes/:id/vencer` 🔒 admin

Marca el justificante como vencido si corresponde.

## Panel

### `GET /dashboard` 🔒

Indicadores y colas de trabajo según el rol: totales por estado, pendientes de revisión, por aprobar, críticos, documentos pendientes de validación y actividad reciente.

### `POST /dashboard/vencer` 🔒 admin

Ejecuta el proceso de vencimiento de aprobados.

## Catálogos

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/catalogos` 🔒 | Todos los catálogos y ajustes públicos. |
| GET | `/catalogos/registro` | Carreras y grupos activos para el formulario público de registro. |
| GET | `/catalogos/institucion` 🔒 | Institución. |
| GET | `/catalogos/carreras` 🔒 | Carreras. |
| GET | `/catalogos/grupos?carrera=` 🔒 | Grupos, opcionalmente por carrera. |
| GET | `/catalogos/materias?carrera=` 🔒 | Materias. |
| GET | `/catalogos/docentes?carrera=` 🔒 | Docentes. |
| GET | `/catalogos/motivos` 🔒 | Motivos. |
| GET | `/catalogos/tipos-documento` 🔒 | Tipos de comprobante. |
| GET | `/catalogos/estados` 🔒 | Estados. |
| GET | `/catalogos/dias-inhabiles` 🔒 | Días inhábiles. |
| GET | `/catalogos/roles` 🔐 admin | Roles disponibles. |
| GET | `/catalogos/configuracion` 🔐 admin | Parámetros del sistema. |
| PUT | `/catalogos/configuracion/:key` 🔐 admin | Actualiza un parámetro. Body: `{ "valor": "…" }`. |

## Usuarios

Todas las rutas requieren rol `admin`.

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/usuarios?buscar=&rol=&activo=` | Lista usuarios. Respuesta `{ usuarios, total }`. |
| GET | `/usuarios/resumen` | Totales por rol, estado y actividad. |
| PATCH | `/usuarios/:id/estado` | Body `{ "activo": true|false }`. No permite autodesactivarse. |
| PATCH | `/usuarios/:id/roles` | Body `{ "roles": ["tutor","directora"] }`. No permite retirar el propio rol admin. |
| PATCH | `/usuarios/:id/password` | Body `{ "password": "Nueva123!" }`. Mínimo 8, letras y números. |

## Auditoría

Todas las rutas requieren rol `admin`.

### `GET /auditoria`

| Parámetro | Descripción |
| --- | --- |
| `page`, `limit` | Paginación (25 por defecto). |
| `tabla` | Tabla auditada. |
| `operacion` | `INSERT`, `UPDATE`, `DELETE`. |
| `usuario` | Identificador de usuario. |
| `buscar` | Texto libre en la descripción. |
| `desde`, `hasta` | Rango de fechas. |

Respuesta: `{ items, total, page, limit, pages }`.

### `GET /auditoria/resumen`

Devuelve `{ resumen, tablas }` con conteos por operación, tabla y actividad reciente.

## Formato de errores

```json
{ "error": "Mensaje descriptivo" }
```

```json
{ "errores": ["El motivo es obligatorio", "La fecha final no puede ser anterior"] }
```

## Códigos de estado

| Código | Uso |
| --- | --- |
| `200` | Operación exitosa. |
| `201` | Recurso creado. |
| `400` | Validación de entrada. |
| `401` | Sin sesión o sesión expirada. |
| `403` | Sin permiso, fuera de alcance o CSRF inválido. |
| `404` | Recurso inexistente o inaccesible. |
| `409` | Conflicto de estado o duplicado. |
| `422` | Regla de negocio incumplida. |
| `429` | Demasiadas solicitudes o intentos. |
| `500` | Error interno. |
