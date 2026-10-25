// Imports the AISHE-derived institution directory spreadsheet into `institutions`.
// Usage: npm run import:directory --workspace backend -- "<path to .xlsx>" [--limit N] [--replace] [--dry-run]
//   --replace  delete every existing institution and its programmes first (asks for --yes in a TTY)
// The sheet carries historical snapshots, not certified current approvals, so every record is stored
// unverified with its sources, and accreditation values keep the snapshot wording from the file.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDb, COLLECTIONS, getDb } from '../db/collections.js';
import { classify } from '../modules/universities/directory-taxonomy.js';
import { upsertUniversities } from '../modules/universities/university-service.js';

const args = process.argv.slice(2);
const file = args.find((value) => !value.startsWith('--'));
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => { const index = args.indexOf(`--${name}`); return index === -1 ? fallback : args[index + 1]; };
const limit = Number(option('limit', Infinity));

if (!file) throw new Error('Pass the spreadsheet path: npm run import:directory --workspace backend -- "C:\\path\\file.xlsx"');

// --- minimal xlsx reader (the workbook uses x:-prefixed tags and inline strings) -------------
const unescapeXml = (text) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&amp;/g, '&');
const columnIndex = (ref) => [...ref.replace(/\d+/g, '')].reduce((total, letter) => total * 26 + (letter.charCodeAt(0) - 64), 0) - 1;

function readRows(xlsxPath) {
  const dir = mkdtempSync(join(tmpdir(), 'gv-xlsx-'));
  try {
    // PowerShell's Expand-Archive avoids adding a zip dependency for a one-off import.
    execFileSync('powershell', ['-NoProfile', '-Command', `Copy-Item -LiteralPath '${xlsxPath.replace(/'/g, "''")}' '${dir}\\b.zip'; Expand-Archive -LiteralPath '${dir}\\b.zip' -DestinationPath '${dir}\\x' -Force`], { stdio: 'pipe' });
    const xml = readFileSync(join(dir, 'x', 'xl', 'worksheets', 'sheet1.xml'), 'utf8');
    const rows = [];
    for (const row of xml.matchAll(/<(?:x:)?row[^>]*>([\s\S]*?)<\/(?:x:)?row>/g)) {
      const cells = [];
      for (const cell of row[1].matchAll(/<(?:x:)?c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/(?:x:)?c>/g)) {
        const [, ref, attrs, body] = cell;
        const inline = /t="inlineStr"/.test(attrs);
        const raw = inline
          ? [...body.matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map((part) => part[1]).join('')
          : /<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/.exec(body)?.[1] ?? '';
        cells[columnIndex(ref)] = unescapeXml(raw).trim();
      }
      rows.push([...cells].map((value) => value ?? ''));
    }
    return rows;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- mapping ---------------------------------------------------------------------------------
// A few rows carry an email address in the website column; keep it as the institutional contact.
const EMAIL = /^[^\s@]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const emailOf = (value) => { const text = String(value).trim().replace(/^www\./i, ''); return EMAIL.test(text) ? text.toLowerCase() : ''; };

const websiteOf = (value) => {
  const text = String(value).trim();
  if (!text || /^(na|n\/a|nil|-)$/i.test(text) || text.includes('@')) return '';
  const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const { hostname } = new URL(url);
    // A plain hostname only: anything odder (spaces, commas, multiple URLs in one cell) is dropped
    // rather than failing the whole row — the institution still imports without a website.
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(hostname) ? url : '';
  } catch { return ''; }
};
const yearOf = (value) => { const year = Number.parseInt(value, 10); return Number.isInteger(year) && year >= 1800 && year <= new Date().getFullYear() ? year : null; };
// "Pharmacy: 52; Engineering: 101-150" → the best (lowest) numeric rank in the row, WITH the list
// it belongs to. NIRF publishes per-subject tables, so the category is part of the fact.
export const nirfOf = (value) => {
  const ranks = [...String(value).matchAll(/([^;:]+):\s*(\d+)/g)]
    .map((match) => ({ category: match[1].trim().slice(0, 60), rank: Number(match[2]) }))
    .filter((entry) => entry.rank > 0 && entry.rank <= 1000);
  return ranks.length ? ranks.reduce((best, entry) => (entry.rank < best.rank ? entry : best)) : null;
};
const NAAC_GRADES = new Set(['A++', 'A+', 'A', 'B++', 'B+', 'B', 'C', 'D']);
const titleCase = (text) => String(text).toLowerCase().replace(/\b([a-z])/g, (match) => match.toUpperCase())
  .replace(/\b(Of|And|For|In|At|The|To)\b/g, (match) => match.toLowerCase()).replace(/^(.)/, (match) => match.toUpperCase());
// Directory names are shouty and carry the AISHE code; keep them readable without inventing anything.
// The separator is sometimes spaced ("150028 - Tapi Valley …") and sometimes not.
const cleanName = (raw) => titleCase(String(raw).replace(/^\s*\d{3,}\s*[-–—]\s*/, '').replace(/\s+/g, ' ').trim()).slice(0, 200);
// Empty cells arrive as the literal string NULL ("College Road, NULL, Kottayam").
const commaList = (raw) => String(raw).split(',').map((part) => part.trim()).filter((part) => part && !/^null$/i.test(part)).join(', ');
// A website in the "Affiliating university" column is not an affiliation; the scrape-time cleanup
// in src/scripts/curate-institutions.js resolves these to a name where it can.
const LOOKS_LIKE_URL = /^(https?:\/\/|www\.)|^[a-z0-9-]+(\.[a-z0-9-]+)+\/?$/i;
const affiliationOf = (raw) => { const text = String(raw).trim(); return LOOKS_LIKE_URL.test(text) ? '' : text.slice(0, 200); };

function toRecord(row, headerIndex) {
  const get = (label) => String(row[headerIndex[label]] ?? '').trim();
  const name = cleanName(get('Institution name'));
  if (!name) return null;
  const state = get('State / UT');
  const district = get('District');
  const naacGrade = get('NAAC grade (Aug 2025 snapshot)').toUpperCase();
  const aisheCode = get('AISHE code');
  const sources = [get('Directory source'), get('NAAC source'), get('AICTE source'), get('NIRF source')].filter(Boolean);
  const nirf = nirfOf(get('NIRF 2025 category ranks'));
  // A university-level or standalone institution has no affiliating university, and in this source
  // its own address was filed in that column instead (1,390 rows, JNU and AIIMS among them). The
  // cell is only read as a website when the row cannot have an affiliation and has no website of
  // its own — for a college the same cell would be its parent university's site, not the college's.
  const ownRow = /^(university-level|standalone)/i.test(get('Institution category'));
  const strayWebsite = ownRow ? websiteOf(get('Affiliating university')) : '';
  return {
    name,
    shortName: '',
    city: district || state,
    district,
    state: state || null,
    ...classify(get('Institution type'), get('Management / ownership')),
    establishedYear: yearOf(get('Established year')),
    website: websiteOf(get('Website (source-reported)')) || strayWebsite,
    email: emailOf(get('Website (source-reported)')),
    address: commaList(get('Address (source-reported)')).slice(0, 400),
    affiliatedTo: affiliationOf(get('Affiliating university')),
    naacGrade: NAAC_GRADES.has(naacGrade) ? naacGrade : '',
    nirfRank: nirf?.rank ?? null,
    nirfYear: nirf ? 2025 : null,
    nirfCategory: nirf?.category ?? '',
    aliases: aisheCode ? [aisheCode] : [],
    sourceUrl: sources[0] || '',
    // Everything below is a historical snapshot from the file, never a current approval claim.
    directory: {
      aisheCode,
      managementLabel: get('Management / ownership'),
      institutionType: get('Institution type'),
      area: get('Rural / urban'),
      affiliatingAishe: get('Affiliating university AISHE'),
      selectionBasis: get('Selection basis'),
      nirfCategories: get('NIRF 2025 categories'),
      nirfRanks: get('NIRF 2025 category ranks'),
      naacCgpa: get('NAAC CGPA (Aug 2025)'),
      naacDeclaredOn: get('NAAC declaration date').slice(0, 10),
      naacCycle: get('NAAC cycle'),
      naacNote: get('NAAC verification status'),
      aicteId: get('AICTE ID (source snapshot)'),
      aicteNote: get('AICTE verification status'),
      ugcNote: get('UGC verification status'),
      nbaNote: get('NBA verification status'),
      compiledOn: get('Compiled on').slice(0, 10),
      sources,
    },
  };
}

// --- run -------------------------------------------------------------------------------------
try {
  console.log(`Reading ${file} …`);
  const rows = readRows(file);
  const headerRowIndex = rows.findIndex((row) => row.includes('Institution name'));
  if (headerRowIndex === -1) throw new Error('Could not find the "Institution name" header row in sheet 1.');
  const headerIndex = Object.fromEntries(rows[headerRowIndex].map((label, index) => [label, index]));
  const records = rows.slice(headerRowIndex + 1).map((row) => toRecord(row, headerIndex)).filter(Boolean).slice(0, limit);
  console.log(`Parsed ${records.length} institutions (header row ${headerRowIndex + 1}).`);
  console.log('Example:', JSON.stringify({ ...records[0], directory: undefined }, null, 1));

  if (flag('dry-run')) { console.log('Dry run: nothing written.'); process.exit(0); }

  const db = await getDb();
  if (flag('replace')) {
    const removedProgrammes = (await db.collection(COLLECTIONS.programmes).deleteMany({})).deletedCount;
    const removed = (await db.collection(COLLECTIONS.institutions).deleteMany({})).deletedCount;
    console.log(`Replaced: removed ${removed} institutions and ${removedProgrammes} programmes.`);
  }

  const started = Date.now();
  const summary = await upsertUniversities(records, {
    source: { kind: 'import', name: 'AISHE-derived directory spreadsheet', url: records[0]?.sourceUrl || '' },
    publish: true,
  });
  console.log(`Imported in ${Math.round((Date.now() - started) / 1000)}s: inserted ${summary.inserted}, updated ${summary.updated}, unchanged ${summary.unchanged}, failed ${summary.failed}`);
  if (summary.errors.length) console.log('First errors:', JSON.stringify(summary.errors.slice(0, 5), null, 1));
  console.log(`institutions in database: ${await db.collection(COLLECTIONS.institutions).countDocuments({})}`);
} catch (error) {
  console.error('Import failed:', error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
