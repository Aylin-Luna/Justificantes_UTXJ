-- ============================================================================
-- Sistema de Gestión de Justificantes Académicos - UTXJ
-- Script 06: datos ficticios de prueba
-- ============================================================================
-- No contiene información médica real, firmas auténticas ni contraseñas en
-- texto plano. Las contraseñas de demostración corresponden a hashes bcrypt.
--
-- Usuarios de demostración:
--   alumno     / Alumno123!
--   tutor      / Tutor123!
--   directora  / Directora123!
--   admin      / Admin123!
-- ============================================================================

USE `db_justificantes_utxj`;
SET NAMES utf8mb4;
SET time_zone = '-06:00';

SET @audit_user_id = NULL;
SET @audit_ip = '127.0.0.1';
SET @audit_source = 'seed';

-- ----------------------------------------------------------------------------
-- Institución, carreras y grupos
-- ----------------------------------------------------------------------------
INSERT INTO `tb_institutions`
  (id_institution, name, acronym, address, city, state_name, country, phone, email, logo_path, active)
VALUES
  (1, 'Universidad Tecnológica de Xicotepec de Juárez', 'UTXJ',
   'Av. Universidad Tecnológica No. 1000, Col. Centro', 'Xicotepec de Juárez', 'Puebla', 'México',
   '+52 764 764 0000', 'control.escolar@utxicotepec.edu.mx', 'assets/img/logo-utxj.svg', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), acronym = VALUES(acronym);

INSERT INTO `tb_careers`
  (id_career, id_institution, code, name, level, active)
VALUES
  (1, 1, 'DSM', 'Desarrollo de Software Multiplataforma', 'LICENCIATURA', 1),
  (2, 1, 'TIC', 'Tecnologías de la Información y Comunicación', 'TSU', 1),
  (3, 1, 'GAS', 'Gastronomía', 'TSU', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), active = VALUES(active);

INSERT INTO `tb_groups`
  (id_group, id_career, name, grade, shift, school_period, capacity, active)
VALUES
  (1, 1, '7A', 7, 'matutino', '2026-2027', 35, 1),
  (2, 1, '7B', 7, 'vespertino', '2026-2027', 35, 1),
  (3, 2, '5A', 5, 'matutino', '2026-2027', 30, 1),
  (4, 3, '3A', 3, 'matutino', '2026-2027', 25, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), active = VALUES(active);

-- ----------------------------------------------------------------------------
-- Estudiantes, docentes y materias
-- ----------------------------------------------------------------------------
INSERT INTO `tb_students`
  (id_student, id_group, enrollment, first_name, last_name, second_last_name, email, phone, status)
VALUES
  (1, 1, '240537', 'Ingrid Natalia', 'Martínez', 'Carrasco', '240537@utxicotepec.edu.mx', '7641000001', 'activo'),
  (2, 1, '240538', 'Ana Sofía', 'López', 'García', '240538@utxicotepec.edu.mx', '7641000002', 'activo'),
  (3, 2, '240539', 'Luis', 'Hernández', 'Pérez', '240539@utxicotepec.edu.mx', '7641000003', 'activo'),
  (4, 3, '240540', 'María Fernanda', 'Ramírez', 'Cruz', '240540@utxicotepec.edu.mx', '7641000004', 'activo'),
  (5, 1, '240541', 'Carlos Alberto', 'Méndez', 'Rojas', '240541@utxicotepec.edu.mx', '7641000005', 'activo'),
  (6, 4, '240542', 'Jesús Antonio', 'Bautista', 'Flores', '240542@utxicotepec.edu.mx', '7641000006', 'activo'),
  (7, 2, '240543', 'Valeria', 'Ortiz', 'Sánchez', '240543@utxicotepec.edu.mx', '7641000007', 'activo'),
  (8, 3, '240544', 'Diego Emilio', 'Castillo', 'Vega', '240544@utxicotepec.edu.mx', '7641000008', 'activo')
ON DUPLICATE KEY UPDATE enrollment = VALUES(enrollment), status = VALUES(status);

INSERT INTO `tb_teachers`
  (id_teacher, id_institution, employee_number, professional_title, first_name, last_name, second_last_name, email, department, active)
VALUES
  (1, 1, 'UTXJ-T-001', 'MTI.', 'Ricardo', 'Luna', 'Santos', 'ricardo.luna@utxicotepec.edu.mx', 'Tecnologías de la Información', 1),
  (2, 1, 'UTXJ-T-002', 'Mtra.', 'Laura Patricia', 'Jiménez', 'Ríos', 'laura.jimenez@utxicotepec.edu.mx', 'Tecnologías de la Información', 1),
  (3, 1, 'UTXJ-T-003', 'Ing.', 'Jorge', 'Hernández', 'Mora', 'jorge.hernandez@utxicotepec.edu.mx', 'Desarrollo de Software', 1),
  (4, 1, 'UTXJ-T-004', 'Lic.', 'Patricia', 'Morales', 'Vargas', 'patricia.morales@utxicotepec.edu.mx', 'Gastronomía', 1)
ON DUPLICATE KEY UPDATE first_name = VALUES(first_name), active = VALUES(active);

INSERT INTO `tb_subjects`
  (id_subject, id_career, code, name, credits, semester, active)
VALUES
  (1, 1, 'DSM-701', 'Programación Web', 5, 7, 1),
  (2, 1, 'DSM-702', 'Bases de Datos', 5, 7, 1),
  (3, 1, 'DSM-703', 'Ingeniería de Software', 5, 7, 1),
  (4, 1, 'DSM-501', 'Redes de Computadoras', 5, 5, 1),
  (5, 2, 'TIC-501', 'Desarrollo de Aplicaciones Móviles', 5, 5, 1),
  (6, 2, 'TIC-502', 'Seguridad Informática', 4, 5, 1),
  (7, 3, 'GAS-301', 'Cocina Mexicana', 6, 3, 1),
  (8, 3, 'GAS-302', 'Higiene y Seguridad Alimentaria', 4, 3, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), active = VALUES(active);

-- ----------------------------------------------------------------------------
-- Roles, usuarios y relación muchos a muchos
-- ----------------------------------------------------------------------------
INSERT INTO `tb_roles` (id_role, code, name, description)
VALUES
  (1, 'alumno', 'Alumno', 'Solicita y consulta sus propios justificantes'),
  (2, 'tutor', 'Tutor educativo', 'Revisa, integra y firma los justificantes'),
  (3, 'directora', 'Directora de carrera', 'Autoriza, firma digitalmente y sella'),
  (4, 'admin', 'Administrador', 'Configuración y soporte del sistema')
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);

INSERT INTO `tb_users`
  (id_user, username, email, password_hash, full_name, id_student, id_teacher, active)
VALUES
  (1, 'alumno', 'alumno@utxicotepec.edu.mx',
   '$2a$12$082puQhzYGPZXXF/.zYsT.m6JTdbWnxUcqZxUtAZt3HOP/iokkW7W',
   'Ingrid Natalia Martínez Carrasco', 1, NULL, 1),
  (2, 'tutor', 'tutor@utxicotepec.edu.mx',
   '$2a$12$n.lpb9j4fYdHsrwfO5tFpuuNHc89ciIKigKi1Y1SuNzj.mmGWJIO6',
   'MTI. Ricardo Luna Santos', NULL, 1, 1),
  (3, 'directora', 'directora@utxicotepec.edu.mx',
   '$2a$12$Sfl/L7xDWTCXZ3Mu3oVJreKDXn6YDx3CZxULkFOL8txV/iFjU2Quq',
   'Mtra. Altagracia Carrillo Parra', NULL, NULL, 1),
  (4, 'admin', 'admin@utxicotepec.edu.mx',
   '$2a$12$BrXSvZwSM5uMDt1VPc2u.uc4FO8bD1tAu2vzw5H7ho7zAhHngq4H6',
   'Administrador del Sistema', NULL, NULL, 1),
  (5, 'alumno2', 'alumno2@utxicotepec.edu.mx',
   '$2a$12$082puQhzYGPZXXF/.zYsT.m6JTdbWnxUcqZxUtAZt3HOP/iokkW7W',
   'Ana Sofía López García', 2, NULL, 1),
  (6, 'alumno3', 'alumno3@utxicotepec.edu.mx',
   '$2a$12$082puQhzYGPZXXF/.zYsT.m6JTdbWnxUcqZxUtAZt3HOP/iokkW7W',
   'Luis Hernández Pérez', 3, NULL, 1)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), active = VALUES(active);

SET @audit_user_id = 4;

INSERT INTO `tbd_user_roles` (id_user, id_role, assigned_by)
VALUES
  (1, 1, 4), (2, 2, 4), (3, 3, 4), (4, 4, 4), (5, 1, 4), (6, 1, 4)
ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by);

INSERT INTO `tb_academic_staff`
  (id_staff, id_institution, id_user, id_career, full_name, position, email, phone, active)
VALUES
  (1, 1, 2, 1, 'MTI. Ricardo Luna Santos', 'tutor_educativo', 'ricardo.luna@utxicotepec.edu.mx', '7641000101', 1),
  (2, 1, 3, 1, 'Mtra. Altagracia Carrillo Parra', 'director_carrera', 'altagracia.carrillo@utxicotepec.edu.mx', '7641000102', 1),
  (3, 1, NULL, NULL, 'Lic. Marisol Sánchez Ortega', 'control_escolar', 'control.escolar@utxicotepec.edu.mx', '7641000103', 1),
  (4, 1, NULL, 2, 'Ing. Laura Patricia Jiménez Ríos', 'tutor_educativo', 'laura.jimenez@utxicotepec.edu.mx', '7641000104', 1)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), active = VALUES(active);

INSERT INTO `tb_guardians`
  (id_guardian, id_student, full_name, relationship, phone, email, address, active)
VALUES
  (1, 1, 'María Carrasco Vázquez', 'madre', '7642000001', 'maria.carrasco@example.com', 'Xicotepec de Juárez, Puebla', 1),
  (2, 2, 'José López Hernández', 'padre', '7642000002', 'jose.lopez@example.com', 'Xicotepec de Juárez, Puebla', 1),
  (3, 3, 'Rosa Pérez Díaz', 'madre', '7642000003', 'rosa.perez@example.com', 'Huauchinango, Puebla', 1)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), active = VALUES(active);

-- ----------------------------------------------------------------------------
-- Catálogos y configuración
-- ----------------------------------------------------------------------------
INSERT INTO `tb_justification_statuses` (id_status, code, name, description, is_final, sort_order)
VALUES
  (1, 'pendiente', 'Pendiente', 'Registrado por el alumno, pendiente de revisión', 0, 1),
  (2, 'en_revision', 'En revisión', 'El tutor educativo integra y valida la solicitud', 0, 2),
  (3, 'aprobado', 'Aprobado', 'Autorizado, firmado y sellado por la dirección', 1, 3),
  (4, 'rechazado', 'Rechazado', 'Rechazado con comentario obligatorio', 1, 4),
  (5, 'cancelado', 'Cancelado', 'Cancelado antes de su resolución', 1, 5),
  (6, 'vencido', 'Vencido', 'Aprobado cuya vigencia de días hábiles terminó', 1, 6)
ON DUPLICATE KEY UPDATE name = VALUES(name), is_final = VALUES(is_final);

INSERT INTO `tb_reason_types` (id_reason_type, code, name, description, requires_document, active)
VALUES
  (1, 'enfermedad_general', 'Enfermedad general', 'Incapacidad o receta médica por enfermedad', 1, 1),
  (2, 'consulta_medica', 'Consulta médica', 'Cita o consulta médica programada', 1, 1),
  (3, 'emergencia_familiar', 'Emergencia familiar', 'Situación familiar imprevista', 0, 1),
  (4, 'asunto_personal', 'Asunto personal', 'Trámite personal justificado', 0, 1),
  (5, 'actividad_institucional', 'Actividad institucional', 'Participación en evento o comisión institucional', 0, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), active = VALUES(active);

INSERT INTO `tb_document_types`
  (id_document_type, code, name, description, allowed_extensions, requires_validation, active)
VALUES
  (1, 'receta_medica', 'Receta médica', 'Receta o indicación médica', 'pdf,jpg,jpeg,png', 1, 1),
  (2, 'justificante_medico', 'Justificante médico', 'Constancia de atención médica', 'pdf,jpg,jpeg,png', 1, 1),
  (3, 'comprobante_cita', 'Comprobante de cita', 'Comprobante de cita o programación', 'pdf,jpg,jpeg,png', 0, 1),
  (4, 'otro', 'Otro comprobante', 'Documento adicional relacionado con el motivo', 'pdf,jpg,jpeg,png', 0, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), active = VALUES(active);

INSERT INTO `tb_system_settings` (setting_key, setting_value, description, updated_by)
VALUES
  ('validity_days', '5', 'Días hábiles de vigencia del justificante', 4),
  ('critical_requires_document', '1', 'Exigir comprobante validado en casos críticos', 4),
  ('max_file_size_mb', '5', 'Tamaño máximo de archivos comprobatorios', 4),
  ('allowed_extensions', 'pdf,jpg,jpeg,png', 'Extensiones permitidas para comprobantes', 4),
  ('folio_prefix', 'JUS', 'Prefijo del folio institucional', 4),
  ('password_min_length', '8', 'Longitud mínima de contraseña', 4),
  ('max_login_attempts', '5', 'Intentos fallidos antes de bloquear la cuenta', 4),
  ('lock_minutes', '15', 'Minutos de bloqueo por intentos fallidos', 4),
  ('session_hours', '8', 'Duración de la sesión autenticada', 4)
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), description = VALUES(description);

INSERT INTO `tb_non_working_days` (id_institution, non_working_date, description, is_recurring)
VALUES
  (1, '2026-09-16', 'Día de la Independencia de México', 1),
  (1, '2026-11-02', 'Día de Muertos (descanso institucional)', 0),
  (1, '2026-11-16', 'Conmemoración de la Revolución Mexicana', 0),
  (1, '2026-12-25', 'Navidad', 1),
  (1, '2027-01-01', 'Año Nuevo', 1)
ON DUPLICATE KEY UPDATE description = VALUES(description), is_recurring = VALUES(is_recurring);

INSERT INTO `tb_folio_sequences` (sequence_date, last_number)
VALUES
  ('2026-10-15', 1), ('2026-10-26', 1), ('2026-10-28', 1), ('2026-10-29', 1), ('2026-10-30', 2)
ON DUPLICATE KEY UPDATE last_number = GREATEST(last_number, VALUES(last_number));

-- ----------------------------------------------------------------------------
-- Justificantes de demostración
-- ----------------------------------------------------------------------------
INSERT INTO `tb_justifications`
  (id_justification, folio, id_student, id_status, id_reason_type, issue_date, start_date, end_date,
   is_critical, reason, observations, validity_days, expires_at, created_by, updated_by)
VALUES
  (1, 'JUS-20261026-0001', 1, 1, 1, '2026-10-26', '2026-10-26', '2026-10-26',
   1, 'Receta médica por infección respiratoria aguda. Se solicita justificar la inasistencia del día.',
   'La receta se adjunta en el expediente digital.', 5, NULL, 1, 1),
  (2, 'JUS-20261028-0001', 2, 1, 2, '2026-10-28', '2026-10-28', '2026-10-29',
   0, 'Consulta médica programada con especialista. Se anexa comprobante de la cita.',
   'Seguimiento médico en el IMSS.', 5, NULL, 5, 5),
  (3, 'JUS-20261029-0001', 3, 1, 3, '2026-10-29', '2026-10-29', '2026-10-29',
   0, 'Emergencia familiar que requirió traslado fuera de la ciudad.',
   'Se informó previamente al tutor educativo.', 5, NULL, 6, 6),
  (4, 'JUS-20261030-0001', 4, 1, 4, '2026-10-30', '2026-10-30', '2026-10-30',
   0, 'Trámite personal relacionado con documentación escolar.',
   'Solicitud sin comprobante suficiente.', 5, NULL, 1, 1),
  (5, 'JUS-20261015-0001', 5, 1, 5, '2026-10-15', '2026-10-15', '2026-10-15',
   0, 'Participación en la comisión institucional de vinculación.',
   'Actividad coordinada por la dirección de carrera.', 5, NULL, 1, 1),
  (6, 'JUS-20261030-0002', 6, 1, 1, '2026-10-30', '2026-10-30', '2026-10-30',
   1, 'Caso crítico de prueba pendiente de comprobante validado.',
   'Sirve para verificar la regla de comprobante obligatorio.', 5, NULL, 1, 1)
ON DUPLICATE KEY UPDATE folio = VALUES(folio);

INSERT INTO `tb_justification_absences` (id_justification, absence_date, notes)
VALUES
  (1, '2026-10-26', 'Inasistencia por enfermedad'),
  (2, '2026-10-28', 'Consulta médica'),
  (2, '2026-10-29', 'Reposo indicado'),
  (3, '2026-10-29', 'Traslado familiar'),
  (4, '2026-10-30', 'Trámite personal'),
  (5, '2026-10-15', 'Comisión institucional'),
  (6, '2026-10-30', 'Caso crítico de prueba')
ON DUPLICATE KEY UPDATE notes = VALUES(notes);

INSERT INTO `tbd_justification_subjects`
  (id_justification, id_subject, id_teacher, id_absence, observations)
SELECT 1, 1, 1, a.id_absence, NULL
FROM `tb_justification_absences` a
WHERE a.id_justification = 1 AND a.absence_date = '2026-10-26'
ON DUPLICATE KEY UPDATE observations = VALUES(observations);

INSERT INTO `tbd_justification_subjects`
  (id_justification, id_subject, id_teacher, id_absence, observations)
SELECT 1, 2, 3, a.id_absence, NULL
FROM `tb_justification_absences` a
WHERE a.id_justification = 1 AND a.absence_date = '2026-10-26'
ON DUPLICATE KEY UPDATE observations = VALUES(observations);

INSERT INTO `tbd_justification_subjects`
  (id_justification, id_subject, id_teacher, id_absence, observations)
SELECT 2, 1, 1, a.id_absence, NULL
FROM `tb_justification_absences` a
WHERE a.id_justification = 2 AND a.absence_date = '2026-10-28'
ON DUPLICATE KEY UPDATE observations = VALUES(observations);

INSERT INTO `tbd_justification_subjects`
  (id_justification, id_subject, id_teacher, id_absence, observations)
SELECT 2, 2, 3, a.id_absence, NULL
FROM `tb_justification_absences` a
WHERE a.id_justification = 2 AND a.absence_date = '2026-10-29'
ON DUPLICATE KEY UPDATE observations = VALUES(observations);

INSERT INTO `tbd_justification_subjects`
  (id_justification, id_subject, id_teacher, id_absence, observations)
SELECT 3, 1, 1, a.id_absence, NULL
FROM `tb_justification_absences` a
WHERE a.id_justification = 3 AND a.absence_date = '2026-10-29'
ON DUPLICATE KEY UPDATE observations = VALUES(observations);

INSERT INTO `tbd_justification_subjects`
  (id_justification, id_subject, id_teacher, id_absence, observations)
SELECT 4, 3, 3, a.id_absence, NULL
FROM `tb_justification_absences` a
WHERE a.id_justification = 4 AND a.absence_date = '2026-10-30'
ON DUPLICATE KEY UPDATE observations = VALUES(observations);

INSERT INTO `tbd_justification_subjects`
  (id_justification, id_subject, id_teacher, id_absence, observations)
SELECT 5, 2, 3, a.id_absence, NULL
FROM `tb_justification_absences` a
WHERE a.id_justification = 5 AND a.absence_date = '2026-10-15'
ON DUPLICATE KEY UPDATE observations = VALUES(observations);

INSERT INTO `tbd_justification_subjects`
  (id_justification, id_subject, id_teacher, id_absence, observations)
SELECT 6, 1, 1, a.id_absence, NULL
FROM `tb_justification_absences` a
WHERE a.id_justification = 6 AND a.absence_date = '2026-10-30'
ON DUPLICATE KEY UPDATE observations = VALUES(observations);

-- ----------------------------------------------------------------------------
-- Documentos ficticios
-- ----------------------------------------------------------------------------
INSERT INTO `tb_supporting_documents`
  (id_justification, id_document_type, original_name, stored_name, storage_path,
   mime_type, extension, file_size, checksum_sha256, uploaded_by, validation_status, validated_by, validated_at, notes)
VALUES
  (1, 1, 'receta-medica-demo-001.pdf', 'demo-receta-001.pdf', 'private/documents/demo-receta-001.pdf',
   'application/pdf', 'pdf', 24576, NULL, 1, 'validado', 2, NOW(), 'Documento ficticio de demostración'),
  (2, 2, 'justificante-medico-demo-002.pdf', 'demo-receta-002.pdf', 'private/documents/demo-receta-002.pdf',
   'application/pdf', 'pdf', 20480, NULL, 5, 'validado', 2, NOW(), 'Documento ficticio de demostración'),
  (3, 3, 'comprobante-cita-demo-003.pdf', 'demo-comprobante-003.pdf', 'private/documents/demo-comprobante-003.pdf',
   'application/pdf', 'pdf', 18432, NULL, 6, 'pendiente', NULL, NULL, NULL),
  (4, 4, 'comprobante-demo-004.pdf', 'demo-comprobante-004.pdf', 'private/documents/demo-comprobante-004.pdf',
   'application/pdf', 'pdf', 16384, NULL, 1, 'rechazado', 2, NOW(), 'No corresponde al motivo solicitado')
ON DUPLICATE KEY UPDATE validation_status = VALUES(validation_status), notes = VALUES(notes);

-- ----------------------------------------------------------------------------
-- Firmas de demostración
-- ----------------------------------------------------------------------------
INSERT INTO `tb_justification_signatures`
  (id_justification, signer_type, id_staff, id_guardian, signer_name, status, signed_at, signature_file_ref, signature_sha256, observations)
VALUES
  (1, 'padre_madre_tutor', NULL, 1, 'María Carrasco Vázquez', 'firmado', NOW(),
   'private/signatures/demo-firma-padre-001.svg', NULL, 'Firma ficticia'),
  (1, 'tutor_educativo', 1, NULL, 'MTI. Ricardo Luna Santos', 'firmado', NOW(),
   'private/signatures/demo-firma-tutor-001.svg', NULL, 'Firma ficticia'),
  (1, 'director_carrera', 2, NULL, 'Mtra. Altagracia Carrillo Parra', 'firmado', NOW(),
   'private/signatures/demo-firma-director-001.svg', NULL, 'Firma ficticia'),
  (2, 'padre_madre_tutor', NULL, 2, 'José López Hernández', 'pendiente', NULL, NULL, NULL, NULL),
  (2, 'tutor_educativo', 1, NULL, 'MTI. Ricardo Luna Santos', 'firmado', NOW(),
   'private/signatures/demo-firma-tutor-002.svg', NULL, 'Firma ficticia'),
  (2, 'director_carrera', 2, NULL, 'Mtra. Altagracia Carrillo Parra', 'pendiente', NULL, NULL, NULL, NULL),
  (5, 'tutor_educativo', 1, NULL, 'MTI. Ricardo Luna Santos', 'firmado', NOW(),
   'private/signatures/demo-firma-tutor-005.svg', NULL, 'Firma ficticia'),
  (5, 'director_carrera', 2, NULL, 'Mtra. Altagracia Carrillo Parra', 'firmado', NOW(),
   'private/signatures/demo-firma-director-005.svg', NULL, 'Firma ficticia')
ON DUPLICATE KEY UPDATE status = VALUES(status), signed_at = VALUES(signed_at);

-- ----------------------------------------------------------------------------
-- Transiciones de estado controladas por triggers
-- ----------------------------------------------------------------------------
SET @audit_user_id = 2;
UPDATE `tb_justifications`
SET id_status = 2, updated_by = 2
WHERE id_justification = 2 AND id_status = 1;

SET @audit_user_id = 3;
UPDATE `tb_justifications`
SET id_status = 2, updated_by = 3
WHERE id_justification = 1 AND id_status = 1;

UPDATE `tb_justifications`
SET id_status = 3, approved_by = 3, resolved_at = NOW(), updated_by = 3
WHERE id_justification = 1 AND id_status = 2;

UPDATE `tb_justifications`
SET id_status = 2, updated_by = 3
WHERE id_justification = 5 AND id_status = 1;

UPDATE `tb_justifications`
SET id_status = 3, approved_by = 3, resolved_at = NOW(), updated_by = 3
WHERE id_justification = 5 AND id_status = 2;

UPDATE `tb_justifications`
SET id_status = 6, resolved_at = NOW(), updated_by = 3
WHERE id_justification = 5 AND id_status = 3;

UPDATE `tb_justifications`
SET id_status = 4, rejected_by = 3, resolved_at = NOW(),
    rejection_comment = 'No se adjuntó documentación suficiente para acreditar el motivo.', updated_by = 3
WHERE id_justification = 4 AND id_status = 1;

-- ----------------------------------------------------------------------------
-- Sellos institucionales ficticios
-- ----------------------------------------------------------------------------
INSERT INTO `tb_institutional_stamps`
  (id_justification, id_institution, stamp_file_ref, stamp_sha256, applied_at, applied_by, observations)
VALUES
  (1, 1, 'private/stamps/demo-sello-001.svg', NULL, NOW(), 3, 'Sello ficticio de demostración'),
  (5, 1, 'private/stamps/demo-sello-005.svg', NULL, NOW(), 3, 'Sello ficticio de demostración')
ON DUPLICATE KEY UPDATE observations = VALUES(observations);

SET @audit_user_id = NULL;
SET @audit_source = NULL;
SET @audit_ip = NULL;

-- ----------------------------------------------------------------------------
-- Verificación rápida de los datos sembrados
-- ----------------------------------------------------------------------------
SELECT 'instituciones' AS tabla, COUNT(*) AS registros FROM `tb_institutions`
UNION ALL SELECT 'carreras', COUNT(*) FROM `tb_careers`
UNION ALL SELECT 'grupos', COUNT(*) FROM `tb_groups`
UNION ALL SELECT 'estudiantes', COUNT(*) FROM `tb_students`
UNION ALL SELECT 'docentes', COUNT(*) FROM `tb_teachers`
UNION ALL SELECT 'materias', COUNT(*) FROM `tb_subjects`
UNION ALL SELECT 'usuarios', COUNT(*) FROM `tb_users`
UNION ALL SELECT 'justificantes', COUNT(*) FROM `tb_justifications`
UNION ALL SELECT 'documentos', COUNT(*) FROM `tb_supporting_documents`
UNION ALL SELECT 'firmas', COUNT(*) FROM `tb_justification_signatures`
UNION ALL SELECT 'sellos', COUNT(*) FROM `tb_institutional_stamps`
UNION ALL SELECT 'historial_estados', COUNT(*) FROM `tb_justification_status_history`
UNION ALL SELECT 'auditoria', COUNT(*) FROM `tb_audit_logs`;
