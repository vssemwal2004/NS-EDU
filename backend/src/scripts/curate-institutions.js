// Derives listing prominence and cleans imported values across `institutions`.
// Usage: node src/scripts/curate-institutions.js [--dry-run] [--rescore-all]   (from backend/)
// `npm run curate -- --dry-run` does NOT work: npm swallows the --flags before the script sees
// them, so a "dry run" launched that way writes for real. Call node directly for flags.
//
// The AISHE-derived import left every record at popularity 0, so the default "relevance" order
// (popularity desc, then name) degenerated to alphabetical and the directory opened on rows whose
// names begin with a digit. This recomputes a deterministic PROMINENCE score into `popularity`.
//
// What the score is NOT: it is not a Gyaan Vidhya ranking and not a quality judgement. It only
// decides which of 9,334 records a student sees first when they have not sorted or filtered:
// officially ranked and accredited institutions, and records complete enough to be worth opening,
// come before near-empty rows. The components are published in SCORE below so it can be audited.
//
// `popularity` doubles as the admin "Popularity boost" field, so by default only records still at 0
// are written. Pass --rescore-all to recompute every record (this overwrites admin boosts).
import { closeDb, COLLECTIONS, getDb } from '../db/collections.js';
import { invalidateUniversityCaches } from '../modules/universities/university-service.js';
import { classify } from '../modules/universities/directory-taxonomy.js';
import { derivedFields, domainOf } from '../modules/universities/normalize.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const dryRun = flag('dry-run');
const rescoreAll = flag('rescore-all');

// --- prominence --------------------------------------------------------------------------------
const SCORE = {
  // An official NIRF rank is the only external ordering signal in the data. Rank 1 → 59,950.
  nirf: (rank) => (Number.isInteger(rank) && rank > 0 && rank <= 1000 ? 60_000 - rank * 50 : 0),
  naac: { 'A++': 9000, 'A+': 7500, A: 6000, 'B++': 4000, 'B+': 3000, B: 2000, C: 1000, D: 0 },
  type: { university: 3000, institute: 2000, college: 0, other: 0 },
  category: {
    'institute-of-national-importance': 4000, 'central-university': 3000, 'state-university': 1500,
    'deemed-university': 1200, 'private-university': 1000, 'autonomous-college': 800,
  },
  // Completeness: a record we can actually show should outrank a name-and-city stub.
  filled: {
    website: 300, logoUrl: 200, about: 300, gallery: 300, programmesOffered: 300, placements: 400,
    facilities: 150, activities: 150, campus: 150, approvals: 200, establishedYear: 100, directory: 100,
  },
};

const has = (value) => !(value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)
  || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length));

function prominenceOf(doc) {
  let score = SCORE.nirf(doc.nirfRank) + (SCORE.naac[doc.naacGrade] ?? 0)
    + (SCORE.type[doc.type] ?? 0) + (SCORE.category[doc.category] ?? 0);
  for (const [field, points] of Object.entries(SCORE.filled)) if (has(doc[field])) score += points;
  // Rows whose name still starts with a source code read as broken; never let one lead the list.
  if (/^\d/.test(String(doc.name ?? ''))) score -= 500;
  return Math.max(0, Math.round(score));
}

// --- cleaning ----------------------------------------------------------------------------------
// The spreadsheet's "Affiliating university" column holds a website for ~1,400 rows (and for a
// university, its own website). A URL is not an affiliation, so resolve it to a real name or drop it.
const LOOKS_LIKE_URL = /^(https?:\/\/|www\.)|^[a-z0-9-]+(\.[a-z0-9-]+)+\/?$/i;
const hostOf = (value) => domainOf(/^https?:\/\//i.test(value) ? value : `https://${value}`);

function cleanAffiliatedTo(value, { ownDomain, byAisheCode, byDomain, affiliatingAishe, name }) {
  const text = String(value ?? '').trim();
  if (!text || !LOOKS_LIKE_URL.test(text)) return text;
  const resolved = affiliatingAishe && byAisheCode.get(affiliatingAishe);
  if (resolved && resolved !== name) return resolved;
  const host = hostOf(text);
  if (!host || host === ownDomain) return '';
  const match = byDomain.get(host);
  return match && match !== name ? match : '';
}

// Empty cells arrived as the literal string NULL: "College Road, NULL, Kottayam".
const cleanAddress = (value) => String(value ?? '')
  .split(',').map((part) => part.trim()).filter((part) => part && !/^null$/i.test(part)).join(', ');

// "150028 - Tapi Valley …" — the source code leaked into the name past the importer's old pattern.
const cleanName = (value) => String(value ?? '').replace(/^\s*\d{3,}\s*[-–—]\s*/, '').trim();

// The stored `nirfRank` is the best of the per-subject ranks in `directory.nirfRanks`
// ("Engineering: 48; Pharmacy: 13; Overall: 49"). Without its category a bare "#13" reads as an
// overall rank, so recover which list the stored rank came from.
function nirfCategoryOf(doc) {
  if (!Number.isInteger(doc.nirfRank) || !doc.directory?.nirfRanks) return '';
  const match = [...String(doc.directory.nirfRanks).matchAll(/([^;:]+):\s*(\d+)/g)]
    .find((entry) => Number(entry[2]) === doc.nirfRank);
  return match ? match[1].trim().slice(0, 60) : '';
}

// The site's Content-Security-Policy allows img-src https: only, so a plain-http logo can never
// render — it is a guaranteed broken image, not a degraded one. Drop it and let the monogram show.
const usableImage = (value) => (/^http:\/\//i.test(String(value ?? '')) ? '' : String(value ?? ''));

// --- run ---------------------------------------------------------------------------------------
const BATCH = 500;

async function run() {
  const db = await getDb();
  const institutions = db.collection(COLLECTIONS.institutions);

  console.log('Building AISHE-code and domain lookups …');
  const byAisheCode = new Map();
  const byDomain = new Map();
  for await (const doc of institutions.find({}, { projection: { name: 1, domain: 1, 'directory.aisheCode': 1 } })) {
    const code = doc.directory?.aisheCode;
    if (code && !byAisheCode.has(code)) byAisheCode.set(code, doc.name);
    if (doc.domain && !byDomain.has(doc.domain)) byDomain.set(doc.domain, doc.name);
  }
  console.log(`  ${byAisheCode.size} AISHE codes, ${byDomain.size} domains.`);

  const stats = { scanned: 0, scored: 0, names: 0, affiliations: 0, addresses: 0, reclassified: 0, nirfCategories: 0, logos: 0, written: 0 };
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    if (!dryRun) await institutions.bulkWrite(batch, { ordered: false });
    stats.written += batch.length;
    batch = [];
  };

  for await (const doc of institutions.find({})) {
    stats.scanned += 1;
    const set = {};

    const name = cleanName(doc.name);
    if (name && name !== doc.name) { set.name = name; stats.names += 1; }

    const address = cleanAddress(doc.address);
    if (doc.address && address !== doc.address) { set.address = address; stats.addresses += 1; }

    const affiliatedTo = cleanAffiliatedTo(doc.affiliatedTo, {
      ownDomain: doc.domain || domainOf(doc.website),
      byAisheCode,
      byDomain,
      affiliatingAishe: doc.directory?.affiliatingAishe,
      name: set.name ?? doc.name,
    });
    if (affiliatedTo !== (doc.affiliatedTo ?? '')) { set.affiliatedTo = affiliatedTo; stats.affiliations += 1; }

    // Re-derive type / category / ownership from the source's own institution-type vocabulary.
    // Admin-locked fields keep whatever a reviewer chose.
    const locked = new Set(doc.lockedFields ?? []);
    if (doc.directory?.institutionType) {
      const derived = classify(doc.directory.institutionType, doc.directory.managementLabel);
      let changed = false;
      for (const [field, value] of Object.entries(derived)) {
        if (locked.has(field) || doc[field] === value) continue;
        set[field] = value;
        changed = true;
      }
      if (changed) stats.reclassified += 1;
    }

    const nirfCategory = nirfCategoryOf(doc);
    if (nirfCategory && nirfCategory !== doc.nirfCategory && !locked.has('nirfCategory')) { set.nirfCategory = nirfCategory; stats.nirfCategories += 1; }

    for (const field of ['logoUrl', 'coverUrl']) {
      const usable = usableImage(doc[field]);
      if (doc[field] && usable !== doc[field] && !locked.has(field)) { set[field] = usable; stats.logos += 1; }
    }

    if (rescoreAll || !doc.popularity) {
      const popularity = prominenceOf({ ...doc, ...set });
      if (popularity !== doc.popularity) { set.popularity = popularity; stats.scored += 1; }
    }

    if (!Object.keys(set).length) continue;
    // A changed name changes nameKey and the search prefixes; the slug is deliberately left alone
    // so existing links and the scrape queue keep working.
    if (set.name) Object.assign(set, derivedFields({ ...doc, ...set }));
    batch.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { ...set, updatedAt: new Date() } } } });
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  if (!dryRun && stats.written) invalidateUniversityCaches();
  console.log(`${dryRun ? '[dry run] ' : ''}${JSON.stringify(stats)}`);

  const top = await institutions.find({ active: { $ne: false } }).sort({ popularity: -1, nameKey: 1, _id: 1 })
    .limit(10).project({ name: 1, popularity: 1, nirfRank: 1, naacGrade: 1 }).toArray();
  console.log('Top of the default order now:');
  for (const row of top) console.log(`  ${String(row.popularity).padStart(6)}  ${row.name}${row.nirfRank ? ` (NIRF ${row.nirfRank})` : ''}`);
}

try {
  await run();
} catch (error) {
  console.error('Curation failed:', error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
