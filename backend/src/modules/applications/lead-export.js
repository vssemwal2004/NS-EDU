import { once } from 'node:events';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { HttpError } from '../../lib/http-error.js';
import { risky } from '../../scraper/csv.js';

export const EXPORT_FORMATS = {
  csv: { type: 'text/csv; charset=utf-8', maxRows: Infinity, label: 'CSV' },
  xlsx: { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', maxRows: 200_000, label: 'Excel' },
  pdf: { type: 'application/pdf', maxRows: 5_000, maxColumns: 12, label: 'PDF' },
};

// A few exports at a time per API process; each one holds a cursor and a response stream open.
const MAX_CONCURRENT = 3;
let running = 0;
export async function withExportSlot(work) {
  if (running >= MAX_CONCURRENT) throw new HttpError(429, 'Other exports are running. Please try again in a minute.', { retryAfterSeconds: 30 });
  running += 1;
  try { return await work(); } finally { running -= 1; }
}

const text = (value) => (value === null || value === undefined ? '' : String(value));
// Always quoted, single line, and formula-looking text is prefixed with ' (phone numbers like +91… stay as they are).
export const csvCell = (value) => {
  const cell = text(value).replace(/\r?\n|\r/g, ' ');
  return `"${(risky(cell) ? `'${cell}` : cell).replaceAll('"', '""')}"`;
};

async function write(response, chunk) {
  if (!response.write(chunk)) await Promise.race([once(response, 'drain'), once(response, 'close')]);
}

export async function writeCsv(response, columns, rows, ctx) {
  await write(response, `﻿${columns.map((column) => csvCell(column.label)).join(',')}\r\n`);
  for await (const doc of rows) {
    if (response.destroyed) return;
    await write(response, `${columns.map((column) => csvCell(column.read(doc, ctx))).join(',')}\r\n`);
  }
  response.end();
}

// Cells are written as plain strings/numbers only, never formula or hyperlink objects.
export async function writeXlsx(response, columns, rows, ctx) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: response, useStyles: true, useSharedStrings: false });
  const sheet = workbook.addWorksheet('Leads', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map((column) => ({ header: column.label, key: column.key, width: Math.max(12, Math.min(40, column.label.length + 4)) }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).commit();
  for await (const doc of rows) {
    if (response.destroyed) return;
    sheet.addRow(columns.map((column) => {
      const value = column.read(doc, ctx);
      return typeof value === 'number' ? value : text(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    })).commit();
  }
  sheet.commit();
  await workbook.commit();
}

// The built-in PDF fonts cover Latin-1 only; other scripts are replaced so the file never breaks.
const latin = (value) => text(value).replace(/[^\u0009\u000A\u000D -ÿ₹–—‘’“”•…]/g, '?');

export async function writePdf(response, columns, rows, ctx, { title, subtitle }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28, bufferPages: false, info: { Title: title } });
  doc.pipe(response);
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottom = doc.page.height - doc.page.margins.bottom - 14;
  const weights = columns.map((column) => column.pdfWidth ?? 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const widths = weights.map((weight) => (weight / total) * width);
  const padding = 3;
  let page = 1;

  // The footer sits below the text area; its own `height` stops pdfkit from starting a blank page for it.
  const footer = () => doc.font('Helvetica').fontSize(7).fillColor('#777').text(`Gyaan Vidhya · ${subtitle} · page ${page}`, left, doc.page.height - doc.page.margins.bottom - 10, { width, height: 12, align: 'right', lineBreak: false });
  // Draws one row of cells at the current y and moves below it.
  const row = (cells, { font, color, fill }) => {
    doc.font(font).fontSize(7);
    const height = Math.max(...cells.map((cell, index) => doc.heightOfString(cell || ' ', { width: widths[index] - padding * 2 }))) + padding * 2;
    if (doc.y + height > bottom) return null;
    const top = doc.y;
    if (fill) doc.rect(left, top, width, height).fill(fill);
    let x = left;
    cells.forEach((cell, index) => {
      doc.fillColor(color).font(font).fontSize(7).text(cell, x + padding, top + padding, { width: widths[index] - padding * 2 });
      x += widths[index];
    });
    doc.y = top + height;
    return height;
  };
  const header = () => row(columns.map((column) => latin(column.label)), { font: 'Helvetica-Bold', color: '#FFFFFF', fill: '#7A1F2B' });

  doc.font('Helvetica-Bold').fontSize(14).fillColor('#1F1A1B').text(latin(title), left, doc.page.margins.top);
  doc.font('Helvetica').fontSize(8).fillColor('#555').text(latin(subtitle)).moveDown(0.6);
  header();
  let shade = false;
  for await (const lead of rows) {
    if (response.destroyed) return;
    // Very long cells are clipped so one row always fits on a page.
    const cells = columns.map((column) => latin(column.read(lead, ctx)).slice(0, 300));
    const style = () => ({ font: 'Helvetica', color: '#1F1A1B', fill: shade ? '#F7F2F1' : null });
    if (row(cells, style()) === null) {
      footer();
      doc.addPage();
      page += 1;
      doc.y = doc.page.margins.top;
      header();
      row(cells, style());
    }
    shade = !shade;
  }
  footer();
  doc.end();
  await once(response, 'finish').catch(() => {});
}
