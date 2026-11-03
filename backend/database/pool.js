'use strict';

const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  dateStrings: true,
  charset: 'utf8mb4',
  timezone: '-06:00',
  decimalNumbers: true,
  namedPlaceholders: false,
});

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function execute(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return result;
}

/**
 * Aplica las variables de sesión que consumen los triggers de auditoría.
 * Los valores se escapan con la conexión para no concatenar entrada cruda.
 */
async function setAuditContext(connection, context = {}) {
  const userId = Number.isInteger(Number(context.userId)) && Number(context.userId) > 0
    ? Number(context.userId)
    : null;
  const ip = context.ip ? String(context.ip).slice(0, 45) : null;
  const source = context.source ? String(context.source).slice(0, 50) : null;
  const dbUser = context.dbUser ? String(context.dbUser).slice(0, 100) : null;

  await connection.query(
    `SET @audit_user_id = ${userId === null ? 'NULL' : userId},
         @audit_ip = ${ip === null ? 'NULL' : connection.escape(ip)},
         @audit_source = ${source === null ? 'NULL' : connection.escape(source)},
         @audit_db_user = ${dbUser === null ? 'NULL' : connection.escape(dbUser)}`
  );
}

/**
 * Ejecuta una función dentro de una transacción y garantiza rollback ante error.
 * El callback recibe la conexión para poder usar el mismo contexto de auditoría.
 */
async function withTransaction(callback, context = {}) {
  const connection = await pool.getConnection();
  try {
    await setAuditContext(connection, context);
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // El error original es más relevante; se registra el fallo de rollback.
      console.error('[db] Error al revertir transacción:', rollbackError.message);
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function checkHealth() {
  const row = await queryOne('SELECT 1 AS ok, DATABASE() AS base, NOW() AS ahora');
  return row;
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  queryOne,
  execute,
  withTransaction,
  setAuditContext,
  checkHealth,
  closePool,
};
