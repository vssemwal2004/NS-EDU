import { buildRecord, LINK_CATEGORIES, parsePage, pickLinks } from './extract.js';
import { CrawlError } from './fetcher.js';
import { isSameSite, normalizeWebsite, registrableDomain, resolveUrl } from './urls.js';

const categoryOf = (url) => LINK_CATEGORIES.find(([, pattern]) => pattern.test(url.pathname))?.[0] ?? 'other';

async function fetchHome(fetcher, website, domain) {
  try {
    return await fetcher.getPage(website, { domain });
  } catch (error) {
    // Many institutional sites still serve plain http only.
    if (error instanceof CrawlError && error.code === 'network' && website.startsWith('https:')) {
      return fetcher.getPage(website.replace(/^https:/, 'http:'), { domain });
    }
    throw error;
  }
}

/**
 * Crawls one institution's official site: the home page plus up to maxPages-1 keyword-matched
 * internal pages (about, contact, admissions, programmes, accreditation). Home-page failures
 * (robots, off-site redirect, HTTP errors) throw a CrawlError; sub-page failures are recorded.
 */
export async function crawlSource(source, { fetcher, config, courses = [], fetchedAt = new Date() }) {
  const website = normalizeWebsite(source.website);
  if (!website) throw new CrawlError('The source has no valid website', { code: 'http', permanent: true });
  const domain = registrableDomain(new URL(website).hostname);
  const homeResult = await fetchHome(fetcher, website, domain);
  const home = { ...parsePage(homeResult.html, homeResult.url), category: 'home' };
  const visited = [{ url: homeResult.url, category: 'home', ok: true, truncated: homeResult.truncated }];

  const hinted = [source.hints?.pages ?? []].flat().map((href) => resolveUrl(href, homeResult.url))
    .filter((url) => url && isSameSite(url, domain)).map((url) => ({ url: url.toString(), category: categoryOf(url) }));
  const picked = pickLinks(home, { domain, maxLinks: config.maxPages - 1, exclude: [homeResult.url, website, ...hinted.map((item) => item.url)] });
  const pages = [];
  for (const link of [...hinted, ...picked].slice(0, config.maxPages - 1)) {
    try {
      const result = await fetcher.getPage(link.url, { domain });
      pages.push({ ...parsePage(result.html, result.url), category: link.category });
      visited.push({ url: result.url, category: link.category, ok: true, truncated: result.truncated });
    } catch (error) {
      if (!(error instanceof CrawlError)) throw error;
      visited.push({ url: link.url, category: link.category, ok: false, error: error.message });
    }
  }

  const finalHome = new URL(homeResult.url);
  const path = new URL(website).pathname;
  const canonical = `${finalHome.origin}${path === '/' ? '/' : path}`;
  const { record, fields, siteName } = buildRecord({ home, pages, source, domain, website: canonical, courses });
  return { record: { ...record, sourceUrl: homeResult.url, fetchedAt }, fields, siteName, pages: visited, domain };
}

// Product owner's rule: publish only with a name, a state/UT and the official website.
export const shouldPublish = (record) => Boolean(record?.name && record.state && record.website);
export const missingForPublish = (record) => ['name', 'state', 'website', 'city'].filter((key) => !record?.[key]);
