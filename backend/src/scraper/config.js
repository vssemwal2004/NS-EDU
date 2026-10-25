import '../config/env.js';

const integer = (name, fallback, min, max) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
};
const boolean = (name, fallback) => {
  const value = process.env[name]?.trim().toLowerCase();
  return value === undefined ? fallback : !['0', 'false', 'no', 'off'].includes(value);
};

const defaultUserAgent = () => {
  const site = process.env.SITE_URL?.trim().replace(/\/+$/, '');
  return site ? `GyaanVidhyaBot/1.0 (+${site}/bot)` : 'GyaanVidhyaBot/1.0';
};

// Read on demand so tests and the CLI can override values through process.env.
export function scraperConfig(overrides = {}) {
  return {
    userAgent: process.env.SCRAPER_USER_AGENT?.trim() || defaultUserAgent(),
    robotsToken: 'GyaanVidhyaBot',
    // Sites in flight at once, never requests to one site: the queue lets one job per domain run.
    concurrency: integer('SCRAPER_CONCURRENCY', 8, 1, 64),
    hostDelayMs: integer('SCRAPER_HOST_DELAY_MS', 3000, 1000, 120_000),
    maxPages: integer('SCRAPER_MAX_PAGES', 18, 1, 40),
    // Campus photographs downloaded per institution (0 turns the image pipeline off).
    maxImages: integer('SCRAPER_MAX_IMAGES', 12, 0, 12),
    // Fee-structure and placement-report PDFs read per site when the pages print no figures
    // (0 turns this off). Size and page caps keep one large prospectus from stalling a lane.
    maxDocuments: integer('SCRAPER_MAX_DOCUMENTS', 3, 0, 6),
    // Prospectus-style fee PDFs with photographs run to 10 MB+; only the first pages are parsed.
    maxDocumentBytes: 15 * 1024 * 1024,
    maxDocumentPages: 15,
    timeoutMs: integer('SCRAPER_TIMEOUT_MS', 15_000, 2000, 60_000),
    // Whole-job budget. Per-request timeouts cannot bound a site that answers every request slowly,
    // and one such site would otherwise hold a worker lane for ever.
    jobTimeoutMs: integer('SCRAPER_JOB_TIMEOUT_MS', 8 * 60_000, 30_000, 60 * 60_000),
    maxBytes: 2 * 1024 * 1024,
    maxImageBytes: 8 * 1024 * 1024,
    maxRedirects: 5,
    maxAttempts: 4,
    leaseMs: 5 * 60_000,
    // Crawl-delay values above this are honoured by skipping the site instead of tying up a worker.
    maxCrawlDelayMs: 60_000,
    // Render only recognisable empty JavaScript app shells. The small separate limit prevents a
    // 50-lane HTTP worker from opening 50 browser pages at once.
    renderJs: boolean('SCRAPER_RENDER_JS', true),
    renderConcurrency: integer('SCRAPER_RENDER_CONCURRENCY', 2, 1, 4),
    renderTimeoutMs: integer('SCRAPER_RENDER_TIMEOUT_MS', 15_000, 5000, 60_000),
    renderMaxPages: integer('SCRAPER_RENDER_MAX_PAGES', 9, 2, 12),
    ...overrides,
  };
}
