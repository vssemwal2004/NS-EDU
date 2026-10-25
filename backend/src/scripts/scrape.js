// University data collection from official websites. See src/scraper/README.md.
// Usage: npm run scrape --workspace backend -- <command> [options]
//   import-sources <file.csv|file.json> [--list "Name"]   add/update crawl sources from a seed list
//   enqueue [--all | --stale-days N | --never] [--limit N] [--list "Name"]   queue one job per active source
//   enqueue-quality [--limit N]                         queue the N university profiles with the most content gaps
//   quality-watch [--limit N] [--poll-seconds N] [--once]  enqueue the next quality batch after the current one ends
//   work [--concurrency N] [--max-jobs N] [--watch]         lease and crawl jobs until none are due
//   enrich-images [--limit N] [--slug a,b] [--source-url URL] [--state S] [--all] [--want N] [--concurrency N] [--dry-run]
//                                                           (re)process campus photographs only
//   status                                                  queue counts and the latest run
//   retry-failed | cancel-queued                            queue maintenance
//
// The npm script caps V8's old space at 1 GB. Without a cap a watching worker grows towards the
// default heap limit (a quarter of RAM) because nothing forces a major collection between jobs, and
// a long crawl is then killed by the machine rather than finishing. Run it through `npm run scrape`.
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { env } from '../config/env.js';
import { COLLECTIONS, closeDb, getDb } from '../db/collections.js';
import { compressionRatio } from '../lib/image-pipeline.js';
import { scraperConfig } from '../scraper/config.js';
import { cancelJobs, enqueueQualitySources, enqueueSources, queueStats, retryJobs } from '../scraper/queue.js';
import { importSources, parseSeedList } from '../scraper/sources.js';
import { runWorker } from '../scraper/worker.js';
import { enrichImages } from './enrich-images.js';

const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
const describeImages = (stats) => `${stats.uploaded} images uploaded, ${stats.skipped} skipped, ${stats.failed} failed; `
  + `${mb(stats.originalBytes)} → ${mb(stats.compressedBytes)} (${Math.round(compressionRatio(stats) * 100)}% of the originals)`;

const [command, ...args] = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const flag = (name) => args.includes(`--${name}`);
const positiveInt = (value, name) => {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`--${name} must be a positive whole number`);
  return number;
};

async function importCommand() {
  const file = args.find((arg) => !arg.startsWith('--') && arg !== option('list'));
  if (!file) throw new Error('Usage: import-sources <file.csv|file.json> [--list "Seed list name"]');
  const format = extname(file).toLowerCase() === '.json' ? 'json' : 'csv';
  const rows = parseSeedList(await readFile(file, 'utf8'), format);
  const summary = await importSources(rows, { seedListName: option('list') || basename(file) });
  console.log(`Sources: ${summary.inserted} added, ${summary.updated} updated, ${summary.duplicates} duplicate rows, ${summary.failed} rejected.`);
  for (const item of summary.errors.slice(0, 20)) console.log(`  row ${item.row} ${item.name}: ${Object.values(item.errors).join('; ')}`);
}

async function enqueueCommand() {
  const staleDays = positiveInt(option('stale-days'), 'stale-days');
  const mode = staleDays ? 'stale' : flag('never') ? 'never' : 'all';
  if (!staleDays && !flag('all') && !flag('never')) console.log('No selection flag given; queueing every active source (--all).');
  const result = await enqueueSources({ mode, staleDays, limit: positiveInt(option('limit'), 'limit') ?? 0, seedListName: option('list') ?? '', createdBy: 'cli' });
  console.log(result.runId
    ? `Run ${result.runId}: ${result.queued} jobs queued (${result.alreadyQueued} sources already had an open job).`
    : `Nothing queued: ${result.selected} matching sources, all of them already have an open job.`);
}

async function workCommand() {
  const config = scraperConfig();
  if (!process.env.SCRAPER_USER_AGENT && !process.env.SITE_URL) {
    console.warn('Warning: set SITE_URL (or SCRAPER_USER_AGENT) so site owners can find who is crawling and how to contact you.');
  }
  const controller = new AbortController();
  let stopping = false;
  const stop = (signalName) => {
    if (stopping) { console.log('Forced exit.'); process.exit(130); }
    stopping = true;
    console.log(`${signalName}: finishing up and releasing leased jobs… (press again to force)`);
    controller.abort(new Error('Worker stopped'));
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  const concurrency = positiveInt(option('concurrency'), 'concurrency') ?? config.concurrency;
  console.log(`Worker on "${env.mongodbDatabase}" as ${config.userAgent} — ${concurrency} sites at a time, ≥${config.hostDelayMs} ms between requests per site, ≤${config.maxPages} pages and ≤${config.maxImages} photographs per site.`);
  const stats = await runWorker({
    concurrency, maxJobs: positiveInt(option('max-jobs'), 'max-jobs') ?? Infinity, watch: flag('watch'),
    signal: controller.signal, config, log: (line) => console.log(line),
  });
  console.log(`Finished: ${stats.done} done, ${stats.skipped} skipped, ${stats.failed} failed, ${stats.retrying} scheduled for retry, ${stats.released} released; ${stats.requests} HTTP requests.`);
  if (stats.images) console.log(`Images: ${describeImages(stats.images)}.`);
}

async function enqueueQualityCommand() {
  const limit = positiveInt(option('limit'), 'limit') ?? 100;
  const result = await enqueueQualitySources({ limit, createdBy: `quality-reenrichment-batch-${new Date().toISOString()}` });
  console.log(result.runId
    ? `Run ${result.runId}: ${result.queued}/${result.selected} quality jobs queued; gaps in selection: ${Object.entries(result.gaps).map(([field, count]) => `${field}=${count}`).join(', ')}.`
    : 'Nothing queued: every eligible incomplete profile already has an open job, or no incomplete sourced profile remains.');
}

async function qualityWatchCommand() {
  const limit = positiveInt(option('limit'), 'limit') ?? 100;
  const pollSeconds = positiveInt(option('poll-seconds'), 'poll-seconds') ?? 60;
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  do {
    const database = await getDb();
    const latest = await database.collection(COLLECTIONS.scrapeRuns).findOne(
      { createdBy: { $regex: '^quality-reenrichment-batch-' } },
      { sort: { createdAt: -1, _id: -1 }, projection: { _id: 1, createdBy: 1, total: 1 } },
    );
    const open = latest ? await database.collection(COLLECTIONS.scrapeJobs).countDocuments({
      runId: latest._id, status: { $in: ['queued', 'running'] },
    }) : 0;
    if (open) {
      console.log(`${new Date().toISOString()} quality run ${latest._id} still has ${open}/${latest.total ?? '?'} open jobs.`);
    } else {
      const result = await enqueueQualitySources({
        limit,
        createdBy: `quality-reenrichment-batch-${new Date().toISOString()}`,
      });
      console.log(result.runId
        ? `${new Date().toISOString()} started quality run ${result.runId}: ${result.queued}/${result.selected} jobs.`
        : `${new Date().toISOString()} no eligible incomplete sourced profile is currently available.`);
    }
    if (flag('once') || stopping) break;
    await new Promise((resolve) => setTimeout(resolve, pollSeconds * 1000));
  } while (!stopping);
}

async function enrichImagesCommand() {
  const controller = new AbortController();
  process.on('SIGINT', () => controller.abort(new Error('Stopped')));
  const slugs = (option('slug') ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  const sourceUrl = option('source-url') ?? '';
  if (sourceUrl && slugs.length !== 1) throw new Error('--source-url requires exactly one --slug');
  const summary = await enrichImages({
    slugs, sourceUrl,
    state: option('state') ?? '',
    limit: positiveInt(option('limit'), 'limit') ?? 50,
    want: positiveInt(option('want'), 'want'),
    concurrency: positiveInt(option('concurrency'), 'concurrency'),
    mode: flag('all') ? 'all' : 'missing',
    dryRun: flag('dry-run'),
    signal: controller.signal,
    log: (line) => console.log(line),
  });
  console.log(`Selected ${summary.selected} institutions: ${summary.updated} updated, ${summary.empty} with no usable photograph, ${summary.failed} failed.`);
  console.log(`Images: ${describeImages(summary.images)}.`);
  for (const example of summary.examples) console.log(`  ${example.slug}: ${example.images} photographs, first ${example.first}`);
}

async function statusCommand() {
  const stats = await queueStats();
  console.log(`Sources: ${stats.sources.total} (${stats.sources.active} active, ${stats.sources.paused} paused, ${stats.sources.blocked} blocked, ${stats.sources.neverCrawled} never crawled)`);
  console.table(stats.jobs);
  console.log(`Due now: ${stats.dueNow}. Workers with leased jobs: ${stats.workers.length ? stats.workers.map((worker) => `${worker.id} (${worker.jobs})`).join(', ') : 'none'}.`);
  if (stats.lastRun) console.log(`Last run ${stats.lastRun.id} (${stats.lastRun.mode}, ${new Date(stats.lastRun.createdAt).toISOString()}):`, stats.lastRun.counts);
}

const commands = {
  'import-sources': importCommand,
  enqueue: enqueueCommand,
  'enqueue-quality': enqueueQualityCommand,
  'quality-watch': qualityWatchCommand,
  work: workCommand,
  'enrich-images': enrichImagesCommand,
  status: statusCommand,
  'retry-failed': async () => console.log(await retryJobs({ status: 'failed' })),
  'cancel-queued': async () => console.log(await cancelJobs({})),
};

try {
  if (!commands[command]) {
    console.log('Commands: import-sources <file>, enqueue [--all|--stale-days N|--never] [--limit N], enqueue-quality [--limit N], quality-watch [--limit N] [--poll-seconds N] [--once], work [--concurrency N] [--max-jobs N] [--watch], enrich-images [--limit N] [--slug a,b] [--source-url URL] [--all] [--dry-run], status, retry-failed, cancel-queued');
    process.exitCode = command ? 1 : 0;
  } else {
    await commands[command]();
  }
} catch (error) {
  console.error(`scrape ${command} failed:`, error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
