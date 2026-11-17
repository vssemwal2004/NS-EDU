import { after, before, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// env.js reads process.env at import time, so configure before importing the app.
// Runs against a throwaway nsedu_test_* database that is dropped afterwards.
const skip = process.env.MONGODB_URI ? false : 'MONGODB_URI is not set';
process.env.MONGODB_DATABASE = `nsedu_test_${randomBytes(4).toString('hex')}`;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.OTP_DELIVERY = 'console';
process.env.SMS_PROVIDER = 'console';
process.env.NODE_ENV = 'test';

const ADMIN = { email: 'reviews-owner@nsedu.test', password: 'correct-horse-battery' };
const review = (overrides = {}) => ({
  name: 'Priya Sharma', stage: 'school', course: 'B.Com', city: 'Dehradun', rating: 5,
  title: 'Helpful comparison', text: 'Comparing annual and semester fees side by side made my shortlist much easier.', consent: true, ...overrides,
});

describe('student reviews API', { skip }, () => {
  let server; let base; let db; let closeDb; let clearReviewCache;
  let owner; let priya; let arjun;

  async function api(path, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(cookie && { cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, setCookies: response.headers.getSetCookie(), headers: response.headers };
  }
  const cookieFrom = (result, name) => result.setCookies.find((item) => item.startsWith(`${name}=`))?.split(';')[0];
  async function signInStudent(identifier) {
    const requested = await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'email', identifier } });
    const verified = await api('/api/auth/otp/verify', { method: 'POST', body: { channel: 'email', identifier, code: requested.body.devCode } });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    return cookieFrom(verified, 'nsedu_student');
  }
  // The 30-second "just saved" guard is real behaviour; tests move the clock back instead of waiting.
  const ageReviews = () => db.collection('reviews').updateMany({}, { $set: { submittedAt: new Date(Date.now() - 60_000) } });

  before(async () => {
    mock.method(console, 'log', () => {});
    const [{ app }, collections, { hashPassword }, service] = await Promise.all([
      import('../src/app.js'), import('../src/db/collections.js'), import('../src/lib/password.js'), import('../src/modules/reviews/reviews-service.js'),
    ]);
    ({ closeDb } = collections);
    ({ clearReviewCache } = service);
    db = await collections.getDb();
    await db.collection('admins').insertOne({ email: ADMIN.email, role: 'admin', passwordHash: await hashPassword(ADMIN.password), createdAt: new Date(), lastLoginAt: null });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    owner = cookieFrom(await api('/api/admin/auth/login', { method: 'POST', body: ADMIN }), 'nsedu_admin');
    priya = await signInStudent('priya@reviews.test');
    arjun = await signInStudent('arjun@reviews.test');
  });

  after(async () => {
    mock.restoreAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db?.databaseName.startsWith('nsedu_test_')) await db.dropDatabase();
    await closeDb?.();
  });

  test('writing a review needs a signed-in student and valid fields', async () => {
    assert.equal((await api('/api/reviews/mine', { method: 'PUT', body: review() })).status, 401);
    const bad = await api('/api/reviews/mine', { method: 'PUT', cookie: priya, body: review({ rating: 0, text: 'short', consent: false }) });
    assert.equal(bad.status, 400);
    assert.deepEqual(Object.keys(bad.body.fields).sort(), ['consent', 'rating', 'text']);
  });

  test('a new review waits for moderation and is not public', async () => {
    const saved = await api('/api/reviews/mine', { method: 'PUT', cookie: priya, body: review() });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.item.status, 'pending');
    assert.equal((await api('/api/reviews/mine', { cookie: priya })).body.item.text, review().text);
    clearReviewCache();
    assert.equal((await api('/api/reviews')).body.items.length, 0);
    assert.equal((await api('/api/reviews/summary')).body.count, 0);
    // Saving again straight away is refused; one review per account is kept.
    assert.equal((await api('/api/reviews/mine', { method: 'PUT', cookie: priya, body: review({ rating: 4 }) })).status, 429);
    assert.equal(await db.collection('reviews').countDocuments({}), 1);
  });

  test('moderation is staff-only; approval publishes with a shortened name', async () => {
    assert.equal((await api('/api/admin/reviews', { cookie: priya })).status, 401);
    const queue = await api('/api/admin/reviews?status=pending', { cookie: owner });
    assert.equal(queue.status, 200);
    assert.deepEqual(queue.body.counts, { pending: 1, approved: 0, rejected: 0 });
    const [item] = queue.body.items;
    assert.equal(item.displayName, 'Priya S.');

    assert.equal((await api(`/api/admin/reviews/${item.id}`, { method: 'PATCH', cookie: owner, body: { featured: true } })).status, 400);
    const approved = await api(`/api/admin/reviews/${item.id}`, { method: 'PATCH', cookie: owner, body: { status: 'approved', featured: true } });
    assert.equal(approved.status, 200);

    const list = await api('/api/reviews');
    assert.equal(list.body.items.length, 1);
    const [shown] = list.body.items;
    assert.equal(shown.name, 'Priya S.');
    assert.equal(shown.featured, true);
    for (const key of ['studentId', 'status', 'consent', 'email']) assert.equal(key in shown, false);
    assert.deepEqual((await api('/api/reviews/summary')).body, { count: 1, average: 5, distribution: [{ stars: 5, count: 1 }, { stars: 4, count: 0 }, { stars: 3, count: 0 }, { stars: 2, count: 0 }, { stars: 1, count: 0 }] });
    assert.equal((await api('/api/reviews/highlights')).body.items[0].id, item.id);
  });

  test('editing an approved review sends it back to moderation', async () => {
    await ageReviews();
    const edited = await api('/api/reviews/mine', { method: 'PUT', cookie: priya, body: review({ rating: 4, text: 'Updated: the fee comparison and the counsellor call were both useful to me.' }) });
    assert.equal(edited.body.item.status, 'pending');
    assert.equal((await api('/api/reviews')).body.items.length, 0);
  });

  test('pages follow the cursor and filter by stars', async () => {
    const students = await db.collection('students').find({}).toArray();
    const now = Date.now();
    await db.collection('reviews').insertMany(Array.from({ length: 25 }, (_, index) => ({
      studentId: `seed-${index}`, name: `Student ${index}`, stage: 'college', course: 'B.Tech', institution: '', city: '', title: '',
      text: 'A seeded review for paging tests, long enough to pass.', rating: (index % 5) + 1, status: 'approved', featured: false,
      approvedAt: new Date(now - index * 1000), submittedAt: new Date(now - index * 1000), createdAt: new Date(), updatedAt: new Date(),
    })));
    assert.ok(students.length >= 2);
    clearReviewCache();
    const first = await api('/api/reviews?limit=10');
    assert.equal(first.body.items.length, 10);
    const second = await api(`/api/reviews?limit=10&cursor=${first.body.nextCursor}`);
    const third = await api(`/api/reviews?limit=10&cursor=${second.body.nextCursor}`);
    assert.equal(third.body.items.length, 5);
    assert.equal(third.body.nextCursor, null);
    const ids = [...first.body.items, ...second.body.items, ...third.body.items].map((item) => item.id);
    assert.equal(new Set(ids).size, 25);
    const fives = await api('/api/reviews?rating=5&limit=30');
    assert.equal(fives.body.items.length, 5);
    assert.ok(fives.body.items.every((item) => item.rating === 5));
    assert.equal((await api('/api/reviews/summary')).body.count, 25);
  });

  test('rejecting shows the reason to the author; authors can delete their review', async () => {
    const pending = (await api('/api/admin/reviews?status=pending', { cookie: owner })).body.items[0];
    await api(`/api/admin/reviews/${pending.id}`, { method: 'PATCH', cookie: owner, body: { status: 'rejected', rejectReason: 'Not about Gyaan Vidhya' } });
    const mine = await api('/api/reviews/mine', { cookie: priya });
    assert.equal(mine.body.item.status, 'rejected');
    assert.equal(mine.body.item.rejectReason, 'Not about Gyaan Vidhya');
    assert.equal((await api('/api/reviews/mine', { method: 'DELETE', cookie: priya })).status, 204);
    assert.equal((await api('/api/reviews/mine', { cookie: priya })).body.item, null);
    assert.equal((await api('/api/reviews/mine', { method: 'DELETE', cookie: arjun })).status, 404);
  });

  test('staff can delete a review and the deletion is audited', async () => {
    const [item] = (await api('/api/admin/reviews?status=approved&limit=1', { cookie: owner })).body.items;
    assert.equal((await api(`/api/admin/reviews/${item.id}`, { method: 'DELETE', cookie: owner })).status, 204);
    assert.equal((await api(`/api/admin/reviews/${item.id}`, { method: 'DELETE', cookie: owner })).status, 404);
    assert.equal(await db.collection('audit_logs').countDocuments({ action: 'review.delete', targetId: item.id }), 1);
  });
});
