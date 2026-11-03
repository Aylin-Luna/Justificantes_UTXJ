-- ============================================================================
-- Sistema de Gestión de Justificantes Académicos - UTXJ
-- Script 05: triggers de negocio y auditoría
-- ============================================================================
-- El backend establece las variables de sesión @audit_user_id, @audit_ip y
-- @audit_source antes de cada operación auditada. Los triggers nunca guardan
-- contraseñas, motivos médicos, nombres de archivos médicos ni rutas privadas.
-- ============================================================================

USE `db_justificantes_utxj`;
SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- Reglas de negocio: justificantes
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_justifications_before_insert`;
DELIMITER $$
CREATE TRIGGER `trg_justifications_before_insert`
BEFORE INSERT ON `tb_justifications`
FOR EACH ROW
BEGIN
  DECLARE v_validity SMALLINT UNSIGNED DEFAULT 5;
  DECLARE v_institution INT UNSIGNED DEFAULT 1;

  IF NEW.folio IS NULL OR CHAR_LENGTH(TRIM(NEW.folio)) < 10 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El folio es obligatorio y debe generarse en el servidor';
  END IF;
  IF NEW.reason IS NULL OR CHAR_LENGTH(TRIM(NEW.reason)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El motivo del justificante es obligatorio';
  END IF;
  IF NEW.end_date < NEW.start_date THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha final no puede ser anterior a la inicial';
  END IF;
  IF NEW.is_critical NOT IN (0,1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El caso crítico solo acepta Sí o No';
  END IF;
  IF NEW.issue_date IS NULL OR NEW.start_date IS NULL OR NEW.end_date IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las fechas del justificante son obligatorias';
  END IF;

  IF NEW.expires_at IS NULL THEN
    SELECT CAST(setting_value AS UNSIGNED) INTO v_validity
    FROM `tb_system_settings`
    WHERE setting_key = 'validity_days'
    LIMIT 1;

    IF v_validity IS NULL OR v_validity < 1 THEN
      SET v_validity = 5;
    END IF;

    SELECT c.id_institution INTO v_institution
    FROM `tb_students` s
    JOIN `tb_groups` g ON g.id_group = s.id_group
    JOIN `tb_careers` c ON c.id_career = g.id_career
    WHERE s.id_student = NEW.id_student
    LIMIT 1;

    SET NEW.validity_days = v_validity;
    SET NEW.expires_at = `fn_calcular_vigencia_habiles`(NEW.issue_date, v_validity, COALESCE(v_institution, 1));
  END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `trg_justifications_before_update`;
DELIMITER $$
CREATE TRIGGER `trg_justifications_before_update`
BEFORE UPDATE ON `tb_justifications`
FOR EACH ROW
BEGIN
  DECLARE v_old_final TINYINT DEFAULT 0;
  DECLARE v_old_code VARCHAR(20) DEFAULT NULL;
  DECLARE v_new_code VARCHAR(20) DEFAULT NULL;
  DECLARE v_documents INT DEFAULT 0;
  DECLARE v_signatures INT DEFAULT 0;

  SELECT is_final, code INTO v_old_final, v_old_code
  FROM `tb_justification_statuses` WHERE id_status = OLD.id_status LIMIT 1;

  SELECT code INTO v_new_code
  FROM `tb_justification_statuses` WHERE id_status = NEW.id_status LIMIT 1;

  IF v_new_code IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El estado destino no existe';
  END IF;

  IF NEW.folio <> OLD.folio OR NEW.id_student <> OLD.id_student
     OR NEW.created_by <> OLD.created_by OR NEW.issue_date <> OLD.issue_date THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Folio, estudiante, creador y fecha de emisión son inmutables';
  END IF;

  IF v_old_final = 1 THEN
    IF NEW.id_status <> OLD.id_status
       OR NOT (NEW.reason <=> OLD.reason)
       OR NOT (NEW.observations <=> OLD.observations)
       OR NEW.start_date <> OLD.start_date
       OR NEW.end_date <> OLD.end_date
       OR NEW.is_critical <> OLD.is_critical
       OR NOT (NEW.id_reason_type <=> OLD.id_reason_type)
       OR NEW.validity_days <> OLD.validity_days
       OR NOT (NEW.expires_at <=> OLD.expires_at)
       OR NOT (NEW.approved_by <=> OLD.approved_by)
       OR NOT (NEW.rejected_by <=> OLD.rejected_by)
       OR NOT (NEW.rejection_comment <=> OLD.rejection_comment)
    THEN
      IF NOT (v_old_code = 'aprobado' AND v_new_code = 'vencido') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un justificante finalizado no puede modificarse sin autorización';
      END IF;
    END IF;
  END IF;

  IF NEW.reason IS NULL OR CHAR_LENGTH(TRIM(NEW.reason)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El motivo del justificante es obligatorio';
  END IF;
  IF NEW.end_date < NEW.start_date THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha final no puede ser anterior a la inicial';
  END IF;
  IF NEW.is_critical NOT IN (0,1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El caso crítico solo acepta Sí o No';
  END IF;

  IF v_new_code = 'aprobado' THEN
    IF NEW.is_critical = 1 THEN
      SELECT COUNT(*) INTO v_documents
      FROM `tb_supporting_documents`
      WHERE id_justification = OLD.id_justification AND validation_status = 'validado';
      IF v_documents = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un caso crítico requiere un comprobante validado';
      END IF;
    END IF;

    SELECT COUNT(DISTINCT signer_type) INTO v_signatures
    FROM `tb_justification_signatures`
    WHERE id_justification = OLD.id_justification
      AND status = 'firmado'
      AND signer_type IN ('tutor_educativo','director_carrera');
    IF v_signatures < 2 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Se requieren las firmas del tutor y de la dirección';
    END IF;
  END IF;

  IF v_new_code IN ('rechazado','cancelado')
     AND (NEW.rejection_comment IS NULL OR CHAR_LENGTH(TRIM(NEW.rejection_comment)) = 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El rechazo o la cancelación requieren comentario';
  END IF;

  IF NEW.id_status <> OLD.id_status THEN
    IF v_new_code IN ('aprobado','rechazado','cancelado','vencido') THEN
      SET NEW.resolved_at = COALESCE(NEW.resolved_at, NOW());
    ELSE
      SET NEW.resolved_at = NULL;
    END IF;
  END IF;

  IF NEW.version = OLD.version THEN
    SET NEW.version = OLD.version + 1;
  END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `trg_justifications_after_update`;
DELIMITER $$
CREATE TRIGGER `trg_justifications_after_update`
AFTER UPDATE ON `tb_justifications`
FOR EACH ROW
BEGIN
  DECLARE v_from_code VARCHAR(20) DEFAULT NULL;
  DECLARE v_to_code VARCHAR(20) DEFAULT NULL;
  DECLARE v_user INT UNSIGNED DEFAULT NULL;

  IF NEW.id_status <> OLD.id_status THEN
    SELECT code INTO v_from_code FROM `tb_justification_statuses` WHERE id_status = OLD.id_status LIMIT 1;
    SELECT code INTO v_to_code FROM `tb_justification_statuses` WHERE id_status = NEW.id_status LIMIT 1;
    SET v_user = COALESCE(@audit_user_id, NEW.updated_by);

    INSERT INTO `tb_justification_status_history`
      (id_justification, id_status_from, id_status_to, changed_by, changed_at, comment)
    VALUES
      (NEW.id_justification, OLD.id_status, NEW.id_status, v_user, NOW(),
       CONCAT('Cambio de estado: ', COALESCE(v_from_code,'?'), ' -> ', COALESCE(v_to_code,'?')));
  END IF;
END$$
DELIMITER ;

-- ----------------------------------------------------------------------------
-- Reglas de negocio: fechas de inasistencia
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_absences_before_insert`;
DELIMITER $$
CREATE TRIGGER `trg_absences_before_insert`
BEFORE INSERT ON `tb_justification_absences`
FOR EACH ROW
BEGIN
  DECLARE v_start DATE DEFAULT NULL;
  DECLARE v_end DATE DEFAULT NULL;
  DECLARE v_final TINYINT DEFAULT 0;

  SELECT j.start_date, j.end_date, st.is_final
    INTO v_start, v_end, v_final
  FROM `tb_justifications` j
  JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
  WHERE j.id_justification = NEW.id_justification
  LIMIT 1;

  IF v_start IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El justificante de la fecha no existe';
  END IF;
  IF v_final = 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden agregar fechas a un justificante finalizado';
  END IF;
  IF NEW.absence_date < v_start OR NEW.absence_date > v_end THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha de inasistencia está fuera del periodo';
  END IF;
END$$
DELIMITER ;

-- ----------------------------------------------------------------------------
-- Reglas de negocio: documentos comprobatorios
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_documents_before_insert`;
DELIMITER $$
CREATE TRIGGER `trg_documents_before_insert`
BEFORE INSERT ON `tb_supporting_documents`
FOR EACH ROW
BEGIN
  DECLARE v_final TINYINT DEFAULT 0;

  SELECT st.is_final INTO v_final
  FROM `tb_justifications` j
  JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
  WHERE j.id_justification = NEW.id_justification
  LIMIT 1;

  IF v_final IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El justificante del documento no existe';
  END IF;
  IF v_final = 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pueden agregar documentos a un justificante finalizado';
  END IF;
  IF NEW.is_private <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los comprobantes deben ser privados';
  END IF;
  IF NEW.extension NOT IN ('pdf','jpg','jpeg','png') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se permiten extensiones pdf, jpg o png';
  END IF;
  IF NEW.file_size <= 0 OR NEW.file_size > 5242880 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El tamaño del archivo debe ser mayor a 0 y máximo 5 MB';
  END IF;
  IF NOT (
    (NEW.extension = 'pdf' AND NEW.mime_type = 'application/pdf')
    OR (NEW.extension IN ('jpg','jpeg') AND NEW.mime_type = 'image/jpeg')
    OR (NEW.extension = 'png' AND NEW.mime_type = 'image/png')
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El tipo MIME no coincide con la extensión';
  END IF;
  IF NEW.storage_path LIKE 'http%'
     OR NEW.storage_path LIKE 'public/%'
     OR NEW.storage_path LIKE '%/public/%'
     OR NEW.stored_name LIKE '%/%'
     OR NEW.stored_name LIKE '%\\%' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La ruta del comprobante debe ser privada y relativa';
  END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `trg_documents_before_update`;
DELIMITER $$
CREATE TRIGGER `trg_documents_before_update`
BEFORE UPDATE ON `tb_supporting_documents`
FOR EACH ROW
BEGIN
  IF NEW.id_justification <> OLD.id_justification
     OR NEW.stored_name <> OLD.stored_name
     OR NEW.storage_path <> OLD.storage_path
     OR NEW.extension <> OLD.extension
     OR NEW.mime_type <> OLD.mime_type
     OR NEW.file_size <> OLD.file_size THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los datos físicos del documento son inmutables';
  END IF;

  IF NEW.validation_status = 'validado' AND NEW.validated_by IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La validación requiere indicar al responsable';
  END IF;
  IF NEW.validation_status = 'rechazado'
     AND (NEW.notes IS NULL OR CHAR_LENGTH(TRIM(NEW.notes)) = 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El rechazo del documento requiere observación';
  END IF;
  IF NEW.validation_status <> 'pendiente' THEN
    SET NEW.validated_at = COALESCE(NEW.validated_at, NOW());
  ELSE
    SET NEW.validated_at = NULL;
    SET NEW.validated_by = NULL;
  END IF;
END$$
DELIMITER ;

-- ----------------------------------------------------------------------------
-- Reglas de negocio: firmas y sellos
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_signatures_before_insert`;
DELIMITER $$
CREATE TRIGGER `trg_signatures_before_insert`
BEFORE INSERT ON `tb_justification_signatures`
FOR EACH ROW
BEGIN
  IF NEW.signer_name IS NULL OR CHAR_LENGTH(TRIM(NEW.signer_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El nombre del firmante es obligatorio';
  END IF;
  IF NEW.status = 'firmado' AND (NEW.signed_at IS NULL OR NEW.signature_file_ref IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una firma firmada requiere fecha y archivo';
  END IF;
  IF NEW.signature_file_ref LIKE 'http%'
     OR NEW.signature_file_ref LIKE 'public/%'
     OR NEW.signature_file_ref LIKE '%/public/%' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El archivo de firma debe estar en una ruta privada';
  END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `trg_signatures_before_update`;
DELIMITER $$
CREATE TRIGGER `trg_signatures_before_update`
BEFORE UPDATE ON `tb_justification_signatures`
FOR EACH ROW
BEGIN
  IF OLD.status = 'firmado' AND (
    NOT (NEW.signature_file_ref <=> OLD.signature_file_ref)
    OR NOT (NEW.signer_name <=> OLD.signer_name)
    OR NEW.signer_type <> OLD.signer_type
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una firma ya registrada no puede sustituirse';
  END IF;
  IF NEW.status = 'firmado' THEN
    IF NEW.signature_file_ref IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La firma requiere un archivo';
    END IF;
    SET NEW.signed_at = COALESCE(NEW.signed_at, NOW());
  END IF;
  IF NEW.signature_file_ref LIKE 'http%'
     OR NEW.signature_file_ref LIKE 'public/%'
     OR NEW.signature_file_ref LIKE '%/public/%' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El archivo de firma debe estar en una ruta privada';
  END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `trg_stamps_before_insert`;
DELIMITER $$
CREATE TRIGGER `trg_stamps_before_insert`
BEFORE INSERT ON `tb_institutional_stamps`
FOR EACH ROW
BEGIN
  IF NEW.stamp_file_ref IS NULL OR CHAR_LENGTH(TRIM(NEW.stamp_file_ref)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La referencia del sello es obligatoria';
  END IF;
  IF NEW.stamp_file_ref LIKE 'http%'
     OR NEW.stamp_file_ref LIKE 'public/%'
     OR NEW.stamp_file_ref LIKE '%/public/%' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El sello debe estar en una ruta privada';
  END IF;
  IF NEW.applied_by IS NULL OR NEW.applied_at IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El sello requiere responsable y fecha';
  END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `trg_stamps_before_update`;
DELIMITER $$
CREATE TRIGGER `trg_stamps_before_update`
BEFORE UPDATE ON `tb_institutional_stamps`
FOR EACH ROW
BEGIN
  IF NOT (NEW.stamp_file_ref <=> OLD.stamp_file_ref) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El sello aplicado no puede sustituirse';
  END IF;
END$$
DELIMITER ;

-- ----------------------------------------------------------------------------
-- Tablas append-only
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_history_before_update`;
DROP TRIGGER IF EXISTS `trg_history_before_delete`;
DELIMITER $$
CREATE TRIGGER `trg_history_before_update`
BEFORE UPDATE ON `tb_justification_status_history`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial de estados es inmutable';
END$$

CREATE TRIGGER `trg_history_before_delete`
BEFORE DELETE ON `tb_justification_status_history`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El historial de estados no puede eliminarse';
END$$

DROP TRIGGER IF EXISTS `trg_audit_before_update`;
DROP TRIGGER IF EXISTS `trg_audit_before_delete`;

CREATE TRIGGER `trg_audit_before_update`
BEFORE UPDATE ON `tb_audit_logs`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La bitácora de auditoría es inmutable';
END$$

CREATE TRIGGER `trg_audit_before_delete`
BEFORE DELETE ON `tb_audit_logs`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La bitácora de auditoría no puede eliminarse';
END$$

-- ----------------------------------------------------------------------------
-- Auditoría: justificantes
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_justifications_audit_insert`$$
CREATE TRIGGER `trg_justifications_audit_insert`
AFTER INSERT ON `tb_justifications`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_justifications', 'INSERT', CAST(NEW.id_justification AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Justificante ', NEW.folio, ' creado'),
     NULL,
     JSON_OBJECT('folio', NEW.folio, 'id_student', NEW.id_student, 'id_status', NEW.id_status,
                 'issue_date', NEW.issue_date, 'start_date', NEW.start_date, 'end_date', NEW.end_date,
                 'is_critical', NEW.is_critical, 'expires_at', NEW.expires_at, 'version', NEW.version));
END$$

DROP TRIGGER IF EXISTS `trg_justifications_audit_update`$$
CREATE TRIGGER `trg_justifications_audit_update`
AFTER UPDATE ON `tb_justifications`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_justifications', 'UPDATE', CAST(NEW.id_justification AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Justificante ', NEW.folio, ' actualizado'),
     JSON_OBJECT('id_status', OLD.id_status, 'start_date', OLD.start_date, 'end_date', OLD.end_date,
                 'is_critical', OLD.is_critical, 'expires_at', OLD.expires_at, 'version', OLD.version,
                 'approved_by', OLD.approved_by, 'rejected_by', OLD.rejected_by),
     JSON_OBJECT('id_status', NEW.id_status, 'start_date', NEW.start_date, 'end_date', NEW.end_date,
                 'is_critical', NEW.is_critical, 'expires_at', NEW.expires_at, 'version', NEW.version,
                 'approved_by', NEW.approved_by, 'rejected_by', NEW.rejected_by));
END$$

DROP TRIGGER IF EXISTS `trg_justifications_audit_delete`$$
CREATE TRIGGER `trg_justifications_audit_delete`
AFTER DELETE ON `tb_justifications`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_justifications', 'DELETE', CAST(OLD.id_justification AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Justificante ', OLD.folio, ' eliminado físicamente'),
     JSON_OBJECT('folio', OLD.folio, 'id_student', OLD.id_student, 'id_status', OLD.id_status,
                 'issue_date', OLD.issue_date, 'start_date', OLD.start_date, 'end_date', OLD.end_date,
                 'is_critical', OLD.is_critical, 'version', OLD.version),
     NULL);
END$$

-- ----------------------------------------------------------------------------
-- Auditoría: estudiantes
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_students_audit_insert`$$
CREATE TRIGGER `trg_students_audit_insert`
AFTER INSERT ON `tb_students`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_students', 'INSERT', CAST(NEW.id_student AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Estudiante ', NEW.enrollment, ' creado'), NULL,
     JSON_OBJECT('enrollment', NEW.enrollment, 'id_group', NEW.id_group, 'status', NEW.status));
END$$

DROP TRIGGER IF EXISTS `trg_students_audit_update`$$
CREATE TRIGGER `trg_students_audit_update`
AFTER UPDATE ON `tb_students`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_students', 'UPDATE', CAST(NEW.id_student AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Estudiante ', NEW.enrollment, ' actualizado'),
     JSON_OBJECT('id_group', OLD.id_group, 'status', OLD.status),
     JSON_OBJECT('id_group', NEW.id_group, 'status', NEW.status));
END$$

DROP TRIGGER IF EXISTS `trg_students_audit_delete`$$
CREATE TRIGGER `trg_students_audit_delete`
AFTER DELETE ON `tb_students`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_students', 'DELETE', CAST(OLD.id_student AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Estudiante ', OLD.enrollment, ' eliminado físicamente'),
     JSON_OBJECT('enrollment', OLD.enrollment, 'id_group', OLD.id_group, 'status', OLD.status), NULL);
END$$

-- ----------------------------------------------------------------------------
-- Auditoría: documentos comprobatorios (sin nombre de archivo ni ruta)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_documents_audit_insert`$$
CREATE TRIGGER `trg_documents_audit_insert`
AFTER INSERT ON `tb_supporting_documents`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_supporting_documents', 'INSERT', CAST(NEW.id_document AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Documento cargado para el justificante ', NEW.id_justification), NULL,
     JSON_OBJECT('id_justification', NEW.id_justification, 'id_document_type', NEW.id_document_type,
                 'extension', NEW.extension, 'file_size', NEW.file_size, 'validation_status', NEW.validation_status));
END$$

DROP TRIGGER IF EXISTS `trg_documents_audit_update`$$
CREATE TRIGGER `trg_documents_audit_update`
AFTER UPDATE ON `tb_supporting_documents`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_supporting_documents', 'UPDATE', CAST(NEW.id_document AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Validación de documento actualizada para el justificante ', NEW.id_justification),
     JSON_OBJECT('validation_status', OLD.validation_status, 'validated_by', OLD.validated_by),
     JSON_OBJECT('validation_status', NEW.validation_status, 'validated_by', NEW.validated_by));
END$$

DROP TRIGGER IF EXISTS `trg_documents_audit_delete`$$
CREATE TRIGGER `trg_documents_audit_delete`
AFTER DELETE ON `tb_supporting_documents`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_supporting_documents', 'DELETE', CAST(OLD.id_document AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Documento eliminado del justificante ', OLD.id_justification),
     JSON_OBJECT('id_justification', OLD.id_justification, 'id_document_type', OLD.id_document_type,
                 'extension', OLD.extension, 'validation_status', OLD.validation_status), NULL);
END$$

-- ----------------------------------------------------------------------------
-- Auditoría: firmas
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_signatures_audit_insert`$$
CREATE TRIGGER `trg_signatures_audit_insert`
AFTER INSERT ON `tb_justification_signatures`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_justification_signatures', 'INSERT', CAST(NEW.id_signature AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Firma registrada: ', NEW.signer_type), NULL,
     JSON_OBJECT('id_justification', NEW.id_justification, 'signer_type', NEW.signer_type,
                 'status', NEW.status, 'signed_at', NEW.signed_at));
END$$

DROP TRIGGER IF EXISTS `trg_signatures_audit_update`$$
CREATE TRIGGER `trg_signatures_audit_update`
AFTER UPDATE ON `tb_justification_signatures`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_justification_signatures', 'UPDATE', CAST(NEW.id_signature AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Firma actualizada: ', NEW.signer_type),
     JSON_OBJECT('status', OLD.status, 'signed_at', OLD.signed_at),
     JSON_OBJECT('status', NEW.status, 'signed_at', NEW.signed_at));
END$$

DROP TRIGGER IF EXISTS `trg_signatures_audit_delete`$$
CREATE TRIGGER `trg_signatures_audit_delete`
AFTER DELETE ON `tb_justification_signatures`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_justification_signatures', 'DELETE', CAST(OLD.id_signature AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Firma eliminada: ', OLD.signer_type),
     JSON_OBJECT('id_justification', OLD.id_justification, 'signer_type', OLD.signer_type,
                 'status', OLD.status), NULL);
END$$

-- ----------------------------------------------------------------------------
-- Auditoría: sellos
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_stamps_audit_insert`$$
CREATE TRIGGER `trg_stamps_audit_insert`
AFTER INSERT ON `tb_institutional_stamps`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_institutional_stamps', 'INSERT', CAST(NEW.id_stamp AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Sello aplicado al justificante ', NEW.id_justification), NULL,
     JSON_OBJECT('id_justification', NEW.id_justification, 'id_institution', NEW.id_institution,
                 'applied_by', NEW.applied_by, 'applied_at', NEW.applied_at));
END$$

DROP TRIGGER IF EXISTS `trg_stamps_audit_update`$$
CREATE TRIGGER `trg_stamps_audit_update`
AFTER UPDATE ON `tb_institutional_stamps`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_institutional_stamps', 'UPDATE', CAST(NEW.id_stamp AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Sello actualizado del justificante ', NEW.id_justification),
     JSON_OBJECT('applied_by', OLD.applied_by, 'applied_at', OLD.applied_at),
     JSON_OBJECT('applied_by', NEW.applied_by, 'applied_at', NEW.applied_at));
END$$

DROP TRIGGER IF EXISTS `trg_stamps_audit_delete`$$
CREATE TRIGGER `trg_stamps_audit_delete`
AFTER DELETE ON `tb_institutional_stamps`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_institutional_stamps', 'DELETE', CAST(OLD.id_stamp AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Sello eliminado del justificante ', OLD.id_justification),
     JSON_OBJECT('id_justification', OLD.id_justification, 'id_institution', OLD.id_institution,
                 'applied_by', OLD.applied_by, 'applied_at', OLD.applied_at), NULL);
END$$

-- ----------------------------------------------------------------------------
-- Auditoría: usuarios (sin hash de contraseña ni correo)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_users_audit_insert`$$
CREATE TRIGGER `trg_users_audit_insert`
AFTER INSERT ON `tb_users`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_users', 'INSERT', CAST(NEW.id_user AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Usuario ', NEW.username, ' creado'), NULL,
     JSON_OBJECT('username', NEW.username, 'active', NEW.active, 'id_student', NEW.id_student, 'id_teacher', NEW.id_teacher));
END$$

DROP TRIGGER IF EXISTS `trg_users_audit_update`$$
CREATE TRIGGER `trg_users_audit_update`
AFTER UPDATE ON `tb_users`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_users', 'UPDATE', CAST(NEW.id_user AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Usuario ', NEW.username, ' actualizado'),
     JSON_OBJECT('active', OLD.active, 'failed_attempts', OLD.failed_attempts, 'locked_until', OLD.locked_until),
     JSON_OBJECT('active', NEW.active, 'failed_attempts', NEW.failed_attempts, 'locked_until', NEW.locked_until));
END$$

DROP TRIGGER IF EXISTS `trg_users_audit_delete`$$
CREATE TRIGGER `trg_users_audit_delete`
AFTER DELETE ON `tb_users`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_users', 'DELETE', CAST(OLD.id_user AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Usuario ', OLD.username, ' eliminado físicamente'),
     JSON_OBJECT('username', OLD.username, 'active', OLD.active), NULL);
END$$

-- ----------------------------------------------------------------------------
-- Auditoría: responsables académicos
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_staff_audit_insert`$$
CREATE TRIGGER `trg_staff_audit_insert`
AFTER INSERT ON `tb_academic_staff`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_academic_staff', 'INSERT', CAST(NEW.id_staff AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Responsable académico registrado: ', NEW.position), NULL,
     JSON_OBJECT('id_staff', NEW.id_staff, 'position', NEW.position, 'id_career', NEW.id_career, 'active', NEW.active));
END$$

DROP TRIGGER IF EXISTS `trg_staff_audit_update`$$
CREATE TRIGGER `trg_staff_audit_update`
AFTER UPDATE ON `tb_academic_staff`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_academic_staff', 'UPDATE', CAST(NEW.id_staff AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Responsable académico actualizado: ', NEW.position),
     JSON_OBJECT('position', OLD.position, 'id_career', OLD.id_career, 'active', OLD.active),
     JSON_OBJECT('position', NEW.position, 'id_career', NEW.id_career, 'active', NEW.active));
END$$

DROP TRIGGER IF EXISTS `trg_staff_audit_delete`$$
CREATE TRIGGER `trg_staff_audit_delete`
AFTER DELETE ON `tb_academic_staff`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_academic_staff', 'DELETE', CAST(OLD.id_staff AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Responsable académico eliminado: ', OLD.position),
     JSON_OBJECT('id_staff', OLD.id_staff, 'position', OLD.position, 'id_career', OLD.id_career, 'active', OLD.active), NULL);
END$$

-- ----------------------------------------------------------------------------
-- Auditoría: tutores legales (sin teléfono ni dirección)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_guardians_audit_insert`$$
CREATE TRIGGER `trg_guardians_audit_insert`
AFTER INSERT ON `tb_guardians`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_guardians', 'INSERT', CAST(NEW.id_guardian AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Tutor legal registrado para el estudiante ', NEW.id_student), NULL,
     JSON_OBJECT('id_student', NEW.id_student, 'relationship', NEW.relationship, 'active', NEW.active));
END$$

DROP TRIGGER IF EXISTS `trg_guardians_audit_update`$$
CREATE TRIGGER `trg_guardians_audit_update`
AFTER UPDATE ON `tb_guardians`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_guardians', 'UPDATE', CAST(NEW.id_guardian AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Tutor legal actualizado del estudiante ', NEW.id_student),
     JSON_OBJECT('relationship', OLD.relationship, 'active', OLD.active),
     JSON_OBJECT('relationship', NEW.relationship, 'active', NEW.active));
END$$

DROP TRIGGER IF EXISTS `trg_guardians_audit_delete`$$
CREATE TRIGGER `trg_guardians_audit_delete`
AFTER DELETE ON `tb_guardians`
FOR EACH ROW
BEGIN
  INSERT INTO `tb_audit_logs`
    (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description, old_values, new_values)
  VALUES
    ('tb_guardians', 'DELETE', CAST(OLD.id_guardian AS CHAR), @audit_user_id, USER(), @audit_ip, @audit_source,
     CONCAT('Tutor legal eliminado del estudiante ', OLD.id_student),
     JSON_OBJECT('id_student', OLD.id_student, 'relationship', OLD.relationship, 'active', OLD.active), NULL);
END$$

DELIMITER ;
