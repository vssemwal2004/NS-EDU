// One-off, repeatable repair for AIHER's programme catalogue.
//
// AIHER is a Vite SPA: /programs renders only stream cards in its HTML while the actual programme
// rows live in the site's own versioned JavaScript chunks. The ordinary crawler deliberately does
// not interpret arbitrary application source, so this narrowly scoped repair reads those official
// chunks, keeps only objects that have programme metadata, and stores their source page per row.

import { closeDb, COLLECTIONS, getDb } from '../db/collections.js';

const BASE = 'https://aiher.edu.in';
const TARGET_SLUG = 'datta-meghe-institute-of-higher-education-research-deemed-to-be-university';
const FETCH_TIMEOUT_MS = 45_000;

async function textAt(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

function sourcePageFor(asset) {
  const routes = [
    [/dental/i, '/programs/dental-streams'],
    [/rnpc|physio/i, '/programs/physiotherapy-streams'],
    [/dmcp|pharmacy/i, '/programs/pharmacy-streams'],
    [/sahs-n/i, '/programs/ahs-n-streams'],
    [/sahs/i, '/programs/ahs-streams'],
    [/feat/i, '/programs/feat-streams'],
    [/commerce/i, '/programs/commerce-management-streams'],
    [/science/i, '/programs/science-technology-streams'],
    [/mgac|ayurveda/i, '/programs/ayurveda-streams'],
    [/jnmc|dmmc|medicine/i, '/programs/medicine-streams'],
    [/smcon|srmmcon|nursing/i, '/programs/nursing-streams'],
    [/smhh|homeopathy/i, '/programs/homeopathy-streams'],
    [/social|arts/i, '/programs/social-streams'],
    [/cdoe|online/i, '/programs/online-streams'],
  ];
  return new URL(routes.find(([pattern]) => pattern.test(asset))?.[1] ?? '/programs', BASE).href;
}

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const keyOf = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function levelOf(category, name) {
  const value = clean(category).toLowerCase();
  if (value === 'ug' || value.startsWith('ug-')) return 'UG';
  if (value === 'pg' || value.startsWith('pg-')) return 'PG';
  if (value === 'phd' || /^(?:ph\.?\s*d|doctor of philosophy)\b/i.test(name)) return 'PhD';
  if (value === 'diploma' || /^(?:p\.?b\.?\s+)?diploma\b/i.test(name)) return 'Diploma';
  return undefined;
}

function durationYearsOf(raw) {
  const value = clean(raw);
  if (!value || /\b\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?\s*years?\b/i.test(value)) return undefined;
  const years = [...value.matchAll(/(\d+(?:\.\d+)?)\s*years?\b/gi)].map((match) => Number(match[1]));
  const months = [...value.matchAll(/(\d+(?:\.\d+)?)\s*months?\b/gi)].map((match) => Number(match[1]));
  if (!years.length && !months.length) return undefined;
  const total = years.reduce((sum, number) => sum + number, 0) + months.reduce((sum, number) => sum + number / 12, 0);
  if (total < 0.5 || total > 10) return undefined;
  return Math.round(total * 100) / 100;
}

function feeNoteOf(raw) {
  const value = clean(raw);
  if (!/^\d[\d,]*(?:\.\d+)?$/.test(value)) return undefined;
  return `Official programme page lists tuition fee ₹${value}; period basis is not specified.`;
}

function rowFrom(nameValue, segment, sourcePage) {
  const name = clean(nameValue).replace(/\$\{[^}]+\}/g, '').trim();
  if (!name || name.length > 160 || /^(?:admission enquiry|programmes?)$/i.test(name)) return null;
  const category = segment.match(/category:`([^`]*)`/)?.[1];
  const duration = segment.match(/duration:`([^`]*)`/)?.[1];
  const fee = segment.match(/tuitionFees:`([^`]*)`/)?.[1];
  // This condition excludes headings, popup titles and other strings from the same application
  // chunks; real programme objects carry at least one of these metadata keys.
  if (!category && !duration && !fee) return null;
  const level = levelOf(category, name);
  const durationYears = durationYearsOf(duration);
  const feeNote = feeNoteOf(fee);
  return {
    name,
    ...(level ? { level } : {}),
    ...(durationYears ? { durationYears } : {}),
    ...(feeNote ? { feeNote } : {}),
    sourcePage,
  };
}

function rowsFromChunk(source, sourcePage) {
  const rows = [];
  const literalTitles = [...source.matchAll(/title:`([^`]+)`/g)];
  for (let index = 0; index < literalTitles.length; index += 1) {
    const match = literalTitles[index];
    if (match[1].includes('${')) continue;
    const end = literalTitles[index + 1]?.index ?? match.index + 3500;
    const row = rowFrom(match[1], source.slice(match.index, end), sourcePage);
    if (row) rows.push(row);
  }

  // Several stream pages build PhD/fellowship/certificate rows from a literal list. Expand only
  // this tightly recognisable compiled form; no downloaded code is evaluated.
  const mapped = /\.\.\.\[((?:`[^`]*`,?)+)\]\.map\(\(e,t\)=>\(\{([\s\S]*?)\}\)\)/g;
  for (const match of source.matchAll(mapped)) {
    const items = [...match[1].matchAll(/`([^`]*)`/g)].map((item) => item[1]);
    const template = match[2].match(/title:`([^`]*)`/)?.[1];
    const direct = /title:e(?:[,}])/.test(match[2]);
    for (const item of items) {
      const name = template ? template.replaceAll('${e}', item) : direct ? item : '';
      const row = rowFrom(name, match[2], sourcePage);
      if (row) rows.push(row);
    }
  }
  return rows;
}

function mergeRows(rows) {
  const merged = new Map();
  for (const row of rows) {
    const key = keyOf(row.name);
    if (!key) continue;
    const current = merged.get(key);
    if (!current) { merged.set(key, row); continue; }
    for (const field of ['level', 'durationYears', 'feeNote']) {
      if (current[field] === undefined && row[field] !== undefined) current[field] = row[field];
    }
  }
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const programHtml = await textAt(`${BASE}/programs`);
  const mainPath = programHtml.match(/<script\b[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/i)?.[1];
  if (!mainPath) throw new Error('Could not locate AIHER main application bundle.');
  const mainSource = await textAt(new URL(mainPath, BASE));
  const assets = [...new Set([...mainSource.matchAll(/assets\/[A-Za-z0-9_.()&-]*(?:program|course)[A-Za-z0-9_.()&-]*\.js/gi)]
    .map((match) => match[0]))];
  if (assets.length < 10) throw new Error(`Only ${assets.length} programme assets were discovered; refusing a partial repair.`);

  const batches = await Promise.all(assets.map(async (asset) => {
    const source = await textAt(new URL(asset, BASE));
    return rowsFromChunk(source, sourcePageFor(asset));
  }));
  const programmes = mergeRows(batches.flat());
  if (programmes.length < 250 || programmes.length > 500) {
    throw new Error(`Parsed ${programmes.length} programme rows; expected a safe 250-500 range.`);
  }

  const database = await getDb();
  const institution = await database.collection(COLLECTIONS.institutions).findOne({ slug: TARGET_SLUG });
  if (!institution?.website || new URL(institution.website).hostname !== 'aiher.edu.in') {
    throw new Error('AIHER target record or its verified official website mapping is missing.');
  }
  const now = new Date();
  const result = await database.collection(COLLECTIONS.institutions).updateOne(
    { _id: institution._id },
    { $set: { programmesOffered: programmes, coursesOffered: programmes.map((row) => row.name), updatedAt: now } },
  );
  console.log(JSON.stringify({ slug: TARGET_SLUG, assets: assets.length, programmes: programmes.length, modified: result.modifiedCount, updatedAt: now }, null, 2));
}

main().finally(closeDb);
