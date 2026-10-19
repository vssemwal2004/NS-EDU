import '../config/env.js';

const integer = (name, fallback, min, max) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
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
    maxImages: integer('SCRAPER_MAX_IMAGES', 8, 0, 12),
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
    ...overrides,
  };
}
