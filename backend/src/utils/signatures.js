'use strict';

const { formatSpanishDate } = require('./dates');

const escapeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

/**
 * Firma digital estilizada generada por el sistema. No representa una firma
 * autógrafa real: es la constancia gráfica de la firma electrónica registrada.
 */
const buildSignatureSvg = ({ name, role, date, folio }) => {
  const displayName = escapeXml(name);
  const displayRole = escapeXml(role);
  const displayDate = escapeXml(formatSpanishDate(date));
  const displayFolio = escapeXml(folio || '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="150" viewBox="0 0 420 150" role="img" aria-label="Firma electrónica de ${displayName}">
  <rect width="420" height="150" fill="#ffffff"/>
  <path d="M28 86 C 62 44, 84 108, 116 72 S 168 38, 190 78 S 238 108, 268 66 S 318 52, 344 84"
        fill="none" stroke="#123c2b" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M52 96 C 110 108, 214 108, 300 92" fill="none" stroke="#123c2b" stroke-width="1.6" opacity="0.55"/>
  <line x1="24" y1="112" x2="396" y2="112" stroke="#123c2b" stroke-width="1.2"/>
  <text x="210" y="132" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="14" font-weight="700" fill="#123c2b">${displayName}</text>
  <text x="210" y="145" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="9.5" fill="#5b6b62">${displayRole} · ${displayDate}</text>
  <text x="396" y="22" text-anchor="end" font-family="Arial, Helvetica, sans-serif"
        font-size="8" fill="#8a9a91">${displayFolio}</text>
</svg>`;
};

/**
 * Sello institucional digital con el folio y la leyenda de autorización.
 */
const buildStampSvg = ({ institution = 'UTXJ', folio, date, director }) => {
  const displayInstitution = escapeXml(institution);
  const displayFolio = escapeXml(folio || '');
  const displayDate = escapeXml(formatSpanishDate(date));
  const displayDirector = escapeXml(director || 'Dirección Académica');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260" role="img" aria-label="Sello institucional ${displayInstitution}">
  <defs>
    <path id="stampTop" d="M 130,130 m -96,0 a 96,96 0 1,1 192,0" fill="none"/>
    <path id="stampBottom" d="M 130,130 m -88,0 a 88,88 0 1,0 176,0" fill="none"/>
  </defs>
  <circle cx="130" cy="130" r="122" fill="none" stroke="#0b5d3b" stroke-width="5"/>
  <circle cx="130" cy="130" r="112" fill="none" stroke="#0b5d3b" stroke-width="1.6"/>
  <circle cx="130" cy="130" r="70" fill="none" stroke="#0b5d3b" stroke-width="1.4"/>
  <text font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="#0b5d3b" letter-spacing="2.4">
    <textPath href="#stampTop" startOffset="50%" text-anchor="middle">${displayInstitution}</textPath>
  </text>
  <text font-family="Arial, Helvetica, sans-serif" font-size="9.5" fill="#0b5d3b" letter-spacing="1.6">
    <textPath href="#stampBottom" startOffset="50%" text-anchor="middle">DIRECCIÓN ACADÉMICA · AUTORIZADO</textPath>
  </text>
  <text x="130" y="116" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="20" font-weight="700" fill="#0b5d3b">UTXJ</text>
  <text x="130" y="136" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="8.5" fill="#0b5d3b">JUSTIFICANTE ACADÉMICO</text>
  <line x1="80" y1="146" x2="180" y2="146" stroke="#0b5d3b" stroke-width="1"/>
  <text x="130" y="162" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="8" fill="#0b5d3b">${displayFolio}</text>
  <text x="130" y="176" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="7.5" fill="#0b5d3b">${displayDate}</text>
  <text x="130" y="196" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="7" fill="#0b5d3b">${displayDirector}</text>
</svg>`;
};

module.exports = { buildSignatureSvg, buildStampSvg, escapeXml };
