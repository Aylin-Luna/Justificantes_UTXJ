#!/usr/bin/env node
/**
 * Genera la documentación visual del esquema a partir de la base de datos viva.
 *
 * Uso: node scripts/generate_erd.js
 * Requiere backend/.env con las credenciales de MySQL.
 *
 * Salidas:
 *   diagrams/entity_relationship.md  -> diagrama Mermaid ER
 *   diagrams/erd.html                -> ERD interactivo autocontenido
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

const TYPE_MAP = [
  [/^(tinyint|smallint|mediumint|int|bigint)/i, 'int'],
  [/^(decimal|numeric)/i, 'decimal'],
  [/^(float|double)/i, 'float'],
  [/^(varchar|char|text|tinytext|mediumtext|longtext)/i, 'string'],
  [/^(date)$/i, 'date'],
  [/^(datetime|timestamp)$/i, 'datetime'],
  [/^(time)$/i, 'time'],
  [/^(json)$/i, 'json'],
  [/^(enum|set)/i, 'enum'],
  [/^(blob|binary|varbinary)/i, 'binary'],
];

function simpleType(columnType) {
  for (const [pattern, name] of TYPE_MAP) {
    if (pattern.test(columnType)) return name;
  }
  return 'string';
}

function escapeMermaid(text) {
  return String(text)
    .replace(/[(){}[\]"]/g, '')
    .replace(/,/g, ' /')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadSchema() {
  const connection = await mysql.createConnection(DB);

  const [columns] = await connection.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY,
            COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT, ORDINAL_POSITION
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [DB.database],
  );

  const [tables] = await connection.query(
    `SELECT TABLE_NAME, TABLE_ROWS, TABLE_COMMENT, ENGINE
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME`,
    [DB.database],
  );

  const [foreignKeys] = await connection.query(
    `SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME,
            k.REFERENCED_COLUMN_NAME, k.CONSTRAINT_NAME,
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
    `SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
    [DB.database],
  );

  await connection.end();

  const byTable = new Map();
  for (const table of tables) {
    byTable.set(table.TABLE_NAME, {
      name: table.TABLE_NAME,
      rows: Number(table.TABLE_ROWS || 0),
      comment: table.TABLE_COMMENT || '',
      domain: DOMAINS[table.TABLE_NAME] || 'Otros',
      columns: [],
      indexes: [],
      foreignKeys: [],
    });
  }

  for (const column of columns) {
    const table = byTable.get(column.TABLE_NAME);
    if (!table) continue;
    table.columns.push({
      name: column.COLUMN_NAME,
      type: column.COLUMN_TYPE,
      nullable: column.IS_NULLABLE === 'YES',
      key: column.COLUMN_KEY,
      default: column.COLUMN_DEFAULT,
      extra: column.EXTRA,
      comment: column.COLUMN_COMMENT,
    });
  }

  for (const index of indexes) {
    const table = byTable.get(index.TABLE_NAME);
    if (!table) continue;
    table.indexes.push(index);
  }

  for (const fk of foreignKeys) {
    const table = byTable.get(fk.TABLE_NAME);
    if (!table) continue;
    table.foreignKeys.push({
      column: fk.COLUMN_NAME,
      referencedTable: fk.REFERENCED_TABLE_NAME,
      referencedColumn: fk.REFERENCED_COLUMN_NAME,
      constraint: fk.CONSTRAINT_NAME,
      onDelete: fk.DELETE_RULE,
      onUpdate: fk.UPDATE_RULE,
    });
  }

  const relations = foreignKeys.map((fk) => ({
    table: fk.TABLE_NAME,
    column: fk.COLUMN_NAME,
    referencedTable: fk.REFERENCED_TABLE_NAME,
    referencedColumn: fk.REFERENCED_COLUMN_NAME,
    constraint: fk.CONSTRAINT_NAME,
    onDelete: fk.DELETE_RULE,
    onUpdate: fk.UPDATE_RULE,
  }));

  return { tables: [...byTable.values()], foreignKeys: relations };
}

function buildMermaid(schema) {
  const lines = [
    'erDiagram',
    '  %% Diagrama generado automáticamente desde la base de datos viva.',
    '  %% Regenerar con: node scripts/generate_erd.js',
    '',
  ];

  for (const table of schema.tables) {
    lines.push(`  ${table.name} {`);
    const fkColumns = new Set(table.foreignKeys.map((fk) => fk.column));
    for (const column of table.columns) {
      const type = simpleType(column.type);
      const name = column.name;
      const marks = [];
      if (column.key === 'PRI') marks.push('PK');
      if (fkColumns.has(name)) marks.push('FK');
      const comment = escapeMermaid(column.comment || '');
      const suffix = marks.length || comment ? ` "${[...marks, comment].filter(Boolean).join(' ')}"` : '';
      lines.push(`    ${type} ${name}${suffix}`);
    }
    lines.push('  }');
    lines.push('');
  }

  const seen = new Set();
  for (const fk of schema.foreignKeys) {
    if (seen.has(fk.constraint)) continue;
    seen.add(fk.constraint);
    lines.push(`  ${fk.referencedTable} ||--o{ ${fk.table} : "${fk.constraint}"`);
  }
  lines.push('');
  return lines.join('\n');
}

function buildHtml(schema) {
  const data = JSON.stringify(schema).replace(/</g, '\\u003c');
  const generated = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Modelo entidad-relación · Justificantes UTXJ</title>
<style>
  :root {
    --bg: #0d1b14;
    --panel: #12251b;
    --panel-2: #173024;
    --line: rgba(148, 196, 166, .22);
    --text: #e7f2ea;
    --muted: #9ab5a4;
    --accent: #46b47a;
    --accent-2: #e0a83e;
    --danger: #e07a6a;
    --shadow: 0 18px 40px -22px rgba(0, 0, 0, .8);
    --radius: 14px;
  }
  [data-theme="light"] {
    --bg: #eef3ef;
    --panel: #ffffff;
    --panel-2: #f5f9f6;
    --line: rgba(24, 74, 46, .16);
    --text: #16241c;
    --muted: #5c7466;
    --accent: #1f7a4c;
    --accent-2: #a8730f;
    --danger: #a3352b;
    --shadow: 0 18px 40px -26px rgba(20, 50, 32, .35);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    background:
      radial-gradient(1200px 600px at 12% -10%, rgba(70, 180, 122, .16), transparent 60%),
      radial-gradient(900px 500px at 105% 10%, rgba(224, 168, 62, .10), transparent 55%),
      var(--bg);
    color: var(--text);
    font-family: "Segoe UI", Inter, system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  header.top {
    position: sticky; top: 0; z-index: 30;
    display: flex; flex-wrap: wrap; align-items: center; gap: 14px 22px;
    padding: 16px 26px;
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--line);
  }
  .brand { display: flex; align-items: center; gap: 12px; margin-right: auto; }
  .brand-mark {
    display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px;
    background: linear-gradient(140deg, var(--accent), #2b7d54);
    color: #fff; font-weight: 800; letter-spacing: .5px; font-size: 13px;
    box-shadow: 0 8px 18px -8px rgba(35, 120, 74, .9);
  }
  .brand h1 { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: .2px; }
  .brand p { margin: 2px 0 0; font-size: 11.5px; color: var(--muted); }
  .stats { display: flex; gap: 8px; flex-wrap: wrap; }
  .stat {
    padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px;
    background: var(--panel); font-size: 11.5px; color: var(--muted);
  }
  .stat b { color: var(--text); font-weight: 700; }
  .tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .search {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px; border-radius: 10px; border: 1px solid var(--line);
    background: var(--panel); min-width: 240px;
  }
  .search input {
    border: 0; outline: 0; background: transparent; color: var(--text);
    font: inherit; font-size: 13px; width: 100%;
  }
  .search span { color: var(--muted); font-size: 14px; }
  button.tool {
    padding: 8px 14px; border-radius: 10px; border: 1px solid var(--line);
    background: var(--panel); color: var(--text); font: inherit; font-size: 12.5px;
    cursor: pointer; transition: .18s ease;
  }
  button.tool:hover { border-color: var(--accent); color: var(--accent); }
  button.tool.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .legend {
    display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 12px 26px;
    border-bottom: 1px solid var(--line); font-size: 11.5px; color: var(--muted);
  }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
  main { padding: 24px 26px 80px; }
  .canvas-wrap {
    position: relative; overflow: auto; border: 1px solid var(--line);
    border-radius: var(--radius); background:
      linear-gradient(var(--line) 1px, transparent 1px) 0 0 / 100% 32px,
      linear-gradient(90deg, var(--line) 1px, transparent 1px) 0 0 / 32px 100%,
      color-mix(in srgb, var(--panel) 55%, transparent);
    box-shadow: var(--shadow);
    max-height: calc(100vh - 235px);
  }
  #canvas { position: relative; min-width: 1560px; min-height: 1180px; }
  svg#edges { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .edge { fill: none; stroke: var(--line); stroke-width: 1.4; transition: .18s ease; }
  .edge.fk { stroke: color-mix(in srgb, var(--accent) 45%, transparent); }
  .edge.hot { stroke: var(--accent-2); stroke-width: 2.6; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent-2) 60%, transparent)); }
  .edge.dim { opacity: .12; }
  .node {
    position: absolute; width: 246px; border-radius: 12px;
    background: var(--panel); border: 1px solid var(--line);
    box-shadow: 0 12px 26px -18px rgba(0, 0, 0, .7);
    font-size: 11.5px; transition: box-shadow .18s ease, opacity .18s ease, border-color .18s ease;
    overflow: hidden; cursor: pointer;
  }
  .node:hover, .node.hot { border-color: var(--accent-2); box-shadow: 0 0 0 1px var(--accent-2), 0 18px 34px -20px rgba(224, 168, 62, .5); }
  .node.dim { opacity: .28; }
  .node header {
    display: flex; align-items: center; gap: 8px; padding: 9px 12px;
    background: linear-gradient(110deg, color-mix(in srgb, var(--accent) 20%, var(--panel-2)), var(--panel-2));
    border-bottom: 1px solid var(--line);
  }
  .node header .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex: none; }
  .node header strong { font-size: 12px; letter-spacing: .2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .node header em { margin-left: auto; font-style: normal; font-size: 9.5px; color: var(--muted); }
  .node .cols { padding: 6px 0 8px; }
  .node .col {
    display: flex; align-items: baseline; gap: 8px; padding: 2px 12px;
    color: var(--muted); white-space: nowrap;
  }
  .node .col .nm { color: var(--text); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 10.5px; overflow: hidden; text-overflow: ellipsis; }
  .node .col .ty { margin-left: auto; font-size: 9.5px; opacity: .8; }
  .node .col.pk .nm { color: var(--accent-2); font-weight: 700; }
  .node .col.fk .nm { color: var(--accent); }
  .node .col.more { color: var(--muted); font-style: italic; padding-top: 4px; }
  .tag { display: inline-block; min-width: 24px; text-align: center; font-size: 8.5px; font-weight: 700; letter-spacing: .4px; border-radius: 4px; padding: 1px 4px; margin-right: 2px; }
  .tag.pk { background: color-mix(in srgb, var(--accent-2) 22%, transparent); color: var(--accent-2); }
  .tag.fk { background: color-mix(in srgb, var(--accent) 20%, transparent); color: var(--accent); }
  .domain-Institucional { --accent: #46b47a; }
  .domain-Personas { --accent: #58a6d6; }
  .domain-Acceso { --accent: #c78bd6; }
  .domain-Académico { --accent: #d6b45a; }
  .domain-Justificantes { --accent: #e08a5f; }
  .domain-Catálogos { --accent: #7fc4b2; }
  .domain-Otros { --accent: #9ab5a4; }
  .empty-state { padding: 60px 24px; text-align: center; color: var(--muted); }
  .hint { margin: 14px 2px 0; color: var(--muted); font-size: 11.5px; line-height: 1.7; }
  .hint kbd { border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 5px; padding: 1px 5px; font-size: 10.5px; }
  footer.bottom { padding: 0 26px 30px; color: var(--muted); font-size: 11px; }
  @media (max-width: 720px) {
    header.top { padding: 14px 16px; }
    main { padding: 16px; }
    .search { min-width: 0; flex: 1 1 180px; }
    .brand p { display: none; }
  }
</style>
</head>
<body>
<header class="top">
  <div class="brand">
    <div class="brand-mark">UTXJ</div>
    <div>
      <h1>Modelo entidad-relación</h1>
      <p>Sistema de justificantes académicos · <code>${DB.database}</code></p>
    </div>
  </div>
  <div class="stats" id="stats"></div>
  <div class="tools">
    <label class="search"><span>⌕</span><input id="q" type="search" placeholder="Buscar tabla o columna…" autocomplete="off"></label>
    <button class="tool" id="toggle-theme">Tema claro</button>
    <button class="tool" id="reset">Restablecer</button>
  </div>
</header>
<div class="legend" id="legend"></div>
<main>
  <div class="canvas-wrap" id="scroll">
    <div id="canvas"><svg id="edges"></svg></div>
  </div>
  <p class="hint">Pase el cursor sobre una tabla para resaltar sus relaciones. Haga clic para fijarla. <kbd>Esc</kbd> restablece la vista. Las etiquetas <b>PK</b> y <b>FK</b> señalan llaves primarias y foráneas.</p>
</main>
<footer class="bottom">Generado el ${generated} desde <code>information_schema</code> de MySQL 8.0. · <code>node scripts/generate_erd.js</code></footer>
<script>
const SCHEMA = ${data};
const DOMAIN_COLORS = {
  'Institucional': '#46b47a', 'Personas': '#58a6d6', 'Acceso': '#c78bd6',
  'Académico': '#d6b45a', 'Justificantes': '#e08a5f', 'Catálogos': '#7fc4b2', 'Otros': '#9ab5a4'
};

const COLUMN_LAYOUT = [
  ['tb_institutions', 'tb_careers', 'tb_groups', 'tb_non_working_days', 'tb_institutions'],
  ['tb_students', 'tb_guardians', 'tb_teachers', 'tb_academic_staff'],
  ['tb_users', 'tb_roles', 'tbd_user_roles', 'tb_audit_logs', 'tb_system_settings'],
  ['tb_subjects', 'tb_reason_types', 'tb_document_types', 'tb_justification_statuses', 'tb_folio_sequences'],
  ['tb_justifications', 'tb_justification_absences', 'tbd_justification_subjects', 'tb_supporting_documents', 'tb_justification_signatures', 'tb_institutional_stamps', 'tb_justification_status_history']
];

const NODE_W = 246, GAP_X = 42, GAP_Y = 26, PAD = 28, TOP = 24;

const byName = new Map(SCHEMA.tables.map(t => [t.name, t]));
const placed = new Map();
const canvas = document.getElementById('canvas');
const svg = document.getElementById('edges');
const scroll = document.getElementById('scroll');
const search = document.getElementById('q');
const stats = document.getElementById('stats');
const legend = document.getElementById('legend');

function buildStats() {
  const cols = SCHEMA.tables.reduce((n, t) => n + t.columns.length, 0);
  const fks = SCHEMA.foreignKeys.length;
  stats.innerHTML = [
    ['Tablas', SCHEMA.tables.length],
    ['Columnas', cols],
    ['Relaciones', fks]
  ].map(([k, v]) => '<span class="stat"><b>' + v + '</b> ' + k + '</span>').join('');
}

function buildLegend() {
  const domains = [...new Set(SCHEMA.tables.map(t => t.domain))];
  legend.innerHTML = domains.map(d =>
    '<span><i style="background:' + (DOMAIN_COLORS[d] || DOMAIN_COLORS.Otros) + '"></i>' + d + '</span>'
  ).join('');
}

function layoutNodes() {
  let maxBottom = 0;
  COLUMN_LAYOUT.forEach((column, index) => {
    const seen = new Set();
    let top = TOP;
    column.forEach(name => {
      const table = byName.get(name);
      if (!table || seen.has(name)) return;
      seen.add(name);
      const node = document.createElement('article');
      node.className = 'node domain-' + table.domain.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ]/g, '');
      node.dataset.table = name;
      const pk = table.columns.filter(c => c.key === 'PRI').map(c => c.name);
      const fkCols = new Set(table.foreignKeys.map(f => f.column));
      const priority = table.columns.filter(c => c.key === 'PRI' || fkCols.has(c.name));
      const shown = [...new Set([...priority, ...table.columns.slice(0, 14).map(c => c.name)])].slice(0, 14);
      const rows = shown.map(colName => {
        const col = table.columns.find(c => c.name === colName);
        if (!col) return '';
        const isPk = col.key === 'PRI', isFk = fkCols.has(col.name);
        const tag = isPk ? '<span class="tag pk">PK</span>' : isFk ? '<span class="tag fk">FK</span>' : '<span class="tag"></span>';
        return '<div class="col ' + (isPk ? 'pk' : isFk ? 'fk' : '') + '">' + tag +
          '<span class="nm" title="' + escapeAttr(col.name) + '">' + escapeHtml(col.name) + '</span>' +
          '<span class="ty">' + escapeHtml(shortType(col.type)) + '</span></div>';
      }).join('');
      const more = table.columns.length > shown.length
        ? '<div class="col more">+' + (table.columns.length - shown.length) + ' columnas más</div>' : '';
      node.innerHTML = '<header><span class="dot"></span><strong title="' + escapeAttr(name) + '">' + escapeHtml(name) + '</strong><em>' + (table.rows || 0) + ' reg.</em></header>' +
        '<div class="cols">' + rows + more + '</div>';
      node.style.left = (PAD + index * (NODE_W + GAP_X)) + 'px';
      node.style.top = top + 'px';
      canvas.appendChild(node);
      const height = node.offsetHeight;
      placed.set(name, { el: node, x: PAD + index * (NODE_W + GAP_X), y: top, w: NODE_W, h: height, table });
      top += height + GAP_Y;
      maxBottom = Math.max(maxBottom, top);
    });
  });
  canvas.style.width = (PAD * 2 + COLUMN_LAYOUT.length * NODE_W + (COLUMN_LAYOUT.length - 1) * GAP_X) + 'px';
  canvas.style.height = Math.max(1180, maxBottom + PAD) + 'px';
}

function shortType(type) {
  return String(type)
    .replace(/^varchar\((\d+)\)$/i, 'varchar($1)')
    .replace(/^int unsigned$/i, 'int')
    .replace(/^bigint unsigned$/i, 'bigint')
    .replace(/^tinyint\(1\)$/i, 'bool')
    .replace(/^enum\(.*\)$/i, 'enum')
    .replace(/^decimal\(.*\)$/i, 'decimal');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function escapeAttr(value) { return escapeHtml(value); }

function edgePath(from, to) {
  const fx = from.x + from.w, fy = from.y + Math.min(from.h / 2, 90);
  const tx = to.x, ty = to.y + Math.min(to.h / 2, 90);
  if (tx >= fx) {
    const mid = fx + Math.max(24, (tx - fx) / 2);
    return 'M' + fx + ',' + fy + ' C' + mid + ',' + fy + ' ' + mid + ',' + ty + ' ' + tx + ',' + ty;
  }
  const sx = from.x + from.w / 2, sy = from.y + from.h;
  const ex = to.x + to.w / 2, ey = to.y;
  const mid = Math.max(sy, ey) + 34;
  return 'M' + sx + ',' + sy + ' C' + sx + ',' + mid + ' ' + ex + ',' + mid + ' ' + ex + ',' + ey;
}

function drawEdges() {
  svg.innerHTML = '';
  SCHEMA.foreignKeys.forEach((fk, index) => {
    const from = placed.get(fk.table);
    const to = placed.get(fk.referencedTable);
    if (!from || !to) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', edgePath(from, to));
    path.setAttribute('class', 'edge fk');
    path.dataset.from = fk.table;
    path.dataset.to = fk.referencedTable;
    path.dataset.constraint = fk.constraint;
    path.innerHTML = '<title>' + escapeHtml(fk.constraint + ': ' + fk.table + '.' + fk.column + ' → ' + fk.referencedTable + '.' + fk.referencedColumn) + '</title>';
    svg.appendChild(path);
  });
}

let pinned = null;

function highlight(tableName) {
  const related = new Set([tableName]);
  SCHEMA.foreignKeys.forEach(fk => {
    if (fk.table === tableName) related.add(fk.referencedTable);
    if (fk.referencedTable === tableName) related.add(fk.table);
  });
  document.querySelectorAll('.node').forEach(node => {
    node.classList.toggle('hot', node.dataset.table === tableName);
    node.classList.toggle('dim', !related.has(node.dataset.table));
  });
  document.querySelectorAll('.edge').forEach(edge => {
    const on = edge.dataset.from === tableName || edge.dataset.to === tableName;
    edge.classList.toggle('hot', on);
    edge.classList.toggle('dim', !on);
  });
}

function clearHighlight() {
  document.querySelectorAll('.node').forEach(node => node.classList.remove('hot', 'dim'));
  document.querySelectorAll('.edge').forEach(edge => edge.classList.remove('hot', 'dim'));
}

function bindNodes() {
  document.querySelectorAll('.node').forEach(node => {
    node.addEventListener('mouseenter', () => { if (!pinned) highlight(node.dataset.table); });
    node.addEventListener('mouseleave', () => { if (!pinned) clearHighlight(); });
    node.addEventListener('click', () => {
      pinned = pinned === node.dataset.table ? null : node.dataset.table;
      if (pinned) highlight(pinned); else clearHighlight();
    });
  });
}

function applySearch(term) {
  const q = term.trim().toLowerCase();
  if (!q) { clearHighlight(); return; }
  const matches = new Set();
  SCHEMA.tables.forEach(table => {
    if (table.name.toLowerCase().includes(q) || table.columns.some(c => c.name.toLowerCase().includes(q))) {
      matches.add(table.name);
    }
  });
  document.querySelectorAll('.node').forEach(node => {
    const hit = matches.has(node.dataset.table);
    node.classList.toggle('dim', !hit);
    node.classList.toggle('hot', hit);
  });
  document.querySelectorAll('.edge').forEach(edge => {
    const hit = matches.has(edge.dataset.from) || matches.has(edge.dataset.to);
    edge.classList.toggle('dim', !hit);
    edge.classList.toggle('hot', hit && matches.size < 6);
  });
  if (matches.size === 1) {
    const name = [...matches][0];
    const node = document.querySelector('.node[data-table="' + name + '"]');
    node?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }
}

document.getElementById('reset').addEventListener('click', () => {
  pinned = null;
  search.value = '';
  clearHighlight();
});
document.getElementById('toggle-theme').addEventListener('click', (event) => {
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  document.documentElement.setAttribute('data-theme', light ? 'dark' : 'light');
  event.currentTarget.textContent = light ? 'Tema claro' : 'Tema oscuro';
});
search.addEventListener('input', () => applySearch(search.value));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    pinned = null; search.value = ''; clearHighlight();
  }
});

buildStats();
buildLegend();
layoutNodes();
drawEdges();
bindNodes();
requestAnimationFrame(drawEdges);
window.addEventListener('resize', drawEdges);
</script>
</body>
</html>
`;
}

(async () => {
  const schema = await loadSchema();
  const diagramsDir = path.join(ROOT, 'diagrams');
  fs.mkdirSync(diagramsDir, { recursive: true });

  const markdown = buildMermaid(schema);
  fs.writeFileSync(path.join(diagramsDir, 'entity_relationship.md'), markdown, 'utf8');
  fs.writeFileSync(path.join(diagramsDir, 'erd.html'), buildHtml(schema), 'utf8');

  console.log(`Tablas: ${schema.tables.length}`);
  console.log(`Relaciones: ${schema.foreignKeys.length}`);
  console.log('Generado: diagrams/entity_relationship.md');
  console.log('Generado: diagrams/erd.html');
})().catch((error) => {
  console.error('No fue posible generar el ERD:', error.message);
  process.exitCode = 1;
});
