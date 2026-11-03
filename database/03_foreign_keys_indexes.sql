-- ============================================================================
-- Sistema de Gestión de Justificantes Académicos - UTXJ
-- Script 03: llaves foráneas, integridad referencial e índices de rendimiento
-- ============================================================================
-- Ejecutar después de 02_create_tables.sql.
-- Los procedimientos auxiliares permiten volver a ejecutar el script sin
-- duplicar restricciones ni índices.
-- ============================================================================

USE `db_justificantes_utxj`;
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `sp_drop_fk_if_exists`;
DROP PROCEDURE IF EXISTS `sp_create_index_if_not_exists`;

DELIMITER $$

CREATE PROCEDURE `sp_drop_fk_if_exists`(
  IN p_table VARCHAR(64),
  IN p_constraint VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND CONSTRAINT_NAME = p_constraint
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    SET @sql_drop_fk = CONCAT('ALTER TABLE `', p_table, '` DROP FOREIGN KEY `', p_constraint, '`');
    PREPARE stmt_drop_fk FROM @sql_drop_fk;
    EXECUTE stmt_drop_fk;
    DEALLOCATE PREPARE stmt_drop_fk;
  END IF;
END$$

CREATE PROCEDURE `sp_create_index_if_not_exists`(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_columns VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table
      AND INDEX_NAME = p_index
  ) THEN
    SET @sql_create_index = CONCAT('CREATE INDEX `', p_index, '` ON `', p_table, '` (', p_columns, ')');
    PREPARE stmt_create_index FROM @sql_create_index;
    EXECUTE stmt_create_index;
    DEALLOCATE PREPARE stmt_create_index;
  END IF;
END$$

DELIMITER ;

-- ----------------------------------------------------------------------------
-- Llaves foráneas
-- ----------------------------------------------------------------------------
CALL sp_drop_fk_if_exists('tb_careers','fk_careers_institution');
ALTER TABLE `tb_careers`
  ADD CONSTRAINT `fk_careers_institution` FOREIGN KEY (`id_institution`)
  REFERENCES `tb_institutions` (`id_institution`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_groups','fk_groups_career');
ALTER TABLE `tb_groups`
  ADD CONSTRAINT `fk_groups_career` FOREIGN KEY (`id_career`)
  REFERENCES `tb_careers` (`id_career`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_students','fk_students_group');
ALTER TABLE `tb_students`
  ADD CONSTRAINT `fk_students_group` FOREIGN KEY (`id_group`)
  REFERENCES `tb_groups` (`id_group`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_teachers','fk_teachers_institution');
ALTER TABLE `tb_teachers`
  ADD CONSTRAINT `fk_teachers_institution` FOREIGN KEY (`id_institution`)
  REFERENCES `tb_institutions` (`id_institution`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_subjects','fk_subjects_career');
ALTER TABLE `tb_subjects`
  ADD CONSTRAINT `fk_subjects_career` FOREIGN KEY (`id_career`)
  REFERENCES `tb_careers` (`id_career`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_users','fk_users_student');
ALTER TABLE `tb_users`
  ADD CONSTRAINT `fk_users_student` FOREIGN KEY (`id_student`)
  REFERENCES `tb_students` (`id_student`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_users','fk_users_teacher');
ALTER TABLE `tb_users`
  ADD CONSTRAINT `fk_users_teacher` FOREIGN KEY (`id_teacher`)
  REFERENCES `tb_teachers` (`id_teacher`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tbd_user_roles','fk_user_roles_user');
ALTER TABLE `tbd_user_roles`
  ADD CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`id_user`)
  REFERENCES `tb_users` (`id_user`) ON UPDATE CASCADE ON DELETE CASCADE;

CALL sp_drop_fk_if_exists('tbd_user_roles','fk_user_roles_role');
ALTER TABLE `tbd_user_roles`
  ADD CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`id_role`)
  REFERENCES `tb_roles` (`id_role`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tbd_user_roles','fk_user_roles_assigned_by');
ALTER TABLE `tbd_user_roles`
  ADD CONSTRAINT `fk_user_roles_assigned_by` FOREIGN KEY (`assigned_by`)
  REFERENCES `tb_users` (`id_user`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_academic_staff','fk_staff_institution');
ALTER TABLE `tb_academic_staff`
  ADD CONSTRAINT `fk_staff_institution` FOREIGN KEY (`id_institution`)
  REFERENCES `tb_institutions` (`id_institution`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_academic_staff','fk_staff_user');
ALTER TABLE `tb_academic_staff`
  ADD CONSTRAINT `fk_staff_user` FOREIGN KEY (`id_user`)
  REFERENCES `tb_users` (`id_user`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_academic_staff','fk_staff_career');
ALTER TABLE `tb_academic_staff`
  ADD CONSTRAINT `fk_staff_career` FOREIGN KEY (`id_career`)
  REFERENCES `tb_careers` (`id_career`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_guardians','fk_guardians_student');
ALTER TABLE `tb_guardians`
  ADD CONSTRAINT `fk_guardians_student` FOREIGN KEY (`id_student`)
  REFERENCES `tb_students` (`id_student`) ON UPDATE CASCADE ON DELETE CASCADE;

CALL sp_drop_fk_if_exists('tb_justifications','fk_justifications_student');
ALTER TABLE `tb_justifications`
  ADD CONSTRAINT `fk_justifications_student` FOREIGN KEY (`id_student`)
  REFERENCES `tb_students` (`id_student`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_justifications','fk_justifications_status');
ALTER TABLE `tb_justifications`
  ADD CONSTRAINT `fk_justifications_status` FOREIGN KEY (`id_status`)
  REFERENCES `tb_justification_statuses` (`id_status`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_justifications','fk_justifications_reason_type');
ALTER TABLE `tb_justifications`
  ADD CONSTRAINT `fk_justifications_reason_type` FOREIGN KEY (`id_reason_type`)
  REFERENCES `tb_reason_types` (`id_reason_type`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_justifications','fk_justifications_created_by');
ALTER TABLE `tb_justifications`
  ADD CONSTRAINT `fk_justifications_created_by` FOREIGN KEY (`created_by`)
  REFERENCES `tb_users` (`id_user`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_justifications','fk_justifications_updated_by');
ALTER TABLE `tb_justifications`
  ADD CONSTRAINT `fk_justifications_updated_by` FOREIGN KEY (`updated_by`)
  REFERENCES `tb_users` (`id_user`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_justifications','fk_justifications_approved_by');
ALTER TABLE `tb_justifications`
  ADD CONSTRAINT `fk_justifications_approved_by` FOREIGN KEY (`approved_by`)
  REFERENCES `tb_users` (`id_user`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_justifications','fk_justifications_rejected_by');
ALTER TABLE `tb_justifications`
  ADD CONSTRAINT `fk_justifications_rejected_by` FOREIGN KEY (`rejected_by`)
  REFERENCES `tb_users` (`id_user`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_justification_absences','fk_absences_justification');
ALTER TABLE `tb_justification_absences`
  ADD CONSTRAINT `fk_absences_justification` FOREIGN KEY (`id_justification`)
  REFERENCES `tb_justifications` (`id_justification`) ON UPDATE CASCADE ON DELETE CASCADE;

CALL sp_drop_fk_if_exists('tbd_justification_subjects','fk_justification_subjects_justification');
ALTER TABLE `tbd_justification_subjects`
  ADD CONSTRAINT `fk_justification_subjects_justification` FOREIGN KEY (`id_justification`)
  REFERENCES `tb_justifications` (`id_justification`) ON UPDATE CASCADE ON DELETE CASCADE;

CALL sp_drop_fk_if_exists('tbd_justification_subjects','fk_justification_subjects_subject');
ALTER TABLE `tbd_justification_subjects`
  ADD CONSTRAINT `fk_justification_subjects_subject` FOREIGN KEY (`id_subject`)
  REFERENCES `tb_subjects` (`id_subject`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tbd_justification_subjects','fk_justification_subjects_teacher');
ALTER TABLE `tbd_justification_subjects`
  ADD CONSTRAINT `fk_justification_subjects_teacher` FOREIGN KEY (`id_teacher`)
  REFERENCES `tb_teachers` (`id_teacher`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tbd_justification_subjects','fk_justification_subjects_absence');
ALTER TABLE `tbd_justification_subjects`
  ADD CONSTRAINT `fk_justification_subjects_absence` FOREIGN KEY (`id_absence`)
  REFERENCES `tb_justification_absences` (`id_absence`) ON UPDATE CASCADE ON DELETE CASCADE;

CALL sp_drop_fk_if_exists('tb_supporting_documents','fk_documents_justification');
ALTER TABLE `tb_supporting_documents`
  ADD CONSTRAINT `fk_documents_justification` FOREIGN KEY (`id_justification`)
  REFERENCES `tb_justifications` (`id_justification`) ON UPDATE CASCADE ON DELETE CASCADE;

CALL sp_drop_fk_if_exists('tb_supporting_documents','fk_documents_type');
ALTER TABLE `tb_supporting_documents`
  ADD CONSTRAINT `fk_documents_type` FOREIGN KEY (`id_document_type`)
  REFERENCES `tb_document_types` (`id_document_type`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_supporting_documents','fk_documents_uploaded_by');
ALTER TABLE `tb_supporting_documents`
  ADD CONSTRAINT `fk_documents_uploaded_by` FOREIGN KEY (`uploaded_by`)
  REFERENCES `tb_users` (`id_user`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_supporting_documents','fk_documents_validated_by');
ALTER TABLE `tb_supporting_documents`
  ADD CONSTRAINT `fk_documents_validated_by` FOREIGN KEY (`validated_by`)
  REFERENCES `tb_users` (`id_user`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_justification_signatures','fk_signatures_justification');
ALTER TABLE `tb_justification_signatures`
  ADD CONSTRAINT `fk_signatures_justification` FOREIGN KEY (`id_justification`)
  REFERENCES `tb_justifications` (`id_justification`) ON UPDATE CASCADE ON DELETE CASCADE;

CALL sp_drop_fk_if_exists('tb_justification_signatures','fk_signatures_staff');
ALTER TABLE `tb_justification_signatures`
  ADD CONSTRAINT `fk_signatures_staff` FOREIGN KEY (`id_staff`)
  REFERENCES `tb_academic_staff` (`id_staff`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_justification_signatures','fk_signatures_guardian');
ALTER TABLE `tb_justification_signatures`
  ADD CONSTRAINT `fk_signatures_guardian` FOREIGN KEY (`id_guardian`)
  REFERENCES `tb_guardians` (`id_guardian`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_institutional_stamps','fk_stamps_justification');
ALTER TABLE `tb_institutional_stamps`
  ADD CONSTRAINT `fk_stamps_justification` FOREIGN KEY (`id_justification`)
  REFERENCES `tb_justifications` (`id_justification`) ON UPDATE CASCADE ON DELETE CASCADE;

CALL sp_drop_fk_if_exists('tb_institutional_stamps','fk_stamps_institution');
ALTER TABLE `tb_institutional_stamps`
  ADD CONSTRAINT `fk_stamps_institution` FOREIGN KEY (`id_institution`)
  REFERENCES `tb_institutions` (`id_institution`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_institutional_stamps','fk_stamps_applied_by');
ALTER TABLE `tb_institutional_stamps`
  ADD CONSTRAINT `fk_stamps_applied_by` FOREIGN KEY (`applied_by`)
  REFERENCES `tb_users` (`id_user`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_justification_status_history','fk_history_justification');
ALTER TABLE `tb_justification_status_history`
  ADD CONSTRAINT `fk_history_justification` FOREIGN KEY (`id_justification`)
  REFERENCES `tb_justifications` (`id_justification`) ON UPDATE CASCADE ON DELETE CASCADE;

CALL sp_drop_fk_if_exists('tb_justification_status_history','fk_history_status_from');
ALTER TABLE `tb_justification_status_history`
  ADD CONSTRAINT `fk_history_status_from` FOREIGN KEY (`id_status_from`)
  REFERENCES `tb_justification_statuses` (`id_status`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_justification_status_history','fk_history_status_to');
ALTER TABLE `tb_justification_status_history`
  ADD CONSTRAINT `fk_history_status_to` FOREIGN KEY (`id_status_to`)
  REFERENCES `tb_justification_statuses` (`id_status`) ON UPDATE CASCADE ON DELETE RESTRICT;

CALL sp_drop_fk_if_exists('tb_justification_status_history','fk_history_changed_by');
ALTER TABLE `tb_justification_status_history`
  ADD CONSTRAINT `fk_history_changed_by` FOREIGN KEY (`changed_by`)
  REFERENCES `tb_users` (`id_user`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_audit_logs','fk_audit_user');
ALTER TABLE `tb_audit_logs`
  ADD CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`)
  REFERENCES `tb_users` (`id_user`) ON UPDATE CASCADE ON DELETE SET NULL;

CALL sp_drop_fk_if_exists('tb_non_working_days','fk_non_working_institution');
ALTER TABLE `tb_non_working_days`
  ADD CONSTRAINT `fk_non_working_institution` FOREIGN KEY (`id_institution`)
  REFERENCES `tb_institutions` (`id_institution`) ON UPDATE CASCADE ON DELETE CASCADE;

CALL sp_drop_fk_if_exists('tb_system_settings','fk_settings_updated_by');
ALTER TABLE `tb_system_settings`
  ADD CONSTRAINT `fk_settings_updated_by` FOREIGN KEY (`updated_by`)
  REFERENCES `tb_users` (`id_user`) ON UPDATE CASCADE ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- Índices adicionales para consultas frecuentes
-- ----------------------------------------------------------------------------
CALL sp_create_index_if_not_exists('tb_careers','idx_careers_institution_active','`id_institution`,`active`');
CALL sp_create_index_if_not_exists('tb_groups','idx_groups_career_active','`id_career`,`active`');
CALL sp_create_index_if_not_exists('tb_students','idx_students_status','`status`');
CALL sp_create_index_if_not_exists('tb_justifications','idx_justifications_issue_status','`issue_date`,`id_status`');
CALL sp_create_index_if_not_exists('tbd_justification_subjects','idx_justification_subjects_justification','`id_justification`');
CALL sp_create_index_if_not_exists('tb_supporting_documents','idx_documents_checksum','`checksum_sha256`');
CALL sp_create_index_if_not_exists('tb_justification_signatures','idx_signatures_status','`status`,`signed_at`');
CALL sp_create_index_if_not_exists('tb_institutional_stamps','idx_stamps_applied_at','`applied_at`');
CALL sp_create_index_if_not_exists('tb_audit_logs','idx_audit_operation_date','`operation`,`changed_at`');
CALL sp_create_index_if_not_exists('tb_audit_logs','idx_audit_user_date','`user_id`,`changed_at`');
CALL sp_create_index_if_not_exists('tb_users','idx_users_last_login','`last_login`');
CALL sp_create_index_if_not_exists('tb_academic_staff','idx_staff_institution','`id_institution`,`position`');

DROP PROCEDURE IF EXISTS `sp_drop_fk_if_exists`;
DROP PROCEDURE IF EXISTS `sp_create_index_if_not_exists`;

SELECT
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'FOREIGN KEY') AS total_foreign_keys,
  (SELECT COUNT(DISTINCT TABLE_NAME, INDEX_NAME) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()) AS total_indexes;
