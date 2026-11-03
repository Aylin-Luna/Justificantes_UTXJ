#!/usr/bin/env node
/**
 * Genera documentation/diccionario_datos.md desde la base de datos viva.
 *
 * Uso: node scripts/generate_data_dictionary.js
 * Requiere backend/.env con las credenciales de MySQL.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

const ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT, 'backend', '.env') });

const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_justificantes_utxj',
};

const DOMAIN_ORDER = ['Institucional', 'Personas', 'Acceso', 'Académico', 'Catálogos', 'Justificantes'];
const DOMAINS = {
  tb_institutions: 'Institucional',
  tb_careers: 'Institucional',
  tb_groups: 'Institucional',
  tb_non_working_days: 'Institucional',
  tb_system_settings: 'Institucional',
  tb_students: 'Personas',
  tb_guardians: 'Personas',
  tb_teachers: 'Personas',
  tb_academic_staff: 'Personas',
  tb_users: 'Acceso',
  tb_roles: 'Acceso',
  tbd_user_roles: 'Acceso',
  tb_audit_logs: 'Acceso',
  tb_subjects: 'Académico',
  tb_justifications: 'Justificantes',
  tb_justification_statuses: 'Justificantes',
  tb_justification_status_history: 'Justificantes',
  tb_reason_types: 'Catálogos',
  tb_document_types: 'Catálogos',
  tb_folio_sequences: 'Catálogos',
  tb_justification_absences: 'Justificantes',
  tbd_justification_subjects: 'Justificantes',
  tb_supporting_documents: 'Justificantes',
  tb_justification_signatures: 'Justificantes',
  tb_institutional_stamps: 'Justificantes',
};

const DESCRIPTION = {
  tb_institutions: 'Datos oficiales de la universidad emisora. Alimenta el encabezado, el pie y el sello del justificante.',
  tb_careers: 'Carreras y niveles educativos ofertados por la institución.',
  tb_groups: 'Grupos escolares por carrera, grado, turno y periodo.',
  tb_non_working_days: 'Días inhábiles usados para calcular la vigencia en días hábiles.',
  tb_system_settings: 'Parámetros operativos configurables desde el panel administrativo.',
  tb_students: 'Alumnado inscrito; la matrícula es la clave natural de consulta.',
  tb_guardians: 'Padres, madres o tutores del alumnado. Su firma es opcional.',
  tb_teachers: 'Docentes que pueden estar asociados a las materias afectadas.',
  tb_academic_staff: 'Personal académico con función de tutoría o dirección de carrera.',
  tb_users: 'Cuentas de acceso con hash bcrypt, bloqueo por intentos y vínculo opcional a alumno o docente.',
  tb_roles: 'Catálogo de roles del sistema (alumno, tutor, directora, admin).',
  tbd_user_roles: 'Relación N:M entre usuarios y roles.',
  tb_audit_logs: 'Bitácora inmutable de cambios generada por los triggers de auditoría.',
  tb_subjects: 'Materias por carrera y cuatrimestre.',
  tb_justifications: 'Entidad central del sistema. Conserva folio, fechas, motivo, estado, vigencia y responsables.',
  tb_justification_statuses: 'Catálogo de estados y marca de estado final.',
  tb_justification_status_history: 'Historial de transiciones de estado con usuario y comentario.',
  tb_reason_types: 'Motivos del justificante y si exigen comprobante.',
  tb_document_types: 'Tipos de comprobante permitidos, extensiones y validación requerida.',
  tb_folio_sequences: 'Secuencia diaria para generar folios únicos sin colisiones.',
  tb_justification_absences: 'Fechas concretas de falta declaradas en cada justificante.',
  tbd_justification_subjects: 'Materias y docentes afectados por cada fecha de falta.',
  tb_supporting_documents: 'Metadatos de comprobantes privados; el binario vive fuera de la base de datos.',
  tb_justification_signatures: 'Firmas electrónicas de padre/madre/tutor, tutor educativo y dirección.',
  tb_institutional_stamps: 'Sello institucional aplicado al aprobar; uno por justificante.',
};

function escapeCell(value) {
  if (value === null || value === undefined) return '—';
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function formatDefault(column) {
  if (column.COLUMN_DEFAULT === null || column.COLUMN_DEFAULT === undefined) {
    return column.IS_NULLABLE === 'YES' ? 'NULL' : '—';
  }
  const value = String(column.COLUMN_DEFAULT);
  if (/^CURRENT_TIMESTAMP/i.test(value)) return `\`${value}\``;
  return `\`${value}\``;
}

function keyLabel(column, foreignColumns) {
  const marks = [];
  if (column.COLUMN_KEY === 'PRI') marks.push('PK');
  if (column.COLUMN_KEY === 'UNI') marks.push('UNI');
  if (foreignColumns.has(column.COLUMN_NAME)) marks.push('FK');
  if (column.COLUMN_KEY === 'MUL' && !foreignColumns.has(column.COLUMN_NAME)) marks.push('IDX');
  return marks.join(', ') || '—';
}

function tableAnchor(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

async function main() {
  const connection = await mysql.createConnection(DB);

  const [tables] = await connection.query(
    `SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, TABLE_COMMENT
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME`,
    [DB.database],
  );

  const [columns] = await connection.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY,
            COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT, CHARACTER_SET_NAME
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [DB.database],
  );

  const [foreignKeys] = await connection.query(
    `SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME,
            k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
            r.DELETE_RULE, r.UPDATE_RULE
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r
         ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
        AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
      WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
    [DB.database],
  );

  const [indexes] = await connection.query(
    `SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns,
            NON_UNIQUE
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ?
      GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
      ORDER BY TABLE_NAME, INDEX_NAME`,
    [DB.database],
  );

  const [views] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ?`,
    [DB.database],
  );

  await connection.end();

  const columnsByTable = new Map();
  for (const column of columns) {
    if (!columnsByTable.has(column.TABLE_NAME)) columnsByTable.set(column.TABLE_NAME, []);
    columnsByTable.get(column.TABLE_NAME).push(column);
  }

  const fksByTable = new Map();
  for (const fk of foreignKeys) {
    if (!fksByTable.has(fk.TABLE_NAME)) fksByTable.set(fk.TABLE_NAME, []);
    fksByTable.get(fk.TABLE_NAME).push(fk);
  }

  const indexesByTable = new Map();
  for (const index of indexes) {
    if (index.INDEX_NAME === 'PRIMARY') continue;
    if (!indexesByTable.has(index.TABLE_NAME)) indexesByTable.set(index.TABLE_NAME, []);
    indexesByTable.get(index.TABLE_NAME).push(index);
  }

  const sorted = [...tables].sort((a, b) => {
    const domainA = DOMAIN_ORDER.indexOf(DOMAINS[a.TABLE_NAME] || 'Otros');
    const domainB = DOMAIN_ORDER.indexOf(DOMAINS[b.TABLE_NAME] || 'Otros');
    if (domainA !== domainB) return domainA - domainB;
    return a.TABLE_NAME.localeCompare(b.TABLE_NAME);
  });

  const generated = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
  const totalColumns = columns.length;
  const totalForeignKeys = foreignKeys.length;

  const lines = [
    '# Diccionario de datos — Sistema de Justificantes Académicos UTXJ',
    '',
    `> Documento generado automáticamente desde \`information_schema\` el **${generated}**`,
    `> Base de datos: \`${DB.database}\` · Motor: MySQL 8.0 · Juego de caracteres: \`utf8mb4\`.`,
    '> Regenerar con: `node scripts/generate_data_dictionary.js`.',
    '',
    '## Resumen',
    '',
    '| Elemento | Cantidad |',
    '| --- | ---: |',
    `| Tablas | ${tables.length} |`,
    `| Columnas | ${totalColumns} |`,
    `| Llaves foráneas | ${totalForeignKeys} |`,
    `| Vistas | ${views.length} |`,
    '',
    '## Contenido',
    '',
  ];

  let currentDomain = '';
  for (const table of sorted) {
    const domain = DOMAINS[table.TABLE_NAME] || 'Otros';
    const label = `${table.TABLE_NAME} — ${DESCRIPTION[table.TABLE_NAME] || table.TABLE_COMMENT || 'Tabla del sistema'}`;
    if (domain !== currentDomain) {
      currentDomain = domain;
      lines.push(`- **${domain}**`);
    }
    lines.push(`  - [${label}](#${tableAnchor(table.TABLE_NAME)})`);
  }
  lines.push('', '## Convenciones', '');
  lines.push('- **PK**: llave primaria. **FK**: llave foránea. **UNI**: restricción de unicidad. **IDX**: índice no único.');
  lines.push('- Los montos de tiempo (`created_at`, `updated_at`, `changed_at`) usan zona horaria del servidor MySQL.');
  lines.push('- Los documentos, firmas y sellos guardan solo la referencia y el SHA-256; el archivo binario se almacena en el sistema de archivos privado.');
  lines.push('- Las columnas `*_at` con `ON UPDATE CURRENT_TIMESTAMP` se actualizan automáticamente.');
  lines.push('');
  lines.push('---', '');

  currentDomain = '';
  for (const table of sorted) {
    const domain = DOMAINS[table.TABLE_NAME] || 'Otros';
    if (domain !== currentDomain) {
      currentDomain = domain;
      lines.push(`## ${domain}`, '');
    }

    const tableColumns = columnsByTable.get(table.TABLE_NAME) || [];
    const tableFks = fksByTable.get(table.TABLE_NAME) || [];
    const fkColumns = new Set(tableFks.map((fk) => fk.COLUMN_NAME));
    const tableIndexes = indexesByTable.get(table.TABLE_NAME) || [];

    lines.push(`### ${table.TABLE_NAME}`, '');
    lines.push(`**Descripción:** ${DESCRIPTION[table.TABLE_NAME] || table.TABLE_COMMENT || 'Sin descripción.'}`, '');
    lines.push(`**Motor:** ${table.ENGINE} · **Cotejamiento:** \`${table.TABLE_COLLATION}\` · **Columnas:** ${tableColumns.length}`, '');
    lines.push('| Columna | Tipo | Nulo | Clave | Predeterminado | Extra | Comentario |');
    lines.push('| --- | --- | :---: | :---: | --- | --- | --- |');
    for (const column of tableColumns) {
      lines.push(`| ${[
        `\`${column.COLUMN_NAME}\``,
        `\`${column.COLUMN_TYPE}\``,
        column.IS_NULLABLE === 'YES' ? 'Sí' : 'No',
        keyLabel(column, fkColumns),
        formatDefault(column),
        column.EXTRA || '—',
        escapeCell(column.COLUMN_COMMENT || '—'),
      ].join(' | ')} |`);
    }
    lines.push('');

    if (tableFks.length > 0) {
      lines.push('**Llaves foráneas**', '');
      lines.push('| Restricción | Columna | Referencia | ON DELETE | ON UPDATE |');
      lines.push('| --- | --- | --- | --- | --- |');
      for (const fk of tableFks) {
        lines.push(`| \`${fk.CONSTRAINT_NAME}\` | \`${fk.COLUMN_NAME}\` | \`${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}\` | ${fk.DELETE_RULE} | ${fk.UPDATE_RULE} |`);
      }
      lines.push('');
    }

    if (tableIndexes.length > 0) {
      lines.push('**Índices**', '');
      lines.push('| Índice | Columnas | Único |');
      lines.push('| --- | --- | :---: |');
      for (const index of tableIndexes) {
        lines.push(`| \`${index.INDEX_NAME}\` | \`${index.columns}\` | ${index.NON_UNIQUE ? 'No' : 'Sí'} |`);
      }
      lines.push('');
    }
  }

  lines.push('---', '');
  lines.push('## Notas de integridad', '');
  lines.push('- Las relaciones usan `ON DELETE RESTRICT` o `SET NULL` según la criticidad del dato; no se elimina historial académico en cascada.');
  lines.push('- `tb_justifications` conserva `version` para control de concurrencia y `deleted_at` para baja lógica.');
  lines.push('- `tb_folio_sequences` se actualiza dentro de una transacción con bloqueo de fila para evitar folios duplicados.');
  lines.push('- La bitácora `tb_audit_logs` es solo de inserción: los triggers impiden modificarla o eliminarla.');
  lines.push('');

  const outputDir = path.join(ROOT, 'documentation');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'diccionario_datos.md'), lines.join('\n'), 'utf8');

  console.log(`Tablas documentadas: ${tables.length}`);
  console.log(`Columnas: ${totalColumns} · Llaves foráneas: ${totalForeignKeys}`);
  console.log('Generado: documentation/diccionario_datos.md');
}

main().catch((error) => {
  console.error('No fue posible generar el diccionario:', error.message);
  process.exitCode = 1;
});
