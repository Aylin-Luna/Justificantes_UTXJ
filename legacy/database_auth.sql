CREATE DATABASE IF NOT EXISTS `db_justificantes_utxj`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `db_justificantes_utxj`;

-- Usuarios para autenticación
DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `nombre_completo` VARCHAR(150) NOT NULL,
  `rol` ENUM('tutor','alumna','directora') NOT NULL,
  `matricula` VARCHAR(20) NULL,
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_usuarios_rol` (`rol`),
  KEY `idx_usuarios_matricula` (`matricula`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar usuarios de prueba
-- Passwords: tutor123, alumna123, directora123 (hashes bcrypt)
INSERT INTO `usuarios` (`username`, `password`, `nombre_completo`, `rol`, `matricula`) VALUES
('tutor', '$2a$10$xpuwg7XYQYx7N9CQ9mFMuuFbaTjwNDkCNgVGhsSSDG/dpkcG.vJyO', 'MTI. Ricardo Luna Santos', 'tutor', NULL),
('alumna', '$2a$10$wxPxKw/reciNZ3C3KCtb5ecm2mhYXZrPv5YO6CQQs82t.cIWODKCC', 'Ingrid Natalia Martinez Carrasco', 'alumna', '240537'),
('directora', '$2a$10$2vOzeM/b/qwee/fir1b50utSgy46yeF6xwL9ZOt7vfi/oNm5ahPyS', 'Mtra. Altagracia Carrillo Parra', 'directora', NULL);

-- Agregar campos a justificantes si no existen
ALTER TABLE `justificantes` 
  ADD COLUMN IF NOT EXISTS `id_usuario_solicitante` INT(11) NULL AFTER `matricula`,
  ADD COLUMN IF NOT EXISTS `aprobado_por` INT(11) NULL AFTER `comentario`,
  ADD COLUMN IF NOT EXISTS `fecha_resolucion` DATETIME NULL AFTER `aprobado_por`,
  ADD COLUMN IF NOT EXISTS `vigente_hasta` DATE NULL AFTER `fecha_resolucion`;
