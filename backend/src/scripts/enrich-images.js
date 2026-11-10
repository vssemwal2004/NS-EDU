// Campus photographs for institutions that already exist, without re-running a full crawl.
// Fetches the home page plus a couple of campus/about pages, picks candidate photographs, then
// downloads → verifies → compresses → uploads them through lib/image-pipeline.js.
//
// Run it through the scraper CLI: `npm run scrape --workspace backend -- enrich-images [options]`.
import { COLLECTIONS, getDb } from '../db/collections.js';
import { accountUsage } from '../lib/cloudinary.js';
import { compressionRatio, imageFingerprint } from '../lib/image-pipeline.js';
import { isRetiredImage, retiredImagePattern } from '../lib/retired-images.js';
import { r2Selected } from '../lib/r2.js';
import { upsertUniversities } from '../modules/universities/university-service.js';
import { scraperConfig } from '../scraper/config.js';
import { galleryCandidates } from '../scraper/deep.js';
import { logoFrom, parsePage, pickLinks } from '../scraper/extract.js';
import { CrawlError, createFetcher } from '../scraper/fetcher.js';
import { isSameSite, normalizeWebsite, registrableDomain, resolveUrl } from '../scraper/urls.js';
import { createRenderer, looksClientRendered } from '../scraper/renderer.js';
import { pipelineFor, withTimeout } from '../scraper/worker.js';

// One slow site must not hold a lane: after this long the university is skipped (it is picked up
// again by the next run, because its images are still missing) and the lane moves on.
const PER_INSTITUTION_MS = Number(process.env.ENRICH_SITE_BUDGET_MS) || 120_000;

// campus (also matches gallery, facilities, infrastructure, hostel, library…), about, and the
// academics/departments page, so a profile gets campus, building and academic photographs.
const IMAGE_PAGES = ['campus', 'about', 'programmes'];

// "wide" mode looks at many more pages of the site (galleries, facilities, hostels, labs, sports,
// departments…) and tops each university up to the wanted number of photographs.
const WIDE_MS = Number(process.env.ENRICH_WIDE_BUDGET_MS) || 300_000;
const WIDE_PAGES = 10;
const WIDE_ALBUM_PAGES = 6;
// "--city X" runs wide mode in a deeper form for one city's institutions: more pages and albums per
// site, a longer budget, and a reserved share of department/academics pages so profiles get
// classroom, lab and department photographs and not only campus views.
// A deep run wants up to ~24 photographs per site; downloads from one site are spaced by the host
// delay (1 s), so 100+ candidates need minutes.
const DEEP_MS = Number(process.env.ENRICH_DEEP_BUDGET_MS) || 720_000;
const DEEP_CANDIDATES = 200;
const DEEP_PAGES = 16;
const DEEP_ALBUM_PAGES = 12;
const DEEP_ACADEMIC_PAGES = 5;
const ACADEMIC_PAGES = /department|school-of|college-of|faculty|faculties|academics?|programmes?|courses?|centre|center|research|laborator|\blabs?\b/i;
const MAX_PHOTOS = 24; // also the length at which replaceRetired stops keeping gallery rows (schema maxItems)
const PAGE_KINDS = [
  [/gallery|photo|album|tour|campus-?life|student-?life/i, 3],
  [/facilit|infrastructure|hostel|librar|laborator|\blabs?\b|sports|canteen|cafeteria|auditorium|amenit|campus|gym|transport|medical/i, 2],
  [/department|school|academics?|centre|center|research|about|overview|events?|activit|clubs?|culture|fest/i, 1],
];
const AVOID_PAGES = /login|sign-?in|portal|erp|lms|webmail|tender|careers?|jobs?|recruit|vacanc|notice|circular|result|download|admission-?form|payment|alumni-?regist/i;
const NOT_A_PAGE = /\.(pdf|jpe?g|png|gif|webp|svg|zip|rar|docx?|xlsx?|pptx?|mp4|mp3)$/i;
const decodeSafe = (text) => { try { return decodeURIComponent(text); } catch { return text; } };

/** Same-site links on a page that are likely to hold photographs, best first (gallery > facilities > departments). */
function photoLinks(page, { domain, exclude = [], onlyAlbums = false, academics = false }) {
  const seen = new Set(exclude);
  const found = [];
  for (const link of page.links ?? []) {
    const url = resolveUrl(link.href, page.url);
    if (!url || !isSameSite(url, domain) || NOT_A_PAGE.test(url.pathname) || url.search.length > 80) continue;
    url.hash = '';
    const key = `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}${url.search}`;
    if (seen.has(key)) continue;
    const text = `${decodeSafe(url.pathname + url.search).replace(/[_/=&?.]+/g, '-')} ${link.text ?? ''}`;
    if (AVOID_PAGES.test(text)) continue;
    const weight = PAGE_KINDS.find(([pattern]) => pattern.test(text))?.[1] ?? (academics && ACADEMIC_PAGES.test(text) ? 1 : 0);
    if (!weight || (onlyAlbums && weight < 3)) continue;
    seen.add(key);
    found.push({ url: url.toString(), key, weight, academic: ACADEMIC_PAGES.test(text), score: weight * 10 - Math.min(url.pathname.split('/').filter(Boolean).length, 6) });
  }
  return found.sort((a, b) => b.score - a.score);
}

async function selectInstitutions({ slugs = [], sourceUrl = '', state = '', city = '', limit = 50, mode = 'missing', target = 10, maxHave = null }) {
  const filter = { website: { $nin: [null, ''] } };
  if (slugs.length) filter.slug = { $in: slugs };
  if (state) filter.state = state;
  // Whole-name, case-insensitive match ("Dehradun" must not also pick "Dehradun Cantt" or a longer name).
  if (city) filter.city = new RegExp(`^\\s*${city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\s*$`, 'i');
  // "missing" skips anything that already has photographs of ours; "all" redoes them; "retired"
  // picks records whose photos, cover or logo sit on a Cloudinary account that no longer serves
  // them, and records with no photographs at all (both end up with a full set).
  const noGallery = [{ gallery: { $exists: false } }, { gallery: { $size: 0 } }];
  if (mode === 'missing' && !slugs.length) filter.$or = noGallery;
  // "logos": only the logo is looked for, on the home page, for every university that has none (or a dead one).
  if (mode === 'logos' && !slugs.length) filter.$or = [{ logoUrl: { $exists: false } }, { logoUrl: null }, { logoUrl: '' }, { logoUrl: retiredImagePattern() }];
  if ((mode === 'retired' || mode === 'wide') && !slugs.length) {
    const dead = retiredImagePattern();
    filter.$or = [{ 'gallery.url': dead }, { coverUrl: dead }, { logoUrl: dead }, ...noGallery];
    // "wide" also tops up every university that has fewer than the wanted number of photographs.
    if (mode === 'wide') filter.$or.push({ $expr: { $lt: [{ $size: { $ifNull: ['$gallery', []] } }, target] } });
  }
  // --max-have N: only institutions that hold at most N usable photographs (the empty ones, for a browser-rendering run).
  if (maxHave !== null && !slugs.length) filter.$and = [{ $expr: { $lte: [{ $size: { $ifNull: ['$gallery', []] } }, maxHave] } }];
  const institutions = (await getDb()).collection(COLLECTIONS.institutions);
  // Most-visited first (an ascending nirfRank sort would put every unranked record first, since a
  // missing field sorts before 1), so a run that is stopped early has fixed the pages students see.
  // Only the sort keys are sorted: thousands of full records exceed Atlas's 32 MB in-memory sort.
  const order = await institutions.aggregate([
    { $match: filter },
    { $project: { _id: 1, popularity: 1, nirfRank: 1 } },
    { $sort: { popularity: -1, nirfRank: 1, _id: 1 } },
    { $limit: Math.max(1, limit) },
  ]).toArray();
  const byId = new Map();
  const projection = { slug: 1, name: 1, city: 1, state: 1, website: 1, coverUrl: 1, logoUrl: 1, gallery: 1, lockedFields: 1 };
  for (let start = 0; start < order.length; start += 500) {
    const ids = order.slice(start, start + 500).map((row) => row._id);
    for (const doc of await institutions.find({ _id: { $in: ids } }, { projection }).toArray()) byId.set(String(doc._id), doc);
  }
  const docs = order.map((row) => byId.get(String(row._id))).filter(Boolean);
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
  const links = pickLinks(pages[0], { domain, maxLinks: 8, exclude: [home.url] }).filter((link) => IMAGE_PAGES.includes(link.category)).slice(0, IMAGE_PAGES.length);
  for (const link of links) {
    try {
      const result = await fetcher.getPage(link.url, { domain });
      pages.push({ ...parsePage(result.html, result.url), category: link.category });
    } catch { /* one missing sub-page is not worth failing over */ }
  }
  return { domain, home: pages[0], candidates: galleryCandidates(pages, { domain }) };
}

/** Home page, then up to 10 photo-likely pages, then up to 6 album pages found on those (deep: 16, 12 and 5 academics pages). */
async function gatherWide(doc, { fetcher, deep = false, renderer = null, deadlineAt = null, lenient = false }) {
  const website = normalizeWebsite(doc.crawlWebsite ?? doc.website);
  if (!website) throw new CrawlError('No usable website', { code: 'http', permanent: true });
  const domain = registrableDomain(new URL(website).hostname);
  // With --render, a page that is only an empty JavaScript app shell (or a client-side redirect) is
  // opened in a real browser, so the pictures and links the script builds become visible. Ordinary
  // pages keep the cheaper HTTP path.
  const load = async (href) => {
    const result = await fetcher.getPage(href, { domain });
    if (!renderer || !looksClientRendered(result.html)) return result;
    const rendered = await renderer.render(result.url, { domain, deadlineAt });
    return rendered ? { ...result, html: rendered.html, url: rendered.url || result.url, rendered: true } : result;
  };
  const home = await load(website);
  const pages = [{ ...parsePage(home.html, home.url), category: 'home' }];
  const seen = new Set([home.url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')]);
  const fetchAll = async (links) => {
    // The fetcher spaces requests to one site by the host delay, so these overlap only their waiting.
    const results = await Promise.allSettled(links.map((link) => load(link.url)));
    results.forEach((result, index) => {
      links[index] && seen.add(links[index].key);
      if (result.status === 'fulfilled') pages.push({ ...parsePage(result.value.html, result.value.url), category: links[index].weight >= 2 ? 'campus' : 'about' });
    });
  };
  const firstLinks = photoLinks(pages[0], { domain, exclude: [...seen], academics: deep });
  const firstPages = firstLinks.slice(0, deep ? DEEP_PAGES : WIDE_PAGES);
  if (deep) {
    // Reserve room for department/academics pages even when galleries and facilities fill the list.
    const chosen = new Set(firstPages.map((link) => link.key));
    firstPages.push(...firstLinks.filter((link) => link.academic && !chosen.has(link.key)).slice(0, Math.max(0, DEEP_ACADEMIC_PAGES - firstPages.filter((link) => link.academic).length)));
  }
  await fetchAll(firstPages);
  const albums = [];
  for (const page of pages.slice(1)) for (const link of photoLinks(page, { domain, exclude: [...seen], onlyAlbums: true })) if (!albums.some((item) => item.key === link.key)) albums.push(link);
  await fetchAll(albums.slice(0, deep ? DEEP_ALBUM_PAGES : WIDE_ALBUM_PAGES));
  return { domain, home: pages[0], pageCount: pages.length, candidates: galleryCandidates(pages, { domain, limit: deep ? DEEP_CANDIDATES : 120, lenientMarkup: lenient }) };
}

/**
 * Re-reads the picture fields of one institution. A university takes minutes to crawl, and another
 * run (the all-India one and a city run can be going at once) may have changed its gallery in the
 * meantime; writing from the snapshot taken at selection time would erase that work.
 */
async function refreshImages(doc) {
  const current = await (await getDb()).collection(COLLECTIONS.institutions).findOne(
    { _id: doc._id }, { projection: { gallery: 1, coverUrl: 1, logoUrl: 1, lockedFields: 1 } },
  );
  if (current) Object.assign(doc, { gallery: current.gallery, coverUrl: current.coverUrl, logoUrl: current.logoUrl, lockedFields: current.lockedFields });
}

/** What the photographs we already hold look like, so the same picture is never stored twice. */
async function printsOfLive(rows) {
  const prints = await Promise.all(rows.map(async (row) => {
    try {
      const response = await fetch(row.url, { signal: AbortSignal.timeout(15_000) });
      return response.ok ? await imageFingerprint(Buffer.from(await response.arrayBuffer())) : null;
    } catch { return null; }
  }));
  return prints.filter((print) => print !== null);
}

/**
 * Replaces images on the retired Cloudinary account for one institution: new photographs from the
 * official site (plus any still-working ones), the cover from the first of them, and the logo
 * found on the home page. Only dead links are touched, never a field an admin locked, and a field
 * with no replacement is cleared (it could not load anyway). Returns what changed.
 */
async function replaceRetired(doc, { home, domain, stored, images, append = false }) {
  const locked = new Set(doc.lockedFields ?? []);
  const set = {};
  const unset = {};
  const changed = [];
  const oldGallery = doc.gallery ?? [];
  const deadGallery = oldGallery.some((row) => isRetiredImage(row?.url));
  if (!locked.has('gallery') && (deadGallery || (!oldGallery.length && stored.length) || (append && stored.length))) {
    const live = oldGallery.filter((row) => row?.url && !isRetiredImage(row.url));
    // Top-up keeps the photographs already shown first and adds the new ones after them.
    const rows = (append ? [...live, ...stored.filter((item) => !live.some((row) => row.url === item.url))]
      : [...stored, ...live.filter((row) => !stored.some((item) => item.url === row.url))]).slice(0, MAX_PHOTOS);
    set.gallery = rows;
    changed.push(`gallery ${oldGallery.length}→${rows.length}`);
  }
  const gallery = set.gallery ?? oldGallery.filter((row) => !isRetiredImage(row?.url));
  const deadCover = isRetiredImage(doc.coverUrl);
  if (!locked.has('coverUrl') && (deadCover || (!doc.coverUrl && gallery[0]?.url))) {
    if (gallery[0]?.url) set.coverUrl = gallery[0].url; else unset.coverUrl = '';
    changed.push(`cover ${set.coverUrl ? 'replaced' : 'cleared'}`);
  }
  const deadLogo = isRetiredImage(doc.logoUrl);
  if (!locked.has('logoUrl') && (deadLogo || !doc.logoUrl)) {
    const found = logoFrom(home);
    const logo = found ? await images.process({ url: found, slug: doc.slug, kind: 'logo', domain, sourcePage: home.url }) : null;
    if (logo?.url) { set.logoUrl = logo.url; changed.push('logo replaced'); } else if (deadLogo) { unset.logoUrl = ''; changed.push('logo cleared'); }
  }
  if (!changed.length) return changed;
  // updatedAt changes, so the running API notices and rebuilds its search index within a minute.
  await (await getDb()).collection(COLLECTIONS.institutions).updateOne({ _id: doc._id }, {
    $set: { ...set, updatedAt: new Date() },
    ...(Object.keys(unset).length && { $unset: unset }),
  });
  return changed;
}

// Storage is billed at about 1 credit per GB stored. A run stops once the images it has uploaded
// would take the account past this share of its credit allowance (CLOUDINARY_MAX_CREDIT_SHARE,
// default 0.7), leaving room for the month's bandwidth. Our first account was disabled at 450%.
const GB = 1024 ** 3;
export function creditBudget(usage, { share = Number(process.env.CLOUDINARY_MAX_CREDIT_SHARE) || 0.7 } = {}) {
  const limit = Number(usage?.credits?.limit) || 25;
  const used = Number(usage?.credits?.usage) || 0;
  const allowedBytes = Math.max(0, limit * share - used) * GB;
  return { limit, used, share, allowedBytes, exhausted: (uploadedBytes) => uploadedBytes >= allowedBytes };
}

/**
 * @param {{ slugs?: string[], sourceUrl?: string, state?: string, limit?: number, mode?: 'missing'|'all', want?: number,
 *           concurrency?: number, dryRun?: boolean, log?: Function, signal?: AbortSignal }} options
 */
export async function enrichImages({ slugs = [], sourceUrl = '', state = '', city = '', limit = 50, mode = 'missing', want, concurrency, part = '', maxHave = null, render = false, lenientMarkup = false, dryRun = false, log = () => {}, signal } = {}) {
  const config = scraperConfig();
  const target = Math.max(1, Math.min(want ?? config.maxImages ?? 6, MAX_PHOTOS));
  const deep = Boolean(city) && mode === 'wide';
  let docs = await selectInstitutions({ slugs, sourceUrl, state, city, limit, mode, target, maxHave });
  // One shared Chrome for the whole run (see scraper/renderer.js); it only opens pages that look like empty JavaScript shells.
  const renderer = render && (mode === 'wide' || mode === 'logos') ? createRenderer({ config, signal, log }) : null;
  // "--part 2/3": this process takes every 3rd record starting at the 2nd, so several processes
  // can share one list without overlapping (the list is the same, most-visited first, in each).
  const [partNumber, partCount] = part.split('/').map(Number);
  if (partCount > 1 && partNumber >= 1 && partNumber <= partCount) docs = docs.filter((_, index) => index % partCount === partNumber - 1);
  const fetcher = createFetcher({ config, signal });
  const images = pipelineFor(fetcher, { config, log });
  const perInstitution = target;
  const summary = { selected: docs.length, updated: 0, empty: 0, failed: 0, stored: 0, dryRun, images: images.stats, examples: [] };
  if (!images.enabled && !dryRun) throw new Error('Cloudinary is not configured; set CLOUDINARY_URL in backend/.env before running enrich-images.');

  let budget = null;
  // The Cloudinary credit guard only matters when pictures go to Cloudinary; R2 has no such plan limit.
  if (!dryRun && !r2Selected()) {
    const usage = await accountUsage().catch((error) => { log(`[warn] could not read Cloudinary usage (${error.message}); assuming a fresh Free plan`); return null; });
    budget = creditBudget(usage);
    summary.budget = { plan: usage?.plan ?? 'unknown', creditsUsed: budget.used, creditLimit: budget.limit, stopAtGb: Number((budget.allowedBytes / GB).toFixed(2)) };
    log(`[budget] Cloudinary ${summary.budget.plan}: ${budget.used} of ${budget.limit} credits used; this run stops after about ${summary.budget.stopAtGb} GB of new images.`);
  }

  const queue = [...docs];
  const lanes = Math.max(1, Math.min(concurrency ?? config.concurrency, 64));
  async function lane() {
    while (queue.length && !signal?.aborted) {
      if (budget?.exhausted(images.stats.compressedBytes)) {
        if (!summary.stoppedForBudget) log(`[budget] stopping: ${(images.stats.compressedBytes / GB).toFixed(2)} GB uploaded reaches ${Math.round(budget.share * 100)}% of the plan's credits. ${queue.length} institutions left for a later run.`);
        summary.stoppedForBudget = true;
        break;
      }
      const doc = queue.shift();
      const budgetMs = deep ? DEEP_MS : mode === 'wide' ? WIDE_MS : PER_INSTITUTION_MS;
      const deadline = Date.now() + budgetMs;
      const inTime = () => Date.now() < deadline;
      try {
        if (mode === 'logos') {
          // One page per university: the logo on the home page (opened in Chrome only if it is an empty JavaScript shell).
          const website = normalizeWebsite(doc.crawlWebsite ?? doc.website);
          if (!website) throw new CrawlError('No usable website', { code: 'http', permanent: true });
          const domain = registrableDomain(new URL(website).hostname);
          let fetched = await withTimeout(fetcher.getPage(website, { domain }), PER_INSTITUTION_MS);
          if (renderer && looksClientRendered(fetched.html)) {
            const rendered = await withTimeout(renderer.render(fetched.url, { domain, deadlineAt: deadline }), PER_INSTITUTION_MS).catch(() => null);
            if (rendered) fetched = { ...fetched, html: rendered.html, url: rendered.url || fetched.url };
          }
          const home = { ...parsePage(fetched.html, fetched.url), category: 'home' };
          if (dryRun) { log(`[dry-run] ${doc.slug} — logo ${logoFrom(home) ?? 'not found'}`); continue; }
          await withTimeout(refreshImages(doc), 30_000);
          const changed = await withTimeout(replaceRetired(doc, { home, domain, stored: [], images }), 60_000);
          if (changed.some((item) => item.startsWith('logo replaced'))) { summary.updated += 1; log(`[ok] ${doc.slug} — ${changed.join(', ')}`); } else { summary.empty += 1; log(`[none] ${doc.slug} — no usable logo on the home page`); }
          continue;
        }
        if (mode === 'wide') {
          const { domain, home, candidates, pageCount } = await withTimeout(gatherWide(doc, { fetcher, deep, renderer, deadlineAt: deadline, lenient: lenientMarkup }), budgetMs);
          await withTimeout(refreshImages(doc), 30_000);
          const live = (doc.gallery ?? []).filter((row) => row?.url && !isRetiredImage(row.url));
          const need = Math.max(0, perInstitution - live.length);
          if (dryRun) { log(`[dry-run] ${doc.slug} — ${pageCount} pages, ${candidates.length} candidates, has ${live.length}, needs ${need}`); continue; }
          let stored = [];
          if (need && candidates.length) {
            const knownPrints = await printsOfLive(live);
            // New files are numbered after the highest we already have, so nothing is overwritten.
            const startIndex = Math.max(live.length, ...live.map((row) => Number(/photo-(\d+)\./.exec(row.url)?.[1] ?? 0))) + 1;
            stored = await withTimeout(images.processMany(candidates, { slug: doc.slug, kind: 'photo', want: need, domain, startIndex, knownPrints, maxAttempts: deep ? need * 6 + 12 : need * 4 + 8, shouldContinue: inTime }), budgetMs + 30_000);
          }
          const rows = stored.map(({ bytes: _bytes, originalBytes: _originalBytes, ...row }) => row);
          await withTimeout(refreshImages(doc), 30_000);
          const changed = await withTimeout(replaceRetired(doc, { home, domain, stored: rows, images, append: true }), 60_000);
          summary.updated += 1;
          summary.stored += rows.length;
          if (summary.examples.length < 5 && rows[0]) summary.examples.push({ slug: doc.slug, images: rows.length, first: rows[0].url });
          log(`[ok] ${doc.slug} — ${live.length}+${rows.length} photographs from ${pageCount} pages${changed.length ? `, ${changed.join(', ')}` : ''}`);
          continue;
        }
        const { domain, home, candidates } = await withTimeout(gatherCandidates(doc, { fetcher, config }), PER_INSTITUTION_MS);
        if (mode === 'retired') {
          if (dryRun) { log(`[dry-run] ${doc.slug} — ${candidates.length} candidate photographs`); continue; }
          // Every network step is bounded: a download or upload that never answers must not hold a lane
          // (two whole runs once sat idle with every lane stuck on one).
          const stored = candidates.length ? await withTimeout(images.processMany(candidates, { slug: doc.slug, kind: 'photo', want: perInstitution, domain, maxAttempts: perInstitution * 3, shouldContinue: inTime }), PER_INSTITUTION_MS + 30_000) : [];
          const rows = stored.map(({ bytes: _bytes, originalBytes: _originalBytes, ...row }) => row);
          const changed = await withTimeout(replaceRetired(doc, { home, domain, stored: rows, images }), 60_000);
          summary.updated += 1;
          summary.stored += rows.length;
          if (summary.examples.length < 5 && rows[0]) summary.examples.push({ slug: doc.slug, images: rows.length, first: rows[0].url });
          log(`[ok] ${doc.slug} — ${changed.join(', ') || 'nothing to change'}`);
          continue;
        }
        if (!candidates.length) { summary.empty += 1; log(`[none] ${doc.slug} — no usable photographs on the site`); continue; }
        if (dryRun) { log(`[dry-run] ${doc.slug} — ${candidates.length} candidates`); continue; }
        const stored = await images.processMany(candidates, { slug: doc.slug, kind: 'photo', want: perInstitution, domain, maxAttempts: perInstitution * 3 });
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
  await renderer?.close();
  summary.compression = compressionRatio(images.stats);
  return summary;
}
