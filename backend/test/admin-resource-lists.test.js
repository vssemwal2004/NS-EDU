import { after, before, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// env.js reads process.env at import time, so configure before importing the app.
const skip = process.env.MONGODB_URI ? false : 'MONGODB_URI is not set';
process.env.MONGODB_DATABASE = `nsedu_test_${randomBytes(4).toString('hex')}`;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.OTP_DELIVERY = 'console';
process.env.SMS_PROVIDER = 'console';
process.env.NODE_ENV = 'test';

const ADMIN = { email: 'owner@nsedu.test', password: 'correct-horse-battery' };

describe('admin catalogue lists: projection, stats, filters and bulk actions', { skip }, () => {
  let server; let base; let db; let closeDb; let resetRateLimits; let owner;

  async function api(path, { method = 'GET', body, cookie = owner } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(cookie && { cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text, setCookies: response.headers.getSetCookie() };
  }

  before(async () => {
    mock.method(console, 'log', () => {});
    const [{ app }, collections, rateLimit, { hashPassword }, { derivedFields }] = await Promise.all([
      import('../src/app.js'), import('../src/db/collections.js'), import('../src/lib/rate-limit.js'), import('../src/lib/password.js'), import('../src/modules/universities/normalize.js'),
    ]);
    ({ closeDb } = collections);
    ({ resetRateLimits } = rateLimit);
    db = await collections.getDb();
    const now = new Date();
    await db.collection('admins').insertOne({ email: ADMIN.email, role: 'admin', passwordHash: await hashPassword(ADMIN.password), createdAt: now, lastLoginAt: null });
    const institution = (n, extra = {}) => {
      const doc = { slug: `inst-${n}`, name: `Test Institute ${n}`, city: 'Dehradun', state: 'Uttarakhand', type: 'college', active: true, verification: 'unverified',
        website: `https://inst-${n}.example.in`, about: 'x'.repeat(2000), coursesOffered: Array.from({ length: 50 }, (_, index) => `Programme ${index}`),
        programmesOffered: [{ name: 'B.Tech', annualFeeInr: n === 1 ? 150000 : null }], source: { kind: 'scrape', name: 'Official website' }, createdAt: now, updatedAt: now, ...extra };
      return { ...doc, ...derivedFields(doc) };
    };
    await db.collection('institutions').insertMany([
      institution(1), institution(2, { website: '' }), institution(3, { active: false, state: 'Delhi', city: 'New Delhi' }), institution(4, { verification: 'verified' }),
    ]);
    await db.collection('programmes').insertOne({ slug: 'inst-4-btech', institutionSlug: 'inst-4', courseSlug: 'btech', annualTuitionInr: 1, active: true });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    const login = await api('/api/admin/auth/login', { method: 'POST', body: ADMIN, cookie: null });
    owner = login.setCookies.find((item) => item.startsWith('nsedu_admin='))?.split(';')[0];
  });

  after(async () => {
    mock.restoreAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db?.databaseName.startsWith('nsedu_test_')) await db.dropDatabase();
    await closeDb?.();
  });

  beforeEach(() => resetRateLimits());

  test('the list returns only the table columns; the record endpoint returns everything', async () => {
    const list = await api('/api/admin/institutions?limit=25');
    assert.equal(list.status, 200);
    assert.equal(list.body.total, 4);
    const row = list.body.items.find((item) => item.slug === 'inst-1');
    assert.deepEqual(Object.keys(row).sort(), ['active', 'city', 'id', 'name', 'slug', 'source', 'state', 'type', 'updatedAt', 'verification', 'website']);
    assert.deepEqual(row.source, { kind: 'scrape' });
    const full = await api(`/api/admin/institutions/${row.id}`);
    assert.equal(full.body.item.about.length, 2000);
    assert.equal(full.body.item.coursesOffered.length, 50);
    assert.equal(full.body.item.searchPrefixes, undefined, 'derived search keys never leave the API');
  });

  test('search and the declared filters narrow the list', async () => {
    const total = async (query) => (await api(`/api/admin/institutions?${new URLSearchParams(query)}`)).body.total;
    assert.equal(await total({ q: 'test inst new del' }), 1, 'every word prefix must match (name and city)');
    assert.equal(await total({ state: 'Uttarakhand' }), 3);
    assert.equal(await total({ active: 'false' }), 1);
    assert.equal(await total({ website: 'no' }), 1);
    assert.equal(await total({ website: 'yes' }), 3);
    assert.equal(await total({ fees: 'yes' }), 1);
    assert.equal(await total({ fees: 'no' }), 3);
    assert.equal(await total({ fees: 'maybe' }), 4, 'an unknown value is ignored, not matched against');
  });

  test('stats count each summary filter and offer the indexed facet values', async () => {
    const { status, body } = await api('/api/admin/institutions/stats');
    assert.equal(status, 200);
    assert.deepEqual(Object.fromEntries(body.stats.map((stat) => [stat.key, stat.value])), { total: 4, published: 3, held: 1, fees: 1, noWebsite: 1 });
    assert.deepEqual(body.options.state, ['Delhi', 'Uttarakhand']);
    assert.equal((await api('/api/admin/nonsense/stats')).status, 404);
  });

  test('bulk publish, unpublish and delete; referenced records are skipped, stats refresh', async () => {
    const items = (await api('/api/admin/institutions?limit=25')).body.items;
    const id = (slug) => items.find((item) => item.slug === slug).id;
    const hide = await api('/api/admin/institutions/bulk', { method: 'POST', body: { action: 'unpublish', ids: [id('inst-1'), id('inst-2')] } });
    assert.equal(hide.status, 200);
    assert.equal(hide.body.modified, 2);
    assert.equal((await api('/api/admin/institutions/stats')).body.stats.find((stat) => stat.key === 'published').value, 1, 'writes clear the cached counts');
    const removed = await api('/api/admin/institutions/bulk', { method: 'POST', body: { action: 'delete', ids: [id('inst-1'), id('inst-4')] } });
    assert.equal(removed.body.modified, 1);
    assert.deepEqual(removed.body.skipped.map((row) => row.title), ['Test Institute 4']);
    assert.match(removed.body.skipped[0].reason, /1 programme/);
    assert.equal((await api('/api/admin/institutions/bulk', { method: 'POST', body: { action: 'explode', ids: [id('inst-2')] } })).status, 400);
    assert.equal((await api('/api/admin/institutions/bulk', { method: 'POST', body: { action: 'publish', ids: ['nope'] } })).status, 400);
    assert.equal((await api('/api/admin/institutions/bulk', { method: 'POST', body: { action: 'publish', ids: [id('inst-2')] }, cookie: null })).status, 401);
  });
});
