-- ============================================================================
-- Sistema de Gestión de Justificantes Académicos - UTXJ
-- Script 01: creación de la base de datos
-- Motor: MySQL 8.0 | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ============================================================================
-- Este script es seguro para ejecutarse sobre una instalación existente:
-- crea la base de datos únicamente si no existe. Para una reinstalación limpia
-- use 00_reset_database.sql (destructivo, haga respaldo antes).
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '-06:00';

CREATE DATABASE IF NOT EXISTS `db_justificantes_utxj`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `db_justificantes_utxj`;

SELECT
  SCHEMA_NAME AS base_de_datos,
  DEFAULT_CHARACTER_SET_NAME AS charset,
  DEFAULT_COLLATION_NAME AS collation
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = 'db_justificantes_utxj';
