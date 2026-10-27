// RFC 4180 CSV with quoted cells, embedded newlines, a UTF-8 BOM and comma, semicolon or tab delimiters.
export function parseCsv(text, { maxRows = Infinity } = {}) {
  const input = String(text ?? '').replace(/^﻿/, '');
  const delimiter = detectDelimiter(input);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.trim() === '') { quoted = true; cell = ''; }
    else if (char === delimiter) { row.push(cell.trim()); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      if (rows.length > maxRows) throw new Error(`Use at most ${maxRows - 1} rows per file.`);
      row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted value.');
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length > maxRows) throw new Error(`Use at most ${maxRows - 1} rows per file.`);
  return rows;
}

function detectDelimiter(input) {
  const header = input.slice(0, input.search(/\r|\n/) === -1 ? input.length : input.search(/\r|\n/)).replace(/"[^"]*"/g, '');
  const counts = [',', ';', '\t'].map((char) => [char, header.split(char).length - 1]);
  return counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts[0][0] : ',';
}

// Header row → objects. `mapHeader` turns a raw header into a field name, or '' to drop the column.
export function rowsToObjects(rows, mapHeader) {
  const [header = [], ...body] = rows;
  const keys = header.map((name) => mapHeader(name));
  return body.map((cells) => Object.fromEntries(keys.map((key, index) => [key, cells[index] ?? '']).filter(([key, value]) => key && value !== '')));
}

// Spreadsheet formula injection guard; phone numbers such as "+91 ..." stay untouched.
export const risky = (text) => /^[=@\t\r]/.test(text) || /^[+-](?![\d\s()-]*$)/.test(text);
const isStructured = (value) => value !== null && typeof value === 'object' && !(value instanceof Date);
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  // Structured fields (gallery, programme rows, placements) export as JSON, which re-imports as-is.
  let text = isStructured(value) && (!Array.isArray(value) || value.some(isStructured)) ? JSON.stringify(value)
    : Array.isArray(value) ? value.join('; ') : value instanceof Date ? value.toISOString() : String(value);
  if (risky(text)) text = `'${text}`;
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvRow = (values) => `${values.map(csvCell).join(',')}\r\n`;
export const unguardCell = (text) => (typeof text === 'string' && /^'[=@+\-\t\r]/.test(text) ? text.slice(1) : text);
