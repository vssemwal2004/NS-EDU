// University data collection from official websites. See src/scraper/README.md.
// Usage: npm run scrape --workspace backend -- <command> [options]
//   import-sources <file.csv|file.json> [--list "Name"]   add/update crawl sources from a seed list
//   enqueue [--all | --stale-days N | --never] [--limit N] [--list "Name"]   queue one job per active source
//   work [--concurrency N] [--max-jobs N] [--watch]         lease and crawl jobs until none are due
//   status                                                  queue counts and the latest run
//   retry-failed | cancel-queued                            queue maintenance
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { env } from '../config/env.js';
import { closeDb } from '../db/collections.js';
import { scraperConfig } from '../scraper/config.js';
import { cancelJobs, enqueueSources, queueStats, retryJobs } from '../scraper/queue.js';
import { importSources, parseSeedList } from '../scraper/sources.js';
import { runWorker } from '../scraper/worker.js';

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
  console.log(`Worker on "${env.mongodbDatabase}" as ${config.userAgent} — ${concurrency} sites at a time, ≥${config.hostDelayMs} ms between requests per site, ≤${config.maxPages} pages per site.`);
  const stats = await runWorker({
    concurrency, maxJobs: positiveInt(option('max-jobs'), 'max-jobs') ?? Infinity, watch: flag('watch'),
    signal: controller.signal, config, log: (line) => console.log(line),
  });
  console.log(`Finished: ${stats.done} done, ${stats.skipped} skipped, ${stats.failed} failed, ${stats.retrying} scheduled for retry, ${stats.released} released; ${stats.requests} HTTP requests.`);
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
  work: workCommand,
  status: statusCommand,
  'retry-failed': async () => console.log(await retryJobs({ status: 'failed' })),
  'cancel-queued': async () => console.log(await cancelJobs({})),
};

try {
  if (!commands[command]) {
    console.log('Commands: import-sources <file>, enqueue [--all|--stale-days N|--never] [--limit N], work [--concurrency N] [--max-jobs N] [--watch], status, retry-failed, cancel-queued');
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
