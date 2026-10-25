import { COLLECTIONS, getDb, toObjectId } from '../db/collections.js';
import { HttpError } from '../lib/http-error.js';
import { pagination, queryString } from '../lib/query.js';
import { escapeRegex } from '../lib/validation.js';
import { foldText } from '../modules/universities/normalize.js';
import { scraperConfig } from './config.js';
import { websiteKey } from './urls.js';

// MongoDB-backed crawl queue. A job is leased with findOneAndUpdate (status queued → running,
// lockedBy/lockedUntil), so any number of worker processes can share it. Two partial unique
// indexes keep it consistent across processes:
//   { sourceId } where open: true    → at most one queued/running job per source
//   { host } where status: 'running' → at most one running job per registrable domain (politeness)
export const JOB_STATUSES = ['queued', 'running', 'done', 'failed', 'skipped', 'cancelled'];
const BACKOFF_BASE_MS = 10 * 60_000;
const BACKOFF_MAX_MS = 12 * 60 * 60_000;
const QUALITY_BACKOFF_MAX_MS = 2 * 60_000;

const db = getDb;
const jobsCollection = async () => (await db()).collection(COLLECTIONS.scrapeJobs);

export function backoffMs(attempt, random = Math.random) {
  const base = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1), BACKOFF_MAX_MS);
  return Math.round(base * (0.8 + random() * 0.4));
}

// Exact quality passes are supervised serially: one delayed straggler otherwise pauses every later
// batch for 10, 20 and then 40 minutes. They still keep a two-minute recovery window between
// attempts, while normal/background jobs retain the conservative exponential backoff above.
export function retryBackoffMs(job, random = Math.random) {
  const delay = backoffMs(job.attempts, random);
  return Number(job.priority) >= 2 ? Math.min(delay, QUALITY_BACKOFF_MAX_MS) : delay;
}

export function serializeJob({ _id, sourceId, runId, open: _open, ...rest }) {
  return { id: _id.toString(), sourceId: sourceId?.toString() ?? null, runId: runId?.toString() ?? null, ...rest };
}

/**
 * Creates one job per selected source in a new run.
 * mode: all (every active source) | stale (not crawled for staleDays) | never (never crawled) | selected (sourceIds)
 */
export async function enqueueSources({ mode = 'all', staleDays = 30, limit = 0, sourceIds = [], seedListName = '', createdBy = 'cli', now = new Date() } = {}) {
  if (!['all', 'stale', 'never', 'selected'].includes(mode)) throw new HttpError(400, 'Unknown enqueue mode');
  if (sourceIds.length && mode !== 'selected') throw new HttpError(400, 'sourceIds requires selected mode');
  const database = await db();
  const filter = { status: 'active' };
  let selectedIds = [];
  if (mode === 'stale') filter.$or = [{ lastJobAt: null }, { lastJobAt: { $lt: new Date(now.getTime() - Math.max(1, Number(staleDays) || 30) * 86_400_000) } }];
  if (mode === 'never') filter.lastJobAt = null;
  if (mode === 'selected') {
    const ids = [...new Set(sourceIds)].map(toObjectId);
    if (!ids.length || ids.length > 5000 || ids.some((id) => !id)) throw new HttpError(400, 'Select between 1 and 5,000 valid sources');
    filter._id = { $in: ids };
    selectedIds = ids;
  }
  if (seedListName) filter.seedListName = seedListName;
  const { maxAttempts } = scraperConfig();
  const run = { createdAt: now, createdBy, mode, options: { staleDays: mode === 'stale' ? Number(staleDays) : null, limit: Number(limit) || null, seedListName: seedListName || null }, total: 0 };
  const { insertedId: runId } = await database.collection(COLLECTIONS.scrapeRuns).insertOne(run);
  const jobs = database.collection(COLLECTIONS.scrapeJobs);
  let cursor = database.collection(COLLECTIONS.scrapeSources).find(filter, { projection: { name: 1, website: 1, domain: 1 } }).sort({ lastJobAt: 1, _id: 1 });
  if (Number(limit) > 0) cursor = cursor.limit(Number(limit));
  let selected = 0;
  let queued = 0;
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    try {
      queued += (await jobs.insertMany(batch, { ordered: false })).insertedCount;
    } catch (error) {
      const writeErrors = [error.writeErrors ?? []].flat();
      if (!writeErrors.length || writeErrors.some((item) => item.code !== 11000)) throw error;
      queued += error.result?.insertedCount ?? error.insertedCount ?? 0; // duplicates: the source already has an open job
    }
    batch = [];
  };
  for await (const source of cursor) {
    selected += 1;
    batch.push({
      sourceId: source._id, runId, name: source.name, website: source.website, host: source.domain, status: 'queued', open: true,
      attempts: 0, maxAttempts, priority: mode === 'selected' ? 1 : 0, nextRunAt: now, lockedBy: null, lockedUntil: null,
      error: null, result: null, createdAt: now, updatedAt: now, startedAt: null, finishedAt: null,
    });
    if (batch.length === 1000) await flush();
  }
  await flush();
  // "selected" is the high-priority path. An existing open job cannot be inserted again because
  // of the sourceId/open unique index, but it must still be promoted; otherwise a newly selected
  // university can remain behind thousands of general directory jobs.
  if (selectedIds.length) {
    await jobs.updateMany(
      { sourceId: { $in: selectedIds }, status: 'queued', priority: { $lt: 1 } },
      { $max: { priority: 1 }, $set: { updatedAt: now } },
    );
  }
  // A run that queued nothing is not worth keeping in the history.
  if (!queued) await database.collection(COLLECTIONS.scrapeRuns).deleteOne({ _id: runId });
  else await database.collection(COLLECTIONS.scrapeRuns).updateOne({ _id: runId }, { $set: { total: queued, selected } });
  return { runId: queued ? runId.toString() : null, selected, queued, alreadyQueued: selected - queued };
}

const hasRows = (value) => Array.isArray(value) && value.length > 0;
const hasPlacement = (value) => value && typeof value === 'object' && (
  Number(value.averagePackageLpa) > 0
  || Number(value.highestPackageLpa) > 0
  || Number(value.medianPackageLpa) > 0
  || Number(value.placedPercent) > 0
  || hasRows(value.recruiters)
);

/**
 * Queues a bounded batch of university/institute profiles with the most missing student-facing
 * fields. Only exact institutionSlug sources are eligible, and a source with an existing open job
 * is excluded. This makes repeated `enqueue-quality --limit 100` calls resumable and non-overlapping.
 */
export async function enqueueQualitySources({ limit = 100, createdBy = 'quality-reenrichment', now = new Date() } = {}) {
  const batchSize = Math.max(1, Math.min(Number(limit) || 100, 500));
  const database = await db();
  const institutions = await database.collection(COLLECTIONS.institutions).find({
    active: { $ne: false },
    type: { $in: ['university', 'institute'] },
    isIllustrative: { $ne: true },
  }, { projection: {
    _id: 0, name: 1, slug: 1, website: 1, about: 1, programmesOffered: 1,
    gallery: 1, facilities: 1, placements: 1,
  } }).toArray();
  const slugs = institutions.map((item) => item.slug).filter(Boolean);
  const [sourceDocs, openSourceIds] = await Promise.all([
    database.collection(COLLECTIONS.scrapeSources).find({
      status: 'active', institutionSlug: { $in: slugs },
    }, { projection: {
      _id: 1, institutionSlug: 1, website: 1, websiteKey: 1, lastJobAt: 1, lastResult: 1,
    } }).toArray(),
    database.collection(COLLECTIONS.scrapeJobs).distinct('sourceId', { open: true }),
  ]);
  const open = new Set(openSourceIds.map((id) => id.toString()));
  const bySlug = new Map();
  for (const source of sourceDocs) {
    if (open.has(source._id.toString())) continue;
    const list = bySlug.get(source.institutionSlug) ?? [];
    list.push(source);
    bySlug.set(source.institutionSlug, list);
  }

  const candidates = [];
  for (const institution of institutions) {
    const gaps = [];
    if (String(institution.about ?? '').trim().length < 80) gaps.push('about');
    if (!hasRows(institution.programmesOffered)) gaps.push('programmesOffered');
    if (!hasRows(institution.gallery)) gaps.push('gallery');
    if (!hasRows(institution.facilities)) gaps.push('facilities');
    if (!hasPlacement(institution.placements)) gaps.push('placements');
    if (!gaps.length) continue;
    const expectedKey = websiteKey(institution.website);
    const available = bySlug.get(institution.slug) ?? [];
    available.sort((a, b) => {
      const aExact = expectedKey && a.websiteKey === expectedKey ? 1 : 0;
      const bExact = expectedKey && b.websiteKey === expectedKey ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      const aAt = a.lastJobAt instanceof Date ? a.lastJobAt.getTime() : 0;
      const bAt = b.lastJobAt instanceof Date ? b.lastJobAt.getTime() : 0;
      return aAt - bAt || a._id.toString().localeCompare(b._id.toString());
    });
    if (available[0]) candidates.push({ institution, source: available[0], gaps });
  }
  candidates.sort((a, b) => b.gaps.length - a.gaps.length
    || (a.source.lastJobAt?.getTime?.() ?? 0) - (b.source.lastJobAt?.getTime?.() ?? 0)
    || String(a.institution.name).localeCompare(String(b.institution.name)));
  const picked = candidates.slice(0, batchSize);
  if (!picked.length) return { runId: null, selected: 0, queued: 0, alreadyQueued: 0, gaps: {}, items: [] };
  const result = await enqueueSources({
    mode: 'selected', sourceIds: picked.map((item) => item.source._id.toString()), createdBy, now,
  });
  if (result.runId) {
    // A watch worker can lease a freshly inserted job before this promotion runs. Promote both
    // queued and already-running rows so a transient retry keeps its quality-batch priority.
    await database.collection(COLLECTIONS.scrapeJobs).updateMany(
      { runId: toObjectId(result.runId), status: { $in: ['queued', 'running'] } },
      { $max: { priority: 2 }, $set: { updatedAt: now } },
    );
  }
  const gaps = Object.fromEntries(['about', 'programmesOffered', 'gallery', 'facilities', 'placements']
    .map((field) => [field, picked.filter((item) => item.gaps.includes(field)).length]));
  return {
    ...result,
    gaps,
    items: picked.map((item) => ({
      name: item.institution.name,
      slug: item.institution.slug,
      sourceId: item.source._id.toString(),
      gaps: item.gaps,
    })),
  };
}

// Jobs whose worker died keep their lease until it expires; then they are retried (or failed).
export async function reclaimExpired(now = new Date()) {
  const jobs = await jobsCollection();
  const expired = { status: 'running', lockedUntil: { $lt: now } };
  const failed = await jobs.updateMany({ ...expired, $expr: { $gte: ['$attempts', '$maxAttempts'] } }, {
    $set: { status: 'failed', error: 'The worker lease expired too many times', lockedBy: null, lockedUntil: null, finishedAt: now, updatedAt: now }, $unset: { open: '' },
  });
  const requeued = await jobs.updateMany(expired, { $set: { status: 'queued', error: 'The worker lease expired; requeued', lockedBy: null, lockedUntil: null, nextRunAt: now, updatedAt: now } });
  return { failed: failed.modifiedCount, requeued: requeued.modifiedCount };
}

export async function leaseJob(workerId, { leaseMs = scraperConfig().leaseMs, now = new Date() } = {}) {
  const jobs = await jobsCollection();
  await reclaimExpired(now);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const busyHosts = await jobs.distinct('host', { status: 'running' });
    try {
      return await jobs.findOneAndUpdate(
        { status: 'queued', nextRunAt: { $lte: now }, host: { $nin: busyHosts } },
        { $set: { status: 'running', lockedBy: workerId, lockedUntil: new Date(now.getTime() + leaseMs), startedAt: now, updatedAt: now }, $inc: { attempts: 1 } },
        { sort: { priority: -1, nextRunAt: 1, _id: 1 }, returnDocument: 'after' },
      );
    } catch (error) {
      if (error.code !== 11000) throw error; // another worker took this host first; look again
    }
  }
  return null;
}

export async function extendLease(job, workerId, { leaseMs = scraperConfig().leaseMs, now = new Date() } = {}) {
  const result = await (await jobsCollection()).updateOne({ _id: job._id, lockedBy: workerId, status: 'running' }, { $set: { lockedUntil: new Date(now.getTime() + leaseMs), updatedAt: now } });
  return result.matchedCount === 1;
}

async function recordOnSource(job, outcome, now) {
  await (await db()).collection(COLLECTIONS.scrapeSources).updateOne({ _id: job.sourceId }, { $set: { lastJobAt: now, lastResult: { ...outcome, jobId: job._id, at: now }, updatedAt: now } });
}

// status: done | skipped | failed (final states only).
export async function finishJob(job, workerId, { status, result = null, error = null, now = new Date() }) {
  const update = await (await jobsCollection()).updateOne({ _id: job._id, lockedBy: workerId, status: 'running' }, {
    $set: { status, result, error, lockedBy: null, lockedUntil: null, finishedAt: now, updatedAt: now }, $unset: { open: '' },
  });
  if (update.matchedCount) await recordOnSource(job, { status, slug: result?.slug ?? null, published: result?.published ?? null, error }, now);
  return update.matchedCount === 1;
}

// Transient failures go back to the queue with exponential backoff until maxAttempts.
export async function failJob(job, workerId, error, { now = new Date(), random = Math.random } = {}) {
  const message = String(error?.message ?? error).slice(0, 500);
  if (error?.permanent || job.attempts >= job.maxAttempts) return { final: true, saved: await finishJob(job, workerId, { status: 'failed', error: message, result: error?.result ?? null, now }) };
  const nextRunAt = new Date(now.getTime() + retryBackoffMs(job, random));
  const update = await (await jobsCollection()).updateOne({ _id: job._id, lockedBy: workerId, status: 'running' }, {
    $set: { status: 'queued', error: message, nextRunAt, lockedBy: null, lockedUntil: null, updatedAt: now },
  });
  return { final: false, saved: update.matchedCount === 1, nextRunAt };
}

// Graceful shutdown: hand the job back without counting the interrupted attempt.
export async function releaseJob(job, workerId, now = new Date()) {
  const update = await (await jobsCollection()).updateOne({ _id: job._id, lockedBy: workerId, status: 'running' }, {
    $set: { status: 'queued', lockedBy: null, lockedUntil: null, nextRunAt: now, updatedAt: now }, $inc: { attempts: -1 },
  });
  return update.matchedCount === 1;
}

function idFilter(ids) {
  const objectIds = [...new Set(ids ?? [])].map(toObjectId);
  if (objectIds.some((id) => !id) || objectIds.length > 1000) throw new HttpError(400, 'Use up to 1,000 valid job ids');
  return objectIds;
}

// Failed or skipped jobs → queued again with a fresh attempt budget. Sources that already have an
// open job are left alone (the unique index rejects the second one).
export async function retryJobs({ ids, status = 'failed', now = new Date() } = {}) {
  const jobs = await jobsCollection();
  const filter = ids?.length ? { _id: { $in: idFilter(ids) }, status: { $in: ['failed', 'skipped', 'cancelled'] } } : { status: ['failed', 'skipped'].includes(status) ? status : 'failed' };
  let retried = 0;
  let skipped = 0;
  for await (const job of jobs.find(filter, { projection: { _id: 1 } }).sort({ finishedAt: -1 }).limit(5000)) {
    try {
      const result = await jobs.updateOne({ _id: job._id, status: { $in: ['failed', 'skipped', 'cancelled'] } }, {
        $set: { status: 'queued', open: true, attempts: 0, error: null, result: null, nextRunAt: now, priority: 1, finishedAt: null, updatedAt: now },
      });
      retried += result.modifiedCount;
    } catch (error) {
      if (error.code !== 11000) throw error;
      skipped += 1;
    }
  }
  return { retried, skipped };
}

export async function cancelJobs({ ids, runId, now = new Date() } = {}) {
  const filter = { status: 'queued' };
  if (ids?.length) filter._id = { $in: idFilter(ids) };
  if (runId) {
    const id = toObjectId(runId);
    if (!id) throw new HttpError(400, 'Invalid run id');
    filter.runId = id;
  }
  const result = await (await jobsCollection()).updateMany(filter, { $set: { status: 'cancelled', finishedAt: now, updatedAt: now }, $unset: { open: '' } });
  return { cancelled: result.modifiedCount };
}

export async function listJobs(query = {}) {
  const { page, limit, skip } = pagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};
  const status = queryString(query.status, 20);
  if (JOB_STATUSES.includes(status)) filter.status = status;
  const runId = toObjectId(queryString(query.runId, 24));
  if (runId) filter.runId = runId;
  const q = foldText(queryString(query.q, 80));
  if (q) filter.$or = [{ host: { $regex: `^${escapeRegex(q.replace(/ /g, '.'))}` } }, { name: { $regex: escapeRegex(queryString(query.q, 80)), $options: 'i' } }];
  const jobs = await jobsCollection();
  const [docs, total] = await Promise.all([
    jobs.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).toArray(),
    jobs.countDocuments(filter),
  ]);
  return { items: docs.map(serializeJob), total, page, limit };
}

async function countsByStatus(collection, match = {}) {
  const rows = await collection.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]).toArray();
  return Object.fromEntries(rows.map((row) => [row._id, row.count]));
}

export async function listRuns(limit = 10) {
  const database = await db();
  const runs = await database.collection(COLLECTIONS.scrapeRuns).find({}).sort({ createdAt: -1 }).limit(Math.min(Math.max(Number(limit) || 10, 1), 50)).toArray();
  const rows = runs.length ? await database.collection(COLLECTIONS.scrapeJobs).aggregate([
    { $match: { runId: { $in: runs.map((run) => run._id) } } },
    { $group: { _id: { runId: '$runId', status: '$status' }, count: { $sum: 1 }, lastActivityAt: { $max: '$updatedAt' } } },
  ]).toArray() : [];
  return runs.map((run) => {
    const own = rows.filter((row) => row._id.runId.equals(run._id));
    return {
      id: run._id.toString(), createdAt: run.createdAt, createdBy: run.createdBy, mode: run.mode, options: run.options, total: run.total ?? 0,
      counts: Object.fromEntries(JOB_STATUSES.map((status) => [status, own.find((row) => row._id.status === status)?.count ?? 0])),
      lastActivityAt: own.reduce((latest, row) => (!latest || row.lastActivityAt > latest ? row.lastActivityAt : latest), null),
    };
  });
}

export async function queueStats() {
  const database = await db();
  const jobs = database.collection(COLLECTIONS.scrapeJobs);
  const sources = database.collection(COLLECTIONS.scrapeSources);
  const now = new Date();
  const [jobCounts, sourceCounts, neverCrawled, dueNow, workers, [lastRun]] = await Promise.all([
    countsByStatus(jobs),
    countsByStatus(sources),
    sources.countDocuments({ lastJobAt: null }),
    jobs.countDocuments({ status: 'queued', nextRunAt: { $lte: now } }),
    jobs.aggregate([{ $match: { status: 'running' } }, { $group: { _id: '$lockedBy', jobs: { $sum: 1 }, lockedUntil: { $max: '$lockedUntil' } } }]).toArray(),
    listRuns(1),
  ]);
  return {
    jobs: Object.fromEntries(JOB_STATUSES.map((status) => [status, jobCounts[status] ?? 0])),
    dueNow,
    sources: { total: Object.values(sourceCounts).reduce((sum, count) => sum + count, 0), active: sourceCounts.active ?? 0, paused: sourceCounts.paused ?? 0, blocked: sourceCounts.blocked ?? 0, neverCrawled },
    workers: workers.map((row) => ({ id: row._id, jobs: row.jobs, lockedUntil: row.lockedUntil })),
    lastRun: lastRun ?? null,
  };
}
