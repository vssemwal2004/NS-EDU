import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { COLLECTIONS, getDb } from '../db/collections.js';
import { createImagePipeline } from '../lib/image-pipeline.js';
import { upsertUniversities } from '../modules/universities/university-service.js';
import { scraperConfig } from './config.js';
import { crawlSource, missingForPublish, shouldPublish } from './crawler.js';
import { CrawlError, createFetcher, sleep } from './fetcher.js';
import { createRenderer } from './renderer.js';
import { extendLease, failJob, finishJob, leaseJob, releaseJob } from './queue.js';

const SKIP_CODES = new Set(['robots', 'crawl-delay', 'not-html']);

export async function loadCourses() {
  return (await getDb()).collection(COLLECTIONS.courses).find({ active: { $ne: false } }, { projection: { _id: 0, slug: 1, name: 1, fullName: 1, aliases: 1 } }).toArray();
}

const describeErrors = (errors) => Object.entries(errors ?? {}).map(([field, message]) => `${field}: ${message}`).join('; ');

// A retry should have a better chance than the attempt that already exhausted the whole-job
// budget. Keep the first crawl rich; progressively trim secondary pages and photographs while
// retaining the home page and core about/programme/placement discovery. Later quality batches can
// revisit any remaining gaps instead of losing the entire institution repeatedly.
export function crawlConfigFor(job, config) {
  const attempt = Math.max(1, Number(job?.attempts) || 1);
  if (attempt === 1) return config;
  const budget = attempt === 2 ? { pages: 12, images: 6 }
    : attempt === 3 ? { pages: 8, images: 4 }
      : { pages: 5, images: 2 };
  return {
    ...config,
    maxPages: Math.min(config.maxPages, budget.pages),
    maxImages: Math.min(config.maxImages, budget.images),
    renderMaxPages: Math.min(config.renderMaxPages, budget.pages),
  };
}

// A site that answers every request just under the per-request timeout can hold a lane for hours.
// The abandoned crawl finishes into nothing; the job goes back to the queue and is retried later.
export async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new CrawlError(`The site did not finish within ${Math.round(ms / 1000)} s`, { code: 'network' })), ms);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

// Crawls one leased job and writes the result through upsertUniversities (the only write path).
/** An image pipeline that downloads through the crawler's polite fetcher (robots + per-host delay). */
export function pipelineFor(fetcher, { config, log } = {}) {
  return createImagePipeline({
    log,
    download: async (url, options) => {
      const result = await fetcher.getFile(url, { domain: options.domain, types: options.types, maxBytes: options.maxBytes ?? config?.maxImageBytes, cdn: true });
      return { contentType: result.contentType, body: result.body, lastModified: result.lastModified };
    },
  });
}

export async function processJob(job, { fetcher, config, courses, workerId, images = null, renderer = null, now = () => new Date() }) {
  const database = await getDb();
  const source = await database.collection(COLLECTIONS.scrapeSources).findOne({ _id: job.sourceId });
  if (!source || source.status !== 'active') {
    const error = source ? `Source is ${source.status}` : 'Source was deleted';
    await finishJob(job, workerId, { status: 'skipped', error });
    return { status: 'skipped', error };
  }
  let crawl;
  try {
    const crawlConfig = crawlConfigFor(job, config);
    // Stop scheduling secondary work shortly before the hard timeout. Individual requests still
    // have their own timeout, so the remaining margin lets the crawl return and persist partial data.
    const deadlineAt = Date.now() + Math.max(1000, config.jobTimeoutMs - Math.max(20_000, config.timeoutMs + 5000));
    crawl = await withTimeout(crawlSource(source, {
      fetcher, config: crawlConfig, courses, images, renderer, fetchedAt: now(), deadlineAt,
    }), config.jobTimeoutMs);
  } catch (error) {
    if (error instanceof CrawlError && SKIP_CODES.has(error.code)) {
      await finishJob(job, workerId, { status: 'skipped', error: error.message, result: { reason: error.code } });
      return { status: 'skipped', error: error.message };
    }
    throw error;
  }
  const publish = shouldPublish(crawl.record);
  const summary = await upsertUniversities([crawl.record], { source: { kind: 'scrape', name: 'Official website', url: crawl.record.sourceUrl }, publish });
  const item = summary.items[0];
  const result = {
    slug: item?.slug ?? null, action: item?.action ?? 'failed', published: item?.action === 'inserted' ? publish : null, publishable: publish,
    fields: crawl.fields, changed: item?.fields ?? [], missing: missingForPublish(crawl.record), siteName: crawl.siteName,
    sourceUrl: crawl.record.sourceUrl, pages: crawl.pages, images: crawl.record.gallery?.length ?? 0,
  };
  if (!item) {
    const error = `Not saved (${describeErrors(summary.errors[0]?.errors)}). Add the missing values to the source and retry.`;
    await finishJob(job, workerId, { status: 'failed', error, result });
    return { status: 'failed', error, result };
  }
  await database.collection(COLLECTIONS.scrapeSources).updateOne({ _id: source._id }, { $set: { institutionSlug: item.slug } });
  await finishJob(job, workerId, { status: 'done', result });
  return { status: 'done', result };
}

/**
 * Worker loop: `concurrency` lanes each lease a job, crawl it and record the outcome, until the
 * queue has nothing due (or `maxJobs` is reached). With `watch`, idle lanes poll instead of exiting.
 * Aborting `signal` stops new leases and hands in-flight jobs back to the queue.
 */
export async function runWorker({
  concurrency, maxJobs = Infinity, signal, fetchImpl, watch = false, pollMs = 30_000, log = () => {},
  workerId = `${hostname()}:${process.pid}:${randomBytes(3).toString('hex')}`, config = scraperConfig(), wait = sleep,
} = {}) {
  const lanes = Math.max(1, Math.min(Number(concurrency) || config.concurrency, 64));
  const courses = await loadCourses();
  const fetcher = createFetcher({ config, fetchImpl, signal, wait });
  // One pipeline per worker so the compression totals cover the whole run.
  const images = config.maxImages ? pipelineFor(fetcher, { config, log }) : null;
  const renderer = config.renderJs ? createRenderer({ config, signal, log }) : null;
  const stats = { workerId, leased: 0, done: 0, skipped: 0, failed: 0, retrying: 0, released: 0 };

  async function lane() {
    while (!signal?.aborted && stats.leased < maxJobs) {
      stats.leased += 1; // reserve the slot before awaiting so lanes never exceed maxJobs
      const job = await leaseJob(workerId, { leaseMs: config.leaseMs });
      if (!job) {
        stats.leased -= 1;
        if (!watch) return;
        try { await wait(pollMs, signal); } catch { return; }
        continue;
      }
      const heartbeat = setInterval(() => { extendLease(job, workerId, { leaseMs: config.leaseMs }).catch(() => {}); }, Math.max(1000, config.leaseMs / 3));
      heartbeat.unref?.();
      try {
        const outcome = await processJob(job, { fetcher, config, courses, workerId, images, renderer });
        stats[outcome.status] += 1;
        log(`[${outcome.status}] ${job.name} <${job.website}>${outcome.result?.slug ? ` → ${outcome.result.slug} (${outcome.result.action}${outcome.result.published === false ? ', held for review' : ''})` : ''}${outcome.error ? ` — ${outcome.error}` : ''}`);
      } catch (error) {
        if (signal?.aborted) {
          await releaseJob(job, workerId).catch(() => {});
          stats.released += 1;
          log(`[released] ${job.name} <${job.website}>`);
        } else {
          const outcome = await failJob(job, workerId, error);
          stats[outcome.final ? 'failed' : 'retrying'] += 1;
          log(`[${outcome.final ? 'failed' : 'retry'}] ${job.name} <${job.website}> — ${error.message}${outcome.nextRunAt ? ` (next attempt ${outcome.nextRunAt.toISOString()})` : ''}`);
        }
      } finally {
        clearInterval(heartbeat);
      }
    }
  }

  await Promise.all(Array.from({ length: lanes }, lane));
  await renderer?.close();
  stats.requests = fetcher.stats.requests;
  if (images) stats.images = images.stats;
  return stats;
}
