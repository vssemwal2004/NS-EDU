import { after, before, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// env.js reads process.env at import time, so configure before importing the app.
const skip = process.env.MONGODB_URI ? false : 'MONGODB_URI is not set';
process.env.MONGODB_DATABASE = `nsedu_test_${randomBytes(4).toString('hex')}`;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.NODE_ENV = 'test';

const ADMIN = { email: 'content-admin@nsedu.test', password: 'correct-horse-battery' };
const EMPLOYEE = { email: 'content-employee@nsedu.test', password: 'Employee!pass1' };

describe('site content API', { skip }, () => {
  let server; let base; let db; let closeDb; let service; let registry;
  let adminCookie; let employeeCookie;

  async function api(path, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(cookie && { cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
  }
  async function login({ email, password }) {
    const result = await fetch(`${base}/api/admin/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(result.status, 200);
    return result.headers.getSetCookie().find((item) => item.startsWith('nsedu_admin=')).split(';')[0];
  }

  before(async () => {
    mock.method(console, 'log', () => {});
    const [{ app }, collections, { hashPassword }] = await Promise.all([import('../src/app.js'), import('../src/db/collections.js'), import('../src/lib/password.js')]);
    service = await import('../src/modules/content/content-service.js');
    registry = await import('../src/modules/content/registry.js');
    ({ closeDb } = collections);
    db = await collections.getDb();
    const now = new Date();
    await db.collection('admins').insertMany([
      { email: ADMIN.email, name: 'Content Admin', role: 'admin', passwordHash: await hashPassword(ADMIN.password), createdAt: now, lastLoginAt: null },
      { email: EMPLOYEE.email, phone: '9999999999', role: 'employee', passwordHash: await hashPassword(EMPLOYEE.password), mustChangePassword: false, createdAt: now, lastLoginAt: null },
    ]);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    [adminCookie, employeeCookie] = [await login(ADMIN), await login(EMPLOYEE)];
  });

  after(async () => {
    mock.restoreAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.dropDatabase();
    await closeDb?.();
  });

  test('every default passes its own validator', () => {
    for (const [key, spec] of Object.entries(registry.CONTENT_KEYS)) {
      assert.deepEqual(registry.validateContent(key, spec.defaults), {}, key);
    }
  });

  test('seeding inserts missing keys and never overwrites edited content unless forced', async () => {
    const first = await service.seedContentDefaults(db);
    assert.equal(first.inserted, Object.keys(registry.CONTENT_KEYS).length);
    const site = await service.getContentEntry('site');
    await service.setContentEntry('site', { ...site, tagline: 'Edited tagline' }, { updatedBy: 'test' });

    const again = await service.seedContentDefaults(db);
    assert.deepEqual(again, { inserted: 0, reset: 0, kept: Object.keys(registry.CONTENT_KEYS).length });
    assert.equal((await service.getContentEntry('site')).tagline, 'Edited tagline');

    const forced = await service.seedContentDefaults(db, { force: true });
    assert.equal(forced.reset, Object.keys(registry.CONTENT_KEYS).length);
    assert.equal((await service.getContentEntry('site')).tagline, registry.CONTENT_KEYS.site.defaults.tagline);
    const stored = await db.collection('site_content').findOne({ key: 'site' });
    assert.equal(stored.history.at(-1).data.tagline, 'Edited tagline');
    assert.equal(await db.collection('site_content').countDocuments({}), Object.keys(registry.CONTENT_KEYS).length);
  });

  test('public endpoint returns only the requested known keys with a short public cache', async () => {
    const ok = await api('/api/content?keys=site,media,site');
    assert.equal(ok.status, 200);
    assert.deepEqual(Object.keys(ok.body).sort(), ['media', 'site']);
    assert.equal(ok.body.site.name, 'Gyaan Vidhya');
    assert.match(ok.body.media.hero.src, /^\/images\//);
    assert.equal(ok.headers.get('cache-control'), 'public, max-age=60, stale-while-revalidate=300');
    assert.equal(ok.body.site.history, undefined);

    const unknown = await api('/api/content?keys=site,secrets');
    assert.equal(unknown.status, 400);
    assert.match(unknown.body.error, /secrets/);
    assert.ok(unknown.body.allowed.includes('landing'));
    assert.equal((await api('/api/content')).status, 400);
    assert.equal((await api('/api/content?keys=__proto__')).status, 400);
  });

  test('admin content routes are administrator-only', async () => {
    assert.equal((await api('/api/admin/content')).status, 401);
    assert.equal((await api('/api/admin/content', { cookie: employeeCookie })).status, 403);
    assert.equal((await api('/api/admin/content/site', { method: 'PUT', cookie: employeeCookie, body: { data: {} } })).status, 403);
    assert.equal((await api('/api/admin/content/site/reset', { method: 'POST', cookie: employeeCookie })).status, 403);

    const list = await api('/api/admin/content', { cookie: adminCookie });
    assert.equal(list.status, 200);
    assert.equal(list.headers.get('cache-control'), 'no-store');
    assert.deepEqual(list.body.items.map((item) => item.key), Object.keys(registry.CONTENT_KEYS));
    for (const item of list.body.items) assert.ok(item.label && item.description && item.size > 0 && item.updatedAt);
    assert.equal((await api('/api/admin/content/nope', { cookie: adminCookie })).status, 404);
  });

  test('validation rejects malformed content with field errors', async () => {
    const put = (key, data) => api(`/api/admin/content/${key}`, { method: 'PUT', cookie: adminCookie, body: { data } });
    assert.equal((await api('/api/admin/content/site', { method: 'PUT', cookie: adminCookie, body: { name: 'x' } })).status, 400);
    assert.equal((await put('site', ['not', 'an', 'object'])).status, 400);

    const site = (await api('/api/admin/content/site', { cookie: adminCookie })).body.item.data;
    const missing = await put('site', { ...site, socials: 'none', name: undefined });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.fields.socials, 'Must be a list');
    assert.equal(missing.body.fields.name, 'This property is required');

    const media = (await api('/api/admin/content/media', { cookie: adminCookie })).body.item.data;
    const badSrc = await put('media', { ...media, hero: { ...media.hero, src: 'javascript:alert(1)' } });
    assert.equal(badSrc.status, 400);
    assert.ok(badSrc.body.fields['hero.src']);
    const cloud = await put('media', { ...media, hero: { ...media.hero, src: 'https://res.cloudinary.com/demo/image/upload/v1/hero.png' } });
    assert.equal(cloud.status, 200);

    const budget = (await api('/api/admin/content/budget', { cookie: adminCookie })).body.item.data;
    const noDeposit = await put('budget', { ...budget, costFields: budget.costFields.filter((field) => field.id !== 'deposit') });
    assert.equal(noDeposit.status, 400);
    assert.match(noDeposit.body.fields.costFields, /deposit/);

    assert.equal((await put('landing', { fields: [], shortcuts: [], featureDirectory: [], fieldIcons: { '$where': 'x' } })).status, 400);
    assert.equal((await put('landing', { fields: [], shortcuts: [], featureDirectory: [], fieldIcons: { 'a.b': 'x' } })).status, 400);
    const huge = await put('news', { topics: [], imagePolicy: { mode: 'reviewed', reviewedUrls: ['x'.repeat(300 * 1024)] } });
    assert.ok([400, 413].includes(huge.status));
  });

  test('edits keep the last five versions and can be restored or reset', async () => {
    const path = '/api/admin/content/explorer';
    const start = (await api(path, { cookie: adminCookie })).body.item;
    let updatedAt = start.updatedAt;
    for (const year of ['A', 'B', 'C', 'D', 'E', 'F']) {
      const saved = await api(path, { method: 'PUT', cookie: adminCookie, body: { data: { ...start.data, tuitionYear: year }, updatedAt } });
      assert.equal(saved.status, 200, JSON.stringify(saved.body));
      assert.equal(saved.body.item.updatedBy, ADMIN.email);
      updatedAt = saved.body.item.updatedAt;
    }
    const stale = await api(path, { method: 'PUT', cookie: adminCookie, body: { data: start.data, updatedAt: start.updatedAt } });
    assert.equal(stale.status, 409);

    const detail = (await api(path, { cookie: adminCookie })).body.item;
    assert.equal(detail.data.tuitionYear, 'F');
    assert.deepEqual(detail.history.map((item) => item.data.tuitionYear), ['E', 'D', 'C', 'B', 'A']);
    assert.equal((await api('/api/content?keys=explorer')).body.explorer.tuitionYear, 'F');

    const restored = await api(`${path}/restore`, { method: 'POST', cookie: adminCookie, body: { index: 2 } });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.item.data.tuitionYear, 'C');
    assert.equal(restored.body.item.history[0].data.tuitionYear, 'F');
    assert.equal(restored.body.item.history.length, 5);
    assert.equal((await api('/api/content?keys=explorer')).body.explorer.tuitionYear, 'C');
    assert.equal((await api(`${path}/restore`, { method: 'POST', cookie: adminCookie, body: { index: 9 } })).status, 400);

    const reset = await api(`${path}/reset`, { method: 'POST', cookie: adminCookie });
    assert.equal(reset.status, 200);
    assert.deepEqual(reset.body.item.data, registry.CONTENT_KEYS.explorer.defaults);
    assert.equal(reset.body.item.history[0].data.tuitionYear, 'C');
  });
});
