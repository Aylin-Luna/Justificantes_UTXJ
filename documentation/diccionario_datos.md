# Diccionario de datos — Sistema de Justificantes Académicos UTXJ

> Documento generado automáticamente desde `information_schema` el **2 de noviembre de 2026, 12:27 a.m.**
> Base de datos: `db_justificantes_utxj` · Motor: MySQL 8.0 · Juego de caracteres: `utf8mb4`.
> Regenerar con: `node scripts/generate_data_dictionary.js`.

## Resumen

| Elemento | Cantidad |
| --- | ---: |
| Tablas | 25 |
| Columnas | 235 |
| Llaves foráneas | 43 |
| Vistas | 0 |

## Contenido

- **Institucional**
  - [tb_careers — Carreras y niveles educativos ofertados por la institución.](#tb-careers)
  - [tb_groups — Grupos escolares por carrera, grado, turno y periodo.](#tb-groups)
  - [tb_institutions — Datos oficiales de la universidad emisora. Alimenta el encabezado, el pie y el sello del justificante.](#tb-institutions)
  - [tb_non_working_days — Días inhábiles usados para calcular la vigencia en días hábiles.](#tb-non-working-days)
  - [tb_system_settings — Parámetros operativos configurables desde el panel administrativo.](#tb-system-settings)
- **Personas**
  - [tb_academic_staff — Personal académico con función de tutoría o dirección de carrera.](#tb-academic-staff)
  - [tb_guardians — Padres, madres o tutores del alumnado. Su firma es opcional.](#tb-guardians)
  - [tb_students — Alumnado inscrito; la matrícula es la clave natural de consulta.](#tb-students)
  - [tb_teachers — Docentes que pueden estar asociados a las materias afectadas.](#tb-teachers)
- **Acceso**
  - [tb_audit_logs — Bitácora inmutable de cambios generada por los triggers de auditoría.](#tb-audit-logs)
  - [tb_roles — Catálogo de roles del sistema (alumno, tutor, directora, admin).](#tb-roles)
  - [tb_users — Cuentas de acceso con hash bcrypt, bloqueo por intentos y vínculo opcional a alumno o docente.](#tb-users)
  - [tbd_user_roles — Relación N:M entre usuarios y roles.](#tbd-user-roles)
- **Académico**
  - [tb_subjects — Materias por carrera y cuatrimestre.](#tb-subjects)
- **Catálogos**
  - [tb_document_types — Tipos de comprobante permitidos, extensiones y validación requerida.](#tb-document-types)
  - [tb_folio_sequences — Secuencia diaria para generar folios únicos sin colisiones.](#tb-folio-sequences)
  - [tb_reason_types — Motivos del justificante y si exigen comprobante.](#tb-reason-types)
- **Justificantes**
  - [tb_institutional_stamps — Sello institucional aplicado al aprobar; uno por justificante.](#tb-institutional-stamps)
  - [tb_justification_absences — Fechas concretas de falta declaradas en cada justificante.](#tb-justification-absences)
  - [tb_justification_signatures — Firmas electrónicas de padre/madre/tutor, tutor educativo y dirección.](#tb-justification-signatures)
  - [tb_justification_status_history — Historial de transiciones de estado con usuario y comentario.](#tb-justification-status-history)
  - [tb_justification_statuses — Catálogo de estados y marca de estado final.](#tb-justification-statuses)
  - [tb_justifications — Entidad central del sistema. Conserva folio, fechas, motivo, estado, vigencia y responsables.](#tb-justifications)
  - [tb_supporting_documents — Metadatos de comprobantes privados; el binario vive fuera de la base de datos.](#tb-supporting-documents)
  - [tbd_justification_subjects — Materias y docentes afectados por cada fecha de falta.](#tbd-justification-subjects)

## Convenciones

- **PK**: llave primaria. **FK**: llave foránea. **UNI**: restricción de unicidad. **IDX**: índice no único.
- Los montos de tiempo (`created_at`, `updated_at`, `changed_at`) usan zona horaria del servidor MySQL.
- Los documentos, firmas y sellos guardan solo la referencia y el SHA-256; el archivo binario se almacena en el sistema de archivos privado.
- Las columnas `*_at` con `ON UPDATE CURRENT_TIMESTAMP` se actualizan automáticamente.

---

## Institucional

### tb_careers

**Descripción:** Carreras y niveles educativos ofertados por la institución.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 8

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_career` | `int unsigned` | No | PK | — | auto_increment | — |
| `id_institution` | `int unsigned` | No | FK | — | — | — |
| `code` | `varchar(30)` | No | — | — | — | — |
| `name` | `varchar(180)` | No | — | — | — | — |
| `level` | `enum('TSU','LICENCIATURA','POSGRADO')` | No | — | `TSU` | — | — |
| `active` | `tinyint(1)` | No | IDX | `1` | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `updated_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_careers_institution` | `id_institution` | `tb_institutions.id_institution` | RESTRICT | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_careers_active` | `active` | No |
| `idx_careers_institution_active` | `id_institution,active` | No |
| `uq_careers_institution_code` | `id_institution,code` | Sí |
| `uq_careers_institution_name` | `id_institution,name` | Sí |

### tb_groups

**Descripción:** Grupos escolares por carrera, grado, turno y periodo.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 10

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_group` | `int unsigned` | No | PK | — | auto_increment | — |
| `id_career` | `int unsigned` | No | FK | — | — | — |
| `name` | `varchar(20)` | No | — | — | — | Identificador visible del grupo, por ejemplo 7A |
| `grade` | `tinyint unsigned` | No | — | — | — | Grado o cuatrimestre |
| `shift` | `enum('matutino','vespertino','nocturno','mixto')` | No | — | `matutino` | — | — |
| `school_period` | `varchar(20)` | No | IDX | — | — | Periodo escolar, por ejemplo 2026-2027 |
| `capacity` | `smallint unsigned` | Sí | — | NULL | — | — |
| `active` | `tinyint(1)` | No | — | `1` | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `updated_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_groups_career` | `id_career` | `tb_careers.id_career` | RESTRICT | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_groups_career_active` | `id_career,active` | No |
| `idx_groups_period` | `school_period` | No |
| `uq_groups_career_name_period` | `id_career,name,school_period` | Sí |

### tb_institutions

**Descripción:** Datos oficiales de la universidad emisora. Alimenta el encabezado, el pie y el sello del justificante.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 13

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_institution` | `int unsigned` | No | PK | — | auto_increment | — |
| `name` | `varchar(180)` | No | — | — | — | — |
| `acronym` | `varchar(30)` | No | UNI | — | — | — |
| `address` | `varchar(255)` | Sí | — | NULL | — | — |
| `city` | `varchar(120)` | Sí | — | NULL | — | — |
| `state_name` | `varchar(120)` | Sí | — | NULL | — | — |
| `country` | `varchar(120)` | No | — | `México` | — | — |
| `phone` | `varchar(30)` | Sí | — | NULL | — | — |
| `email` | `varchar(150)` | Sí | — | NULL | — | — |
| `logo_path` | `varchar(255)` | Sí | — | NULL | — | Ruta privada o relativa del logotipo institucional |
| `active` | `tinyint(1)` | No | — | `1` | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `updated_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | — |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `uq_institutions_acronym` | `acronym` | Sí |

### tb_non_working_days

**Descripción:** Días inhábiles usados para calcular la vigencia en días hábiles.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 6

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_non_working_day` | `int unsigned` | No | PK | — | auto_increment | — |
| `id_institution` | `int unsigned` | No | FK | — | — | — |
| `non_working_date` | `date` | No | IDX | — | — | — |
| `description` | `varchar(180)` | No | — | — | — | — |
| `is_recurring` | `tinyint(1)` | No | — | `0` | — | 1 = se repite cada año en mes/día |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_non_working_institution` | `id_institution` | `tb_institutions.id_institution` | CASCADE | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_non_working_date` | `non_working_date` | No |
| `uq_non_working_institution_date` | `id_institution,non_working_date` | Sí |

### tb_system_settings

**Descripción:** Parámetros operativos configurables desde el panel administrativo.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 5

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `setting_key` | `varchar(60)` | No | PK | — | — | — |
| `setting_value` | `varchar(255)` | No | — | — | — | — |
| `description` | `varchar(255)` | Sí | — | NULL | — | — |
| `updated_by` | `int unsigned` | Sí | FK | NULL | — | — |
| `updated_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_settings_updated_by` | `updated_by` | `tb_users.id_user` | SET NULL | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `fk_settings_updated_by` | `updated_by` | No |

## Personas

### tb_academic_staff

**Descripción:** Personal académico con función de tutoría o dirección de carrera.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 11

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_staff` | `int unsigned` | No | PK | — | auto_increment | — |
| `id_institution` | `int unsigned` | No | FK | — | — | — |
| `id_user` | `int unsigned` | Sí | FK | NULL | — | — |
| `id_career` | `int unsigned` | Sí | FK | NULL | — | — |
| `full_name` | `varchar(180)` | No | — | — | — | — |
| `position` | `enum('tutor_educativo','director_carrera','control_escolar','secretaria_academica','otro')` | No | IDX | — | — | — |
| `email` | `varchar(150)` | Sí | — | NULL | — | — |
| `phone` | `varchar(30)` | Sí | — | NULL | — | — |
| `active` | `tinyint(1)` | No | — | `1` | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `updated_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_staff_career` | `id_career` | `tb_careers.id_career` | SET NULL | CASCADE |
| `fk_staff_institution` | `id_institution` | `tb_institutions.id_institution` | RESTRICT | CASCADE |
| `fk_staff_user` | `id_user` | `tb_users.id_user` | SET NULL | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `fk_staff_career` | `id_career` | No |
| `idx_staff_institution` | `id_institution,position` | No |
| `idx_staff_position_career` | `position,id_career,active` | No |
| `idx_staff_user` | `id_user` | No |

### tb_guardians

**Descripción:** Padres, madres o tutores del alumnado. Su firma es opcional.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 10

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_guardian` | `int unsigned` | No | PK | — | auto_increment | — |
| `id_student` | `int unsigned` | No | FK | — | — | — |
| `full_name` | `varchar(180)` | No | — | — | — | — |
| `relationship` | `enum('padre','madre','tutor','otro')` | No | — | `tutor` | — | — |
| `phone` | `varchar(30)` | Sí | — | NULL | — | — |
| `email` | `varchar(150)` | Sí | — | NULL | — | — |
| `address` | `varchar(255)` | Sí | — | NULL | — | — |
| `active` | `tinyint(1)` | No | — | `1` | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `updated_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_guardians_student` | `id_student` | `tb_students.id_student` | CASCADE | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_guardians_student` | `id_student,active` | No |

### tb_students

**Descripción:** Alumnado inscrito; la matrícula es la clave natural de consulta.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 11

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_student` | `int unsigned` | No | PK | — | auto_increment | — |
| `id_group` | `int unsigned` | No | FK | — | — | — |
| `enrollment` | `varchar(20)` | No | UNI | — | — | Matrícula institucional única |
| `first_name` | `varchar(100)` | No | — | — | — | — |
| `last_name` | `varchar(100)` | No | IDX | — | — | — |
| `second_last_name` | `varchar(100)` | Sí | — | NULL | — | — |
| `email` | `varchar(150)` | Sí | UNI | NULL | — | — |
| `phone` | `varchar(30)` | Sí | — | NULL | — | — |
| `status` | `enum('activo','inactivo','egresado','baja')` | No | IDX | `activo` | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `updated_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_students_group` | `id_group` | `tb_groups.id_group` | RESTRICT | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_students_group_status` | `id_group,status` | No |
| `idx_students_name` | `last_name,second_last_name,first_name` | No |
| `idx_students_status` | `status` | No |
| `uq_students_email` | `email` | Sí |
| `uq_students_enrollment` | `enrollment` | Sí |

### tb_teachers

**Descripción:** Docentes que pueden estar asociados a las materias afectadas.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 12

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_teacher` | `int unsigned` | No | PK | — | auto_increment | — |
| `id_institution` | `int unsigned` | No | FK | — | — | — |
| `employee_number` | `varchar(30)` | No | — | — | — | — |
| `professional_title` | `varchar(50)` | Sí | — | NULL | — | Grado académico visible, por ejemplo MTI. |
| `first_name` | `varchar(100)` | No | — | — | — | — |
| `last_name` | `varchar(100)` | No | — | — | — | — |
| `second_last_name` | `varchar(100)` | Sí | — | NULL | — | — |
| `email` | `varchar(150)` | Sí | UNI | NULL | — | — |
| `department` | `varchar(150)` | Sí | — | NULL | — | — |
| `active` | `tinyint(1)` | No | IDX | `1` | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `updated_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_teachers_institution` | `id_institution` | `tb_institutions.id_institution` | RESTRICT | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_teachers_active` | `active` | No |
| `uq_teachers_email` | `email` | Sí |
| `uq_teachers_employee` | `id_institution,employee_number` | Sí |

## Acceso

### tb_audit_logs

**Descripción:** Bitácora inmutable de cambios generada por los triggers de auditoría.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 12

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_log` | `bigint unsigned` | No | PK | — | auto_increment | — |
| `table_name` | `varchar(64)` | No | IDX | — | — | — |
| `operation` | `enum('INSERT','UPDATE','DELETE')` | No | IDX | — | — | — |
| `record_id` | `varchar(64)` | No | — | — | — | — |
| `user_id` | `int unsigned` | Sí | FK | NULL | — | — |
| `db_user` | `varchar(100)` | Sí | — | NULL | — | — |
| `client_ip` | `varchar(45)` | Sí | — | NULL | — | — |
| `source` | `varchar(50)` | Sí | — | NULL | — | — |
| `changed_at` | `timestamp` | No | IDX | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `change_description` | `varchar(1000)` | Sí | — | NULL | — | — |
| `old_values` | `json` | Sí | — | NULL | — | — |
| `new_values` | `json` | Sí | — | NULL | — | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_audit_user` | `user_id` | `tb_users.id_user` | SET NULL | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_audit_changed_at` | `changed_at` | No |
| `idx_audit_operation_date` | `operation,changed_at` | No |
| `idx_audit_table_record` | `table_name,record_id` | No |
| `idx_audit_user` | `user_id` | No |
| `idx_audit_user_date` | `user_id,changed_at` | No |

### tb_roles

**Descripción:** Catálogo de roles del sistema (alumno, tutor, directora, admin).

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 5

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_role` | `int unsigned` | No | PK | — | auto_increment | — |
| `code` | `varchar(30)` | No | UNI | — | — | — |
| `name` | `varchar(80)` | No | — | — | — | — |
| `description` | `varchar(255)` | Sí | — | NULL | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `uq_roles_code` | `code` | Sí |

### tb_users

**Descripción:** Cuentas de acceso con hash bcrypt, bloqueo por intentos y vínculo opcional a alumno o docente.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 13

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_user` | `int unsigned` | No | PK | — | auto_increment | — |
| `username` | `varchar(60)` | No | UNI | — | — | — |
| `email` | `varchar(150)` | No | UNI | — | — | — |
| `password_hash` | `varchar(255)` | No | — | — | — | Hash bcrypt; nunca contraseña en texto plano |
| `full_name` | `varchar(180)` | No | — | — | — | — |
| `id_student` | `int unsigned` | Sí | UNI, FK | NULL | — | — |
| `id_teacher` | `int unsigned` | Sí | UNI, FK | NULL | — | — |
| `active` | `tinyint(1)` | No | IDX | `1` | — | — |
| `failed_attempts` | `tinyint unsigned` | No | — | `0` | — | — |
| `locked_until` | `datetime` | Sí | — | NULL | — | — |
| `last_login` | `datetime` | Sí | IDX | NULL | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `updated_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_users_student` | `id_student` | `tb_students.id_student` | SET NULL | CASCADE |
| `fk_users_teacher` | `id_teacher` | `tb_teachers.id_teacher` | SET NULL | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_users_active` | `active` | No |
| `idx_users_last_login` | `last_login` | No |
| `uq_users_email` | `email` | Sí |
| `uq_users_student` | `id_student` | Sí |
| `uq_users_teacher` | `id_teacher` | Sí |
| `uq_users_username` | `username` | Sí |

### tbd_user_roles

**Descripción:** Relación N:M entre usuarios y roles.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 4

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_user` | `int unsigned` | No | PK, FK | — | — | — |
| `id_role` | `int unsigned` | No | PK, FK | — | — | — |
| `assigned_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `assigned_by` | `int unsigned` | Sí | FK | NULL | — | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_user_roles_assigned_by` | `assigned_by` | `tb_users.id_user` | SET NULL | CASCADE |
| `fk_user_roles_role` | `id_role` | `tb_roles.id_role` | RESTRICT | CASCADE |
| `fk_user_roles_user` | `id_user` | `tb_users.id_user` | CASCADE | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_user_roles_assigned_by` | `assigned_by` | No |
| `idx_user_roles_role` | `id_role` | No |

## Académico

### tb_subjects

**Descripción:** Materias por carrera y cuatrimestre.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 9

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_subject` | `int unsigned` | No | PK | — | auto_increment | — |
| `id_career` | `int unsigned` | No | FK | — | — | — |
| `code` | `varchar(30)` | No | — | — | — | — |
| `name` | `varchar(180)` | No | — | — | — | — |
| `credits` | `tinyint unsigned` | Sí | — | NULL | — | — |
| `semester` | `tinyint unsigned` | Sí | — | NULL | — | — |
| `active` | `tinyint(1)` | No | — | `1` | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `updated_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_subjects_career` | `id_career` | `tb_careers.id_career` | RESTRICT | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_subjects_career_active` | `id_career,active` | No |
| `uq_subjects_career_code` | `id_career,code` | Sí |

## Catálogos

### tb_document_types

**Descripción:** Tipos de comprobante permitidos, extensiones y validación requerida.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 8

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_document_type` | `int unsigned` | No | PK | — | auto_increment | — |
| `code` | `varchar(40)` | No | UNI | — | — | — |
| `name` | `varchar(120)` | No | — | — | — | — |
| `description` | `varchar(255)` | Sí | — | NULL | — | — |
| `allowed_extensions` | `varchar(80)` | No | — | `pdf,jpg,jpeg,png` | — | — |
| `requires_validation` | `tinyint(1)` | No | — | `1` | — | — |
| `active` | `tinyint(1)` | No | — | `1` | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `uq_document_types_code` | `code` | Sí |

### tb_folio_sequences

**Descripción:** Secuencia diaria para generar folios únicos sin colisiones.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 3

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `sequence_date` | `date` | No | PK | — | — | — |
| `last_number` | `int unsigned` | No | — | `0` | — | — |
| `updated_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | — |

### tb_reason_types

**Descripción:** Motivos del justificante y si exigen comprobante.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 7

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_reason_type` | `int unsigned` | No | PK | — | auto_increment | — |
| `code` | `varchar(40)` | No | UNI | — | — | — |
| `name` | `varchar(120)` | No | — | — | — | — |
| `description` | `varchar(255)` | Sí | — | NULL | — | — |
| `requires_document` | `tinyint(1)` | No | — | `0` | — | — |
| `active` | `tinyint(1)` | No | — | `1` | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `uq_reason_types_code` | `code` | Sí |

## Justificantes

### tb_institutional_stamps

**Descripción:** Sello institucional aplicado al aprobar; uno por justificante.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 9

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_stamp` | `bigint unsigned` | No | PK | — | auto_increment | — |
| `id_justification` | `bigint unsigned` | No | UNI, FK | — | — | — |
| `id_institution` | `int unsigned` | No | FK | — | — | — |
| `stamp_file_ref` | `varchar(500)` | No | — | — | — | Ruta privada del sello institucional |
| `stamp_sha256` | `char(64)` | Sí | — | NULL | — | — |
| `applied_at` | `datetime` | No | IDX | — | — | — |
| `applied_by` | `int unsigned` | No | FK | — | — | — |
| `observations` | `varchar(500)` | Sí | — | NULL | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_stamps_applied_by` | `applied_by` | `tb_users.id_user` | RESTRICT | CASCADE |
| `fk_stamps_institution` | `id_institution` | `tb_institutions.id_institution` | RESTRICT | CASCADE |
| `fk_stamps_justification` | `id_justification` | `tb_justifications.id_justification` | CASCADE | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_stamps_applied_at` | `applied_at` | No |
| `idx_stamps_applied_by` | `applied_by` | No |
| `idx_stamps_institution` | `id_institution` | No |
| `uq_stamps_justification` | `id_justification` | Sí |

### tb_justification_absences

**Descripción:** Fechas concretas de falta declaradas en cada justificante.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 5

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_absence` | `bigint unsigned` | No | PK | — | auto_increment | — |
| `id_justification` | `bigint unsigned` | No | FK | — | — | — |
| `absence_date` | `date` | No | IDX | — | — | — |
| `notes` | `varchar(255)` | Sí | — | NULL | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_absences_justification` | `id_justification` | `tb_justifications.id_justification` | CASCADE | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_absences_date` | `absence_date` | No |
| `uq_absences_justification_date` | `id_justification,absence_date` | Sí |

### tb_justification_signatures

**Descripción:** Firmas electrónicas de padre/madre/tutor, tutor educativo y dirección.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 13

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_signature` | `bigint unsigned` | No | PK | — | auto_increment | — |
| `id_justification` | `bigint unsigned` | No | FK | — | — | — |
| `signer_type` | `enum('padre_madre_tutor','tutor_educativo','director_carrera')` | No | — | — | — | — |
| `id_staff` | `int unsigned` | Sí | FK | NULL | — | — |
| `id_guardian` | `int unsigned` | Sí | FK | NULL | — | — |
| `signer_name` | `varchar(180)` | No | — | — | — | — |
| `status` | `enum('pendiente','firmado','rechazado')` | No | IDX | `pendiente` | — | — |
| `signed_at` | `datetime` | Sí | — | NULL | — | — |
| `signature_file_ref` | `varchar(500)` | Sí | — | NULL | — | Ruta privada del archivo de firma |
| `signature_sha256` | `char(64)` | Sí | — | NULL | — | — |
| `observations` | `varchar(500)` | Sí | — | NULL | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `updated_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_signatures_guardian` | `id_guardian` | `tb_guardians.id_guardian` | SET NULL | CASCADE |
| `fk_signatures_justification` | `id_justification` | `tb_justifications.id_justification` | CASCADE | CASCADE |
| `fk_signatures_staff` | `id_staff` | `tb_academic_staff.id_staff` | SET NULL | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_signatures_guardian` | `id_guardian` | No |
| `idx_signatures_justification` | `id_justification` | No |
| `idx_signatures_staff` | `id_staff` | No |
| `idx_signatures_status` | `status,signed_at` | No |
| `uq_signatures_justification_type` | `id_justification,signer_type` | Sí |

### tb_justification_status_history

**Descripción:** Historial de transiciones de estado con usuario y comentario.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 7

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_history` | `bigint unsigned` | No | PK | — | auto_increment | — |
| `id_justification` | `bigint unsigned` | No | FK | — | — | — |
| `id_status_from` | `int unsigned` | Sí | FK | NULL | — | — |
| `id_status_to` | `int unsigned` | No | FK | — | — | — |
| `changed_by` | `int unsigned` | Sí | FK | NULL | — | — |
| `changed_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `comment` | `varchar(500)` | Sí | — | NULL | — | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_history_changed_by` | `changed_by` | `tb_users.id_user` | SET NULL | CASCADE |
| `fk_history_justification` | `id_justification` | `tb_justifications.id_justification` | CASCADE | CASCADE |
| `fk_history_status_from` | `id_status_from` | `tb_justification_statuses.id_status` | SET NULL | CASCADE |
| `fk_history_status_to` | `id_status_to` | `tb_justification_statuses.id_status` | RESTRICT | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `fk_history_status_from` | `id_status_from` | No |
| `idx_history_changed_by` | `changed_by` | No |
| `idx_history_justification_date` | `id_justification,changed_at` | No |
| `idx_history_status_to` | `id_status_to` | No |

### tb_justification_statuses

**Descripción:** Catálogo de estados y marca de estado final.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 7

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_status` | `int unsigned` | No | PK | — | auto_increment | — |
| `code` | `varchar(20)` | No | UNI | — | — | — |
| `name` | `varchar(60)` | No | — | — | — | — |
| `description` | `varchar(255)` | Sí | — | NULL | — | — |
| `is_final` | `tinyint(1)` | No | — | `0` | — | — |
| `sort_order` | `tinyint unsigned` | No | — | `0` | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `uq_statuses_code` | `code` | Sí |

### tb_justifications

**Descripción:** Entidad central del sistema. Conserva folio, fechas, motivo, estado, vigencia y responsables.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 23

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_justification` | `bigint unsigned` | No | PK | — | auto_increment | — |
| `folio` | `varchar(30)` | No | UNI | — | — | Folio institucional único generado en el servidor |
| `id_student` | `int unsigned` | No | FK | — | — | — |
| `id_status` | `int unsigned` | No | FK | — | — | — |
| `id_reason_type` | `int unsigned` | Sí | FK | NULL | — | — |
| `issue_date` | `date` | No | IDX | — | — | Fecha de emisión del justificante |
| `start_date` | `date` | No | IDX | — | — | Primer día de inasistencia |
| `end_date` | `date` | No | — | — | — | Último día de inasistencia |
| `is_critical` | `tinyint(1)` | No | — | `0` | — | Caso crítico: 1 = Sí, 0 = No |
| `reason` | `text` | No | — | — | — | Motivo completo escrito por el solicitante |
| `observations` | `text` | Sí | — | NULL | — | — |
| `validity_days` | `smallint unsigned` | No | — | `5` | — | Días hábiles configurados para la vigencia |
| `expires_at` | `date` | Sí | IDX | NULL | — | Fecha de vencimiento calculada con días hábiles |
| `created_by` | `int unsigned` | No | FK | — | — | — |
| `updated_by` | `int unsigned` | Sí | FK | NULL | — | — |
| `approved_by` | `int unsigned` | Sí | FK | NULL | — | — |
| `rejected_by` | `int unsigned` | Sí | FK | NULL | — | — |
| `resolved_at` | `datetime` | Sí | — | NULL | — | — |
| `rejection_comment` | `text` | Sí | — | NULL | — | — |
| `version` | `int unsigned` | No | — | `1` | — | Control de concurrencia optimista |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `updated_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | — |
| `deleted_at` | `datetime` | Sí | IDX | NULL | — | Borrado lógico; nunca se elimina físicamente por la aplicación |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_justifications_approved_by` | `approved_by` | `tb_users.id_user` | SET NULL | CASCADE |
| `fk_justifications_created_by` | `created_by` | `tb_users.id_user` | RESTRICT | CASCADE |
| `fk_justifications_reason_type` | `id_reason_type` | `tb_reason_types.id_reason_type` | SET NULL | CASCADE |
| `fk_justifications_rejected_by` | `rejected_by` | `tb_users.id_user` | SET NULL | CASCADE |
| `fk_justifications_status` | `id_status` | `tb_justification_statuses.id_status` | RESTRICT | CASCADE |
| `fk_justifications_student` | `id_student` | `tb_students.id_student` | RESTRICT | CASCADE |
| `fk_justifications_updated_by` | `updated_by` | `tb_users.id_user` | SET NULL | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `fk_justifications_approved_by` | `approved_by` | No |
| `fk_justifications_created_by` | `created_by` | No |
| `fk_justifications_reason_type` | `id_reason_type` | No |
| `fk_justifications_rejected_by` | `rejected_by` | No |
| `fk_justifications_updated_by` | `updated_by` | No |
| `idx_justifications_dates` | `start_date,end_date` | No |
| `idx_justifications_deleted` | `deleted_at` | No |
| `idx_justifications_expires` | `expires_at` | No |
| `idx_justifications_issue_status` | `issue_date,id_status` | No |
| `idx_justifications_status_created` | `id_status,created_at` | No |
| `idx_justifications_student_status` | `id_student,id_status` | No |
| `uq_justifications_folio` | `folio` | Sí |

### tb_supporting_documents

**Descripción:** Metadatos de comprobantes privados; el binario vive fuera de la base de datos.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 17

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_document` | `bigint unsigned` | No | PK | — | auto_increment | — |
| `id_justification` | `bigint unsigned` | No | FK | — | — | — |
| `id_document_type` | `int unsigned` | No | FK | — | — | — |
| `original_name` | `varchar(255)` | No | — | — | — | Nombre original solo para trazabilidad interna |
| `stored_name` | `varchar(255)` | No | UNI | — | — | Nombre aleatorio en disco |
| `storage_path` | `varchar(500)` | No | — | — | — | Ruta privada relativa; nunca una URL pública |
| `mime_type` | `varchar(100)` | No | — | — | — | — |
| `extension` | `varchar(10)` | No | — | — | — | — |
| `file_size` | `int unsigned` | No | — | — | — | — |
| `checksum_sha256` | `char(64)` | Sí | IDX | NULL | — | — |
| `uploaded_by` | `int unsigned` | No | FK | — | — | — |
| `uploaded_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |
| `validation_status` | `enum('pendiente','validado','rechazado')` | No | — | `pendiente` | — | — |
| `validated_by` | `int unsigned` | Sí | FK | NULL | — | — |
| `validated_at` | `datetime` | Sí | — | NULL | — | — |
| `notes` | `varchar(500)` | Sí | — | NULL | — | — |
| `is_private` | `tinyint(1)` | No | — | `1` | — | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_documents_justification` | `id_justification` | `tb_justifications.id_justification` | CASCADE | CASCADE |
| `fk_documents_type` | `id_document_type` | `tb_document_types.id_document_type` | RESTRICT | CASCADE |
| `fk_documents_uploaded_by` | `uploaded_by` | `tb_users.id_user` | RESTRICT | CASCADE |
| `fk_documents_validated_by` | `validated_by` | `tb_users.id_user` | SET NULL | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `fk_documents_validated_by` | `validated_by` | No |
| `idx_documents_checksum` | `checksum_sha256` | No |
| `idx_documents_justification_status` | `id_justification,validation_status` | No |
| `idx_documents_type` | `id_document_type` | No |
| `idx_documents_uploaded_by` | `uploaded_by` | No |
| `uq_documents_stored_name` | `stored_name` | Sí |

### tbd_justification_subjects

**Descripción:** Materias y docentes afectados por cada fecha de falta.

**Motor:** InnoDB · **Cotejamiento:** `utf8mb4_unicode_ci` · **Columnas:** 7

| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |
| --- | --- | :---: | :---: | --- | --- | --- |
| `id_justification_subject` | `bigint unsigned` | No | PK | — | auto_increment | — |
| `id_justification` | `bigint unsigned` | No | FK | — | — | — |
| `id_subject` | `int unsigned` | No | FK | — | — | — |
| `id_teacher` | `int unsigned` | Sí | FK | NULL | — | — |
| `id_absence` | `bigint unsigned` | No | FK | — | — | — |
| `observations` | `varchar(255)` | Sí | — | NULL | — | — |
| `created_at` | `timestamp` | No | — | `CURRENT_TIMESTAMP` | DEFAULT_GENERATED | — |

**Llaves foráneas**

| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- |
| `fk_justification_subjects_absence` | `id_absence` | `tb_justification_absences.id_absence` | CASCADE | CASCADE |
| `fk_justification_subjects_justification` | `id_justification` | `tb_justifications.id_justification` | CASCADE | CASCADE |
| `fk_justification_subjects_subject` | `id_subject` | `tb_subjects.id_subject` | RESTRICT | CASCADE |
| `fk_justification_subjects_teacher` | `id_teacher` | `tb_teachers.id_teacher` | SET NULL | CASCADE |

**Índices**

| Índice | Columnas | Único |
| --- | --- | :---: |
| `idx_justification_subjects_absence` | `id_absence` | No |
| `idx_justification_subjects_justification` | `id_justification` | No |
| `idx_justification_subjects_subject` | `id_subject` | No |
| `idx_justification_subjects_teacher` | `id_teacher` | No |
| `uq_justification_subject_absence` | `id_justification,id_subject,id_absence` | Sí |

---

## Notas de integridad

- Las relaciones usan `ON DELETE RESTRICT` o `SET NULL` según la criticidad del dato; no se elimina historial académico en cascada.
- `tb_justifications` conserva `version` para control de concurrencia y `deleted_at` para baja lógica.
- `tb_folio_sequences` se actualiza dentro de una transacción con bloqueo de fila para evitar folios duplicados.
- La bitácora `tb_audit_logs` es solo de inserción: los triggers impiden modificarla o eliminarla.
