import { isSameSite } from './urls.js';

// Vite/React and similar sites often return only an empty mount point to a normal HTTP client.
// Rendering is deliberately limited to pages that look like such shells; ordinary sites keep the
// cheaper, more polite HTTP-only path.
export function looksClientRendered(html) {
  const source = String(html ?? '');
  const clientRedirect = /<meta\b[^>]*http-equiv=["']?refresh/i.test(source)
    || /(?:window\.)?location\.(?:replace|assign)\s*\(/i.test(source)
    || /(?:window\.)?location(?:\.href)?\s*=\s*["']/i.test(source);
  if (!clientRedirect && !/<script\b[^>]*(?:type=["']module["']|src=)[^>]*>/i.test(source)) return false;
  // Some Vite/React builds put a loading spinner inside #root instead of leaving it literally
  // empty. A mount plus almost no server-rendered text is still a shell; genuinely SSR pages have
  // substantial visible copy and stay on the cheaper HTTP path.
  const appMount = /<(?:div|main)\b[^>]*\bid=["'](?:root|app|__next|___gatsby)["'][^>]*>/i.test(source)
    || /<([a-z][\w-]*(?:-root|-app))\b[^>]*>/i.test(source);
  // A few university roots return HTTP 200 with only a meta/JavaScript redirect to a current
  // same-site subdomain. The HTTP fetcher cannot execute it, while a browser can safely follow it.
  if (!appMount && !clientRedirect) return false;
  const visible = source.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&\w+;/g, ' ').replace(/\s+/g, ' ').trim();
  return visible.length < 500;
}

export function createRenderer({ config, signal, log = () => {} } = {}) {
  const limit = Math.max(1, Math.min(Number(config?.renderConcurrency) || 2, 4));
  const timeout = Math.max(5000, Number(config?.renderTimeoutMs) || 30_000);
  let browserPromise = null;
  let disabled = false;
  let active = 0;
  let warnings = 0;
  const waiters = [];

  const warn = (message) => {
    if (warnings++ < 10) log(`[render skipped] ${message}`);
  };
  const acquire = async (deadlineAt) => {
    if (active < limit) { active += 1; return true; }
    const granted = await new Promise((resolve) => {
      let timer;
      const ready = () => { clearTimeout(timer); resolve(true); };
      waiters.push(ready);
      if (deadlineAt) timer = setTimeout(() => {
        const index = waiters.indexOf(ready);
        if (index !== -1) waiters.splice(index, 1);
        resolve(false);
      }, Math.max(0, deadlineAt - Date.now()));
    });
    if (!granted) return false;
    active += 1;
    return true;
  };
  const release = () => {
    active -= 1;
    waiters.shift()?.();
  };
  const launch = async () => {
    const { chromium } = await import('playwright');
    const preferred = process.env.SCRAPER_BROWSER_CHANNEL?.trim();
    const attempts = [...(preferred ? [{ channel: preferred }] : []), { channel: 'chrome' }, { channel: 'msedge' }, {}];
    let lastError;
    for (const options of attempts) {
      try { return await chromium.launch({ headless: true, ...options }); } catch (error) { lastError = error; }
    }
    throw lastError;
  };
  const browser = async () => {
    if (disabled) return null;
    if (!browserPromise) {
      browserPromise = launch().catch((error) => {
        disabled = true;
        warn(`browser unavailable — ${error.message}`);
        return null;
      });
    }
    return browserPromise;
  };

  async function render(url, { domain, deadlineAt } = {}) {
    if (disabled || signal?.aborted || (deadlineAt && Date.now() >= deadlineAt)) return null;
    if (!await acquire(deadlineAt)) return null;
    let page;
    try {
      const instance = await browser();
      if (!instance) return null;
      page = await instance.newPage({ userAgent: config?.userAgent, locale: 'en-IN' });
      await page.route('**/*', (route) => (['image', 'media', 'font', 'stylesheet'].includes(route.request().resourceType()) ? route.abort() : route.continue()));
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      // Analytics and live widgets often keep the network permanently busy. The rendered nav plus
      // page copy is the useful completion signal; give route data a short settling window after it.
      await page.waitForFunction(() => document.body?.innerText.trim().length > 500, null, { timeout: Math.min(timeout, 8000) }).catch(() => {});
      await page.waitForTimeout(400);
      if (signal?.aborted || (domain && !isSameSite(page.url(), domain))) return null;
      const html = await page.content();
      // Keep the browser's final URL. JavaScript redirects do not update the HTTP fetch result, and
      // resolving a redirected page's relative navigation against the old root silently crawls the
      // wrong paths (for example /courses instead of /portal/courses).
      return looksClientRendered(html) ? null : { html, url: page.url() };
    } catch (error) {
      warn(`${url} — ${error.message}`);
      return null;
    } finally {
      await page?.close().catch(() => {});
      release();
    }
  }

  async function close() {
    const instance = await browserPromise?.catch(() => null);
    await instance?.close().catch(() => {});
  }

  return { render, close };
}
