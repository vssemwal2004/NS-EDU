// Creates one scrape source per institution that has an official website, so the crawler can
// enrich the imported directory. Idempotent: re-running only adds the ones that are missing.
// Usage: node --env-file-if-exists=.env --env-file-if-exists=.env.local src/scripts/seed-scrape-sources.js [--limit N] [--state "Maharashtra"]
import { closeDb, COLLECTIONS, getDb } from '../db/collections.js';
import { importSources } from '../scraper/sources.js';

const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(`--${name}`); return index === -1 ? fallback : args[index + 1]; };
const limit = Number(option('limit', 0));
const state = option('state', '');

try {
  const db = await getDb();
  const filter = { website: { $regex: '^https?://' }, active: { $ne: false }, ...(state ? { state } : {}) };
  const cursor = db.collection(COLLECTIONS.institutions)
    .find(filter, { projection: { name: 1, website: 1, state: 1, city: 1, type: 1, category: 1, slug: 1, nirfRank: 1, naacGrade: 1 } })
    // Ranked and accredited institutions first: they are what students search for most.
    .sort({ nirfRank: 1, popularity: -1, nameKey: 1 });
  const rows = [];
  for await (const doc of cursor) {
    rows.push({ name: doc.name, website: doc.website, state: doc.state ?? '', city: doc.city ?? '', type: doc.type ?? '', category: doc.category ?? '', institutionSlug: doc.slug });
    if (limit && rows.length >= limit) break;
  }
  console.log(`Seeding ${rows.length} scrape source(s)${state ? ` in ${state}` : ''} …`);
  const summary = await importSources(rows, { seedListName: 'Institution directory' });
  console.log(JSON.stringify(summary.counts ?? summary, null, 1));
  console.log(`scrape_sources now: ${await db.collection(COLLECTIONS.scrapeSources).countDocuments({})}`);
} catch (error) {
  console.error('Seeding failed:', error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
