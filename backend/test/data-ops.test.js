import { after, before, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const skip = process.env.MONGODB_URI ? false : 'MONGODB_URI is not set';
process.env.MONGODB_DATABASE = `nsedu_test_${randomBytes(4).toString('hex')}`;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.NODE_ENV = 'test';

const ADMIN = { email: 'data-admin@nsedu.test', password: 'correct-horse-battery' };
const CSV = `name,city,state,website,streams,coursesOffered,approvals,establishedYear,Notes
Data Ops Test University,Pune,Maharashtra,https://dotu-example.ac.in/,"Engineering; Management","B.Tech (CSE, AI); MBA",UGC,1999,ignored
Data Ops Test College,Nagpur,,https://dotc-example.ac.in/,"Science, Commerce",,,"",
Data Ops Test Broken,,Goa,not-a-url,,,,1700,
`;

describe('admin data operations API', { skip }, () => {
  let server; let base; let db; let closeDb; let cookie;

  async function call(path, { method = 'GET', body, type = 'application/json', raw = false, cookie: sessionCookie = cookie } = {}) {
    const response = await fetch(`${base}/api/admin/data-ops${path}`, {
      method,
      headers: { ...(body !== undefined && { 'content-type': type }), ...(sessionCookie && { cookie: sessionCookie }) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, body: raw || !text || !response.headers.get('content-type')?.includes('json') ? null : JSON.parse(text) };
  }

  before(async () => {
    mock.method(console, 'log', () => {});
    const [{ app }, collections, { hashPassword }] = await Promise.all([import('../src/app.js'), import('../src/db/collections.js'), import('../src/lib/password.js')]);
    ({ closeDb } = collections);
    db = await collections.getDb();
    await db.collection('admins').insertOne({ email: ADMIN.email, name: 'Data Admin', role: 'admin', passwordHash: await hashPassword(ADMIN.password), createdAt: new Date(), lastLoginAt: null });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(`${base}/api/admin/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ADMIN) });
    cookie = login.headers.getSetCookie().find((item) => item.startsWith('nsedu_admin=')).split(';')[0];
  });

  after(async () => {
    mock.restoreAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.dropDatabase();
    await closeDb?.();
  });

  test('requires an administrator session', async () => {
    assert.equal((await call('/overview', { cookie: '' })).status, 401);
  });

  test('template and CSV import: dry run, then import, with list cells and row errors', async () => {
    const template = await call('/universities/template.csv', { raw: true });
    assert.equal(template.status, 200);
    assert.match(template.headers.get('content-type'), /text\/csv/);
    const columns = template.text.replace(/^﻿/, '').trim().split(',');
    assert.deepEqual(columns.slice(0, 3), ['slug', 'name', 'shortName']);
    assert.ok(columns.includes('sourceUrl') && !columns.includes('verification') && !columns.includes('active'));

    const dry = await call('/universities/import?format=csv&dryRun=true&publish=false', { method: 'POST', body: CSV, type: 'text/csv' });
    assert.equal(dry.status, 200, dry.text);
    assert.deepEqual([dry.body.rows, dry.body.inserted, dry.body.failed, dry.body.dryRun], [3, 2, 1, true]);
    assert.deepEqual(dry.body.ignoredColumns, ['Notes']);
    // A state without a city is enough to place a record; the bad year and URL still fail the row.
    assert.deepEqual(Object.keys(dry.body.errors[0].errors).sort(), ['establishedYear', 'website']);
    assert.equal(await db.collection('institutions').countDocuments(), 0);

    const real = await call('/universities/import?format=csv&publish=false&sourceName=Test%20directory&sourceUrl=https%3A%2F%2Fdirectory.example.org%2Flist', { method: 'POST', body: CSV, type: 'text/csv' });
    assert.deepEqual([real.body.inserted, real.body.failed, real.body.dryRun, real.body.publish], [2, 1, false, false]);
    const university = await db.collection('institutions').findOne({ name: 'Data Ops Test University' });
    assert.deepEqual(university.streams, ['Engineering', 'Management']);
    assert.deepEqual(university.coursesOffered, ['B.Tech (CSE, AI)', 'MBA']);
    assert.deepEqual([university.active, university.verification, university.source.kind, university.source.name, university.source.url], [false, 'unverified', 'import', 'Test directory', 'https://directory.example.org/list']);
    assert.deepEqual((await db.collection('institutions').findOne({ name: 'Data Ops Test College' })).streams, ['Science', 'Commerce']);

    const json = await call('/universities/import', { method: 'POST', body: { format: 'json', content: JSON.stringify([{ name: 'Data Ops Test University', city: 'Pune', state: 'Maharashtra', website: 'https://dotu-example.ac.in/', establishedYear: 1998 }]), publish: true } });
    assert.deepEqual([json.body.inserted, json.body.updated], [0, 1]);
    assert.equal((await db.collection('institutions').findOne({ name: 'Data Ops Test University' })).establishedYear, 1998);
  });

  test('import accepts files above the global 100 kB JSON limit and rejects bad input', async () => {
    const padding = 'x'.repeat(60_000);
    const big = `name,city,Comment\nData Ops Test Large One,Agra,${padding}\nData Ops Test Large Two,Agra,${padding}\n`;
    const response = await call('/universities/import?format=csv&dryRun=1', { method: 'POST', body: big, type: 'text/plain' });
    assert.equal(response.status, 200, response.text);
    assert.equal(response.body.inserted, 2);
    assert.equal((await call('/universities/import?format=csv', { method: 'POST', body: `name\n${'y'.repeat(5.2 * 1024 * 1024)}`, type: 'text/csv' })).status, 413);
    assert.equal((await call('/universities/import?format=xml', { method: 'POST', body: 'a', type: 'text/plain' })).status, 400);
    assert.equal((await call('/universities/import?format=csv', { method: 'POST', body: 'city\nPune', type: 'text/csv' })).status, 400);
    assert.equal((await call('/universities/import', { method: 'POST', body: { format: 'json', content: '{"items": 3}' } })).status, 400);
    const tooMany = `name,city\n${Array.from({ length: 5001 }, (_, index) => `N${index},C`).join('\n')}`;
    assert.equal((await call('/universities/import?format=csv&dryRun=1', { method: 'POST', body: tooMany, type: 'text/csv' })).status, 400);
  });

  test('review queue, bulk actions and CSV export', async () => {
    const held = await call('/review?view=held');
    assert.deepEqual(held.body.items.map((item) => item.name).sort(), ['Data Ops Test College', 'Data Ops Test University']);
    const college = held.body.items.find((item) => item.name === 'Data Ops Test College');
    assert.deepEqual(college.missing, ['state']);
    assert.equal(college.source.kind, 'import');
    assert.deepEqual(held.body.counts, { held: 2, visible: 0 });
    assert.equal((await call('/review?view=held&q=college')).body.total, 1);

    const ids = held.body.items.map((item) => item.id);
    assert.equal((await call('/universities/bulk', { method: 'POST', body: { ids, action: 'delete' } })).status, 400);
    assert.equal((await call('/universities/bulk', { method: 'POST', body: { ids: ['bad'], action: 'hide' } })).status, 400);
    assert.equal((await call('/universities/bulk', { method: 'POST', body: { ids: Array.from({ length: 501 }, () => '0'.repeat(24)), action: 'hide' } })).status, 400);
    const published = await call('/universities/bulk', { method: 'POST', body: { ids: [college.id], action: 'publish' } });
    assert.deepEqual(published.body, { action: 'publish', matched: 1, modified: 1 });
    assert.deepEqual((await call('/review?view=visible')).body.items.map((item) => item.id), [college.id]);
    const verified = await call('/universities/bulk', { method: 'POST', body: { ids, action: 'verify' } });
    assert.equal(verified.body.modified, 2);
    const stored = await db.collection('institutions').findOne({ name: 'Data Ops Test University' });
    assert.deepEqual([stored.verification, stored.active, stored.reviewedBy], ['verified', true, ADMIN.email]);
    assert.equal((await call('/review?view=all')).body.total, 0);
    await call('/universities/bulk', { method: 'POST', body: { ids: [college.id], action: 'reject' } });
    assert.deepEqual(await db.collection('institutions').findOne({ name: 'Data Ops Test College' }, { projection: { _id: 0, verification: 1, active: 1 } }), { verification: 'rejected', active: false });

    const csv = await call('/universities/export.csv?verification=verified', { raw: true });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-disposition'), /attachment; filename="universities-\d{4}-\d{2}-\d{2}\.csv"/);
    const lines = csv.text.replace(/^﻿/, '').trim().split('\r\n');
    assert.equal(lines.length, 2);
    assert.ok(lines[0].startsWith('id,slug,name,'));
    assert.match(lines[1], /Data Ops Test University/);
    assert.match(lines[1], /"Engineering; Management"/);
    const all = await call('/universities/export.csv', { raw: true });
    assert.equal(all.text.trim().split('\r\n').length, 3);

    const overview = await call('/overview');
    assert.deepEqual([overview.body.institutions.total, overview.body.institutions.verified, overview.body.institutions.rejected, overview.body.institutions.bySource.import], [2, 1, 1, 2]);
    assert.equal(overview.body.scraper.jobs.queued, 0);
  });

  test('scraper sources, seed upload, queue management and stats', async () => {
    const created = await call('/scraper/sources', { method: 'POST', body: { name: 'Data Ops Test Source', website: 'www.dots-example.ac.in', state: 'tamil nadu', city: 'Chennai' } });
    assert.equal(created.status, 201, created.text);
    assert.deepEqual([created.body.item.website, created.body.item.state, created.body.item.domain, created.body.item.status], ['https://www.dots-example.ac.in/', 'Tamil Nadu', 'dots-example.ac.in', 'active']);
    assert.equal((await call('/scraper/sources', { method: 'POST', body: { name: 'Again', website: 'http://dots-example.ac.in' } })).status, 409);
    assert.equal((await call('/scraper/sources', { method: 'POST', body: { name: '', website: 'javascript:alert(1)' } })).status, 400);

    const upload = await call('/scraper/sources/import?format=csv&seedListName=Directory%20download', { method: 'POST', body: 'College Name,Website URL,State Name\nData Ops Seed One,seed-one-example.ac.in,Assam\nData Ops Seed Two,,Assam\n', type: 'text/csv' });
    assert.deepEqual([upload.body.inserted, upload.body.failed], [1, 1]);
    const listed = await call('/scraper/sources?q=data%20ops%20seed');
    assert.deepEqual(listed.body.items.map((item) => [item.name, item.seedListName]), [['Data Ops Seed One', 'Directory download']]);

    const paused = await call(`/scraper/sources/${created.body.item.id}`, { method: 'PATCH', body: { status: 'paused' } });
    assert.equal(paused.body.item.status, 'paused');
    const run = await call('/scraper/enqueue', { method: 'POST', body: { mode: 'all' } });
    assert.deepEqual([run.status, run.body.queued], [201, 1], 'paused sources are not queued');
    const selected = await call('/scraper/enqueue', { method: 'POST', body: { mode: 'selected', sourceIds: [listed.body.items[0].id] } });
    assert.deepEqual([selected.body.queued, selected.body.alreadyQueued], [0, 1]);
    assert.equal((await call('/scraper/enqueue', { method: 'POST', body: { mode: 'selected', sourceIds: ['x'] } })).status, 400);

    const jobs = await call('/scraper/jobs?status=queued');
    assert.deepEqual(jobs.body.items.map((item) => [item.name, item.status, item.runId]), [['Data Ops Seed One', 'queued', run.body.runId]]);
    const stats = await call('/scraper/stats');
    assert.deepEqual([stats.body.jobs.queued, stats.body.sources.total, stats.body.sources.paused, stats.body.lastRun.id], [1, 2, 1, run.body.runId]);
    assert.equal((await call('/scraper/runs')).body.items[0].counts.queued, 1);
    assert.deepEqual((await call('/scraper/jobs/cancel', { method: 'POST', body: { runId: run.body.runId } })).body, { cancelled: 1 });
    assert.deepEqual((await call('/scraper/jobs/retry', { method: 'POST', body: {} })).body, { retried: 0, skipped: 0 });
    assert.deepEqual((await call('/scraper/jobs/retry', { method: 'POST', body: { ids: [jobs.body.items[0].id] } })).body, { retried: 1, skipped: 0 });
    assert.equal((await call(`/scraper/sources/${listed.body.items[0].id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await call('/scraper/jobs?status=cancelled')).body.total, 1, 'deleting a source cancels its queued job');
    assert.equal((await call(`/scraper/sources/${listed.body.items[0].id}`, { method: 'DELETE' })).status, 404);
  });
});
