import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { fakeWeb, fixtures, SITE } from './scraper-fixtures.js';

// Throwaway database; env.js reads process.env at import time.
const skip = process.env.MONGODB_URI ? false : 'MONGODB_URI is not set';
process.env.MONGODB_DATABASE = `nsedu_test_${randomBytes(4).toString('hex')}`;
process.env.NODE_ENV = 'test';

const MINUTE = 60_000;
const SEED_CSV = `Name of the Institution,Website,State,City,Type
Doon Valley Institute of Technology,www.dvit-example.ac.in,,,
Hidden Hills College,https://hidden-example.ac.in,,Shimla,college
Statecraft College,https://statecraft-example.ac.in/,Kerala,,college
Robots Blocked College,https://blocked-example.ac.in,Goa,Panaji,
No Website College,,Bihar,Patna,
Doon Valley Duplicate,http://dvit-example.ac.in/,,,
`;

describe('scraper queue and worker', { skip }, () => {
  let db; let closeDb; let queue; let sources; let worker;

  before(async () => {
    const collections = await import('../src/db/collections.js');
    ({ closeDb } = collections);
    [queue, sources, worker] = await Promise.all([import('../src/scraper/queue.js'), import('../src/scraper/sources.js'), import('../src/scraper/worker.js')]);
    db = await collections.getDb();
    await db.collection('courses').insertMany([{ slug: 'btech', name: 'B.Tech', fullName: 'Bachelor of Technology', active: true }, { slug: 'mba', name: 'MBA', active: true }]);
  });

  after(async () => {
    if (db) await db.dropDatabase();
    await closeDb?.();
  });

  test('seed lists import generically and dedupe by website', async () => {
    const rows = sources.parseSeedList(SEED_CSV, 'csv');
    assert.equal(rows.length, 6);
    assert.deepEqual(rows[1], { name: 'Hidden Hills College', website: 'https://hidden-example.ac.in', city: 'Shimla', type: 'college' });
    const summary = await sources.importSources(rows, { seedListName: 'Test list' });
    assert.deepEqual([summary.inserted, summary.updated, summary.duplicates, summary.failed], [4, 0, 1, 1]);
    assert.equal(summary.errors[0].row, 6);
    const again = await sources.importSources(sources.parseSeedList(JSON.stringify([{ name: 'Statecraft College', website: 'statecraft-example.ac.in', state: 'kerala' }]), 'json'), { seedListName: 'JSON list' });
    assert.deepEqual([again.inserted, again.updated], [0, 1]);
    const listed = await sources.listSources({ q: 'state' });
    assert.deepEqual(listed.items.map((item) => [item.name, item.state, item.domain, item.seedListName]), [['Statecraft College', 'Kerala', 'statecraft-example.ac.in', 'JSON list']]);
    assert.equal((await sources.listSources({ q: 'dvit-example' })).total, 1);
    const changing = await sources.createSource({ name: 'Changing Website Institute', website: 'changing-old-example.ac.in', institutionSlug: 'changing-website-institute' });
    await db.collection('scrape_sources').updateOne({ _id: new ObjectId(changing.id) }, { $set: { lastJobAt: new Date(), lastResult: { status: 'done' } } });
    await queue.enqueueSources({ mode: 'selected', sourceIds: [changing.id] });
    const changed = await sources.updateSource(changing.id, { website: 'changing-new-example.ac.in' });
    assert.deepEqual([changed.websiteKey, changed.lastJobAt, changed.lastResult], ['changing-new-example.ac.in', null, null]);
    const staleJob = await db.collection('scrape_jobs').findOne({ sourceId: new ObjectId(changing.id), website: 'https://changing-old-example.ac.in/' });
    assert.deepEqual([staleJob.status, staleJob.open], ['cancelled', undefined]);
    await sources.deleteSource(changing.id);
    const variant = await sources.createSource({ name: 'Host Variant Institute', website: 'www.variant-example.ac.in', institutionSlug: 'host-variant-institute' });
    await queue.enqueueSources({ mode: 'selected', sourceIds: [variant.id] });
    await sources.updateSource(variant.id, { website: 'https://variant-example.ac.in/' });
    const variantJob = await db.collection('scrape_jobs').findOne({ sourceId: new ObjectId(variant.id) });
    assert.deepEqual([variantJob.website, variantJob.status, variantJob.open], ['https://www.variant-example.ac.in/', 'cancelled', undefined]);
    await sources.deleteSource(variant.id);
    await db.collection('scrape_sources').updateOne({ name: 'Statecraft College' }, { $set: { lastJobAt: new Date(), lastResult: { status: 'done' } } });
    await sources.importSources([{ name: 'Statecraft College', website: 'statecraft-example.ac.in', state: 'Kerala', institutionSlug: 'statecraft-college' }], { seedListName: 'Directory targets' });
    const retargeted = await db.collection('scrape_sources').findOne({ name: 'Statecraft College' });
    assert.deepEqual([retargeted.institutionSlug, retargeted.lastJobAt, retargeted.lastResult], ['statecraft-college', null, null]);
    const shared = await sources.importSources([
      { name: 'Example Constituent College', website: 'shared-campus-example.ac.in', type: 'college', institutionSlug: 'example-constituent-college' },
      { name: 'Example University', website: 'shared-campus-example.ac.in', type: 'university', institutionSlug: 'example-university' },
    ], { seedListName: 'Shared homepage targets' });
    assert.equal(shared.duplicates, 1);
    assert.equal((await db.collection('scrape_sources').findOne({ websiteKey: 'shared-campus-example.ac.in' })).institutionSlug, 'example-university');
    await db.collection('scrape_sources').deleteOne({ websiteKey: 'shared-campus-example.ac.in' });
    await assert.rejects(sources.createSource({ name: 'Dup', website: 'https://www.statecraft-example.ac.in' }), (error) => error.status === 409);
  });

  test('leases are exclusive per job and per domain, failures back off and leases can be reclaimed', async () => {
    const a = await sources.createSource({ name: 'North Campus', website: 'https://north.multi-example.ac.in', state: 'Delhi', city: 'Delhi' });
    const b = await sources.createSource({ name: 'South Campus', website: 'https://south.multi-example.ac.in', state: 'Delhi', city: 'Delhi' });
    await assert.rejects(
      queue.enqueueSources({ sourceIds: [a.id] }),
      (error) => error.status === 400 && /selected mode/.test(error.message),
      'sourceIds must never be silently ignored by a broad enqueue mode',
    );
    const run = await queue.enqueueSources({ mode: 'selected', sourceIds: [a.id, b.id], createdBy: 'test' });
    assert.deepEqual([run.queued, run.alreadyQueued], [2, 0]);
    await db.collection('scrape_jobs').updateOne({ sourceId: new ObjectId(a.id), open: true }, { $set: { priority: 0 } });
    assert.equal((await queue.enqueueSources({ mode: 'selected', sourceIds: [a.id] })).alreadyQueued, 1, 'second open job for a source');
    assert.equal((await db.collection('scrape_jobs').findOne({ sourceId: new ObjectId(a.id), open: true })).priority, 1, 'selected sources promote an existing queued job');

    const first = await queue.leaseJob('w1');
    assert.equal(first.host, 'multi-example.ac.in');
    assert.equal(first.attempts, 1);
    assert.equal(await queue.leaseJob('w2'), null, 'two running jobs on one domain');
    assert.equal(await queue.extendLease(first, 'w2'), false);
    assert.equal(await queue.extendLease(first, 'w1'), true);

    const now = new Date();
    const failed = await queue.failJob(first, 'w1', new Error('Network error: ECONNRESET'), { now, random: () => 0.5 });
    assert.equal(failed.final, false);
    assert.equal(failed.nextRunAt.getTime() - now.getTime(), 10 * MINUTE);
    assert.equal(queue.backoffMs(3, () => 0.5), 40 * MINUTE);
    assert.equal(queue.retryBackoffMs({ attempts: 3, priority: 2 }, () => 0.5), 2 * MINUTE,
      'serial quality batches use a short capped retry delay');

    const second = await queue.leaseJob('w2');
    assert.notEqual(second._id.toString(), first._id.toString());
    assert.equal(await queue.releaseJob(second, 'w2'), true);
    assert.equal((await db.collection('scrape_jobs').findOne({ _id: second._id })).attempts, 0);

    // A worker that dies keeps its lease until expiry; the next lease call requeues the job.
    const stuck = await queue.leaseJob('dead-worker', { leaseMs: 1 });
    const later = new Date(Date.now() + 1000);
    const rescued = await queue.leaseJob('w3', { now: later });
    assert.equal(rescued._id.toString(), stuck._id.toString());
    assert.equal(rescued.lockedBy, 'w3');
    assert.equal(await queue.finishJob(stuck, 'dead-worker', { status: 'done' }), false, 'stale worker cannot finish a re-leased job');
    await queue.releaseJob(rescued, 'w3');
    const other = rescued._id.equals(first._id) ? second : rescued;
    assert.deepEqual(await queue.cancelJobs({ ids: [other._id.toString()] }), { cancelled: 1 });

    // Attempts run out → failed; then retry gives a fresh budget.
    let job;
    let clock = Date.now();
    for (let round = 0; round < 10; round += 1) {
      clock += 13 * 60 * MINUTE;
      job = await queue.leaseJob('w4', { now: new Date(clock) });
      assert.ok(job?._id.equals(first._id), 'expected the failing job to be leased again');
      const outcome = await queue.failJob(job, 'w4', new Error('HTTP 503'), { now: new Date(clock) });
      if (outcome.final) break;
    }
    assert.equal(job.attempts, job.maxAttempts);
    const stored = await db.collection('scrape_jobs').findOne({ _id: first._id });
    assert.deepEqual([stored.status, stored.open, stored.error], ['failed', undefined, 'HTTP 503']);
    assert.equal((await db.collection('scrape_sources').findOne({ _id: first.sourceId })).lastResult.status, 'failed');
    assert.deepEqual(await queue.retryJobs({ ids: [first._id.toString()] }), { retried: 1, skipped: 0 });
    assert.equal((await db.collection('scrape_jobs').findOne({ _id: first._id })).attempts, 0);
    assert.deepEqual(await queue.cancelJobs({ runId: run.runId }), { cancelled: 1 });
    assert.equal(await db.collection('scrape_jobs').countDocuments({ open: true }), 0);
    await assert.rejects(queue.retryJobs({ ids: ['nope'] }), (error) => error.status === 400);
  });

  test('quality batches select incomplete university profiles and exclude complete or illustrative records', async () => {
    const incomplete = {
      name: 'Quality Gap University', slug: 'quality-gap-university', website: 'https://quality-gap-example.ac.in/',
      type: 'university', active: true,
    };
    const complete = {
      name: 'Complete University', slug: 'complete-university', website: 'https://complete-example.ac.in/',
      type: 'university', active: true, about: 'A'.repeat(100), programmesOffered: [{ name: 'B.Tech' }],
      gallery: [{ url: 'https://res.cloudinary.com/demo/image/upload/campus.jpg' }], facilities: ['Library'],
      placements: { medianPackageLpa: 6, sourcePage: 'https://complete-example.ac.in/placements' },
    };
    const illustrative = {
      name: 'Illustrative University', slug: 'illustrative-university', website: 'https://illustrative-example.ac.in/',
      type: 'university', active: true, isIllustrative: true,
    };
    await db.collection('institutions').insertMany([incomplete, complete, illustrative]);
    const [gapSource, completeSource, illustrativeSource] = await Promise.all([
      sources.createSource({ name: incomplete.name, website: incomplete.website, institutionSlug: incomplete.slug }),
      sources.createSource({ name: complete.name, website: complete.website, institutionSlug: complete.slug }),
      sources.createSource({ name: illustrative.name, website: illustrative.website, institutionSlug: illustrative.slug }),
    ]);
    const result = await queue.enqueueQualitySources({ limit: 1, createdBy: 'quality-test' });
    assert.deepEqual([result.selected, result.queued, result.items[0].slug, result.items[0].gaps.length], [1, 1, incomplete.slug, 5]);
    const job = await db.collection('scrape_jobs').findOne({ runId: new ObjectId(result.runId) });
    assert.deepEqual([job.sourceId.toString(), job.priority], [gapSource.id, 2]);
    await queue.cancelJobs({ runId: result.runId });
    await db.collection('institutions').deleteMany({ slug: { $in: [incomplete.slug, complete.slug, illustrative.slug] } });
    await db.collection('scrape_sources').deleteMany({ _id: { $in: [gapSource.id, completeSource.id, illustrativeSource.id].map((id) => new ObjectId(id)) } });
  });

  test('retries progressively reduce page and image work without changing the full first attempt', () => {
    const config = { maxPages: 18, maxImages: 8, renderMaxPages: 9 };
    assert.equal(worker.crawlConfigFor({ attempts: 1 }, config), config);
    assert.deepEqual(worker.crawlConfigFor({ attempts: 2 }, config), { maxPages: 12, maxImages: 6, renderMaxPages: 9 });
    assert.deepEqual(worker.crawlConfigFor({ attempts: 3 }, config), { maxPages: 8, maxImages: 4, renderMaxPages: 8 });
    assert.deepEqual(worker.crawlConfigFor({ attempts: 4 }, config), { maxPages: 5, maxImages: 2, renderMaxPages: 5 });
  });

  test('the worker crawls due jobs, applies the publish rule and records results', async () => {
    const site = (host, html) => ({ [`https://${host}/robots.txt`]: { status: 404 }, [`https://${host}/`]: { body: html } });
    const web = fakeWeb({
      [`${SITE}/robots.txt`]: { body: 'User-agent: *\nDisallow: /naac\n', headers: { 'content-type': 'text/plain' } },
      [`${SITE}/`]: { body: fixtures.home }, [`${SITE}/about-us`]: { body: fixtures.about }, [`${SITE}/contact`]: { body: fixtures.contact },
      [`${SITE}/academics/programmes`]: { body: fixtures.programmes },
      ...site('hidden-example.ac.in', '<html><head><title>Hidden Hills College</title></head><body><p>A college in the hills.</p></body></html>'),
      ...site('statecraft-example.ac.in', '<html><head><title>Statecraft College</title></head><body><p>No address here.</p></body></html>'),
      'https://statecraft-example.ac.in/about-us': { body: '<html><body><h1>About Statecraft College</h1><p>Statecraft College was established in 2005 to provide higher education in Kerala.</p></body></html>' },
      'https://statecraft-example.ac.in/courses': { body: '<html><body><h1>Courses</h1><ul><li>Bachelor of Technology in Computer Science</li><li>Master of Business Administration</li></ul></body></html>' },
      'https://blocked-example.ac.in/robots.txt': { body: 'User-agent: *\nDisallow: /\n' },
      ...site('north.multi-example.ac.in', '<html><body><p>North Campus, Delhi 110007</p></body></html>'),
      ...site('south.multi-example.ac.in', '<html><body><p>South Campus, Delhi 110021</p></body></html>'),
    });
    await db.collection('scrape_sources').updateMany({ domain: 'multi-example.ac.in' }, { $set: { status: 'paused' } });
    const run = await queue.enqueueSources({ mode: 'all', createdBy: 'test' });
    assert.equal(run.queued, 4);
    const lines = [];
    const stats = await worker.runWorker({ concurrency: 2, fetchImpl: web.fetchImpl, wait: web.wait, log: (line) => lines.push(line) });
    assert.deepEqual([stats.done, stats.skipped, stats.failed, stats.retrying], [3, 1, 0, 0], lines.join('\n'));

    const institutions = db.collection('institutions');
    const dvit = await institutions.findOne({ name: 'Doon Valley Institute of Technology' });
    assert.deepEqual([dvit.active, dvit.verification, dvit.state, dvit.city, dvit.source.kind, dvit.source.name, dvit.source.url], [true, 'unverified', 'Uttarakhand', 'Dehradun', 'scrape', 'Official website', `${SITE}/`]);
    assert.deepEqual(dvit.courseSlugs, ['btech', 'mba']);
    assert.ok(dvit.source.fetchedAt instanceof Date);
    const hidden = await institutions.findOne({ name: 'Hidden Hills College' });
    assert.deepEqual([hidden.active, hidden.state, hidden.city, hidden.type], [false, null, 'Shimla', 'college'], 'no state → held for review');

    const jobs = await db.collection('scrape_jobs').find({ runId: new ObjectId(run.runId) }).toArray();
    const byName = Object.fromEntries(jobs.map((job) => [job.name, job]));
    assert.equal(byName['Robots Blocked College'].status, 'skipped');
    assert.match(byName['Robots Blocked College'].error, /robots\.txt disallows/);
    // No city on the site, but the seed list's state is enough to place (and, with the website, publish) it.
    assert.equal(byName['Statecraft College'].status, 'done');
    const statecraft = await institutions.findOne({ name: 'Statecraft College' });
    assert.equal(statecraft.city, undefined);
    assert.match(statecraft.about, /established in 2005/i);
    assert.ok(statecraft.programmesOffered.some((row) => /Bachelor of Technology/i.test(row.name)));
    assert.deepEqual([byName['Doon Valley Institute of Technology'].result.action, byName['Doon Valley Institute of Technology'].result.published], ['inserted', true]);
    assert.ok(byName['Doon Valley Institute of Technology'].result.fields.includes('naacGrade'));
    assert.deepEqual(byName['Hidden Hills College'].result.missing, ['state']);
    const source = await db.collection('scrape_sources').findOne({ name: 'Doon Valley Institute of Technology' });
    assert.deepEqual([source.institutionSlug, source.lastResult.status], [dvit.slug, 'done']);
    assert.ok(!web.requests.some((request) => request.url.includes('multi-example')), 'paused sources are not crawled');

    // Admin edits lock fields; a re-crawl never overwrites them.
    await institutions.updateOne({ _id: dvit._id }, { $set: { about: 'Edited by an administrator.', lockedFields: ['about'] } });
    await queue.enqueueSources({ mode: 'selected', sourceIds: [source._id.toString()] });
    const again = await worker.runWorker({ concurrency: 1, fetchImpl: web.fetchImpl, wait: web.wait });
    assert.equal(again.done, 1);
    assert.equal((await institutions.findOne({ _id: dvit._id })).about, 'Edited by an administrator.');
    assert.equal(await institutions.countDocuments({ name: 'Doon Valley Institute of Technology' }), 1);

    const stats2 = await queue.queueStats();
    assert.equal(stats2.jobs.running, 0);
    assert.equal(stats2.sources.paused, 2);
    assert.equal(stats2.lastRun.counts.done, 1);
    const listed = await queue.listJobs({ status: 'failed' });
    assert.ok(listed.items.every((item) => item.status === 'failed' && typeof item.id === 'string'));
  });

  test('aborting the worker hands in-flight jobs back to the queue', async () => {
    const controller = new AbortController();
    const slow = async (url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
      setTimeout(() => controller.abort(new Error('stop')), 20);
    });
    const [source] = await db.collection('scrape_sources').find({ name: 'Hidden Hills College' }).toArray();
    await queue.enqueueSources({ mode: 'selected', sourceIds: [source._id.toString()] });
    const stats = await worker.runWorker({ concurrency: 1, fetchImpl: slow, signal: controller.signal });
    assert.equal(stats.released, 1);
    const job = await db.collection('scrape_jobs').findOne({ sourceId: source._id, open: true });
    assert.deepEqual([job.status, job.attempts, job.lockedBy], ['queued', 0, null]);
  });
});
