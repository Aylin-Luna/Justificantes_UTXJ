-- ============================================================================
-- Sistema de Gestión de Justificantes Académicos - UTXJ
-- Script 04: funciones y procedimientos almacenados
-- ============================================================================
-- Ejecutar después de 03_foreign_keys_indexes.sql.
-- ============================================================================

USE `db_justificantes_utxj`;
SET NAMES utf8mb4;
SET time_zone = '-06:00';

-- ----------------------------------------------------------------------------
-- Función: cálculo de vigencia en días hábiles
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS `fn_calcular_vigencia_habiles`;

DELIMITER $$

CREATE FUNCTION `fn_calcular_vigencia_habiles`(
  p_fecha DATE,
  p_dias INT,
  p_id_institution INT UNSIGNED
)
RETURNS DATE
NOT DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE v_fecha DATE DEFAULT p_fecha;
  DECLARE v_contador INT DEFAULT 0;
  DECLARE v_no_habil TINYINT DEFAULT 0;

  IF p_fecha IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha base de vigencia es obligatoria';
  END IF;
  IF p_dias IS NULL OR p_dias < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los días de vigencia deben ser mayores o iguales a cero';
  END IF;

  WHILE v_contador < p_dias DO
    SET v_fecha = DATE_ADD(v_fecha, INTERVAL 1 DAY);
    SET v_no_habil = 0;

    IF DAYOFWEEK(v_fecha) IN (1,7) THEN
      SET v_no_habil = 1;
    END IF;

    IF v_no_habil = 0 AND EXISTS (
      SELECT 1
      FROM `tb_non_working_days` nwd
      WHERE (p_id_institution IS NULL OR nwd.id_institution = p_id_institution)
        AND (
          (nwd.is_recurring = 0 AND nwd.non_working_date = v_fecha)
          OR (nwd.is_recurring = 1
              AND MONTH(nwd.non_working_date) = MONTH(v_fecha)
              AND DAY(nwd.non_working_date) = DAY(v_fecha))
        )
    ) THEN
      SET v_no_habil = 1;
    END IF;

    IF v_no_habil = 0 THEN
      SET v_contador = v_contador + 1;
    END IF;
  END WHILE;

  RETURN v_fecha;
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: generar folio diario JUS-AAAAMMDD-####
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_generar_folio`;

CREATE PROCEDURE `sp_generar_folio`(
  IN p_fecha DATE,
  OUT p_folio VARCHAR(30)
)
BEGIN
  DECLARE v_numero INT UNSIGNED DEFAULT 0;

  IF p_fecha IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha del folio es obligatoria';
  END IF;

  INSERT INTO `tb_folio_sequences` (`sequence_date`, `last_number`)
  VALUES (p_fecha, 1)
  ON DUPLICATE KEY UPDATE `last_number` = `last_number` + 1;

  SELECT `last_number`
    INTO v_numero
  FROM `tb_folio_sequences`
  WHERE `sequence_date` = p_fecha;

  SET p_folio = CONCAT('JUS-', DATE_FORMAT(p_fecha, '%Y%m%d'), '-', LPAD(v_numero, 4, '0'));
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: calcular vigencia (wrapper expuesto a integraciones)
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_calcular_vigencia`;

CREATE PROCEDURE `sp_calcular_vigencia`(
  IN p_fecha DATE,
  IN p_dias INT,
  IN p_id_institution INT UNSIGNED,
  OUT p_resultado DATE
)
BEGIN
  SET p_resultado = `fn_calcular_vigencia_habiles`(p_fecha, p_dias, p_id_institution);
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: registrar un justificante completo
-- p_absence_dates: JSON ["2026-10-28","2026-10-29"]
-- p_subjects: JSON [{"id_subject":1,"id_teacher":2,"absence_date":"2026-10-28"}]
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_registrar_justificante`;

CREATE PROCEDURE `sp_registrar_justificante`(
  IN p_id_student INT UNSIGNED,
  IN p_issue_date DATE,
  IN p_start_date DATE,
  IN p_end_date DATE,
  IN p_is_critical TINYINT,
  IN p_id_reason_type INT UNSIGNED,
  IN p_reason TEXT,
  IN p_observations TEXT,
  IN p_id_institution INT UNSIGNED,
  IN p_created_by INT UNSIGNED,
  IN p_absence_dates JSON,
  IN p_subjects JSON,
  IN p_document_type_id INT UNSIGNED,
  IN p_original_name VARCHAR(255),
  IN p_stored_name VARCHAR(255),
  IN p_storage_path VARCHAR(500),
  IN p_mime_type VARCHAR(100),
  IN p_extension VARCHAR(10),
  IN p_file_size INT UNSIGNED,
  IN p_sha256 CHAR(64),
  OUT p_id_justification BIGINT UNSIGNED,
  OUT p_folio VARCHAR(30)
)
BEGIN
  DECLARE v_status_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_validity_days SMALLINT UNSIGNED DEFAULT 5;
  DECLARE v_expires_at DATE DEFAULT NULL;
  DECLARE v_institution INT UNSIGNED DEFAULT NULL;
  DECLARE v_absence_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_id_student IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El estudiante es obligatorio';
  END IF;
  IF p_issue_date IS NULL OR p_start_date IS NULL OR p_end_date IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las fechas del justificante son obligatorias';
  END IF;
  IF p_end_date < p_start_date THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha final no puede ser anterior a la inicial';
  END IF;
  IF p_reason IS NULL OR CHAR_LENGTH(TRIM(p_reason)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El motivo del justificante es obligatorio';
  END IF;
  IF p_is_critical IS NOT NULL AND p_is_critical NOT IN (0,1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El caso crítico solo acepta 0 o 1';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM `tb_students`
    WHERE id_student = p_id_student AND status = 'activo'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El estudiante no existe o no está activo';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM `tb_users`
    WHERE id_user = p_created_by AND active = 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El usuario creador no existe o no está activo';
  END IF;
  IF p_id_reason_type IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `tb_reason_types`
    WHERE id_reason_type = p_id_reason_type AND active = 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El tipo de motivo no existe o no está activo';
  END IF;
  IF p_absence_dates IS NOT NULL AND (JSON_VALID(p_absence_dates) = 0 OR JSON_TYPE(p_absence_dates) <> 'ARRAY') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'p_absence_dates debe ser un arreglo JSON';
  END IF;
  IF p_subjects IS NOT NULL AND (JSON_VALID(p_subjects) = 0 OR JSON_TYPE(p_subjects) <> 'ARRAY') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'p_subjects debe ser un arreglo JSON';
  END IF;

  SELECT id_status INTO v_status_id
  FROM `tb_justification_statuses`
  WHERE code = 'pendiente'
  LIMIT 1;

  IF v_status_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe el estado pendiente en el catálogo';
  END IF;

  SELECT CAST(setting_value AS UNSIGNED) INTO v_validity_days
  FROM `tb_system_settings`
  WHERE setting_key = 'validity_days'
  LIMIT 1;

  IF v_validity_days IS NULL OR v_validity_days < 1 THEN
    SET v_validity_days = 5;
  END IF;

  SELECT c.id_institution INTO v_institution
  FROM `tb_students` s
  JOIN `tb_groups` g ON g.id_group = s.id_group
  JOIN `tb_careers` c ON c.id_career = g.id_career
  WHERE s.id_student = p_id_student
  LIMIT 1;

  SET v_institution = COALESCE(p_id_institution, v_institution, 1);
  SET v_expires_at = `fn_calcular_vigencia_habiles`(p_issue_date, v_validity_days, v_institution);

  START TRANSACTION;

  CALL `sp_generar_folio`(p_issue_date, p_folio);

  INSERT INTO `tb_justifications` (
    folio, id_student, id_status, id_reason_type, issue_date, start_date, end_date,
    is_critical, reason, observations, validity_days, expires_at, created_by, updated_by
  ) VALUES (
    p_folio, p_id_student, v_status_id, p_id_reason_type, p_issue_date, p_start_date, p_end_date,
    COALESCE(p_is_critical, 0), p_reason, p_observations, v_validity_days, v_expires_at, p_created_by, p_created_by
  );

  SET p_id_justification = LAST_INSERT_ID();

  IF p_absence_dates IS NOT NULL THEN
    INSERT INTO `tb_justification_absences` (`id_justification`, `absence_date`)
    SELECT p_id_justification, jt.absence_date
    FROM JSON_TABLE(
      p_absence_dates,
      '$[*]' COLUMNS (`absence_date` DATE PATH '$')
    ) AS jt;
  END IF;

  SELECT COUNT(*) INTO v_absence_count
  FROM `tb_justification_absences`
  WHERE id_justification = p_id_justification;

  IF v_absence_count = 0 THEN
    INSERT INTO `tb_justification_absences` (`id_justification`, `absence_date`)
    VALUES (p_id_justification, p_start_date);
  END IF;

  IF p_subjects IS NOT NULL THEN
    INSERT INTO `tbd_justification_subjects`
      (`id_justification`, `id_subject`, `id_teacher`, `id_absence`, `observations`)
    SELECT
      p_id_justification,
      jt.id_subject,
      NULLIF(jt.id_teacher, 0),
      a.id_absence,
      jt.observations
    FROM JSON_TABLE(
      p_subjects,
      '$[*]' COLUMNS (
        `id_subject` INT PATH '$.id_subject',
        `id_teacher` INT PATH '$.id_teacher',
        `absence_date` DATE PATH '$.absence_date',
        `observations` VARCHAR(255) PATH '$.observations'
      )
    ) AS jt
    JOIN `tb_justification_absences` a
      ON a.id_justification = p_id_justification
     AND a.absence_date = COALESCE(jt.absence_date, p_start_date);
  END IF;

  IF p_stored_name IS NOT NULL THEN
    INSERT INTO `tb_supporting_documents` (
      id_justification, id_document_type, original_name, stored_name, storage_path,
      mime_type, extension, file_size, checksum_sha256, uploaded_by, validation_status, is_private
    ) VALUES (
      p_id_justification, p_document_type_id, p_original_name, p_stored_name, p_storage_path,
      p_mime_type, p_extension, p_file_size, p_sha256, p_created_by, 'pendiente', 1
    );
  END IF;

  COMMIT;
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: consultar justificantes por matrícula
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_consultar_justificantes_por_matricula`;

CREATE PROCEDURE `sp_consultar_justificantes_por_matricula`(
  IN p_enrollment VARCHAR(20)
)
BEGIN
  SELECT
    j.id_justification,
    j.folio,
    s.enrollment,
    CONCAT_WS(' ', s.first_name, s.last_name, s.second_last_name) AS student_name,
    c.name AS career_name,
    g.name AS group_name,
    g.grade,
    st.code AS status_code,
    st.name AS status_name,
    j.issue_date,
    j.start_date,
    j.end_date,
    j.is_critical,
    j.expires_at,
    j.created_at,
    (SELECT COUNT(*) FROM `tb_supporting_documents` d
      WHERE d.id_justification = j.id_justification) AS documents_count
  FROM `tb_justifications` j
  JOIN `tb_students` s ON s.id_student = j.id_student
  JOIN `tb_groups` g ON g.id_group = s.id_group
  JOIN `tb_careers` c ON c.id_career = g.id_career
  JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
  WHERE s.enrollment = p_enrollment
    AND j.deleted_at IS NULL
  ORDER BY j.created_at DESC;
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: consultar un justificante completo por folio
-- Devuelve varios resultados para reconstruir el documento institucional.
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_consultar_justificante_por_folio`;

CREATE PROCEDURE `sp_consultar_justificante_por_folio`(
  IN p_folio VARCHAR(30)
)
BEGIN
  SELECT
    j.id_justification, j.folio, j.issue_date, j.start_date, j.end_date,
    j.is_critical, j.reason, j.observations, j.validity_days, j.expires_at,
    j.created_at, j.updated_at,
    st.code AS status_code, st.name AS status_name,
    rt.name AS reason_type_name,
    s.enrollment, s.first_name, s.last_name, s.second_last_name,
    CONCAT_WS(' ', s.first_name, s.last_name, s.second_last_name) AS student_name,
    c.name AS career_name, g.name AS group_name, g.grade, g.shift,
    i.name AS institution_name, i.acronym AS institution_acronym
  FROM `tb_justifications` j
  JOIN `tb_students` s ON s.id_student = j.id_student
  JOIN `tb_groups` g ON g.id_group = s.id_group
  JOIN `tb_careers` c ON c.id_career = g.id_career
  JOIN `tb_institutions` i ON i.id_institution = c.id_institution
  JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
  LEFT JOIN `tb_reason_types` rt ON rt.id_reason_type = j.id_reason_type
  WHERE j.folio = p_folio AND j.deleted_at IS NULL
  LIMIT 1;

  SELECT a.absence_date, a.notes
  FROM `tb_justification_absences` a
  JOIN `tb_justifications` j ON j.id_justification = a.id_justification
  WHERE j.folio = p_folio
  ORDER BY a.absence_date;

  SELECT
    sub.code AS subject_code, sub.name AS subject_name,
    CONCAT_WS(' ', t.professional_title, t.first_name, t.last_name, t.second_last_name) AS teacher_name,
    a.absence_date, js.observations
  FROM `tbd_justification_subjects` js
  JOIN `tb_justifications` j ON j.id_justification = js.id_justification
  JOIN `tb_subjects` sub ON sub.id_subject = js.id_subject
  LEFT JOIN `tb_teachers` t ON t.id_teacher = js.id_teacher
  JOIN `tb_justification_absences` a ON a.id_absence = js.id_absence
  WHERE j.folio = p_folio
  ORDER BY a.absence_date, sub.name;

  SELECT
    d.id_document, dt.name AS document_type,
    d.extension, d.file_size, d.validation_status, d.uploaded_at, d.validated_at
  FROM `tb_supporting_documents` d
  JOIN `tb_justifications` j ON j.id_justification = d.id_justification
  JOIN `tb_document_types` dt ON dt.id_document_type = d.id_document_type
  WHERE j.folio = p_folio
  ORDER BY d.uploaded_at;

  SELECT
    sg.signer_type, sg.signer_name, sg.status, sg.signed_at,
    sg.signature_sha256
  FROM `tb_justification_signatures` sg
  JOIN `tb_justifications` j ON j.id_justification = sg.id_justification
  WHERE j.folio = p_folio
  ORDER BY FIELD(sg.signer_type, 'padre_madre_tutor', 'tutor_educativo', 'director_carrera');

  SELECT st.id_stamp, i.name AS institution_name, st.applied_at, st.stamp_sha256
  FROM `tb_institutional_stamps` st
  JOIN `tb_justifications` j ON j.id_justification = st.id_justification
  JOIN `tb_institutions` i ON i.id_institution = st.id_institution
  WHERE j.folio = p_folio;

  SELECT hs.changed_at, sfrom.code AS status_from, sto.code AS status_to,
         u.full_name AS changed_by_name, hs.comment
  FROM `tb_justification_status_history` hs
  JOIN `tb_justifications` j ON j.id_justification = hs.id_justification
  LEFT JOIN `tb_justification_statuses` sfrom ON sfrom.id_status = hs.id_status_from
  JOIN `tb_justification_statuses` sto ON sto.id_status = hs.id_status_to
  LEFT JOIN `tb_users` u ON u.id_user = hs.changed_by
  WHERE j.folio = p_folio
  ORDER BY hs.changed_at;
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: justificantes pendientes y en revisión
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_obtener_justificantes_pendientes`;

CREATE PROCEDURE `sp_obtener_justificantes_pendientes`()
BEGIN
  SELECT
    j.id_justification, j.folio, s.enrollment,
    CONCAT_WS(' ', s.first_name, s.last_name, s.second_last_name) AS student_name,
    c.name AS career_name, g.name AS group_name,
    st.code AS status_code, j.issue_date, j.start_date, j.end_date,
    j.is_critical, j.expires_at, j.created_at,
    (SELECT COUNT(*) FROM `tb_supporting_documents` d
      WHERE d.id_justification = j.id_justification) AS documents_count,
    (SELECT COUNT(*) FROM `tb_justification_signatures` sg
      WHERE sg.id_justification = j.id_justification AND sg.status = 'firmado') AS signatures_count
  FROM `tb_justifications` j
  JOIN `tb_students` s ON s.id_student = j.id_student
  JOIN `tb_groups` g ON g.id_group = s.id_group
  JOIN `tb_careers` c ON c.id_career = g.id_career
  JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
  WHERE st.code IN ('pendiente','en_revision')
    AND j.deleted_at IS NULL
  ORDER BY j.issue_date ASC, j.created_at ASC;
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: cambiar estado con reglas de negocio y trazabilidad
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_cambiar_estado_justificante`;

CREATE PROCEDURE `sp_cambiar_estado_justificante`(
  IN p_id_justification BIGINT UNSIGNED,
  IN p_new_status_code VARCHAR(20),
  IN p_user_id INT UNSIGNED,
  IN p_comment VARCHAR(500),
  OUT p_ok TINYINT
)
BEGIN
  DECLARE v_old_status INT UNSIGNED DEFAULT NULL;
  DECLARE v_old_code VARCHAR(20) DEFAULT NULL;
  DECLARE v_new_status INT UNSIGNED DEFAULT NULL;
  DECLARE v_new_code VARCHAR(20) DEFAULT NULL;
  DECLARE v_is_critical TINYINT DEFAULT 0;
  DECLARE v_documents INT DEFAULT 0;
  DECLARE v_signatures INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET p_ok = 0;

  START TRANSACTION;

  SELECT j.id_status, st.code, j.is_critical
    INTO v_old_status, v_old_code, v_is_critical
  FROM `tb_justifications` j
  JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
  WHERE j.id_justification = p_id_justification
    AND j.deleted_at IS NULL
  FOR UPDATE;

  IF v_old_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El justificante no existe';
  END IF;

  SELECT id_status, code
    INTO v_new_status, v_new_code
  FROM `tb_justification_statuses`
  WHERE code = p_new_status_code
  LIMIT 1;

  IF v_new_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El estado destino no existe';
  END IF;
  IF v_old_code = v_new_code THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El justificante ya tiene ese estado';
  END IF;

  IF NOT (
    (v_old_code = 'pendiente' AND v_new_code IN ('en_revision','aprobado','rechazado','cancelado'))
    OR (v_old_code = 'en_revision' AND v_new_code IN ('pendiente','aprobado','rechazado','cancelado'))
    OR (v_old_code = 'aprobado' AND v_new_code = 'vencido')
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Transición de estado no permitida';
  END IF;

  IF v_new_code IN ('rechazado','cancelado')
     AND (p_comment IS NULL OR CHAR_LENGTH(TRIM(p_comment)) = 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El rechazo o la cancelación requieren comentario';
  END IF;

  IF v_new_code = 'aprobado' AND v_is_critical = 1 THEN
    SELECT COUNT(*) INTO v_documents
    FROM `tb_supporting_documents`
    WHERE id_justification = p_id_justification
      AND validation_status = 'validado';
    IF v_documents = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un caso crítico requiere un comprobante validado';
    END IF;
  END IF;

  IF v_new_code = 'aprobado' THEN
    SELECT COUNT(DISTINCT signer_type) INTO v_signatures
    FROM `tb_justification_signatures`
    WHERE id_justification = p_id_justification
      AND status = 'firmado'
      AND signer_type IN ('tutor_educativo','director_carrera');
    IF v_signatures < 2 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Se requieren las firmas del tutor y de la dirección';
    END IF;
  END IF;

  IF v_new_code = 'aprobado' THEN
    UPDATE `tb_justifications`
    SET id_status = v_new_status,
        approved_by = p_user_id,
        rejected_by = NULL,
        resolved_at = NOW(),
        rejection_comment = NULL,
        updated_by = p_user_id,
        version = version + 1
    WHERE id_justification = p_id_justification;
  ELSEIF v_new_code = 'rechazado' THEN
    UPDATE `tb_justifications`
    SET id_status = v_new_status,
        rejected_by = p_user_id,
        approved_by = NULL,
        resolved_at = NOW(),
        rejection_comment = p_comment,
        updated_by = p_user_id,
        version = version + 1
    WHERE id_justification = p_id_justification;
  ELSEIF v_new_code = 'vencido' THEN
    UPDATE `tb_justifications`
    SET id_status = v_new_status,
        resolved_at = COALESCE(resolved_at, NOW()),
        updated_by = p_user_id,
        version = version + 1
    WHERE id_justification = p_id_justification;
  ELSEIF v_new_code = 'cancelado' THEN
    UPDATE `tb_justifications`
    SET id_status = v_new_status,
        resolved_at = NOW(),
        rejection_comment = p_comment,
        updated_by = p_user_id,
        version = version + 1
    WHERE id_justification = p_id_justification;
  ELSE
    UPDATE `tb_justifications`
    SET id_status = v_new_status,
        resolved_at = NULL,
        rejection_comment = NULL,
        updated_by = p_user_id,
        version = version + 1
    WHERE id_justification = p_id_justification;
  END IF;

  COMMIT;
  SET p_ok = 1;
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: registrar una materia afectada en una fecha de inasistencia
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_registrar_materia_afectada`;

CREATE PROCEDURE `sp_registrar_materia_afectada`(
  IN p_id_justification BIGINT UNSIGNED,
  IN p_id_subject INT UNSIGNED,
  IN p_id_teacher INT UNSIGNED,
  IN p_absence_date DATE,
  IN p_observations VARCHAR(255),
  OUT p_id_justification_subject BIGINT UNSIGNED
)
BEGIN
  DECLARE v_start DATE DEFAULT NULL;
  DECLARE v_end DATE DEFAULT NULL;
  DECLARE v_final TINYINT DEFAULT 0;
  DECLARE v_student_career INT UNSIGNED DEFAULT NULL;
  DECLARE v_subject_career INT UNSIGNED DEFAULT NULL;
  DECLARE v_absence_date DATE DEFAULT NULL;
  DECLARE v_id_absence BIGINT UNSIGNED DEFAULT NULL;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT j.start_date, j.end_date, st.is_final
    INTO v_start, v_end, v_final
  FROM `tb_justifications` j
  JOIN `tb_students` s ON s.id_student = j.id_student
  JOIN `tb_groups` g ON g.id_group = s.id_group
  JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
  WHERE j.id_justification = p_id_justification
    AND j.deleted_at IS NULL
  FOR UPDATE;

  IF v_start IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El justificante no existe';
  END IF;
  IF v_final = 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden agregar materias a un justificante finalizado';
  END IF;

  SELECT c.id_career INTO v_student_career
  FROM `tb_justifications` j
  JOIN `tb_students` s ON s.id_student = j.id_student
  JOIN `tb_groups` g ON g.id_group = s.id_group
  JOIN `tb_careers` c ON c.id_career = g.id_career
  WHERE j.id_justification = p_id_justification
  LIMIT 1;

  SELECT id_career INTO v_subject_career
  FROM `tb_subjects`
  WHERE id_subject = p_id_subject AND active = 1
  LIMIT 1;

  IF v_subject_career IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La materia no existe o no está activa';
  END IF;
  IF v_student_career <> v_subject_career THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La materia no pertenece a la carrera del estudiante';
  END IF;
  IF p_id_teacher IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM `tb_teachers` WHERE id_teacher = p_id_teacher AND active = 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El docente no existe o no está activo';
  END IF;

  SET v_absence_date = COALESCE(p_absence_date, v_start);
  IF v_absence_date < v_start OR v_absence_date > v_end THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha no está dentro del periodo del justificante';
  END IF;

  SELECT id_absence INTO v_id_absence
  FROM `tb_justification_absences`
  WHERE id_justification = p_id_justification
    AND absence_date = v_absence_date
  LIMIT 1;

  IF v_id_absence IS NULL THEN
    INSERT INTO `tb_justification_absences` (`id_justification`, `absence_date`)
    VALUES (p_id_justification, v_absence_date);
    SET v_id_absence = LAST_INSERT_ID();
  END IF;

  INSERT INTO `tbd_justification_subjects`
    (`id_justification`, `id_subject`, `id_teacher`, `id_absence`, `observations`)
  VALUES
    (p_id_justification, p_id_subject, p_id_teacher, v_id_absence, p_observations)
  ON DUPLICATE KEY UPDATE
    id_justification_subject = LAST_INSERT_ID(id_justification_subject),
    id_teacher = VALUES(id_teacher),
    observations = VALUES(observations);

  SET p_id_justification_subject = LAST_INSERT_ID();
  COMMIT;
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: registrar documento comprobatorio
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_registrar_documento_comprobante`;

CREATE PROCEDURE `sp_registrar_documento_comprobante`(
  IN p_id_justification BIGINT UNSIGNED,
  IN p_id_document_type INT UNSIGNED,
  IN p_original_name VARCHAR(255),
  IN p_stored_name VARCHAR(255),
  IN p_storage_path VARCHAR(500),
  IN p_mime_type VARCHAR(100),
  IN p_extension VARCHAR(10),
  IN p_file_size INT UNSIGNED,
  IN p_sha256 CHAR(64),
  IN p_uploaded_by INT UNSIGNED,
  OUT p_id_document BIGINT UNSIGNED
)
BEGIN
  DECLARE v_final TINYINT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT st.is_final INTO v_final
  FROM `tb_justifications` j
  JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
  WHERE j.id_justification = p_id_justification
  LIMIT 1;

  IF v_final IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El justificante no existe';
  END IF;
  IF v_final = 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden agregar documentos a un justificante finalizado';
  END IF;
  IF p_stored_name IS NULL OR p_storage_path IS NULL OR p_mime_type IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los metadatos del archivo son obligatorios';
  END IF;

  START TRANSACTION;

  INSERT INTO `tb_supporting_documents` (
    id_justification, id_document_type, original_name, stored_name, storage_path,
    mime_type, extension, file_size, checksum_sha256, uploaded_by, validation_status, is_private
  ) VALUES (
    p_id_justification, p_id_document_type, p_original_name, p_stored_name, p_storage_path,
    p_mime_type, p_extension, p_file_size, p_sha256, p_uploaded_by, 'pendiente', 1
  );

  SET p_id_document = LAST_INSERT_ID();
  COMMIT;
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: validar o rechazar un documento
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_validar_documento_comprobante`;

CREATE PROCEDURE `sp_validar_documento_comprobante`(
  IN p_id_document BIGINT UNSIGNED,
  IN p_validation_status VARCHAR(20),
  IN p_validated_by INT UNSIGNED,
  IN p_notes VARCHAR(500)
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_validation_status NOT IN ('pendiente','validado','rechazado') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Estado de validación inválido';
  END IF;
  IF p_validation_status = 'rechazado' AND (p_notes IS NULL OR CHAR_LENGTH(TRIM(p_notes)) = 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El rechazo del documento requiere una observación';
  END IF;

  START TRANSACTION;

  UPDATE `tb_supporting_documents`
  SET validation_status = p_validation_status,
      validated_by = p_validated_by,
      validated_at = CASE WHEN p_validation_status = 'pendiente' THEN NULL ELSE NOW() END,
      notes = p_notes
  WHERE id_document = p_id_document;

  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El documento no existe';
  END IF;

  COMMIT;
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: registrar firma
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_registrar_firma`;

CREATE PROCEDURE `sp_registrar_firma`(
  IN p_id_justification BIGINT UNSIGNED,
  IN p_signer_type VARCHAR(30),
  IN p_id_staff INT UNSIGNED,
  IN p_id_guardian INT UNSIGNED,
  IN p_signer_name VARCHAR(180),
  IN p_signature_file_ref VARCHAR(500),
  IN p_signature_sha256 CHAR(64),
  OUT p_id_signature BIGINT UNSIGNED
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_signer_type NOT IN ('padre_madre_tutor','tutor_educativo','director_carrera') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tipo de firmante inválido';
  END IF;
  IF p_signer_name IS NULL OR CHAR_LENGTH(TRIM(p_signer_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El nombre del firmante es obligatorio';
  END IF;
  IF p_signature_file_ref IS NULL OR CHAR_LENGTH(TRIM(p_signature_file_ref)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La referencia del archivo de firma es obligatoria';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM `tb_justifications` WHERE id_justification = p_id_justification
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El justificante no existe';
  END IF;

  START TRANSACTION;

  INSERT INTO `tb_justification_signatures` (
    id_justification, signer_type, id_staff, id_guardian, signer_name,
    status, signed_at, signature_file_ref, signature_sha256
  ) VALUES (
    p_id_justification, p_signer_type, p_id_staff, p_id_guardian, p_signer_name,
    'firmado', NOW(), p_signature_file_ref, p_signature_sha256
  )
  ON DUPLICATE KEY UPDATE
    id_signature = LAST_INSERT_ID(id_signature),
    signer_name = VALUES(signer_name),
    id_staff = VALUES(id_staff),
    id_guardian = VALUES(id_guardian),
    status = 'firmado',
    signed_at = NOW(),
    signature_file_ref = VALUES(signature_file_ref),
    signature_sha256 = VALUES(signature_sha256);

  SET p_id_signature = LAST_INSERT_ID();
  COMMIT;
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: registrar sello institucional
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_registrar_sello`;

CREATE PROCEDURE `sp_registrar_sello`(
  IN p_id_justification BIGINT UNSIGNED,
  IN p_id_institution INT UNSIGNED,
  IN p_stamp_file_ref VARCHAR(500),
  IN p_stamp_sha256 CHAR(64),
  IN p_applied_by INT UNSIGNED,
  OUT p_id_stamp BIGINT UNSIGNED
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_stamp_file_ref IS NULL OR CHAR_LENGTH(TRIM(p_stamp_file_ref)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La referencia del sello es obligatoria';
  END IF;

  START TRANSACTION;

  INSERT INTO `tb_institutional_stamps` (
    id_justification, id_institution, stamp_file_ref, stamp_sha256, applied_at, applied_by
  ) VALUES (
    p_id_justification, p_id_institution, p_stamp_file_ref, p_stamp_sha256, NOW(), p_applied_by
  )
  ON DUPLICATE KEY UPDATE
    id_stamp = LAST_INSERT_ID(id_stamp);

  SET p_id_stamp = LAST_INSERT_ID();
  COMMIT;
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: consultar justificantes por rango de fechas
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_consultar_justificantes_por_fechas`;

CREATE PROCEDURE `sp_consultar_justificantes_por_fechas`(
  IN p_desde DATE,
  IN p_hasta DATE,
  IN p_id_institution INT UNSIGNED
)
BEGIN
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El rango de fechas es inválido';
  END IF;

  SELECT
    j.id_justification, j.folio, s.enrollment,
    CONCAT_WS(' ', s.first_name, s.last_name, s.second_last_name) AS student_name,
    c.name AS career_name, g.name AS group_name,
    st.code AS status_code, j.issue_date, j.start_date, j.end_date,
    j.is_critical, j.expires_at
  FROM `tb_justifications` j
  JOIN `tb_students` s ON s.id_student = j.id_student
  JOIN `tb_groups` g ON g.id_group = s.id_group
  JOIN `tb_careers` c ON c.id_career = g.id_career
  JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
  WHERE j.deleted_at IS NULL
    AND (p_id_institution IS NULL OR c.id_institution = p_id_institution)
    AND (
      j.issue_date BETWEEN p_desde AND p_hasta
      OR j.start_date BETWEEN p_desde AND p_hasta
      OR j.end_date BETWEEN p_desde AND p_hasta
      OR EXISTS (
        SELECT 1 FROM `tb_justification_absences` a
        WHERE a.id_justification = j.id_justification
          AND a.absence_date BETWEEN p_desde AND p_hasta
      )
    )
  ORDER BY j.issue_date, j.folio;
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: historial de estados y auditoría de un justificante
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_obtener_historial_justificante`;

CREATE PROCEDURE `sp_obtener_historial_justificante`(
  IN p_id_justification BIGINT UNSIGNED
)
BEGIN
  SELECT
    hs.changed_at,
    sfrom.code AS status_from,
    sto.code AS status_to,
    u.full_name AS changed_by_name,
    hs.comment
  FROM `tb_justification_status_history` hs
  LEFT JOIN `tb_justification_statuses` sfrom ON sfrom.id_status = hs.id_status_from
  JOIN `tb_justification_statuses` sto ON sto.id_status = hs.id_status_to
  LEFT JOIN `tb_users` u ON u.id_user = hs.changed_by
  WHERE hs.id_justification = p_id_justification
  ORDER BY hs.changed_at;

  SELECT
    a.changed_at,
    a.operation,
    a.user_id,
    a.change_description
  FROM `tb_audit_logs` a
  WHERE a.table_name = 'tb_justifications'
    AND a.record_id = CAST(p_id_justification AS CHAR)
  ORDER BY a.changed_at;
END$$

-- ----------------------------------------------------------------------------
-- Procedimiento: marcar como vencidos los justificantes aprobados
-- ----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_vencer_justificantes`;

CREATE PROCEDURE `sp_vencer_justificantes`(
  IN p_user_id INT UNSIGNED
)
BEGIN
  DECLARE v_status_vencido INT UNSIGNED DEFAULT NULL;
  DECLARE v_afectados INT DEFAULT 0;

  SELECT id_status INTO v_status_vencido
  FROM `tb_justification_statuses`
  WHERE code = 'vencido'
  LIMIT 1;

  IF v_status_vencido IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe el estado vencido';
  END IF;

  SET @audit_user_id = p_user_id;
  SET @audit_source = 'sp_vencer_justificantes';

  UPDATE `tb_justifications` j
  JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
  SET j.id_status = v_status_vencido,
      j.resolved_at = COALESCE(j.resolved_at, NOW()),
      j.updated_by = p_user_id,
      j.version = j.version + 1
  WHERE st.code = 'aprobado'
    AND j.expires_at IS NOT NULL
    AND j.expires_at < CURDATE()
    AND j.deleted_at IS NULL;

  SET v_afectados = ROW_COUNT();
  SELECT v_afectados AS justificantes_vencidos;
END$$

DELIMITER ;
