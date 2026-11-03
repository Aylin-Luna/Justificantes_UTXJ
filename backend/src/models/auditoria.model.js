'use strict';

const { query, queryOne } = require('../../database/pool');

const list = async ({ filters = {}, page = 1, limit = 25 }) => {
  const where = [];
  const params = [];

  if (filters.table) {
    where.push('a.table_name = ?');
    params.push(filters.table);
  }
  if (filters.operation) {
    where.push('a.operation = ?');
    params.push(filters.operation);
  }
  if (filters.userId) {
    where.push('a.user_id = ?');
    params.push(filters.userId);
  }
  if (filters.search) {
    where.push('(a.change_description LIKE ? OR a.record_id LIKE ? OR u.full_name LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  if (filters.from) {
    where.push('a.changed_at >= ?');
    params.push(`${filters.from} 00:00:00`);
  }
  if (filters.to) {
    where.push('a.changed_at <= ?');
    params.push(`${filters.to} 23:59:59`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const totalRow = await queryOne(
    `SELECT COUNT(*) AS total FROM tb_audit_logs a LEFT JOIN tb_users u ON u.id_user = a.user_id ${whereSql}`,
    params
  );
  const rows = await query(
    `SELECT a.id_log, a.table_name, a.operation, a.record_id, a.user_id,
            a.db_user, a.client_ip, a.source, a.changed_at, a.change_description,
            u.full_name AS user_name
       FROM tb_audit_logs a
       LEFT JOIN tb_users u ON u.id_user = a.user_id
       ${whereSql}
      ORDER BY a.changed_at DESC, a.id_log DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );

  return {
    total: Number(totalRow.total),
    page,
    limit,
    pages: Math.max(1, Math.ceil(Number(totalRow.total) / limit)),
    items: rows.map((row) => ({
      id: Number(row.id_log),
      table: row.table_name,
      operation: row.operation,
      recordId: row.record_id,
      userId: row.user_id,
      userName: row.user_name || 'Sistema',
      dbUser: row.db_user,
      clientIp: row.client_ip,
      source: row.source,
      changedAt: row.changed_at,
      description: row.change_description,
    })),
  };
};

const summary = async () => {
  const row = await queryOne(
    `SELECT COUNT(*) AS total,
            SUM(operation = 'INSERT') AS inserts,
            SUM(operation = 'UPDATE') AS updates,
            SUM(operation = 'DELETE') AS deletes,
            SUM(changed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS last_24h
       FROM tb_audit_logs`
  );
  return {
    total: Number(row.total),
    inserts: Number(row.inserts || 0),
    updates: Number(row.updates || 0),
    deletes: Number(row.deletes || 0),
    last24h: Number(row.last_24h || 0),
  };
};

const getTables = async () => {
  const rows = await query(
    'SELECT DISTINCT table_name FROM tb_audit_logs ORDER BY table_name'
  );
  return rows.map((row) => row.table_name);
};

module.exports = { list, summary, getTables };
