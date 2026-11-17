// Downloads institution logos that a researcher found in a page's markup (the `logos` list printed by apply-research.js)
// and stores them like any other scraped logo: robots.txt, the institution's own domain, size/shape checks, then the image store.
// Usage: node --env-file-if-exists=.env src/scripts/apply-logos.js <logos.json> [--dry-run]
//   logos.json = [{ "slug": "…", "url": "https://…/logo.png", "page": "https://… (page it was seen on)" }]
// Only fills an EMPTY logo, never one an admin locked, and never replaces an existing one.
import { readFile } from 'node:fs/promises';
import { COLLECTIONS, closeDb, getDb } from '../db/collections.js';
import { scraperConfig } from '../scraper/config.js';
import { createFetcher } from '../scraper/fetcher.js';
import { registrableDomain } from '../scraper/urls.js';
import { pipelineFor } from '../scraper/worker.js';

const file = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');
if (!file) { console.log('Usage: apply-logos <logos.json> [--dry-run]'); process.exit(1); }

const config = scraperConfig();
const fetcher = createFetcher({ config });
const images = pipelineFor(fetcher, { config, log: () => {} });
const institutions = (await getDb()).collection(COLLECTIONS.institutions);
const result = { saved: 0, skipped: 0, failed: [] };

for (const item of JSON.parse(await readFile(file, 'utf8'))) {
  const doc = await institutions.findOne({ slug: item.slug }, { projection: { slug: 1, website: 1, logoUrl: 1, lockedFields: 1 } });
  if (!doc || doc.logoUrl || (doc.lockedFields ?? []).includes('logoUrl')) { result.skipped += 1; continue; }
  try {
    const host = new URL(item.url).hostname;
    const domain = registrableDomain(new URL(doc.website ?? item.page ?? item.url).hostname) || registrableDomain(host);
    if (dryRun) { console.log(`[dry] ${item.slug}: ${item.url}`); continue; }
    const logo = await images.process({ url: item.url, slug: item.slug, kind: 'logo', domain, sourcePage: item.page ?? doc.website });
    if (!logo?.url) { result.failed.push(`${item.slug}: no usable logo`); continue; }
    await institutions.updateOne({ slug: item.slug, $or: [{ logoUrl: { $exists: false } }, { logoUrl: '' }, { logoUrl: null }] }, { $set: { logoUrl: logo.url, updatedAt: new Date() } });
    result.saved += 1;
    console.log(`${item.slug}: logo saved`);
  } catch (error) { result.failed.push(`${item.slug}: ${error.message}`); }
}
console.log(JSON.stringify(result, null, 1));
await closeDb();
