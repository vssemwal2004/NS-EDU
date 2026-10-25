// Campus photographs for institutions that already exist, without re-running a full crawl.
// Fetches the home page plus a couple of campus/about pages, picks candidate photographs, then
// downloads → verifies → compresses → uploads them through lib/image-pipeline.js.
//
// Run it through the scraper CLI: `npm run scrape --workspace backend -- enrich-images [options]`.
import { COLLECTIONS, getDb } from '../db/collections.js';
import { compressionRatio } from '../lib/image-pipeline.js';
import { upsertUniversities } from '../modules/universities/university-service.js';
import { scraperConfig } from '../scraper/config.js';
import { galleryCandidates } from '../scraper/deep.js';
import { parsePage, pickLinks } from '../scraper/extract.js';
import { CrawlError, createFetcher } from '../scraper/fetcher.js';
import { normalizeWebsite, registrableDomain } from '../scraper/urls.js';
import { pipelineFor } from '../scraper/worker.js';

const IMAGE_PAGES = ['campus', 'about'];

async function selectInstitutions({ slugs = [], sourceUrl = '', state = '', limit = 50, mode = 'missing' }) {
  const filter = { website: { $nin: [null, ''] } };
  if (slugs.length) filter.slug = { $in: slugs };
  if (state) filter.state = state;
  // "missing" skips anything that already has photographs of ours; "all" redoes them.
  if (mode === 'missing' && !slugs.length) filter.$or = [{ gallery: { $exists: false } }, { gallery: { $size: 0 } }];
  const docs = await (await getDb()).collection(COLLECTIONS.institutions)
    .find(filter, { projection: { slug: 1, name: 1, city: 1, state: 1, website: 1, coverUrl: 1, lockedFields: 1 } })
    .sort({ nirfRank: 1, popularity: -1, _id: 1 }).limit(Math.max(1, limit)).toArray();
  if (sourceUrl) {
    const crawlWebsite = normalizeWebsite(sourceUrl);
    if (!crawlWebsite || docs.length !== 1) throw new Error('The alternate official source URL is invalid or did not select exactly one institution');
    docs[0].crawlWebsite = crawlWebsite;
  }
  return docs;
}

async function gatherCandidates(doc, { fetcher, config }) {
  const website = normalizeWebsite(doc.crawlWebsite ?? doc.website);
  if (!website) throw new CrawlError('No usable website', { code: 'http', permanent: true });
  const domain = registrableDomain(new URL(website).hostname);
  const home = await fetcher.getPage(website, { domain });
  const pages = [{ ...parsePage(home.html, home.url), category: 'home' }];
  const links = pickLinks(pages[0], { domain, maxLinks: 8, exclude: [home.url] }).filter((link) => IMAGE_PAGES.includes(link.category)).slice(0, 2);
  for (const link of links) {
    try {
      const result = await fetcher.getPage(link.url, { domain });
      pages.push({ ...parsePage(result.html, result.url), category: link.category });
    } catch { /* one missing sub-page is not worth failing over */ }
  }
  return { domain, candidates: galleryCandidates(pages, { domain }) };
}

/**
 * @param {{ slugs?: string[], sourceUrl?: string, state?: string, limit?: number, mode?: 'missing'|'all', want?: number,
 *           concurrency?: number, dryRun?: boolean, log?: Function, signal?: AbortSignal }} options
 */
export async function enrichImages({ slugs = [], sourceUrl = '', state = '', limit = 50, mode = 'missing', want, concurrency, dryRun = false, log = () => {}, signal } = {}) {
  const config = scraperConfig();
  const docs = await selectInstitutions({ slugs, sourceUrl, state, limit, mode });
  const fetcher = createFetcher({ config, signal });
  const images = pipelineFor(fetcher, { config, log });
  const perInstitution = Math.max(1, Math.min(want ?? config.maxImages ?? 6, 8));
  const summary = { selected: docs.length, updated: 0, empty: 0, failed: 0, stored: 0, dryRun, images: images.stats, examples: [] };
  if (!images.enabled && !dryRun) throw new Error('Cloudinary is not configured; set CLOUDINARY_URL in backend/.env before running enrich-images.');

  const queue = [...docs];
  const lanes = Math.max(1, Math.min(concurrency ?? config.concurrency, 64));
  async function lane() {
    while (queue.length && !signal?.aborted) {
      const doc = queue.shift();
      try {
        const { domain, candidates } = await gatherCandidates(doc, { fetcher, config });
        if (!candidates.length) { summary.empty += 1; log(`[none] ${doc.slug} — no usable photographs on the site`); continue; }
        if (dryRun) { log(`[dry-run] ${doc.slug} — ${candidates.length} candidates`); continue; }
        const stored = await images.processMany(candidates, { slug: doc.slug, kind: 'photo', want: perInstitution, domain });
        if (!stored.length) { summary.empty += 1; log(`[none] ${doc.slug} — nothing passed the checks`); continue; }
        const gallery = stored.map(({ bytes: _bytes, originalBytes: _originalBytes, ...row }) => row);
        const record = {
          slug: doc.slug, name: doc.name, city: doc.city, state: doc.state, website: doc.website, gallery,
          sourceUrl: doc.crawlWebsite ?? doc.website,
          // An existing cover an admin chose is left alone; upsertUniversities also honours locks.
          ...(doc.coverUrl ? {} : { coverUrl: gallery[0].url }),
        };
        const result = await upsertUniversities([record], { source: { kind: 'scrape', name: 'Official website (photographs)', url: doc.crawlWebsite ?? doc.website }, publish: false });
        if (result.items[0]?.action === 'updated' || result.items[0]?.action === 'unchanged') summary.updated += 1;
        else summary.failed += 1;
        summary.stored += gallery.length;
        if (summary.examples.length < 5) summary.examples.push({ slug: doc.slug, images: gallery.length, first: gallery[0].url });
        log(`[ok] ${doc.slug} — ${gallery.length} photographs`);
      } catch (error) {
        summary.failed += 1;
        log(`[failed] ${doc.slug} <${doc.crawlWebsite ?? doc.website}> — ${error.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: lanes }, lane));
  summary.compression = compressionRatio(images.stats);
  return summary;
}
