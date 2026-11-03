'use strict';

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const toISODate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
};

const parseISODate = (value) => {
  const iso = toISODate(value);
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

const todayISO = () => toISODate(new Date());

const addDays = (value, days) => {
  const date = parseISODate(value);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return toISODate(date);
};

const isWeekend = (value) => {
  const date = parseISODate(value);
  return !date || date.getDay() === 0 || date.getDay() === 6;
};

const eachDate = (start, end, options = {}) => {
  const dates = [];
  let cursor = parseISODate(start);
  const last = parseISODate(end);
  if (!cursor || !last || last < cursor) return dates;
  while (cursor <= last) {
    const iso = toISODate(cursor);
    if (!options.skipWeekends || !isWeekend(iso)) dates.push(iso);
    cursor = parseISODate(addDays(iso, 1));
  }
  return dates;
};

const formatSpanishDate = (value, options = {}) => {
  const date = parseISODate(value);
  if (!date) return '—';
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  if (options.weekday) return `${DAY_NAMES[date.getDay()]} ${day} de ${month} de ${year}`;
  return `${day} de ${month} de ${year}`;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const iso = String(value).replace(' ', 'T');
  const date = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const daysBetween = (start, end) => {
  const first = parseISODate(start);
  const last = parseISODate(end);
  if (!first || !last) return 0;
  return Math.round((last - first) / (24 * 60 * 60 * 1000));
};

module.exports = {
  toISODate,
  parseISODate,
  todayISO,
  addDays,
  isWeekend,
  eachDate,
  formatSpanishDate,
  formatDateTime,
  daysBetween,
};
