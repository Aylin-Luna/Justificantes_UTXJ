# Diseño de base de datos — Sistema de Justificantes Académicos UTXJ

## Objetivo
Normalizar la información del trámite de justificantes académicos a Tercera Forma Normal (3FN), garantizar integridad referencial, trazabilidad y soporte al flujo institucional.

## Alcance
Base de datos `db_justificantes_utxj`, MySQL 8.0, InnoDB, `utf8mb4_unicode_ci`, con llaves primarias, foráneas, índices, procedimientos almacenados, funciones, disparadores y bitácora de auditoría.

## Arquitectura lógica

### Dominios

| Dominio | Propósito | Tablas principales |
| --- | --- | --- |
| Institucional | Estructura organizativa y calendario | `tb_institutions`, `tb_careers`, `tb_groups`, `tb_non_working_days`, `tb_system_settings` |
| Personas | Alumnado, tutores, docentes y personal académico | `tb_students`, `tb_guardians`, `tb_teachers`, `tb_academic_staff` |
| Acceso | Autenticación, autorización y auditoría | `tb_users`, `tb_roles`, `tbd_user_roles`, `tb_audit_logs` |
| Académico | Oferta curricular | `tb_subjects` |
| Catálogos | Motivos, tipos, estados y secuencias | `tb_reason_types`, `tb_document_types`, `tb_justification_statuses`, `tb_folio_sequences` |
| Justificantes | Trámite, documentos, firmas, sello e historial | `tb_justifications`, `tb_justification_absences`, `tbd_justification_subjects`, `tb_supporting_documents`, `tb_justification_signatures`, `tb_institutional_stamps`, `tb_justification_status_history` |

## Entidades clave

### `tb_justifications` (entidad central)
| Campo | Tipo | Notas |
| --- | --- | --- |
| `id_justification` | BIGINT UNSIGNED PK AI | Identificador interno. |
| `folio` | VARCHAR(30) UNIQUE NOT NULL | Folio institucional generado por el servidor. |
| `id_student` | INT UNSIGNED FK NOT NULL | Estudiante solicitante. |
| `id_status` | INT UNSIGNED FK NOT NULL | Estado actual. |
| `id_reason_type` | INT UNSIGNED FK NULL | Motivo del catálogo. |
| `issue_date` | DATE NOT NULL | Fecha de emisión. |
| `start_date` | DATE NOT NULL | Inicio del periodo a justificar. |
| `end_date` | DATE NOT NULL | Fin del periodo a justificar. |
| `is_critical` | TINYINT(1) NOT NULL DEFAULT 0 | Requiere comprobante validado para aprobar. |
| `reason` | TEXT NOT NULL | Motivo libre con validación mínima. |
| `observations` | TEXT NULL | Observaciones del alumno. |
| `validity_days` | SMALLINT UNSIGNED NOT NULL DEFAULT 5 | Vigencia usada para calcular `expires_at`. |
| `expires_at` | DATE NULL | Fecha de vencimiento en días hábiles. |
| `created_by` / `updated_by` / `approved_by` / `rejected_by` | INT UNSIGNED FK NULL | Trazabilidad de responsables. |
| `resolved_at` | DATETIME NULL | Fecha de resolución (aprobado/rechazado). |
| `rejection_comment` | TEXT NULL | Obligatorio al rechazar. |
| `version` | INT UNSIGNED NOT NULL DEFAULT 1 | Control de concurrencia. |
| `deleted_at` | DATETIME NULL | Baja lógica. |

### `tb_justification_absences`
Registra las **fechas concretas** de inasistencia. Permite justificar días no consecutivos y genera la base para validar las materias afectadas.

### `tbd_justification_subjects`
Vincula justificante, fecha (`id_absence`), materia y docente. Usa clave foránea a `tb_justification_absences` para mantener la granularidad por fecha.

### `tb_supporting_documents`
Almacena metadatos del comprobante. El archivo físico reside en `uploads/` (privado). Se guarda `checksum_sha256` para integridad y `validation_status` para el flujo de validación.

### `tb_justification_signatures`
Una firma por tipo de firmante (`padre_madre_tutor`, `tutor_educativo`, `director_carrera`). Usa `id_staff` o `id_guardian` según corresponda. Guarda `signature_file_ref` y `signature_sha256`.

### `tb_institutional_stamps`
Uno por justificante (`UNIQUE(id_justification)`). Se genera al aprobar.

### `tb_justification_status_history`
Historial inmutable de transiciones: `id_status_from`, `id_status_to`, `changed_by`, `changed_at`, `comment`.

### `tb_audit_logs`
Bitácora generada por triggers. Contiene `table_name`, `operation`, `record_id`, `user_id`, `db_user`, `client_ip`, `old_values` (JSON), `new_values` (JSON). Los triggers `BEFORE UPDATE/DELETE` la bloquean para mantenerla inmutable.

## Integridad y restricciones

### Llaves foráneas (principales)
| Relación | Regla | Justificación |
| --- | --- | --- |
| `tb_justifications` → `tb_students` | `RESTRICT` | No eliminar alumno con trámites. |
| `tb_justifications` → `tb_justification_statuses` | `RESTRICT` | Catálogo fijo. |
| `tb_supporting_documents` → `tb_justifications` | `RESTRICT` | No eliminar justificante con documentos. |
| `tb_justification_signatures` → `tb_justifications` | `RESTRICT` | Conservar firmas. |
| `tb_institutional_stamps` → `tb_justifications` | `RESTRICT` | Conservar sello. |
| `tb_justification_status_history` → `tb_justifications` | `RESTRICT` | Conservar historial. |
| `tbd_justification_subjects` → `tb_justification_absences` | `RESTRICT` | Mantener granularidad. |
| `tb_students` → `tb_groups` | `RESTRICT` | Grupo obligatorio. |
| `tb_users` → `tb_students` / `tb_teachers` | `SET NULL` / `UNIQUE` | Vinculación opcional/única. |
| `tb_audit_logs` → `tb_users` | `SET NULL` | Conserva traza aunque usuario se elimine. |
| `tbd_user_roles` → `tb_users` / `tb_roles` | `CASCADE` | Relaciones de acceso. |

### Índices relevantes
| Tabla | Índice | Uso |
| --- | --- | --- |
| `tb_justifications` | `folio` (UNIQUE), `(id_student)`, `(id_status)`, `(issue_date)`, `(expires_at)`, `(deleted_at)` | Búsqueda, filtros y vencimiento. |
| `tb_students` | `enrollment` (UNIQUE), `(last_name)` | Consulta por matrícula/nombre. |
| `tb_supporting_documents` | `(id_justification)`, `checksum_sha256` | Validación y descarga. |
| `tb_justification_signatures` | `(id_justification)`, `(signer_type)` | Flujo de firmas. |
| `tb_audit_logs` | `(table_name)`, `(operation)`, `(changed_at)` | Consulta de auditoría. |
| `tb_users` | `username` (UNIQUE), `email` (UNIQUE), `(last_login)` | Autenticación. |
| `tb_folio_sequences` | PRIMARY KEY `sequence_date` | Generación de folio diaria. |

## Procedimientos, función y triggers

### Función
- `fn_calcular_vigencia_habiles(id_institucion, fecha_inicio, dias_habiles)` — Calcula `expires_at` omitiendo fines de semana y días inhábiles registrados.

### Procedimientos almacenados (resumen)
| Procedimiento | Propósito |
| --- | --- |
| `sp_generar_folio` | Genera folio diario con `SELECT ... FOR UPDATE` sobre `tb_folio_sequences`. |
| `sp_calcular_vigencia` | Calcula vigencia en días hábiles y actualiza el justificante. |
| `sp_registrar_justificante` | Inserta justificante, ausencias, materias y, opcionalmente, comprobante en una transacción. |
| `sp_cambiar_estado_justificante` | Controla transiciones, aplica reglas (rechazo con comentario, crítico con validado), registra historial y actualiza responsables/resolución. |
| `sp_vencer_justificantes` | Marca como `vencido` los aprobados vencidos. |
| `sp_registrar_firma`, `sp_registrar_sello`, `sp_registrar_documento_comprobante`, `sp_validar_documento_comprobante` | Operaciones del flujo con auditoría integrada. |
| `sp_consultar_justificantes_por_matricula`, `sp_consultar_justificante_por_folio`, `sp_obtener_justificantes_pendientes`, `sp_consultar_justificantes_por_fechas`, `sp_obtener_historial_justificante` | Consultas operativas. |

### Triggers (resumen)
| Tipo | Alcance | Propósito |
| --- | --- | --- |
| `BEFORE INSERT/UPDATE` | `tb_justifications`, `tb_supporting_documents`, `tb_justification_signatures`, `tb_institutional_stamps` | Validación, normalización, control de fechas. |
| `AFTER UPDATE` | `tb_justifications` | Genera historial y marca `resolved_at`. |
| `BEFORE INSERT` | `tb_justification_absences` | Integridad de fechas de inasistencia. |
| `BEFORE UPDATE/DELETE` | `tb_justification_status_history`, `tb_audit_logs` | **Inmutabilidad**: bloquea modificaciones/eliminación. |
| `AFTER INSERT/UPDATE/DELETE` | Varias tablas (`tb_justifications`, `tb_students`, `tb_supporting_documents`, `tb_signatures`, `tb_stamps`, `tb_users`, `tb_staff`, `tb_guardians`) | Escritura automática en `tb_audit_logs`. |

## Seguridad de datos
- Contraseñas almacenadas como `bcrypt` (10–12 rondas) en `tb_users.password_hash`.
- `tb_audit_logs` es inmutable por restricciones de trigger.
- Metadatos de archivos privados, no rutas públicas.
- Información de firmas/sellos con hash criptográfico.
- `version` en justificantes para control de concurrencia.

## Consideraciones de diseño
- Uso de `DATE` para periodos/fechas de inasistencia, `DATETIME/TIMESTAMP` para auditoría.
- `CHAR(64)` para SHA-256, `JSON` para valores antiguos/nuevos en auditoría.
- `deleted_at` permite recuperar trazabilidad sin romper integridad.
- Separación entre entidad `tb_justifications` y sus detalles (`absences`, `subjects`, `documents`, `signatures`, `stamp`) para normalizar.

## Diagrama
- Mermaid: [`diagrams/entity_relationship.md`](../diagrams/entity_relationship.md)
- Interactivo (HTML): [`diagrams/erd.html`](../diagrams/erd.html)
