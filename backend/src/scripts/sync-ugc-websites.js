// Fills missing official websites for universities/institutes from UGC's current public registry,
// in resumable batches of 100, then queues only those new sources at high priority.
// Usage: node --env-file-if-exists=.env --env-file-if-exists=.env.local src/scripts/sync-ugc-websites.js [--limit 100] [--dry-run] [--no-enqueue]
import { closeDb, COLLECTIONS, getDb } from '../db/collections.js';
import { upsertUniversities } from '../modules/universities/university-service.js';
import { enqueueSources } from '../scraper/queue.js';
import { fetchUgcRegistry, matchRegistryRow, UGC_REGISTRY_URL } from '../scraper/ugc-registry.js';
import { importSources } from '../scraper/sources.js';
import { scraperConfig } from '../scraper/config.js';
import { websiteKey } from '../scraper/urls.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const limit = Number(option('limit', 100));
if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('--limit must be between 1 and 500');
const dryRun = flag('dry-run');
const shouldEnqueue = !flag('no-enqueue');

try {
  const db = await getDb();
  const institutions = db.collection(COLLECTIONS.institutions);
  const missingFilter = {
    active: { $ne: false },
    isIllustrative: { $ne: true },
    type: { $in: ['university', 'institute'] },
    $or: [{ website: { $exists: false } }, { website: null }, { website: '' }],
  };
  const missing = await institutions.find(missingFilter, {
    projection: { slug: 1, name: 1, city: 1, district: 1, state: 1, pincode: 1, type: 1, category: 1 },
  }).sort({ nameKey: 1, _id: 1 }).toArray();
  const registry = await fetchUgcRegistry({ userAgent: scraperConfig().userAgent });
  const outcomes = missing.map((institution) => ({ institution, match: matchRegistryRow(institution, registry) }));
  const matched = outcomes.filter(({ match }) => match.status === 'matched');
  const ambiguous = outcomes.filter(({ match }) => match.status === 'ambiguous');
  const batch = matched.slice(0, limit);

  console.log(`UGC registry: ${registry.length} rows with websites. DB: ${missing.length} universities/institutes still missing a website.`);
  console.log(`Resolution: ${matched.length} matched, ${ambiguous.length} ambiguous, ${missing.length - matched.length - ambiguous.length} unmatched; processing ${batch.length}${dryRun ? ' (dry run)' : ''}.`);
  for (const { institution, match } of batch.slice(0, 12)) {
    console.log(`  ${(match.score * 100).toFixed(1)}% ${institution.name} -> ${match.row.website}`);
  }
  if (dryRun || !batch.length) process.exitCode = batch.length ? 0 : 2;
  else {
    const rows = batch.map(({ institution, match }) => ({
      slug: institution.slug,
      name: institution.name,
      city: institution.city,
      state: institution.state,
      type: institution.type,
      category: institution.category,
      website: match.row.website,
      sourceUrl: match.row.evidence || UGC_REGISTRY_URL,
    }));
    const saved = await upsertUniversities(rows, {
      source: { kind: 'import', name: 'UGC registry and reviewed official sources', url: UGC_REGISTRY_URL },
      publish: true,
    });
    console.log(`Institutions: ${saved.updated} updated, ${saved.unchanged} unchanged, ${saved.failed} failed.`);
    if (saved.failed) console.log(JSON.stringify(saved.errors.slice(0, 20), null, 2));

    const acceptedSlugs = new Set(saved.items.filter((item) => item.action === 'updated').map((item) => item.slug));
    const sourceRows = rows.filter((row) => acceptedSlugs.has(row.slug));
    const sources = await importSources(sourceRows, { seedListName: 'UGC university registry' });
    console.log(`Sources: ${sources.inserted} added, ${sources.updated} refreshed, ${sources.failed} failed.`);

    if (shouldEnqueue) {
      // Include older UGC rows that were saved before an interrupted process reached this step.
      // This makes the command resumable across a terminal close or machine restart.
      const keys = sourceRows.map((row) => websiteKey(row.website));
      const sourceDocs = await db.collection(COLLECTIONS.scrapeSources).find({
        status: 'active',
        lastJobAt: null,
        $or: [
          { seedListName: 'UGC university registry' },
          ...(keys.length ? [{ websiteKey: { $in: keys } }] : []),
        ],
      }, { projection: { _id: 1 } }).toArray();
      if (!sourceDocs.length) {
        console.log('Queue: no never-crawled UGC sources waiting.');
      } else {
      const queued = await enqueueSources({ mode: 'selected', sourceIds: sourceDocs.map((doc) => doc._id.toString()), createdBy: 'ugc-registry-sync' });
      console.log(`Queue: ${queued.queued} high-priority jobs added (${queued.alreadyQueued} already open), run ${queued.runId ?? 'none'}.`);
      }
    }
  }

  for (const { institution, match } of ambiguous.slice(0, 10)) {
    console.log(`[review] ${institution.name} (${institution.state}): ${match.candidates.map(({ row, score }) => `${row.name} ${(score * 100).toFixed(1)}%`).join(' | ')}`);
  }
} catch (error) {
  console.error('UGC website sync failed:', error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
