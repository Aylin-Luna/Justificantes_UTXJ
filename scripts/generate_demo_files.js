'use strict';

/**
 * Genera archivos ficticios de demostración (PDF, firmas y sello) para que los
 * registros del seed tengan archivos reales en la carpeta privada.
 * Uso: node scripts/generate_demo_files.js
 */

const fs = require('fs');
const path = require('path');
const { buildSignatureSvg, buildStampSvg } = require('../backend/src/utils/signatures');

const backend = path.resolve(__dirname, '..', 'backend');
const uploads = path.join(backend, 'uploads');
const documents = path.join(uploads, 'private', 'documents');
const signatures = path.join(uploads, 'private', 'signatures');
const stamps = path.join(uploads, 'private', 'stamps');
const assets = path.resolve(__dirname, '..', 'frontend', 'src', 'assets', 'img');

[documents, signatures, stamps, assets].forEach((directory) => fs.mkdirSync(directory, { recursive: true }));

const escapePdfText = (text) => String(text)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[\\()]/g, (match) => `\\${match}`);

const buildPdf = (title, lines) => {
  const contentLines = [
    'BT',
    '/F1 20 Tf',
    '72 740 Td',
    `(${escapePdfText(title)}) Tj`,
    '/F1 11 Tf',
    '0 -34 Td',
    ...lines.flatMap((line) => [
      `(${escapePdfText(line)}) Tj`,
      '0 -20 Td',
    ]),
    'ET',
    '0.12 0.36 0.23 RG',
    '3 w',
    '72 700 m 523 700 l S',
    '72 96 m 523 96 l S',
  ];
  const stream = contentLines.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
};

const demoDocuments = [
  {
    name: 'demo-receta-001.pdf',
    title: 'Receta médica (documento ficticio)',
    lines: [
      'Sistema de Gestión de Justificantes Académicos - UTXJ',
      'DOCUMENTO DE DEMOSTRACIÓN SIN VALIDEZ MÉDICA',
      '',
      'Paciente: Ingrid Natalia Martínez Carrasco',
      'Matrícula: 240537',
      'Fecha de atención: 26 de octubre de 2026',
      'Indicación: reposo por 24 horas.',
      'Médico: Dra. Ejemplo Demostración',
      'Cédula profesional: 0000000 (ficticia)',
      '',
      'Este archivo se genera automáticamente para probar la carga,',
      'descarga y validación de comprobantes privados.',
    ],
  },
  {
    name: 'demo-receta-002.pdf',
    title: 'Justificante médico (documento ficticio)',
    lines: [
      'Sistema de Gestión de Justificantes Académicos - UTXJ',
      'DOCUMENTO DE DEMOSTRACIÓN SIN VALIDEZ MÉDICA',
      '',
      'Paciente: Ana Sofía López García',
      'Matrícula: 240538',
      'Fecha de atención: 28 de octubre de 2026',
      'Se indica reposo los días 28 y 29 de octubre de 2026.',
      '',
      'Este archivo es ficticio y forma parte de los datos de prueba.',
    ],
  },
  {
    name: 'demo-comprobante-003.pdf',
    title: 'Comprobante de cita (documento ficticio)',
    lines: [
      'Sistema de Gestión de Justificantes Académicos - UTXJ',
      'DOCUMENTO DE DEMOSTRACIÓN SIN VALIDEZ OFICIAL',
      '',
      'Paciente: Luis Hernández Pérez',
      'Matrícula: 240539',
      'Cita programada: 29 de octubre de 2026, 09:00 h',
      'Unidad médica de demostración',
      '',
      'Comprobante pendiente de validación por el tutor educativo.',
    ],
  },
  {
    name: 'demo-comprobante-004.pdf',
    title: 'Comprobante adicional (documento ficticio)',
    lines: [
      'Sistema de Gestión de Justificantes Académicos - UTXJ',
      'DOCUMENTO DE DEMOSTRACIÓN',
      '',
      'Alumno: María Fernanda Ramírez Cruz',
      'Matrícula: 240540',
      '',
      'Este comprobante fue rechazado en los datos de prueba porque',
      'no corresponde al motivo solicitado.',
    ],
  },
];

for (const document of demoDocuments) {
  fs.writeFileSync(path.join(documents, document.name), buildPdf(document.title, document.lines));
}

const demoSignatures = [
  ['demo-firma-padre-001.svg', 'María Carrasco Vázquez', 'Madre del alumno', '2026-10-27', 'JUS-20261026-0001'],
  ['demo-firma-tutor-001.svg', 'MTI. Ricardo Luna Santos', 'Tutor educativo', '2026-10-27', 'JUS-20261026-0001'],
  ['demo-firma-director-001.svg', 'Mtra. Altagracia Carrillo Parra', 'Dirección de carrera', '2026-10-27', 'JUS-20261026-0001'],
  ['demo-firma-tutor-002.svg', 'MTI. Ricardo Luna Santos', 'Tutor educativo', '2026-10-28', 'JUS-20261028-0001'],
  ['demo-firma-tutor-005.svg', 'MTI. Ricardo Luna Santos', 'Tutor educativo', '2026-10-16', 'JUS-20261015-0001'],
  ['demo-firma-director-005.svg', 'Mtra. Altagracia Carrillo Parra', 'Dirección de carrera', '2026-10-16', 'JUS-20261015-0001'],
];
for (const [name, signer, role, date, folio] of demoSignatures) {
  fs.writeFileSync(path.join(signatures, name), buildSignatureSvg({ name: signer, role, date, folio }));
}

const demoTimestamps = [
  ['demo-sello-001.svg', 'JUS-20261026-0001', '2026-10-27', 'Mtra. Altagracia Carrillo Parra'],
  ['demo-sello-005.svg', 'JUS-20261015-0001', '2026-10-16', 'Mtra. Altagracia Carrillo Parra'],
];
for (const [name, folio, date, director] of demoTimestamps) {
  fs.writeFileSync(path.join(stamps, name), buildStampSvg({ institution: 'UTXJ', folio, date, director }));
}

const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120" role="img" aria-label="Universidad Tecnológica de Xicotepec de Juárez">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b5d3b"/>
      <stop offset="1" stop-color="#073d27"/>
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="18" fill="url(#g)"/>
  <path d="M26 78 L60 34 L94 78 Z" fill="none" stroke="#c9a227" stroke-width="5" stroke-linejoin="round"/>
  <path d="M39 78 L60 51 L81 78" fill="none" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="60" cy="88" r="6" fill="#c9a227"/>
  <text x="138" y="47" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-weight="700" fill="#0b3d28">UTXJ</text>
  <text x="138" y="70" font-family="Arial, Helvetica, sans-serif" font-size="10.5" fill="#4c5f55">UNIVERSIDAD TECNOLÓGICA DE</text>
  <text x="138" y="86" font-family="Arial, Helvetica, sans-serif" font-size="10.5" fill="#4c5f55">XICOTEPEC DE JUÁREZ</text>
  <text x="138" y="104" font-family="Arial, Helvetica, sans-serif" font-size="8.5" letter-spacing="1.6" fill="#c9a227">CONTROL ESCOLAR</text>
</svg>`;
fs.writeFileSync(path.join(assets, 'logo-utxj.svg'), logo);

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0b5d3b"/>
  <path d="M14 44 L32 18 L50 44 Z" fill="none" stroke="#c9a227" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M22 44 L32 30 L42 44" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
</svg>`;
fs.writeFileSync(path.join(assets, 'favicon.svg'), favicon);

console.log('Archivos de demostración generados en backend/uploads y frontend/src/assets/img');
