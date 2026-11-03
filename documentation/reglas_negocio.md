# Reglas de negocio — Sistema de Justificantes Académicos UTXJ

Este documento describe las reglas funcionales que el sistema aplica en la base de datos, la API y la interfaz. Cuando una regla se valida en más de una capa, la base de datos es la última línea de defensa.

## 1. Actores y alcance

| Rol | Código | Alcance funcional |
| --- | --- | --- |
| Alumno | `alumno` | Crea, consulta, edita y cancela sus propios justificantes; adjunta comprobantes; descarga e imprime sus documentos. |
| Tutor educativo | `tutor` | Consulta los justificantes de las carreras que tiene asignadas; inicia revisión, firma, valida o rechaza comprobantes. |
| Directora de carrera | `directora` | Consulta las carreras asignadas; firma dirección, aprueba, rechaza y aplica el sello institucional. |
| Administrador | `admin` | Alcance institucional completo; administra usuarios, roles, parámetros, catálogos y auditoría; puede vencer justificantes. |

Un usuario puede tener más de un rol. Los permisos se suman, pero las reglas de estado y propiedad se siguen aplicando. El alcance por carrera se determina con `tb_academic_staff.id_career`; un registro sin carrera otorga alcance institucional.

## 2. Estados del justificante

| Código | Nombre | ¿Final? | Descripción |
| --- | --- | --- | --- |
| `pendiente` | Pendiente | No | Creado por el alumno, editable y cancelable. |
| `en_revision` | En revisión | No | El tutor inició la revisión o registró su firma. |
| `aprobado` | Aprobado | Sí | Firmado por tutor y dirección, con sello institucional. |
| `rechazado` | Rechazado | Sí | Requiere comentario de rechazo. |
| `cancelado` | Cancelado | Sí | El alumno o un administrador canceló el trámite. |
| `vencido` | Vencido | Sí | Justificante aprobado cuya vigencia expiró. |

### Transiciones permitidas

| Desde | Hacia | Quién | Condición |
| --- | --- | --- | --- |
| `pendiente` | `en_revision` | Tutor | Inicio explícito de revisión o firma del tutor. |
| `pendiente` | `cancelado` | Alumno propietario / admin | Sin requisitos adicionales. |
| `en_revision` | `aprobado` | Directora | Firma de tutor registrada; caso crítico con comprobante validado; se genera firma de dirección y sello. |
| `en_revision` | `rechazado` | Directora | Comentario obligatorio de al menos 5 caracteres. |
| `en_revision` | `cancelado` | Admin | Cancelación administrativa. |
| `aprobado` | `vencido` | Proceso automático / admin | Se alcanzó `expires_at` sin prórroga. |

Cualquier otra transición se rechaza con HTTP `409`. Los estados finales son inmutables: no se editan, no se vuelven a firmar y no se les agregan comprobantes.

## 3. Creación del justificante

1. Solo un usuario con rol `alumno` y estudiante activo asociado puede crear.
2. El folio **no se recibe del cliente**. Se genera en el servidor dentro de una transacción con el formato `JUS-AAAAMMDD-####`.
3. La fecha de emisión es la fecha actual del servidor.
4. El motivo textual es obligatorio, con mínimo 10 y máximo 2 000 caracteres.
5. El motivo del catálogo (`motivo_id`) debe existir y estar activo.
6. La fecha inicial y final son obligatorias, con `fecha_fin >= fecha_inicio`.
7. No se permiten fechas futuras.
8. El periodo no puede exceder **60 días naturales** ni iniciar hace más de **365 días**.
9. Las fechas de inasistencia se deducen del periodo omitiendo sábados y domingos cuando el cliente no las envía; también pueden enviarse explícitamente.
10. Cada fecha de inasistencia debe estar dentro del periodo y no puede ser futura. Se permiten hasta 60 fechas.
11. Las materias deben pertenecer a la carrera del alumno. Si se indica docente, debe existir y estar activo.
12. Cada combinación materia–docente–fecha se registra una sola vez.
13. Si el motivo exige comprobante o el caso es crítico, el archivo es obligatorio al crear.
14. La vigencia se calcula en días hábiles a partir del catálogo de días inhábiles.

## 4. Edición

- Solo se edita un justificante en estado `pendiente`.
- Solo el alumno propietario o un administrador pueden editar.
- Un justificante en `en_revision` o en estado final responde `409`.
- Si el justificante es crítico o el motivo exige comprobante y no tiene archivo, se debe adjuntar uno en la misma operación.
- Cada edición incrementa `tb_justifications.version`; el historial y la auditoría conservan el cambio.
- El folio, la fecha de emisión y el estudiante no cambian.

## 5. Comprobantes

| Regla | Valor |
| --- | --- |
| Formatos permitidos | PDF, JPG, JPEG, PNG |
| Tamaño máximo | 5 MB |
| Validación de contenido | Firma binaria del archivo y extensión |
| Almacenamiento | Directorio privado fuera de `public/`; nombre aleatorio |
| Metadatos en BD | Nombre original, nombre almacenado, ruta, MIME, extensión, tamaño, SHA-256 |
| Acceso | Descarga autenticada y autorizada; nunca por URL pública |
| Reemplazo | Se elimina el archivo anterior cuando corresponde |
| Validación | `pendiente`, `validado` o `rechazado`; el rechazo exige observaciones |

Un caso crítico solo puede aprobarse si tiene al menos un comprobante con `validation_status = 'validado'`. El tutor o la directora validan el comprobante; el alumno y el administrador pueden eliminarlo si el expediente no está resuelto y no es el único comprobante exigido.

## 6. Firmas y sello

- La firma del **tutor educativo** es requisito para aprobar.
- La firma de **dirección de carrera** se genera automáticamente al aprobar si aún no existe.
- La firma del **padre, madre o tutor** es opcional y no bloquea el flujo.
- Las firmas se generan como SVG en el servidor a partir del nombre, rol, fecha y folio; se guardan en almacenamiento privado con SHA-256.
- Una firma registrada no puede sustituirse (`409`).
- Al aprobar se aplica un **sello institucional** único por justificante, también con SHA-256.
- La dirección solo puede firmar un expediente en `en_revision`.
- El tutor puede firmar un expediente `pendiente`; al hacerlo, el sistema lo pasa a `en_revision`.

## 7. Aprobación y rechazo

### Aprobación

1. El expediente debe estar en `en_revision`.
2. Debe existir la firma del tutor educativo.
3. Si es crítico, debe existir un comprobante validado.
4. Se registra la firma de dirección si falta.
5. Se aplica el sello institucional.
6. El estado cambia a `aprobado` y el expediente queda inmutable.
7. El comentario de aprobación es opcional (máximo 500 caracteres).

### Rechazo

1. Se permite desde `pendiente` o `en_revision`.
2. Solo la directora de carrera puede rechazar el justificante.
3. El comentario es obligatorio, con mínimo 5 y máximo 500 caracteres.
4. El estado cambia a `rechazado` y el expediente queda inmutable.

## 8. Cancelación

- El alumno propietario puede cancelar un justificante `pendiente`.
- El administrador puede cancelar un justificante `pendiente` o `en_revision`.
- El comentario es opcional; si se omite se registra “Cancelado por el alumno”.
- Un expediente cancelado es final.

## 9. Vigencia y vencimiento

- La vigencia predeterminada es de **5 días hábiles**, configurable en `tb_system_settings.validity_days`.
- El cálculo omite sábados, domingos y los días registrados en `tb_non_working_days` para la institución.
- `expires_at` se calcula al crear y se conserva en la base de datos.
- El proceso automático revisa periódicamente los justificantes `aprobado` cuya fecha de vigencia ya pasó y los marca como `vencidos`.
- Un administrador puede ejecutar el vencimiento manualmente desde el panel.

## 10. Folio institucional

- Formato: `JUS-AAAAMMDD-####` (prefijo configurable, fecha de emisión y consecutivo diario).
- Se genera exclusivamente en el servidor mediante `sp_generar_folio`.
- La secuencia diaria se bloquea con `SELECT ... FOR UPDATE` dentro de una transacción.
- La columna `folio` es única; un fallo de concurrencia no produce duplicados.
- El folio no se modifica al editar.

## 11. Privacidad y datos personales

- Los comprobantes médicos y documentos sensibles son privados por defecto (`is_private = 1`).
- No se sirven desde una carpeta pública; se transmiten con `Content-Disposition` y tipo MIME controlado.
- Las firmas y sellos se guardan en almacenamiento privado y solo se incorporan a la vista imprimible para usuarios autorizados.
- La bitácora de auditoría no se expone en la API pública; solo el rol `admin` consulta el resumen y los eventos.
- Los datos de menores y tutores se limitan a lo necesario para el trámite.

## 12. Matriz de permisos

| Operación | Alumno propietario | Tutor | Directora | Admin |
| --- | :---: | :---: | :---: | :---: |
| Crear justificante | Sí | No | No | No |
| Ver justificante | Sí | Carreras asignadas | Carreras asignadas | Todos |
| Editar `pendiente` | Sí | No | No | Sí |
| Cancelar `pendiente` | Sí | No | No | Sí |
| Iniciar revisión | No | Sí | No | No |
| Firmar tutor | No | Sí | No | No |
| Firmar dirección | No | No | Sí | No |
| Validar comprobante | No | Sí | Sí | No |
| Aprobar | No | No | Sí | No |
| Rechazar | No | No | Sí | No |
| Descargar comprobante | Sí | Carreras asignadas | Carreras asignadas | Todos |
| Gestionar usuarios | No | No | No | Sí |
| Editar configuración | No | No | No | Sí |
| Consultar auditoría | No | No | No | Sí |

## 13. Errores esperados

| Código | Situación |
| --- | --- |
| `400` | Datos inválidos, archivo faltante o formato incorrecto. |
| `401` | Sesión ausente o expirada. |
| `403` | Rol insuficiente, fuera de alcance o CSRF inválido. |
| `404` | Recurso inexistente o fuera del alcance del usuario. |
| `409` | Conflicto de estado o firma ya registrada. |
| `422` | Regla de negocio incumplida (caso crítico sin comprobante validado, estudiante inactivo). |
| `429` | Límite de intentos o de solicitudes excedido. |
| `500` | Error interno no controlado. |

Las respuestas de error usan `{ "error": "..." }` o `{ "errores": ["..."] }`; el frontend maneja ambas formas.
