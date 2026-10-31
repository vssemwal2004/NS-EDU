// Writes hand-researched fee / placement / programme data (JSON files) into `institutions`.
// Usage: npm run research:apply -- <file.json> [more.json] [--dry-run] [--fix-websites]   (calls node directly if npm eats flags)
// Each file is an array of { slug, officialWebsite?, campusGalleryUrl?, programmes[], placements?, placementHistory[], notFound[] }.
// Rules enforced here, because the researcher is a person or an agent, not the crawler:
//   - every figure needs an https `sourcePage` that is not an aggregator;
//   - a fee period is stored as given (annual/semester/total), never converted;
//   - rows merge into the stored programme list by name, so the crawler's rows are kept.
import { readFile } from 'node:fs/promises';
import { COLLECTIONS, closeDb, getDb } from '../db/collections.js';
import { upsertUniversities } from '../modules/universities/university-service.js';

const AGGREGATORS = /(^|\.)(shiksha|collegedunia|careers360|getmyuni|collegedekho|wikipedia|justdial|indiatoday|jagranjosh|testbook|leverageedu|collegesearch)\./i;
const PERIODS = ['annualFeeInr', 'semesterFeeInr', 'totalFeeInr'];
const files = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');
const fixWebsites = process.argv.includes('--fix-websites');
const hostOf = (url) => { try { return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

const normal = (name) => String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const goodSource = (url) => {
  try { const { protocol, hostname } = new URL(url); return protocol === 'https:' && !AGGREGATORS.test(`${hostname}.`); } catch { return false; }
};
const money = (value, max) => (Number.isInteger(value) && value > 0 && value <= max ? value : null);

function cleanProgramme(row, problems) {
  const out = { name: String(row.name ?? '').trim().slice(0, 160) };
  if (!out.name) return null;
  const level = { ug: 'UG', pg: 'PG', diploma: 'Diploma', phd: 'PhD', doctoral: 'PhD' }[String(row.level ?? '').toLowerCase().replace(/[^a-z]/g, '')];
  if (level) out.level = level;
  if (Number(row.durationYears) >= 0.5 && Number(row.durationYears) <= 10) out.durationYears = Number(row.durationYears);
  const fees = Object.fromEntries(PERIODS.map((key) => [key, money(row[key], key === 'totalFeeInr' ? 50_000_000 : 10_000_000)]).filter(([, value]) => value));
  if (Object.keys(fees).length) {
    if (!goodSource(row.sourcePage)) { problems.push(`${out.name}: fee without an acceptable https sourcePage (${row.sourcePage ?? 'none'})`); return out; }
    Object.assign(out, fees, { sourcePage: row.sourcePage });
    if (row.feeYear) out.feeYear = String(row.feeYear).slice(0, 20);
    if (row.feeNote) out.feeNote = String(row.feeNote).slice(0, 160);
  } else if (goodSource(row.sourcePage)) out.sourcePage = row.sourcePage;
  return out;
}

const cleanSeason = (row) => {
  const year = Number(row.year);
  if (!Number.isInteger(year) || year < 2000 || !goodSource(row.sourcePage)) return null;
  const out = { year, sourcePage: row.sourcePage };
  if (row.session) out.session = String(row.session).slice(0, 20);
  for (const key of ['averagePackageLpa', 'highestPackageLpa', 'medianPackageLpa', 'placedPercent']) if (Number(row[key]) > 0 && Number(row[key]) <= (key === 'placedPercent' ? 100 : 1000)) out[key] = Number(row[key]);
  for (const key of ['studentsPlaced', 'offers', 'companies']) if (Number.isInteger(row[key]) && row[key] > 0) out[key] = row[key];
  return Object.keys(out).length > 3 || out.session ? out : null;
};

if (!files.length) { console.log('Usage: apply-research <file.json> [...] [--dry-run]'); process.exit(1); }
const database = await getDb();
const collection = database.collection(COLLECTIONS.institutions);
const report = { institutions: 0, feeRows: 0, newRows: 0, seasons: 0, rejected: [], missing: [], gallery: [], websites: [] };

for (const file of files) {
  for (const item of JSON.parse(await readFile(file, 'utf8'))) {
    const existing = await collection.findOne({ slug: item.slug });
    if (!existing) { report.missing.push(item.slug); continue; }
    const problems = [];
    const rows = [...(existing.programmesOffered ?? [])];
    const byName = new Map(rows.map((row, index) => [normal(row.name), index]));
    let feeRows = 0;
    for (const raw of item.programmes ?? []) {
      const row = cleanProgramme(raw, problems);
      if (!row) continue;
      const at = byName.get(normal(row.name));
      const hasFee = PERIODS.some((key) => row[key]);
      if (at === undefined) { if (rows.length < 500) { byName.set(normal(row.name), rows.length); rows.push(row); report.newRows += 1; feeRows += hasFee ? 1 : 0; } continue; }
      if (hasFee) { rows[at] = { ...rows[at], ...Object.fromEntries(PERIODS.map((key) => [key, null])), ...row }; feeRows += 1; }
      else rows[at] = { ...row, ...rows[at] };
    }
    const placementSource = item.placements && goodSource(item.placements.sourcePage);
    const placements = placementSource ? { ...item.placements, recruiters: (item.placements.recruiters ?? []).slice(0, 20) } : null;
    const seasons = (item.placementHistory ?? []).map(cleanSeason).filter(Boolean);
    if (item.placements && !placementSource) problems.push('placements without an acceptable https sourcePage');
    report.institutions += 1; report.feeRows += feeRows; report.seasons += seasons.length;
    report.rejected.push(...problems.map((text) => `${item.slug}: ${text}`));
    if (item.campusGalleryUrl && goodSource(item.campusGalleryUrl)) report.gallery.push({ slug: item.slug, url: item.campusGalleryUrl, hasGallery: (existing.gallery?.length ?? 0) > 0 });
    // Opt-in: the directory's website is sometimes dead or taken over by a spam site; the researcher checked the real one.
    let website = null;
    if (fixWebsites && item.officialWebsite && goodSource(item.officialWebsite) && hostOf(item.officialWebsite) !== hostOf(existing.website)
      && !hostOf(existing.website).startsWith(hostOf(item.officialWebsite))) { // a "correction" that only truncates the host is a typo
      website = item.officialWebsite.replace(/\/+$/, '');
      report.websites.push(`${item.slug}: ${existing.website} -> ${website}`);
    }
    const record = {
      slug: existing.slug, name: existing.name, city: existing.city, state: existing.state,
      ...(website ? { website } : {}),
      ...(rows.length ? { programmesOffered: rows } : {}),
      ...(placements ? { placements } : {}), ...(seasons.length ? { placementHistory: seasons } : {}),
    };
    console.log(`${dryRun ? '[dry] ' : ''}${item.slug}: ${feeRows} fee rows, ${seasons.length} seasons${placements ? ', placement summary' : ''}${item.notFound?.length ? ` | not published: ${item.notFound.join('; ').slice(0, 140)}` : ''}`);
    if (!dryRun && website) {
      const host = hostOf(website);
      await database.collection(COLLECTIONS.scrapeSources).updateOne({ institutionSlug: existing.slug }, { $set: { website, domain: host, websiteKey: host } });
    }
    if (!dryRun && (website || feeRows || placements || seasons.length || rows.length !== (existing.programmesOffered?.length ?? 0))) {
      const written = await upsertUniversities([record], { source: { kind: 'import', name: 'Official website, checked by hand' }, publish: false });
      // The write path drops rows that fail validation without an error, so read back what really landed.
      const stored = await collection.findOne({ slug: existing.slug }, { projection: { programmesOffered: 1 } });
      const storedFees = (stored.programmesOffered ?? []).filter((row) => PERIODS.some((key) => row[key])).length;
      if (written.failed || storedFees < feeRows) report.rejected.push(`${item.slug}: wrote ${written.failed ? `with ${written.failed} failure(s) ${JSON.stringify(written.errors[0] ?? {})}` : ''} but only ${storedFees} of ${feeRows} fee rows are stored`);
    }
  }
}
console.log(JSON.stringify({ ...report, rejected: report.rejected.slice(0, 40) }, null, 1));
await closeDb();
