-- ============================================================================
-- Sistema de Gestión de Justificantes Académicos - UTXJ
-- Script 02: tablas normalizadas (3FN)
-- ============================================================================
-- Las llaves foráneas e índices adicionales se agregan en
-- 03_foreign_keys_indexes.sql para mantener el orden de ejecución solicitado.
-- Todas las tablas usan InnoDB y utf8mb4/utf8mb4_unicode_ci.
-- ============================================================================

USE `db_justificantes_utxj`;
SET NAMES utf8mb4;
SET time_zone = '-06:00';

-- ----------------------------------------------------------------------------
-- 1. Instituciones
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_institutions` (
  `id_institution` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(180) NOT NULL,
  `acronym` VARCHAR(30) NOT NULL,
  `address` VARCHAR(255) NULL,
  `city` VARCHAR(120) NULL,
  `state_name` VARCHAR(120) NULL,
  `country` VARCHAR(120) NOT NULL DEFAULT 'México',
  `phone` VARCHAR(30) NULL,
  `email` VARCHAR(150) NULL,
  `logo_path` VARCHAR(255) NULL COMMENT 'Ruta privada o relativa del logotipo institucional',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_institution`),
  UNIQUE KEY `uq_institutions_acronym` (`acronym`),
  CONSTRAINT `chk_institutions_active` CHECK (`active` IN (0,1)),
  CONSTRAINT `chk_institutions_name` CHECK (CHAR_LENGTH(TRIM(`name`)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Universidades o planteles que emiten justificantes';

-- ----------------------------------------------------------------------------
-- 2. Carreras
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_careers` (
  `id_career` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_institution` INT UNSIGNED NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `level` ENUM('TSU','LICENCIATURA','POSGRADO') NOT NULL DEFAULT 'TSU',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_career`),
  UNIQUE KEY `uq_careers_institution_code` (`id_institution`,`code`),
  UNIQUE KEY `uq_careers_institution_name` (`id_institution`,`name`),
  KEY `idx_careers_active` (`active`),
  CONSTRAINT `chk_careers_active` CHECK (`active` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo de carreras por institución';

-- ----------------------------------------------------------------------------
-- 3. Grupos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_groups` (
  `id_group` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_career` INT UNSIGNED NOT NULL,
  `name` VARCHAR(20) NOT NULL COMMENT 'Identificador visible del grupo, por ejemplo 7A',
  `grade` TINYINT UNSIGNED NOT NULL COMMENT 'Grado o cuatrimestre',
  `shift` ENUM('matutino','vespertino','nocturno','mixto') NOT NULL DEFAULT 'matutino',
  `school_period` VARCHAR(20) NOT NULL COMMENT 'Periodo escolar, por ejemplo 2026-2027',
  `capacity` SMALLINT UNSIGNED NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_group`),
  UNIQUE KEY `uq_groups_career_name_period` (`id_career`,`name`,`school_period`),
  KEY `idx_groups_period` (`school_period`),
  CONSTRAINT `chk_groups_grade` CHECK (`grade` BETWEEN 1 AND 12),
  CONSTRAINT `chk_groups_capacity` CHECK (`capacity` IS NULL OR `capacity` > 0),
  CONSTRAINT `chk_groups_active` CHECK (`active` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Grupos escolares por carrera y periodo';

-- ----------------------------------------------------------------------------
-- 4. Estudiantes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_students` (
  `id_student` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_group` INT UNSIGNED NOT NULL,
  `enrollment` VARCHAR(20) NOT NULL COMMENT 'Matrícula institucional única',
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `second_last_name` VARCHAR(100) NULL,
  `email` VARCHAR(150) NULL,
  `phone` VARCHAR(30) NULL,
  `status` ENUM('activo','inactivo','egresado','baja') NOT NULL DEFAULT 'activo',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_student`),
  UNIQUE KEY `uq_students_enrollment` (`enrollment`),
  UNIQUE KEY `uq_students_email` (`email`),
  KEY `idx_students_group_status` (`id_group`,`status`),
  KEY `idx_students_name` (`last_name`,`second_last_name`,`first_name`),
  CONSTRAINT `chk_students_enrollment` CHECK (CHAR_LENGTH(TRIM(`enrollment`)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Datos personales y académicos de los estudiantes';

-- ----------------------------------------------------------------------------
-- 5. Docentes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_teachers` (
  `id_teacher` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_institution` INT UNSIGNED NOT NULL,
  `employee_number` VARCHAR(30) NOT NULL,
  `professional_title` VARCHAR(50) NULL COMMENT 'Grado académico visible, por ejemplo MTI.',
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `second_last_name` VARCHAR(100) NULL,
  `email` VARCHAR(150) NULL,
  `department` VARCHAR(150) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_teacher`),
  UNIQUE KEY `uq_teachers_employee` (`id_institution`,`employee_number`),
  UNIQUE KEY `uq_teachers_email` (`email`),
  KEY `idx_teachers_active` (`active`),
  CONSTRAINT `chk_teachers_active` CHECK (`active` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Plantilla docente';

-- ----------------------------------------------------------------------------
-- 6. Materias
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_subjects` (
  `id_subject` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_career` INT UNSIGNED NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `credits` TINYINT UNSIGNED NULL,
  `semester` TINYINT UNSIGNED NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_subject`),
  UNIQUE KEY `uq_subjects_career_code` (`id_career`,`code`),
  KEY `idx_subjects_career_active` (`id_career`,`active`),
  CONSTRAINT `chk_subjects_semester` CHECK (`semester` IS NULL OR `semester` BETWEEN 1 AND 12),
  CONSTRAINT `chk_subjects_active` CHECK (`active` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo de materias por carrera';

-- ----------------------------------------------------------------------------
-- 7. Roles y usuarios
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_roles` (
  `id_role` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `description` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_role`),
  UNIQUE KEY `uq_roles_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Roles del sistema para control de acceso';

CREATE TABLE IF NOT EXISTS `tb_users` (
  `id_user` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(60) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'Hash bcrypt; nunca contraseña en texto plano',
  `full_name` VARCHAR(180) NOT NULL,
  `id_student` INT UNSIGNED NULL,
  `id_teacher` INT UNSIGNED NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `failed_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `locked_until` DATETIME NULL,
  `last_login` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_user`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_student` (`id_student`),
  UNIQUE KEY `uq_users_teacher` (`id_teacher`),
  KEY `idx_users_active` (`active`),
  CONSTRAINT `chk_users_active` CHECK (`active` IN (0,1)),
  CONSTRAINT `chk_users_username` CHECK (CHAR_LENGTH(TRIM(`username`)) >= 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cuentas de acceso; solo almacena hashes de contraseña';

CREATE TABLE IF NOT EXISTS `tbd_user_roles` (
  `id_user` INT UNSIGNED NOT NULL,
  `id_role` INT UNSIGNED NOT NULL,
  `assigned_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `assigned_by` INT UNSIGNED NULL,
  PRIMARY KEY (`id_user`,`id_role`),
  KEY `idx_user_roles_role` (`id_role`),
  KEY `idx_user_roles_assigned_by` (`assigned_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Relación muchos a muchos entre usuarios y roles';

-- ----------------------------------------------------------------------------
-- 8. Responsables académicos y tutores legales
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_academic_staff` (
  `id_staff` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_institution` INT UNSIGNED NOT NULL,
  `id_user` INT UNSIGNED NULL,
  `id_career` INT UNSIGNED NULL,
  `full_name` VARCHAR(180) NOT NULL,
  `position` ENUM('tutor_educativo','director_carrera','control_escolar','secretaria_academica','otro') NOT NULL,
  `email` VARCHAR(150) NULL,
  `phone` VARCHAR(30) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_staff`),
  KEY `idx_staff_position_career` (`position`,`id_career`,`active`),
  KEY `idx_staff_user` (`id_user`),
  CONSTRAINT `chk_staff_active` CHECK (`active` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tutores educativos, directores y personal académico configurable';

CREATE TABLE IF NOT EXISTS `tb_guardians` (
  `id_guardian` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_student` INT UNSIGNED NOT NULL,
  `full_name` VARCHAR(180) NOT NULL,
  `relationship` ENUM('padre','madre','tutor','otro') NOT NULL DEFAULT 'tutor',
  `phone` VARCHAR(30) NULL,
  `email` VARCHAR(150) NULL,
  `address` VARCHAR(255) NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_guardian`),
  KEY `idx_guardians_student` (`id_student`,`active`),
  CONSTRAINT `chk_guardians_active` CHECK (`active` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Padres, madres o tutores legales del estudiante';

-- ----------------------------------------------------------------------------
-- 9. Catálogos del justificante
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_justification_statuses` (
  `id_status` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(60) NOT NULL,
  `description` VARCHAR(255) NULL,
  `is_final` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_status`),
  UNIQUE KEY `uq_statuses_code` (`code`),
  CONSTRAINT `chk_statuses_code` CHECK (`code` IN ('pendiente','en_revision','aprobado','rechazado','cancelado','vencido')),
  CONSTRAINT `chk_statuses_final` CHECK (`is_final` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Estados del ciclo de vida del justificante';

CREATE TABLE IF NOT EXISTS `tb_reason_types` (
  `id_reason_type` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(255) NULL,
  `requires_document` TINYINT(1) NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_reason_type`),
  UNIQUE KEY `uq_reason_types_code` (`code`),
  CONSTRAINT `chk_reason_types_document` CHECK (`requires_document` IN (0,1)),
  CONSTRAINT `chk_reason_types_active` CHECK (`active` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo configurable de tipos de motivo';

CREATE TABLE IF NOT EXISTS `tb_document_types` (
  `id_document_type` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(255) NULL,
  `allowed_extensions` VARCHAR(80) NOT NULL DEFAULT 'pdf,jpg,jpeg,png',
  `requires_validation` TINYINT(1) NOT NULL DEFAULT 1,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_document_type`),
  UNIQUE KEY `uq_document_types_code` (`code`),
  CONSTRAINT `chk_document_types_validation` CHECK (`requires_validation` IN (0,1)),
  CONSTRAINT `chk_document_types_active` CHECK (`active` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tipos de documento comprobatorio permitidos';

-- ----------------------------------------------------------------------------
-- 10. Justificantes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_justifications` (
  `id_justification` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `folio` VARCHAR(30) NOT NULL COMMENT 'Folio institucional único generado en el servidor',
  `id_student` INT UNSIGNED NOT NULL,
  `id_status` INT UNSIGNED NOT NULL,
  `id_reason_type` INT UNSIGNED NULL,
  `issue_date` DATE NOT NULL COMMENT 'Fecha de emisión del justificante',
  `start_date` DATE NOT NULL COMMENT 'Primer día de inasistencia',
  `end_date` DATE NOT NULL COMMENT 'Último día de inasistencia',
  `is_critical` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Caso crítico: 1 = Sí, 0 = No',
  `reason` TEXT NOT NULL COMMENT 'Motivo completo escrito por el solicitante',
  `observations` TEXT NULL,
  `validity_days` SMALLINT UNSIGNED NOT NULL DEFAULT 5 COMMENT 'Días hábiles configurados para la vigencia',
  `expires_at` DATE NULL COMMENT 'Fecha de vencimiento calculada con días hábiles',
  `created_by` INT UNSIGNED NOT NULL,
  `updated_by` INT UNSIGNED NULL,
  `approved_by` INT UNSIGNED NULL,
  `rejected_by` INT UNSIGNED NULL,
  `resolved_at` DATETIME NULL,
  `rejection_comment` TEXT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Control de concurrencia optimista',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL COMMENT 'Borrado lógico; nunca se elimina físicamente por la aplicación',
  PRIMARY KEY (`id_justification`),
  UNIQUE KEY `uq_justifications_folio` (`folio`),
  KEY `idx_justifications_student_status` (`id_student`,`id_status`),
  KEY `idx_justifications_status_created` (`id_status`,`created_at`),
  KEY `idx_justifications_dates` (`start_date`,`end_date`),
  KEY `idx_justifications_expires` (`expires_at`),
  KEY `idx_justifications_deleted` (`deleted_at`),
  CONSTRAINT `chk_justifications_dates` CHECK (`end_date` >= `start_date`),
  CONSTRAINT `chk_justifications_critical` CHECK (`is_critical` IN (0,1)),
  CONSTRAINT `chk_justifications_validity` CHECK (`validity_days` BETWEEN 1 AND 60),
  CONSTRAINT `chk_justifications_reason` CHECK (CHAR_LENGTH(TRIM(`reason`)) > 0),
  CONSTRAINT `chk_justifications_folio` CHECK (CHAR_LENGTH(TRIM(`folio`)) >= 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cabecera del justificante académico';

CREATE TABLE IF NOT EXISTS `tb_justification_absences` (
  `id_absence` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_justification` BIGINT UNSIGNED NOT NULL,
  `absence_date` DATE NOT NULL,
  `notes` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_absence`),
  UNIQUE KEY `uq_absences_justification_date` (`id_justification`,`absence_date`),
  KEY `idx_absences_date` (`absence_date`),
  CONSTRAINT `chk_absences_notes` CHECK (`notes` IS NULL OR CHAR_LENGTH(`notes`) <= 255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Fechas individuales de inasistencia del justificante';

CREATE TABLE IF NOT EXISTS `tbd_justification_subjects` (
  `id_justification_subject` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_justification` BIGINT UNSIGNED NOT NULL,
  `id_subject` INT UNSIGNED NOT NULL,
  `id_teacher` INT UNSIGNED NULL,
  `id_absence` BIGINT UNSIGNED NOT NULL,
  `observations` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_justification_subject`),
  UNIQUE KEY `uq_justification_subject_absence` (`id_justification`,`id_subject`,`id_absence`),
  KEY `idx_justification_subjects_subject` (`id_subject`),
  KEY `idx_justification_subjects_teacher` (`id_teacher`),
  KEY `idx_justification_subjects_absence` (`id_absence`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Relación muchos a muchos entre justificantes, materias y fechas';

-- ----------------------------------------------------------------------------
-- 11. Documentos, firmas y sello
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_supporting_documents` (
  `id_document` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_justification` BIGINT UNSIGNED NOT NULL,
  `id_document_type` INT UNSIGNED NOT NULL,
  `original_name` VARCHAR(255) NOT NULL COMMENT 'Nombre original solo para trazabilidad interna',
  `stored_name` VARCHAR(255) NOT NULL COMMENT 'Nombre aleatorio en disco',
  `storage_path` VARCHAR(500) NOT NULL COMMENT 'Ruta privada relativa; nunca una URL pública',
  `mime_type` VARCHAR(100) NOT NULL,
  `extension` VARCHAR(10) NOT NULL,
  `file_size` INT UNSIGNED NOT NULL,
  `checksum_sha256` CHAR(64) NULL,
  `uploaded_by` INT UNSIGNED NOT NULL,
  `uploaded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `validation_status` ENUM('pendiente','validado','rechazado') NOT NULL DEFAULT 'pendiente',
  `validated_by` INT UNSIGNED NULL,
  `validated_at` DATETIME NULL,
  `notes` VARCHAR(500) NULL,
  `is_private` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_document`),
  UNIQUE KEY `uq_documents_stored_name` (`stored_name`),
  KEY `idx_documents_justification_status` (`id_justification`,`validation_status`),
  KEY `idx_documents_type` (`id_document_type`),
  KEY `idx_documents_uploaded_by` (`uploaded_by`),
  CONSTRAINT `chk_documents_size` CHECK (`file_size` > 0 AND `file_size` <= 5242880),
  CONSTRAINT `chk_documents_extension` CHECK (`extension` IN ('pdf','jpg','jpeg','png')),
  CONSTRAINT `chk_documents_private` CHECK (`is_private` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Metadatos de comprobantes privados; el archivo vive fuera de public';

CREATE TABLE IF NOT EXISTS `tb_justification_signatures` (
  `id_signature` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_justification` BIGINT UNSIGNED NOT NULL,
  `signer_type` ENUM('padre_madre_tutor','tutor_educativo','director_carrera') NOT NULL,
  `id_staff` INT UNSIGNED NULL,
  `id_guardian` INT UNSIGNED NULL,
  `signer_name` VARCHAR(180) NOT NULL,
  `status` ENUM('pendiente','firmado','rechazado') NOT NULL DEFAULT 'pendiente',
  `signed_at` DATETIME NULL,
  `signature_file_ref` VARCHAR(500) NULL COMMENT 'Ruta privada del archivo de firma',
  `signature_sha256` CHAR(64) NULL,
  `observations` VARCHAR(500) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_signature`),
  UNIQUE KEY `uq_signatures_justification_type` (`id_justification`,`signer_type`),
  KEY `idx_signatures_justification` (`id_justification`),
  KEY `idx_signatures_staff` (`id_staff`),
  KEY `idx_signatures_guardian` (`id_guardian`),
  CONSTRAINT `chk_signatures_signed` CHECK (`status` <> 'firmado' OR (`signed_at` IS NOT NULL AND `signature_file_ref` IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Firmas de padre/madre/tutor, tutor educativo y dirección';

CREATE TABLE IF NOT EXISTS `tb_institutional_stamps` (
  `id_stamp` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_justification` BIGINT UNSIGNED NOT NULL,
  `id_institution` INT UNSIGNED NOT NULL,
  `stamp_file_ref` VARCHAR(500) NOT NULL COMMENT 'Ruta privada del sello institucional',
  `stamp_sha256` CHAR(64) NULL,
  `applied_at` DATETIME NOT NULL,
  `applied_by` INT UNSIGNED NOT NULL,
  `observations` VARCHAR(500) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_stamp`),
  UNIQUE KEY `uq_stamps_justification` (`id_justification`),
  KEY `idx_stamps_institution` (`id_institution`),
  KEY `idx_stamps_applied_by` (`applied_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Sello institucional aplicado al justificante';

-- ----------------------------------------------------------------------------
-- 12. Historial, auditoría y configuración
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tb_justification_status_history` (
  `id_history` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_justification` BIGINT UNSIGNED NOT NULL,
  `id_status_from` INT UNSIGNED NULL,
  `id_status_to` INT UNSIGNED NOT NULL,
  `changed_by` INT UNSIGNED NULL,
  `changed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `comment` VARCHAR(500) NULL,
  PRIMARY KEY (`id_history`),
  KEY `idx_history_justification_date` (`id_justification`,`changed_at`),
  KEY `idx_history_status_to` (`id_status_to`),
  KEY `idx_history_changed_by` (`changed_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Trazabilidad de cambios de estado; solo inserción';

CREATE TABLE IF NOT EXISTS `tb_audit_logs` (
  `id_log` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `table_name` VARCHAR(64) NOT NULL,
  `operation` ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  `record_id` VARCHAR(64) NOT NULL,
  `user_id` INT UNSIGNED NULL,
  `db_user` VARCHAR(100) NULL,
  `client_ip` VARCHAR(45) NULL,
  `source` VARCHAR(50) NULL,
  `changed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `change_description` VARCHAR(1000) NULL,
  `old_values` JSON NULL,
  `new_values` JSON NULL,
  PRIMARY KEY (`id_log`),
  KEY `idx_audit_table_record` (`table_name`,`record_id`),
  KEY `idx_audit_changed_at` (`changed_at`),
  KEY `idx_audit_user` (`user_id`),
  CONSTRAINT `chk_audit_operation` CHECK (`operation` IN ('INSERT','UPDATE','DELETE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Bitácora append-only de operaciones sobre tablas críticas';

CREATE TABLE IF NOT EXISTS `tb_non_working_days` (
  `id_non_working_day` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_institution` INT UNSIGNED NOT NULL,
  `non_working_date` DATE NOT NULL,
  `description` VARCHAR(180) NOT NULL,
  `is_recurring` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = se repite cada año en mes/día',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_non_working_day`),
  UNIQUE KEY `uq_non_working_institution_date` (`id_institution`,`non_working_date`),
  KEY `idx_non_working_date` (`non_working_date`),
  CONSTRAINT `chk_non_working_recurring` CHECK (`is_recurring` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Días inhábiles institucionales para el cálculo de vigencia';

CREATE TABLE IF NOT EXISTS `tb_system_settings` (
  `setting_key` VARCHAR(60) NOT NULL,
  `setting_value` VARCHAR(255) NOT NULL,
  `description` VARCHAR(255) NULL,
  `updated_by` INT UNSIGNED NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`),
  CONSTRAINT `chk_settings_key` CHECK (CHAR_LENGTH(TRIM(`setting_key`)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Parámetros configurables de la lógica institucional';

CREATE TABLE IF NOT EXISTS `tb_folio_sequences` (
  `sequence_date` DATE NOT NULL,
  `last_number` INT UNSIGNED NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sequence_date`),
  CONSTRAINT `chk_folio_sequence_number` CHECK (`last_number` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Secuencia diaria para folios JUS-AAAAMMDD-####';
