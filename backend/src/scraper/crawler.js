import { slugify } from '../lib/validation.js';
import { buildRecord, LINK_CATEGORIES, parsePage, pickLinks } from './extract.js';
import { documentPage, pickDocuments, readPdf } from './documents.js';
import { CrawlError } from './fetcher.js';
import { looksClientRendered } from './renderer.js';
import { isSameSite, normalizeWebsite, registrableDomain, resolveUrl } from './urls.js';

const categoryOf = (url) => LINK_CATEGORIES.find(([, pattern]) => pattern.test(url.pathname))?.[0] ?? 'other';
// An amount or package printed on a page: ₹/Rs/INR figures, Indian-grouped rupees, or "8.5 LPA".
const PRINTS_FIGURES = /(?:₹|\brs\.?|\binr)\s*\d|\d{1,2},\d{2},\d{3}|\d\s*(?:lpa|lakhs?|lacs?)\b/i;
// A broken or encrypted PDF must not fail the crawl, but a stopped worker must still stop.
const signalAborted = (error) => error?.name === 'AbortError' || (error?.message === 'Worker stopped');

// Some official sites render their navigation entirely in JavaScript, leaving the downloaded home
// page with no crawlable links. Probe a small, conventional set only in that case; every request
// still goes through robots.txt, per-host throttling, the same-domain rule and the page budget.
const SPARSE_HOME_PATHS = [
  ['/about-us', 'about'],
  ['/about', 'about'],
  ['/academics/programmes', 'programmes'],
  ['/courses', 'programmes'],
  ['/placements', 'placement'],
  ['/campus-life', 'campus'],
  ['/gallery', 'campus'],
  ['/contact-us', 'contact'],
];

async function fetchHome(fetcher, website, domain) {
  const original = new URL(website);
  const candidates = [original];
  // A common directory-data defect is a www host with no DNS record even though the official apex
  // host is healthy. The apex is still the exact same registrable institution domain.
  if (original.hostname.startsWith('www.')) {
    const apex = new URL(original);
    apex.hostname = apex.hostname.slice(4);
    candidates.push(apex);
  }
  // Many institutional sites still serve plain http only. Try it only after HTTPS candidates.
  if (original.protocol === 'https:') {
    for (const candidate of [...candidates]) {
      const plain = new URL(candidate);
      plain.protocol = 'http:';
      candidates.push(plain);
    }
  }
  let lastError;
  for (const candidate of candidates) {
    try {
      return await fetcher.getPage(candidate, { domain });
    } catch (error) {
      lastError = error;
      if (!(error instanceof CrawlError) || error.code !== 'network') throw error;
    }
  }
  throw lastError;
}

async function renderedPage(result, renderer, domain, deadlineAt) {
  if (!renderer || !looksClientRendered(result.html)) return { ...result, rendered: false };
  const rendered = await renderer.render(result.url, { domain, deadlineAt });
  if (!rendered) return { ...result, rendered: false };
  // String support keeps injected/test renderers simple; the production renderer also returns the
  // final browser URL after client-side navigation.
  return typeof rendered === 'string'
    ? { ...result, html: rendered, rendered: true }
    : { ...result, html: rendered.html, url: rendered.url || result.url, rendered: true };
}

/**
 * Crawls one institution's official site: the home page plus up to maxPages-1 keyword-matched
 * internal pages (about, contact, admissions, programmes, accreditation). Home-page failures
 * (robots, off-site redirect, HTTP errors) throw a CrawlError; sub-page failures are recorded.
 */
export async function crawlSource(source, { fetcher, config, courses = [], fetchedAt = new Date(), images = null, renderer = null, deadlineAt = null }) {
  const website = normalizeWebsite(source.website);
  if (!website) throw new CrawlError('The source has no valid website', { code: 'http', permanent: true });
  const domain = registrableDomain(new URL(website).hostname);
  const enoughTime = () => !deadlineAt || Date.now() + config.timeoutMs + 1000 < deadlineAt;
  const homeResult = await renderedPage(await fetchHome(fetcher, website, domain), renderer, domain, deadlineAt);
  const maxPages = homeResult.rendered ? Math.min(config.maxPages, config.renderMaxPages ?? 9) : config.maxPages;
  const home = { ...parsePage(homeResult.html, homeResult.url), category: 'home' };
  const visited = [{ url: homeResult.url, category: 'home', ok: true, truncated: homeResult.truncated, ...(homeResult.rendered ? { rendered: true } : {}) }];

  const hinted = [source.hints?.pages ?? []].flat().map((href) => resolveUrl(href, homeResult.url))
    .filter((url) => url && isSameSite(url, domain)).map((url) => ({ url: url.toString(), category: categoryOf(url) }));
  const picked = pickLinks(home, { domain, maxLinks: maxPages - 1, exclude: [homeResult.url, website, ...hinted.map((item) => item.url)] });
  const fallback = hinted.length || picked.length ? [] : SPARSE_HOME_PATHS.map(([path, category]) => ({
    url: new URL(path, homeResult.url).toString(), category,
  }));
  const pages = [];
  // A fee or placement page whose HTML prints no figure and no table often fills them in with
  // JavaScript (fee tables shipped as JSON to a React/Next.js component). Only those two kinds of
  // page are rendered in the browser on that evidence; every other page keeps the HTTP-only path.
  const fetchInto = async (link) => {
    try {
      const figures = ['fees', 'placement'].includes(link.category);
      let result = await renderedPage(await fetcher.getPage(link.url, { domain }), renderer, domain, deadlineAt);
      let page = parsePage(result.html, result.url, { embedded: figures });
      const printsFigures = (candidate) => candidate.tables.length || candidate.lines.some((line) => PRINTS_FIGURES.test(line))
        || candidate.embeddedLines.some((line) => /\b(fee|tuition|package|ctc|placed)\b/i.test(line));
      if (renderer && !result.rendered && figures && !printsFigures(page) && enoughTime()) {
        const rendered = await renderer.render(result.url, { domain, deadlineAt });
        if (rendered) {
          result = { ...result, html: typeof rendered === 'string' ? rendered : rendered.html, url: rendered.url || result.url, rendered: true };
          page = parsePage(result.html, result.url, { embedded: true });
        }
      }
      pages.push({ ...page, category: link.category });
      visited.push({ url: result.url, category: link.category, ok: true, truncated: result.truncated, ...(result.rendered ? { rendered: true } : {}) });
    } catch (error) {
      if (!(error instanceof CrawlError)) throw error;
      visited.push({ url: link.url, category: link.category, ok: false, error: error.message });
    }
  };
  for (const link of [...hinted, ...picked, ...fallback].slice(0, maxPages - 1)) {
    if (!enoughTime()) break;
    await fetchInto(link);
  }

  // Most institutions link their fee structure from Admissions, and their year-wise placement record
  // from the placement cell's page, not from the home page — so a crawl that only follows home-page
  // links never sees the figures. One extra hop from the pages already fetched: a fee page when none
  // was reached, and the placement record/statistics pages one level below the placement page.
  const reached = new Set(pages.map((page) => page.category));
  const spare = maxPages - 1 - pages.length;
  if (spare > 0) {
    const seen = [homeResult.url, website, ...visited.map((page) => page.url)];
    const feeHubs = reached.has('fees') ? [] : pages.filter((page) => ['admission', 'programmes', 'accreditation'].includes(page.category));
    const fees = feeHubs.flatMap((hub) => pickLinks(hub, { domain, maxLinks: 4, exclude: seen })).filter((link) => link.category === 'fees').slice(0, 2);
    const placementHubs = pages.filter((page) => page.category === 'placement');
    const records = placementHubs.flatMap((hub) => pickLinks(hub, { domain, maxLinks: 8, exclude: seen }))
      .filter((link) => link.category === 'placement' && /record|statistic|stats|report|highlight|20\d\d|batch|year/i.test(link.url)).slice(0, 2);
    const second = [...new Map([...fees, ...records].map((link) => [link.url, link])).values()].slice(0, Math.min(spare, 3));
    for (const link of second) {
      if (!enoughTime()) break;
      await fetchInto(link);
    }
  }

  // Fee structures and placement reports are commonly PDFs. They are read only when the pages did
  // not already print the figures, at most `maxDocuments` per site, under the same robots.txt,
  // per-host delay, same-domain and size rules as pages.
  const documents = [];
  if ((config.maxDocuments ?? 0) > 0 && enoughTime()) {
    const printsFees = pages.some((page) => page.category === 'fees' && page.lines.some((line) => /(?:₹|rs\.?|inr)\s*\d/i.test(line) && /b\.?\s?tech|b\.?\s?sc|m\.?\s?b\.?\s?a|b\.?\s?com|b\.?\s?a\b|bachelor|master|diploma|ph\.?\s?d/i.test(line)));
    const printsPlacements = pages.some((page) => page.category === 'placement' && page.lines.some((line) => /\d\s*(lpa|lakhs?|lacs?)\b/i.test(line) && /20\d\d/.test(line)));
    const want = { fees: printsFees ? 0 : 2, placement: printsPlacements ? 0 : 1 };
    const picked = pickDocuments([home, ...pages], { domain, want }).slice(0, config.maxDocuments);
    for (const document of picked) {
      if (!enoughTime()) break;
      try {
        const file = await fetcher.getFile(document.url, { domain, accept: 'application/pdf,*/*;q=0.1', types: ['application/pdf', 'application/octet-stream', 'binary/octet-stream', 'application/x-pdf'], maxBytes: config.maxDocumentBytes ?? 6 * 1024 * 1024 });
        if (file.body.subarray(0, 5).toString('latin1') !== '%PDF-') throw new CrawlError('Not a PDF file', { code: 'not-allowed-type', permanent: true });
        const rows = await readPdf(file.body, { maxPages: config.maxDocumentPages ?? 15 });
        const page = documentPage(rows, { url: file.url, category: document.category });
        // Kept apart from the document's own title: link text is often generic ("Fee Structure",
        // "View") or names a different programme than the file, so it is only a fallback.
        if (document.linkText) page.linkText = document.linkText;
        documents.push(page);
        visited.push({ url: file.url, category: document.category, ok: true, document: 'pdf', rows: rows.length });
      } catch (error) {
        if (signalAborted(error)) throw error;
        visited.push({ url: document.url, category: document.category, ok: false, document: 'pdf', error: error.message });
      }
    }
    pages.push(...documents);
  }

  const finalHome = new URL(homeResult.url);
  const path = new URL(website).pathname;
  const canonical = `${finalHome.origin}${path === '/' ? '/' : path}`;
  const { record, fields, siteName, imageCandidates } = buildRecord({ home, pages, source, domain, website: canonical, courses });

  // Campus photographs: downloaded through the same polite fetcher, verified, compressed and
  // re-hosted. Failures never fail the crawl — the record is saved without them.
  const want = Math.max(0, Math.min(config.maxImages ?? 0, 12));
  const slug = source.institutionSlug || slugify(source.name) || slugify(domain);
  // The crest is the first thing a student recognises in a results row, so it is re-hosted like the
  // photographs instead of being hot-linked: an institution's own http:// URL is blocked outright by
  // the site's image policy, and the rest load at whatever speed that server manages.
  if (images?.enabled && slug && record.logoUrl && enoughTime()) {
    const stored = await images.process({ url: record.logoUrl, slug, kind: 'logo', domain, sourcePage: homeResult.url });
    if (stored?.url) record.logoUrl = stored.url;
    else if (record.logoUrl.startsWith('http:')) delete record.logoUrl; // insecure and unusable
  }
  if (images?.enabled && want && slug && imageCandidates.length && enoughTime()) {
    const stored = await images.processMany(imageCandidates, { slug, kind: 'photo', want, domain, shouldContinue: enoughTime });
    if (stored.length) {
      record.gallery = stored.map(({ bytes: _bytes, originalBytes: _originalBytes, ...row }) => row);
      // The cover runs the width of the profile header. A home-page carousel slide is usually a
      // notice or a chart, so prefer a wide picture taken from the campus or about pages — those
      // are the ones that actually show the place. The first photograph remains the fallback.
      const categoryOfPage = new Map(visited.map((page) => [page.url, page.category]));
      const isWide = (photo) => photo.width && photo.height && photo.width / photo.height >= 1.5;
      const recentFirst = stored.toSorted((a, b) => (b.year ?? 0) - (a.year ?? 0));
      const fromCampus = recentFirst.find((photo) => isWide(photo) && ['campus', 'about'].includes(categoryOfPage.get(photo.sourcePage)));
      record.coverUrl ||= (fromCampus ?? recentFirst.find(isWide) ?? stored[0]).url;
      fields.push('gallery', 'coverUrl');
    }
  }
  // The source knows which institution it was built from; naming it stops the upsert from having to
  // guess from the domain, which merges constituent colleges that share one hostname.
  const target = source.institutionSlug ? { slug: source.institutionSlug } : {};
  return { record: { ...record, ...target, sourceUrl: homeResult.url, fetchedAt }, fields, siteName, pages: visited, domain, imageCandidates };
}

// Product owner's rule: publish only with a name, a state/UT and the official website.
export const shouldPublish = (record) => Boolean(record?.name && record.state && record.website);
export const missingForPublish = (record) => ['name', 'state', 'website', 'city'].filter((key) => !record?.[key]);
