-- ============================================================================
-- Sistema de Gestión de Justificantes Académicos - UTXJ
-- Script 07: consultas de verificación y pruebas de reglas de negocio
-- ============================================================================
-- Ejecutar después de 06_seed_data.sql. Es idempotente y no deja datos
-- temporales. Las pruebas de error comprueban que los triggers rechacen
-- operaciones prohibidas.
-- ============================================================================

USE `db_justificantes_utxj`;
SET NAMES utf8mb4;
SET time_zone = '-06:00';

DROP TABLE IF EXISTS `tmp_test_results`;
CREATE TEMPORARY TABLE `tmp_test_results` (
  `prueba` VARCHAR(180) NOT NULL,
  `esperado` VARCHAR(180) NOT NULL,
  `obtenido` VARCHAR(255) NOT NULL,
  `estado` ENUM('OK','FALLO') NOT NULL
) ENGINE=MEMORY;

DROP PROCEDURE IF EXISTS `sp_test_assert_equal`;

DELIMITER $$

CREATE PROCEDURE `sp_test_assert_equal`(
  IN p_prueba VARCHAR(180),
  IN p_esperado VARCHAR(180),
  IN p_obtenido VARCHAR(255)
)
BEGIN
  INSERT INTO `tmp_test_results` (`prueba`, `esperado`, `obtenido`, `estado`)
  VALUES (p_prueba, p_esperado, p_obtenido,
          IF(p_esperado = p_obtenido, 'OK', 'FALLO'));
END$$

-- Ejecuta una sentencia que debe fallar por una regla de negocio.
DROP PROCEDURE IF EXISTS `sp_test_espera_error`;

CREATE PROCEDURE `sp_test_espera_error`(
  IN p_prueba VARCHAR(180),
  IN p_sql TEXT
)
BEGIN
  DECLARE v_msg VARCHAR(255) DEFAULT '';

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    GET DIAGNOSTICS CONDITION 1 v_msg = MESSAGE_TEXT;
    ROLLBACK;
    INSERT INTO `tmp_test_results` (`prueba`, `esperado`, `obtenido`, `estado`)
    VALUES (p_prueba, 'error de regla de negocio', v_msg, 'OK');
  END;

  SET @sql_test = p_sql;
  PREPARE stmt FROM @sql_test;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;

  INSERT INTO `tmp_test_results` (`prueba`, `esperado`, `obtenido`, `estado`)
  VALUES (p_prueba, 'error de regla de negocio', 'la sentencia se ejecutó sin error', 'FALLO');
END$$

DELIMITER ;

-- ----------------------------------------------------------------------------
-- 1. Conteos esperados del seed
-- ----------------------------------------------------------------------------
CALL sp_test_assert_equal('Instituciones sembradas', '1',
  (SELECT COUNT(*) FROM `tb_institutions`));
CALL sp_test_assert_equal('Carreras sembradas', '3',
  (SELECT COUNT(*) FROM `tb_careers`));
CALL sp_test_assert_equal('Estudiantes sembrados', '8',
  (SELECT COUNT(*) FROM `tb_students`));
CALL sp_test_assert_equal('Usuarios sembrados', '6',
  (SELECT COUNT(*) FROM `tb_users`));
CALL sp_test_assert_equal('Justificantes sembrados', '6',
  (SELECT COUNT(*) FROM `tb_justifications`));
CALL sp_test_assert_equal('Roles sembrados', '4',
  (SELECT COUNT(*) FROM `tb_roles`));
CALL sp_test_assert_equal('Tipos de motivo sembrados', '5',
  (SELECT COUNT(*) FROM `tb_reason_types`));

-- ----------------------------------------------------------------------------
-- 2. Integridad referencial: ninguna huérfana
-- ----------------------------------------------------------------------------
CALL sp_test_assert_equal('Justificantes sin estudiante', '0',
  (SELECT COUNT(*) FROM `tb_justifications` j
    LEFT JOIN `tb_students` s ON s.id_student = j.id_student
   WHERE s.id_student IS NULL));
CALL sp_test_assert_equal('Justificantes sin estado', '0',
  (SELECT COUNT(*) FROM `tb_justifications` j
    LEFT JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
   WHERE st.id_status IS NULL));
CALL sp_test_assert_equal('Documentos sin justificante', '0',
  (SELECT COUNT(*) FROM `tb_supporting_documents` d
    LEFT JOIN `tb_justifications` j ON j.id_justification = d.id_justification
   WHERE j.id_justification IS NULL));
CALL sp_test_assert_equal('Firmas sin justificante', '0',
  (SELECT COUNT(*) FROM `tb_justification_signatures` f
    LEFT JOIN `tb_justifications` j ON j.id_justification = f.id_justification
   WHERE j.id_justification IS NULL));
CALL sp_test_assert_equal('Materias sin justificante', '0',
  (SELECT COUNT(*) FROM `tbd_justification_subjects` js
    LEFT JOIN `tb_justifications` j ON j.id_justification = js.id_justification
   WHERE j.id_justification IS NULL));

-- ----------------------------------------------------------------------------
-- 3. Folios únicos y con formato JUS-AAAAMMDD-####
-- ----------------------------------------------------------------------------
CALL sp_test_assert_equal('Folios duplicados', '0',
  (SELECT COUNT(*) FROM (
      SELECT folio FROM `tb_justifications`
      GROUP BY folio HAVING COUNT(*) > 1
   ) dup));
CALL sp_test_assert_equal('Folios con formato inválido', '0',
  (SELECT COUNT(*) FROM `tb_justifications`
    WHERE folio NOT REGEXP '^JUS-[0-9]{8}-[0-9]{4}$'));

-- ----------------------------------------------------------------------------
-- 4. Cálculo de vigencia en días hábiles
--    2026-10-30 (viernes) + 5 hábiles:
--    31 oct y 1 nov (fin de semana), 2 nov (inhábil), 3-6 nov, 9 nov.
-- ----------------------------------------------------------------------------
CALL sp_test_assert_equal('Vigencia hábil 2026-10-30 + 5', '2026-11-09',
  (SELECT DATE_FORMAT(`fn_calcular_vigencia_habiles`('2026-10-30', 5, 1), '%Y-%m-%d')));
--    2026-10-26 (lunes) + 5 hábiles: 27-30 oct y 3 nov (2 nov es inhábil).
CALL sp_test_assert_equal('Vigencia hábil 2026-10-26 + 5', '2026-11-03',
  (SELECT DATE_FORMAT(`fn_calcular_vigencia_habiles`('2026-10-26', 5, 1), '%Y-%m-%d')));

-- ----------------------------------------------------------------------------
-- 5. Generación de folio (se prueba con una fecha futura y se limpia)
-- ----------------------------------------------------------------------------
START TRANSACTION;
CALL `sp_generar_folio`('2099-12-31', @folio_prueba);
ROLLBACK;

CALL sp_test_assert_equal('Folio generado con formato correcto', '1',
  IF(@folio_prueba REGEXP '^JUS-20991231-[0-9]{4}$', '1', '0'));

-- ----------------------------------------------------------------------------
-- 6. Consultas de negocio
-- ----------------------------------------------------------------------------
CALL sp_test_assert_equal('Justificantes de la matrícula 240537', '1',
  (SELECT COUNT(*) FROM (
      SELECT j.id_justification
      FROM `tb_justifications` j
      JOIN `tb_students` s ON s.id_student = j.id_student
      WHERE s.enrollment = '240537' AND j.deleted_at IS NULL
   ) q));

CALL sp_test_assert_equal('Estados finales con resolved_at', '0',
  (SELECT COUNT(*) FROM `tb_justifications` j
    JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
   WHERE st.is_final = 1 AND j.resolved_at IS NULL));

CALL sp_test_assert_equal('Aprobados con sello institucional', '0',
  (SELECT COUNT(*) FROM `tb_justifications` j
    JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
    LEFT JOIN `tb_institutional_stamps` s ON s.id_justification = j.id_justification
   WHERE st.code = 'aprobado' AND s.id_stamp IS NULL));

CALL sp_test_assert_equal('Aprobados con firma de tutor y dirección', '0',
  (SELECT COUNT(*) FROM `tb_justifications` j
    JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
   WHERE st.code = 'aprobado'
     AND (SELECT COUNT(DISTINCT signer_type)
            FROM `tb_justification_signatures` f
           WHERE f.id_justification = j.id_justification
             AND f.status = 'firmado'
             AND f.signer_type IN ('tutor_educativo','director_carrera')) < 2));

CALL sp_test_assert_equal('Casos críticos aprobados con comprobante validado', '0',
  (SELECT COUNT(*) FROM `tb_justifications` j
    JOIN `tb_justification_statuses` st ON st.id_status = j.id_status
   WHERE st.code = 'aprobado' AND j.is_critical = 1
     AND NOT EXISTS (
       SELECT 1 FROM `tb_supporting_documents` d
        WHERE d.id_justification = j.id_justification
          AND d.validation_status = 'validado'
     )));

-- ----------------------------------------------------------------------------
-- 7. Privacidad y seguridad
-- ----------------------------------------------------------------------------
CALL sp_test_assert_equal('Documentos marcados como privados', '0',
  (SELECT COUNT(*) FROM `tb_supporting_documents` WHERE is_private <> 1));
CALL sp_test_assert_equal('Rutas de documentos públicas o absolutas', '0',
  (SELECT COUNT(*) FROM `tb_supporting_documents`
    WHERE storage_path LIKE 'http%' OR storage_path LIKE '%public/%'));
CALL sp_test_assert_equal('Contraseñas no bcrypt', '0',
  (SELECT COUNT(*) FROM `tb_users` WHERE password_hash NOT REGEXP '^\\$2[aby]\\$'));
CALL sp_test_assert_equal('Contraseñas con longitud sospechosa', '0',
  (SELECT COUNT(*) FROM `tb_users` WHERE CHAR_LENGTH(password_hash) < 55));
CALL sp_test_assert_equal('Bitácora de auditoría con registros', '1',
  IF((SELECT COUNT(*) FROM `tb_audit_logs`) > 0, '1', '0'));

-- ----------------------------------------------------------------------------
-- 8. Pruebas de reglas de negocio (deben fallar)
-- ----------------------------------------------------------------------------
-- 8.1 Caso crítico sin comprobante validado (justificante 6)
CALL sp_test_espera_error(
  'Rechaza aprobar caso crítico sin comprobante validado',
  'UPDATE `tb_justifications` SET id_status = 3 WHERE id_justification = 6'
);

-- 8.2 Aprobación sin las dos firmas requeridas (justificante 2)
CALL sp_test_espera_error(
  'Rechaza aprobar sin firma del tutor y de la dirección',
  'UPDATE `tb_justifications` SET id_status = 3 WHERE id_justification = 2'
);

-- 8.3 Rechazo sin comentario (justificante 3)
CALL sp_test_espera_error(
  'Rechaza rechazar sin comentario',
  'UPDATE `tb_justifications` SET id_status = 4 WHERE id_justification = 3'
);

-- 8.4 Inmutabilidad de folio en justificante aprobado (justificante 1)
CALL sp_test_espera_error(
  'Rechaza modificar el folio de un justificante finalizado',
  "UPDATE `tb_justifications` SET folio = 'JUS-20260101-9999' WHERE id_justification = 1"
);

-- 8.5 Documento nuevo en justificante finalizado (justificante 4 rechazado)
CALL sp_test_espera_error(
  'Rechaza agregar documentos a un justificante finalizado',
  "INSERT INTO `tb_supporting_documents`
     (id_justification, id_document_type, original_name, stored_name, storage_path,
      mime_type, extension, file_size, uploaded_by, validation_status)
   VALUES (4, 4, 'extra.pdf', 'test-extra.pdf', 'private/documents/test-extra.pdf',
      'application/pdf', 'pdf', 1024, 1, 'pendiente')"
);

-- 8.6 Fecha de inasistencia fuera del periodo (justificante 3)
CALL sp_test_espera_error(
  'Rechaza fechas de inasistencia fuera del periodo',
  "INSERT INTO `tb_justification_absences` (id_justification, absence_date)
   VALUES (3, '2026-12-01')"
);

-- 8.7 Historial de estados inmutable
CALL sp_test_espera_error(
  'Rechaza modificar el historial de estados',
  'UPDATE `tb_justification_status_history` SET comment = ''alterado'' WHERE id_history = 1'
);

-- 8.8 Bitácora de auditoría inmutable
CALL sp_test_espera_error(
  'Rechaza modificar la bitácora de auditoría',
  'UPDATE `tb_audit_logs` SET source = ''alterado'' WHERE id_log = 1'
);

-- 8.9 Firma ya registrada no puede sustituirse
CALL sp_test_espera_error(
  'Rechaza sustituir una firma ya registrada',
  "UPDATE `tb_justification_signatures`
      SET signature_file_ref = 'private/signatures/otra.svg'
    WHERE id_justification = 1 AND signer_type = 'tutor_educativo'"
);

-- 8.10 Documento con MIME inconsistente
CALL sp_test_espera_error(
  'Rechaza un documento con MIME inconsistente',
  "INSERT INTO `tb_supporting_documents`
     (id_justification, id_document_type, original_name, stored_name, storage_path,
      mime_type, extension, file_size, uploaded_by, validation_status)
   VALUES (3, 4, 'falso.pdf', 'test-falso.pdf', 'private/documents/test-falso.pdf',
      'image/png', 'pdf', 1024, 1, 'pendiente')"
);

-- ----------------------------------------------------------------------------
-- 9. Resultado final
-- ----------------------------------------------------------------------------
SELECT `prueba`, `esperado`, `obtenido`, `estado`
FROM `tmp_test_results`
ORDER BY `estado` DESC, `prueba`;

SELECT
  COUNT(*) AS total_pruebas,
  SUM(`estado` = 'OK') AS correctas,
  SUM(`estado` = 'FALLO') AS fallidas,
  IF(SUM(`estado` = 'FALLO') = 0, 'TODO OK', 'REVISAR FALLOS') AS resultado
FROM `tmp_test_results`;

-- Limpieza de objetos temporales
DROP PROCEDURE IF EXISTS `sp_test_assert_equal`;
DROP PROCEDURE IF EXISTS `sp_test_espera_error`;
DROP TABLE IF EXISTS `tmp_test_results`;
