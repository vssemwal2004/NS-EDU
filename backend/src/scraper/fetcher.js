import { ALLOW_ALL, parseRobots, robotsPolicy } from './robots.js';
import { isInstitutionCdn, isSameSite, registrableDomain, resolveUrl } from './urls.js';

export class CrawlError extends Error {
  // code: robots | offsite | http | not-html | network | robots-unavailable | crawl-delay
  constructor(message, { code, permanent = false, status = null } = {}) {
    super(message);
    this.name = 'CrawlError';
    this.code = code;
    this.permanent = permanent;
    this.status = status;
  }
}

const HTML_TYPES = /^(text\/html|application\/xhtml\+xml)\b/i;

export const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(signal.reason); return; }
  const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
  function onAbort() { clearTimeout(timer); reject(signal.reason); }
  signal?.addEventListener('abort', onAbort, { once: true });
});

async function readLimited(response, maxBytes) {
  const charset = /charset=["']?([\w-]+)/i.exec(response.headers.get('content-type') ?? '')?.[1];
  let decoder;
  try { decoder = new TextDecoder(charset || 'utf-8'); } catch { decoder = new TextDecoder('utf-8'); }
  if (!response.body) return { text: '', truncated: false };
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = maxBytes - size;
    chunks.push(value.byteLength > room ? value.subarray(0, room) : value);
    size += Math.min(value.byteLength, room);
    if (size >= maxBytes) { truncated = true; await reader.cancel().catch(() => {}); break; }
  }
  return { text: decoder.decode(Buffer.concat(chunks)), truncated };
}

// Binary bodies are never truncated: half an image is useless, so an over-sized one is refused.
async function readBytes(response, maxBytes) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new CrawlError(`File is larger than ${Math.round(maxBytes / 1024)} KB`, { code: 'too-large', permanent: true });
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Polite HTTP client for one worker process: identifies itself, honours robots.txt per origin,
 * keeps a minimum gap between requests to the same host, caps time and size, and never leaves
 * the institution's registrable domain (redirects included).
 */
export function createFetcher({ config, fetchImpl = globalThis.fetch, wait = sleep, now = Date.now, signal } = {}) {
  const robotsCache = new Map();
  const nextSlot = new Map();
  const hostDelay = new Map();
  const headers = { 'user-agent': config.userAgent, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', 'accept-language': 'en-IN,en;q=0.8' };
  const stats = { requests: 0 };

  // Keyed by registrable domain, so www.x.ac.in and x.ac.in share one politeness budget.
  async function throttle(hostname) {
    const host = registrableDomain(hostname);
    const delay = Math.max(config.hostDelayMs, hostDelay.get(host) ?? 0);
    const at = Math.max(now(), nextSlot.get(host) ?? 0);
    nextSlot.set(host, at + delay);
    const pause = at - now();
    if (pause > 0) await wait(pause, signal);
  }

  async function request(url, accept) {
    await throttle(url.hostname);
    const timeout = AbortSignal.timeout(config.timeoutMs);
    stats.requests += 1;
    try {
      return await fetchImpl(url.toString(), {
        redirect: 'manual',
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: accept ? { ...headers, accept } : headers,
      });
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error;
      throw new CrawlError(timeout.aborted ? `Timed out after ${config.timeoutMs} ms` : `Network error: ${error.cause?.code || error.message}`, { code: 'network' });
    }
  }

  // RFC 9309: 4xx means "no rules"; 5xx or unreachable means "assume everything is disallowed".
  async function loadRobots(origin, domain) {
    let url = new URL('/robots.txt', origin);
    for (let hop = 0; hop <= config.maxRedirects; hop += 1) {
      const response = await request(url, 'text/plain,*/*;q=0.1');
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel().catch(() => {});
        const next = resolveUrl(location, url);
        if (!next || !isSameSite(next, domain)) return ALLOW_ALL;
        url = next;
        continue;
      }
      if (response.ok) {
        const { text } = await readLimited(response, 500 * 1024);
        return robotsPolicy(parseRobots(text), config.robotsToken);
      }
      await response.body?.cancel().catch(() => {});
      if (response.status === 429 || response.status >= 500) throw new CrawlError(`robots.txt returned HTTP ${response.status}`, { code: 'robots-unavailable', status: response.status });
      return ALLOW_ALL;
    }
    return ALLOW_ALL;
  }

  async function robotsFor(url, domain) {
    const origin = url.origin;
    if (!robotsCache.has(origin)) {
      const pending = loadRobots(origin, domain).then((policy) => {
        const host = registrableDomain(url.hostname);
        if (policy.crawlDelayMs > (hostDelay.get(host) ?? 0)) {
          hostDelay.set(host, policy.crawlDelayMs);
          nextSlot.set(host, Math.max(nextSlot.get(host) ?? 0, now() + policy.crawlDelayMs));
        }
        return policy;
      });
      robotsCache.set(origin, pending);
      pending.catch(() => robotsCache.delete(origin));
    }
    return robotsCache.get(origin);
  }

  async function getPage(href, { domain }) {
    let url = href instanceof URL ? href : resolveUrl(href);
    if (!url) throw new CrawlError(`Invalid URL: ${href}`, { code: 'http', permanent: true });
    for (let hop = 0; hop <= config.maxRedirects; hop += 1) {
      if (!isSameSite(url, domain)) throw new CrawlError(`Leaves the institution's domain: ${url.hostname}`, { code: 'offsite', permanent: true });
      const policy = await robotsFor(url, domain);
      if (policy.crawlDelayMs > config.maxCrawlDelayMs) throw new CrawlError(`Crawl-delay of ${policy.crawlDelayMs / 1000}s is above our limit`, { code: 'crawl-delay', permanent: true });
      if (!policy.isAllowed(`${url.pathname}${url.search}`)) throw new CrawlError(`robots.txt disallows ${url.pathname}`, { code: 'robots', permanent: true });
      const response = await request(url);
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel().catch(() => {});
        const next = resolveUrl(location, url);
        if (!next) throw new CrawlError('Invalid redirect', { code: 'http', permanent: true });
        url = next;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new CrawlError(`HTTP ${response.status}`, { code: 'http', status: response.status, permanent: [404, 410].includes(response.status) });
      }
      if (!HTML_TYPES.test(response.headers.get('content-type') ?? 'text/html')) {
        await response.body?.cancel().catch(() => {});
        throw new CrawlError('Not an HTML page', { code: 'not-html', permanent: true });
      }
      const { text, truncated } = await readLimited(response, config.maxBytes);
      return { url: url.toString(), status: response.status, html: text, truncated };
    }
    throw new CrawlError('Too many redirects', { code: 'http', permanent: true });
  }

  /**
   * Downloads a non-HTML file (an image) under the same rules as a page: robots.txt, the per-host
   * delay, the institution's own domain only, and a hard size cap. Used by the image pipeline so
   * photographs are fetched as politely as pages are.
   */
  async function getFile(href, { domain, accept = 'image/*', types, maxBytes = 8 * 1024 * 1024, cdn = false }) {
    let url = href instanceof URL ? href : resolveUrl(href);
    if (!url) throw new CrawlError(`Invalid URL: ${href}`, { code: 'http', permanent: true });
    for (let hop = 0; hop <= config.maxRedirects; hop += 1) {
      // `cdn` admits the institution's own CDN host for photographs (see isInstitutionCdn).
      if (!isSameSite(url, domain) && !(cdn && isInstitutionCdn(url, domain))) throw new CrawlError(`Leaves the institution's domain: ${url.hostname}`, { code: 'offsite', permanent: true });
      const policy = await robotsFor(url, domain);
      if (!policy.isAllowed(`${url.pathname}${url.search}`)) throw new CrawlError(`robots.txt disallows ${url.pathname}`, { code: 'robots', permanent: true });
      const response = await request(url, accept);
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel().catch(() => {});
        const next = resolveUrl(location, url);
        if (!next) throw new CrawlError('Invalid redirect', { code: 'http', permanent: true });
        url = next;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new CrawlError(`HTTP ${response.status}`, { code: 'http', status: response.status, permanent: [404, 410].includes(response.status) });
      }
      const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      // Some servers send files with no type or as a generic byte stream; the caller decodes the
      // bytes and refuses anything that is not what it asked for, so those are let through.
      const untyped = !contentType || /^(application|binary)\/octet-stream$/.test(contentType);
      if (types && !untyped && !types.includes(contentType)) {
        await response.body?.cancel().catch(() => {});
        throw new CrawlError(`Unsupported content type: ${contentType || 'unknown'}`, { code: 'not-allowed-type', permanent: true });
      }
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > maxBytes) {
        await response.body?.cancel().catch(() => {});
        throw new CrawlError(`File is larger than ${Math.round(maxBytes / 1024)} KB`, { code: 'too-large', permanent: true });
      }
      return { url: url.toString(), status: response.status, contentType, lastModified: response.headers.get('last-modified') ?? '', body: await readBytes(response, maxBytes) };
    }
    throw new CrawlError('Too many redirects', { code: 'http', permanent: true });
  }

  return { getPage, getFile, robotsFor, stats };
}
