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
// A fake account: signing is local, and image fields must point at this cloud's delivery URLs.
process.env.CLOUDINARY_URL = 'cloudinary://123456789:test-secret@testcloud';

const ADMIN = { email: 'owner@nsedu.test', password: 'correct-horse-battery' };
const OWN_IMAGE = 'https://res.cloudinary.com/testcloud/image/upload/v1/gyaan-vidhya/place/mumbai.jpg';

describe('study locations', { skip }, () => {
  let server; let base; let db; let closeDb; let resetRateLimits; let owner; let employee;

  async function api(path, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(cookie && { cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text, setCookies: response.headers.getSetCookie() };
  }
  const cookieFrom = (result, name) => result.setCookies.find((item) => item.startsWith(`${name}=`))?.split(';')[0];
  const post = (resource, body, cookie = owner) => api(`/api/admin/${resource}`, { method: 'POST', cookie, body });
  const locations = async () => (await api('/api/catalog/locations')).body;
  const counts = (places) => places.map((place) => [place.name, place.institutions]);

  before(async () => {
    mock.method(console, 'log', () => {});
    const [{ app }, collections, rateLimit, { hashPassword }] = await Promise.all([
      import('../src/app.js'), import('../src/db/collections.js'), import('../src/lib/rate-limit.js'), import('../src/lib/password.js'),
    ]);
    ({ closeDb } = collections);
    ({ resetRateLimits } = rateLimit);
    db = await collections.getDb();
    const now = new Date();
    await db.collection('admins').insertOne({ email: ADMIN.email, role: 'admin', passwordHash: await hashPassword(ADMIN.password), createdAt: now, lastLoginAt: null });
    let n = 0;
    const at = (city, state, extra = {}) => ({ slug: `inst-${n += 1}`, name: `Institution ${n}`, city, district: city, state, active: true, createdAt: now, ...extra });
    await db.collection('institutions').insertMany([
      at('Pune City', 'Maharashtra', { district: 'Pune' }), at('Pune', 'Maharashtra'), at('Mumbai Suburban', 'Maharashtra'),
      at('Bengaluru Urban', 'Karnataka'), at('Bangalore', 'Karnataka'),
      // Delhi NCR: every NCT district plus the satellite cities in Haryana and Uttar Pradesh.
      at('South West', 'Delhi'), at('New Delhi', 'Delhi'), at('Gurugram', 'Haryana'), at('Gurgaon', 'Haryana'),
      at('Gautam Buddha Nagar', 'Uttar Pradesh'), at('Ghaziabad', 'Uttar Pradesh'),
      at('Bhubaneswar', 'Orissa'),
      at('', 'Telangana', { district: 'Hyderabad' }),
      at('Chennai', 'Tamil Nadu'),
      // Not public: never counted.
      at('Kochi', 'Kerala', { active: false }), at('Panaji', 'Goa', { verification: 'rejected' }),
    ]);
    await db.collection('cities').insertMany(['Kolkata', 'Mumbai', 'Hyderabad', 'Pune', 'Bengaluru', 'Delhi NCR']
      .map((name, order) => ({ name, landmark: '', crop: null, featured: order < 3, order, active: true })));
    await db.collection('states').insertMany([
      { name: 'Karnataka', landmark: 'Mysore Palace', crop: [1, 2, 3, 4], featured: true, order: 0, active: true },
      { name: 'Maharashtra', landmark: '', crop: null, featured: false, order: 1, active: true },
      // Hidden by an admin, so it must not come back as a synthesized tile.
      { name: 'Tamil Nadu', landmark: '', crop: null, featured: true, order: 2, active: false },
    ]);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    owner = cookieFrom(await api('/api/admin/auth/login', { method: 'POST', body: ADMIN }), 'nsedu_admin');
    const created = await post('employees', { email: 'staff@nsedu.test', phone: '+919876500000', password: 'Temporary!Pass9' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    employee = cookieFrom(await api('/api/admin/auth/login', { method: 'POST', body: { email: 'staff@nsedu.test', password: 'Temporary!Pass9' } }), 'nsedu_admin');
    assert.equal((await api('/api/admin/auth/change-password', { method: 'POST', cookie: employee, body: { currentPassword: 'Temporary!Pass9', newPassword: 'Changed!Pass9' } })).status, 200);
  });

  after(async () => {
    mock.restoreAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.dropDatabase();
    await closeDb?.();
  });

  beforeEach(() => resetRateLimits());

  test('cities are ordered by institution count, with aliases and qualifiers folded into each tile', async () => {
    const { cities, totals } = await locations();
    // Ties fall back to the name; stored featured/order flags no longer decide anything.
    assert.deepEqual(counts(cities), [['Delhi NCR', 6], ['Bengaluru', 2], ['Pune', 2], ['Hyderabad', 1], ['Mumbai', 1], ['Kolkata', 0]]);
    assert.deepEqual(cities[0], { name: 'Delhi NCR', landmark: '', crop: null, featured: false, institutions: 6, image: null });
    assert.equal(totals.states, 8, 'Orissa is folded into Odisha; hidden and rejected records are not counted');
  });

  test('a city tile’s directory link lists exactly the institutions its count covers', async () => {
    const directoryTotal = async (query) => {
      const result = await api(`/api/universities?${new URLSearchParams(query)}`, { cookie: owner });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      return result.body.total;
    };
    for (const city of (await locations()).cities) assert.equal(await directoryTotal({ city: city.name }), city.institutions, city.name);
    // The state + city facet stays an exact match on the stored city.
    assert.equal(await directoryTotal({ state: 'Karnataka', city: 'Bangalore' }), 1);
    assert.equal(await directoryTotal({ city: 'Nowhere' }), 0);
  });

  test('states are ordered by count and include states that have institutions but no curated entry', async () => {
    const { states } = await locations();
    assert.deepEqual(counts(states), [
      ['Maharashtra', 3], ['Delhi', 2], ['Haryana', 2], ['Karnataka', 2], ['Uttar Pradesh', 2], ['Odisha', 1], ['Telangana', 1],
    ]);
    assert.deepEqual(states.find((state) => state.name === 'Karnataka'), { name: 'Karnataka', landmark: 'Mysore Palace', crop: [1, 2, 3, 4], featured: true, institutions: 2, image: null });
    assert.deepEqual(states.find((state) => state.name === 'Delhi'), { name: 'Delhi', landmark: '', crop: null, featured: false, institutions: 2, image: null });
    assert.ok(!states.some((state) => ['Tamil Nadu', 'Kerala', 'Goa'].includes(state.name)), 'hidden states and non-public institutions stay out');
  });

  test('place images must be this account’s Cloudinary delivery URLs', async () => {
    const meta = (await api('/api/admin/resources', { cookie: owner })).body.resources.cities.fields.find((field) => field.name === 'imageUrl');
    assert.deepEqual([meta.type, meta.usage], ['image', 'place']);

    const [mumbai] = (await api('/api/admin/cities?q=Mumbai', { cookie: owner })).body.items;
    for (const imageUrl of ['https://example.com/mumbai.jpg', 'https://res.cloudinary.com/othercloud/image/upload/mumbai.jpg', 'http://res.cloudinary.com/testcloud/image/upload/mumbai.jpg', 'javascript:alert(1)']) {
      const rejected = await api(`/api/admin/cities/${mumbai.id}`, { method: 'PATCH', cookie: owner, body: { imageUrl } });
      assert.equal(rejected.status, 400, imageUrl);
      assert.ok(rejected.body.fields.imageUrl, imageUrl);
    }
    assert.equal((await post('states', { name: 'Kerala', imageUrl: 'https://example.com/kerala.jpg' })).status, 400);

    const saved = await api(`/api/admin/cities/${mumbai.id}`, { method: 'PATCH', cookie: owner, body: { imageUrl: OWN_IMAGE, imageAlt: 'Gateway of India at dusk' } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual((await locations()).cities.find((city) => city.name === 'Mumbai').image, { url: OWN_IMAGE, alt: 'Gateway of India at dusk' });

    // The alt text falls back to the place name, and clearing the URL removes the image.
    await api(`/api/admin/cities/${mumbai.id}`, { method: 'PATCH', cookie: owner, body: { imageAlt: '' } });
    assert.deepEqual((await locations()).cities.find((city) => city.name === 'Mumbai').image, { url: OWN_IMAGE, alt: 'Mumbai' });
    await api(`/api/admin/cities/${mumbai.id}`, { method: 'PATCH', cookie: owner, body: { imageUrl: '' } });
    assert.equal((await locations()).cities.find((city) => city.name === 'Mumbai').image, null);
  });

  test('uploads can be signed for place images and counsellor photos', async () => {
    for (const usage of ['place', 'counsellor']) {
      const signed = await api('/api/admin/media/sign', { method: 'POST', cookie: owner, body: { usage } });
      assert.equal(signed.status, 200, JSON.stringify(signed.body));
      assert.match(signed.body.folder, new RegExp(`/${usage}$`));
    }
  });

  test('only administrators can edit places', async () => {
    const [pune] = (await api('/api/admin/cities?q=Pune', { cookie: owner })).body.items;
    assert.equal((await api(`/api/admin/cities/${pune.id}`, { method: 'PATCH', cookie: employee, body: { imageUrl: OWN_IMAGE } })).status, 403);
    assert.equal((await post('states', { name: 'Goa' }, employee)).status, 403);
    assert.equal((await api(`/api/admin/cities/${pune.id}`, { method: 'PATCH', body: { imageUrl: OWN_IMAGE } })).status, 401);
    assert.equal((await locations()).cities.find((city) => city.name === 'Pune').image, null);
  });
});
