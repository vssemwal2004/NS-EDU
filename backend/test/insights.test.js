import { after, before, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// env.js reads process.env at import time, so configure before importing the app.
const skip = process.env.MONGODB_URI ? false : 'MONGODB_URI is not set';
process.env.MONGODB_DATABASE = `nsedu_test_${randomBytes(4).toString('hex')}`;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.ADMIN_EMAIL = 'admin@nsedu.test';
process.env.ADMIN_PASSWORD = 'correct-horse-battery';
process.env.OTP_DELIVERY = 'console';
process.env.NODE_ENV = 'test';

const ADMIN = { email: 'admin@nsedu.test', password: 'correct-horse-battery' };

describe('search tracking and recommendations', { skip }, () => {
  let server; let base; let db; let closeDb; let resetRateLimits; let normalize; let recommend; let events;
  let adminCookie; let studentCookie;

  // Activity is only captured for visitors who accepted personalisation cookies, so requests carry
  // that consent unless a test passes `consent: null` (or 'essential') to check the opposite.
  async function api(path, { method = 'GET', body, cookie, headers = {}, consent = 'all' } = {}) {
    const cookies = [consent && `gv_consent=${consent}`, cookie].filter(Boolean).join('; ');
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(cookies && { cookie: cookies }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, setCookies: response.headers.getSetCookie() };
  }
  const cookieFrom = (result, name) => result.setCookies.find((item) => item.startsWith(`${name}=`));
  const cookiePair = (result, name) => cookieFrom(result, name)?.split(';')[0];

  const institution = (doc) => ({
    type: 'university', category: 'other', ownership: 'unknown', aliases: [], approvals: [], streams: [], courseSlugs: [],
    coursesOffered: [], popularity: 0, verification: 'unverified', isIllustrative: false, active: true, lockedFields: [],
    source: { kind: 'import', name: 'test', url: '', fetchedAt: new Date(), fields: [] },
    createdAt: new Date(), updatedAt: new Date(), ...doc, ...normalize.derivedFields(doc),
  });

  const seedEvents = (visitorId, list) => db.collection('student_events').insertMany(list.map((item) => ({
    studentId: null, visitorId, query: '', institutionSlug: '', state: '', city: '', stream: '', courseSlug: '',
    results: null, path: '/universities', ...item,
  })));

  before(async () => {
    mock.method(console, 'log', () => {});
    const [{ app }, collections, rateLimit, { hashPassword }, normalizeModule, recommendModule, eventsModule] = await Promise.all([
      import('../src/app.js'), import('../src/db/collections.js'), import('../src/lib/rate-limit.js'), import('../src/lib/password.js'),
      import('../src/modules/universities/normalize.js'), import('../src/modules/insights/recommend.js'), import('../src/modules/insights/events.js'),
    ]);
    ({ closeDb } = collections);
    ({ resetRateLimits } = rateLimit);
    normalize = normalizeModule; recommend = recommendModule; events = eventsModule;
    db = await collections.getDb();
    await db.collection('admins').insertOne({ email: ADMIN.email, name: 'Test Admin', role: 'admin', passwordHash: await hashPassword(ADMIN.password), createdAt: new Date(), lastLoginAt: null });
    await db.collection('institutions').insertMany([
      institution({ slug: 'pune-institute-of-engineering', name: 'Pune Institute of Engineering', city: 'Pune', state: 'Maharashtra', streams: ['Engineering'], courseSlugs: ['btech'], naacGrade: 'A' }),
      institution({ slug: 'pune-college-of-management', name: 'Pune College of Management', city: 'Pune', state: 'Maharashtra', streams: ['Management'], courseSlugs: ['mba'] }),
      institution({ slug: 'delhi-school-of-engineering', name: 'Delhi School of Engineering', city: 'Delhi', state: 'Delhi', streams: ['Engineering'], courseSlugs: ['btech'] }),
      institution({ slug: 'kolkata-arts-college', name: 'Kolkata Arts College', city: 'Kolkata', state: 'West Bengal', streams: ['Arts & Humanities'], nirfRank: 12, nirfYear: 2024 }),
      institution({ slug: 'hidden-university', name: 'Hidden University', city: 'Pune', state: 'Maharashtra', streams: ['Engineering'], active: false }),
    ]);
    await db.collection('courses').insertOne({ slug: 'btech', name: 'B.Tech', active: true, order: 1 });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    adminCookie = cookiePair(await api('/api/admin/auth/login', { method: 'POST', body: ADMIN }), 'nsedu_admin');
    const identifier = 'viewer@example.com';
    const requested = await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'email', identifier } });
    const verified = await api('/api/auth/otp/verify', { method: 'POST', body: { channel: 'email', identifier, code: requested.body.devCode } });
    studentCookie = cookiePair(verified, 'nsedu_student');
  });

  after(async () => {
    mock.restoreAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.dropDatabase();
    await closeDb?.();
  });

  beforeEach(() => {
    resetRateLimits();
    recommend.invalidateRecommendationCache();
  });

  test('normalizeEvent keeps only declared fields, caps text and strips query strings from paths', () => {
    const now = new Date('2026-01-10T10:00:00Z');
    const long = 'x'.repeat(400);
    const event = events.normalizeEvent({
      type: 'search', query: `  B.Tech   ${long}  `, institutionSlug: 'Pune-Institute-Of-Engineering', state: long, city: 'Pune',
      stream: 'Engineering', courseSlug: 'btech', results: 3, path: '/search?q=secret#frag', at: '2026-01-10T09:59:00Z',
      ip: '10.0.0.1', userAgent: 'Mozilla', extra: { nested: true },
    }, now);
    assert.equal(event.query.length, 120);
    assert.equal(event.state.length, 120);
    assert.equal(event.path, '/search', 'the query string is dropped');
    assert.equal(event.institutionSlug, 'pune-institute-of-engineering');
    assert.equal(event.results, 3);
    assert.deepEqual(Object.keys(event).toSorted(), ['at', 'city', 'courseSlug', 'institutionSlug', 'path', 'query', 'results', 'state', 'stream', 'type']);
    assert.equal(event.at.toISOString(), '2026-01-10T09:59:00.000Z');

    assert.equal(events.normalizeEvent({ type: 'hack', query: 'x' }, now), null, 'unknown type');
    assert.equal(events.normalizeEvent({ type: 'search' }, now), null, 'nothing to learn from');
    assert.equal(events.normalizeEvent('search', now), null);
    // A clock that is far out is replaced by the server's own time.
    assert.equal(events.normalizeEvent({ type: 'view', institutionSlug: 'a', at: '2030-01-01' }, now).at.getTime(), now.getTime());
    assert.equal(events.normalizeEvent({ type: 'view', institutionSlug: 'a', path: 'https://evil.test/x' }, now).path, '');
  });

  test('the capture endpoint validates, caps and drops unknown events', async () => {
    const tooMany = await api('/api/insights/events', { method: 'POST', body: { events: Array.from({ length: 21 }, () => ({ type: 'view', institutionSlug: 'a' })) } });
    assert.equal(tooMany.status, 400);
    assert.match(tooMany.body.error, /at most 20 events/);
    assert.equal((await api('/api/insights/events', { method: 'POST', body: { nope: true } })).status, 400);

    const mixed = await api('/api/insights/events', {
      method: 'POST',
      body: { events: [{ type: 'search', query: 'btech pune', city: 'Pune', results: 2 }, { type: 'nope' }, null, { type: 'view' }] },
    });
    assert.equal(mixed.status, 202);
    assert.deepEqual(mixed.body, { accepted: 1, dropped: 3 });
    const stored = await db.collection('student_events').findOne({ query: 'btech pune' });
    assert.equal(stored.city, 'Pune');
    assert.equal(stored.studentId, null);
    assert.ok(stored.visitorId);
    assert.equal(stored.ip, undefined);
    assert.equal(stored.userAgent, undefined);
  });

  test('a first-party visitor cookie is set once and reused', async () => {
    const first = await api('/api/insights/events', { method: 'POST', body: { events: [{ type: 'view', institutionSlug: 'kolkata-arts-college' }] } });
    const raw = cookieFrom(first, 'gv_visitor');
    assert.match(raw, /HttpOnly/i);
    assert.match(raw, /SameSite=Lax/i);
    assert.match(raw, /Max-Age=15552000/);
    const cookie = cookiePair(first, 'gv_visitor');
    const visitorId = cookie.split('=')[1];
    assert.match(visitorId, /^[0-9a-f-]{36}$/);

    const second = await api('/api/insights/events', { method: 'POST', cookie, body: { events: [{ type: 'view', institutionSlug: 'kolkata-arts-college' }] } });
    assert.equal(cookieFrom(second, 'gv_visitor'), undefined, 'an existing id is not re-issued');
    assert.equal(await db.collection('student_events').countDocuments({ visitorId }), 2);

    const forged = await api('/api/insights/recommendations', { cookie: `${studentCookie}; gv_visitor=not-a-uuid` });
    assert.equal(forged.status, 200);
    assert.ok(cookieFrom(forged, 'gv_visitor'), 'a malformed id is replaced');
    // Suggestions hand back directory records, so they need a session; capture stays open.
    assert.equal((await api('/api/insights/recommendations')).status, 401);
  });

  test('recommendations rank on the viewer’s own events and explain why', async () => {
    const visitorId = '11111111-1111-4111-8111-111111111111';
    const at = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000);
    await seedEvents(visitorId, [
      { type: 'search', query: 'engineering pune', city: 'Pune', state: 'Maharashtra', stream: 'Engineering', courseSlug: 'btech', results: 2, at: at(5) },
      { type: 'filter', city: 'Pune', state: 'Maharashtra', stream: 'Engineering', at: at(20) },
      { type: 'view', institutionSlug: 'delhi-school-of-engineering', city: 'Delhi', state: 'Delhi', at: at(600) },
    ]);
    const result = await api('/api/insights/recommendations?limit=4', { cookie: `${studentCookie}; gv_visitor=${visitorId}` });
    assert.equal(result.status, 200);
    assert.equal(result.body.personalised, true);
    assert.equal(result.body.basedOnEvents, 3);
    const ids = result.body.items.map((item) => item.id);
    assert.equal(ids[0], 'pune-institute-of-engineering', 'city + stream + course + name all match');
    assert.ok(!ids.includes('hidden-university'), 'records hidden from students are never recommended');
    assert.ok(ids.indexOf('pune-college-of-management') < ids.indexOf('kolkata-arts-college'), 'same city outranks an unrelated city');
    assert.equal(result.body.items[0].reason, 'Because you searched B.Tech in Pune');
    // Only the place matched here, so the reason says only that — it never claims a stream it did not match.
    assert.equal(result.body.items.find((item) => item.id === 'pune-college-of-management').reason, 'Because you searched universities in Pune');

    // Deterministic: the same events produce the same order.
    recommend.invalidateRecommendationCache();
    const again = await api('/api/insights/recommendations?limit=4', { cookie: `${studentCookie}; gv_visitor=${visitorId}` });
    assert.deepEqual(again.body.items.map((item) => item.id), ids);
  });

  test('a repeatedly viewed institution is pushed down and a brand-new visitor still gets a sensible list', async () => {
    const seen = '22222222-2222-4222-8222-222222222222';
    const at = (minutes) => new Date(Date.now() - minutes * 60_000);
    await seedEvents(seen, [
      { type: 'search', query: 'engineering pune', city: 'Pune', stream: 'Engineering', results: 2, at: at(5) },
      ...[10, 11, 12, 13].map((minute) => ({ type: 'view', institutionSlug: 'pune-institute-of-engineering', city: 'Pune', at: at(minute) })),
    ]);
    const tired = await api('/api/insights/recommendations?limit=4', { cookie: `${studentCookie}; gv_visitor=${seen}` });
    assert.notEqual(tired.body.items[0].id, 'pune-institute-of-engineering', 'already seen four times');

    const fresh = await api('/api/insights/recommendations?limit=3', { cookie: `${studentCookie}; gv_visitor=33333333-3333-4333-8333-333333333333` });
    assert.equal(fresh.body.personalised, false);
    assert.equal(fresh.body.items.length, 3);
    assert.equal(fresh.body.items[0].id, 'kolkata-arts-college', 'NIRF-ranked fallback leads');
    assert.equal(fresh.body.items[0].reason, 'Ranked 12 in the NIRF list (2024)');
    for (const item of fresh.body.items) assert.ok(item.reason, 'every item explains itself');

    // Excluding the institution being viewed keeps the profile page from recommending itself.
    recommend.invalidateRecommendationCache();
    const excluded = await api('/api/insights/recommendations?limit=3&exclude=kolkata-arts-college', { cookie: `${studentCookie}; gv_visitor=33333333-3333-4333-8333-333333333333` });
    assert.ok(!excluded.body.items.some((item) => item.id === 'kolkata-arts-college'));
  });

  test('admin insights are administrator-only and report the content gaps', async () => {
    const visitorId = '44444444-4444-4444-8444-444444444444';
    const at = (minutes) => new Date(Date.now() - minutes * 60_000);
    await seedEvents(visitorId, [
      { type: 'search', query: 'Nalanda University', results: 0, at: at(3) },
      { type: 'search', query: 'nalanda university', results: 0, at: at(4) },
      { type: 'search', query: 'engineering pune', city: 'Pune', state: 'Maharashtra', stream: 'Engineering', results: 2, at: at(5) },
      { type: 'view', institutionSlug: 'pune-institute-of-engineering', city: 'Pune', at: at(6) },
    ]);
    assert.equal((await api('/api/admin/insights/overview')).status, 401);
    assert.equal((await api('/api/admin/insights/overview', { cookie: 'nsedu_admin=not-a-jwt' })).status, 401);

    const overview = await api('/api/admin/insights/overview?days=7', { cookie: adminCookie });
    assert.equal(overview.status, 200);
    assert.equal(overview.body.days, 7);
    assert.match(overview.body.notice, /recommendations/);
    assert.equal(overview.body.retentionDays, 180);
    assert.deepEqual(overview.body.noResults[0], { query: 'nalanda university', count: 2, lastAt: overview.body.noResults[0].lastAt }, 'case-folded gap list');
    assert.ok(overview.body.topSearches.some((row) => row.query === 'engineering pune'));
    assert.ok(overview.body.topViewed.some((row) => row.slug === 'pune-institute-of-engineering' && row.name === 'Pune Institute of Engineering'));
    assert.ok(overview.body.states.some((row) => row.value === 'Maharashtra'));

    const gaps = await api('/api/admin/insights/searches?noResults=true&limit=5', { cookie: adminCookie });
    assert.equal(gaps.body.total, 1);
    assert.equal(gaps.body.items[0].query, 'nalanda university');
    const all = await api('/api/admin/insights/searches?limit=5', { cookie: adminCookie });
    assert.ok(all.body.total >= 2, 'the unfiltered list is larger than the gap list');
    const viewed = await api('/api/admin/insights/institutions', { cookie: adminCookie });
    assert.ok(viewed.body.items.length > 0);
  });

  test('an employee cannot read insights and the student drill-down is paginated', async () => {
    const employee = { email: 'insights.staff@example.com', phone: '+919876543211', password: 'Temporary!Pass9' };
    assert.equal((await api('/api/admin/employees', { method: 'POST', cookie: adminCookie, body: employee })).status, 201);
    const signedIn = await api('/api/admin/auth/login', { method: 'POST', body: { email: employee.email, password: employee.password } });
    const staffCookie = cookiePair(signedIn, 'nsedu_admin');
    await api('/api/admin/auth/change-password', { method: 'POST', cookie: staffCookie, body: { currentPassword: employee.password, newPassword: 'New!SecurePass9' } });
    assert.equal((await api('/api/admin/insights/overview', { cookie: staffCookie })).status, 403);

    const student = await db.collection('students').insertOne({ email: 'drill@example.com', createdAt: new Date(), lastLoginAt: null });
    const studentId = student.insertedId;
    await db.collection('student_events').insertMany(Array.from({ length: 5 }, (_item, index) => ({
      studentId, visitorId: '55555555-5555-4555-8555-555555555555', type: 'search', query: `query ${index}`,
      institutionSlug: '', state: '', city: 'Pune', stream: '', courseSlug: '', results: index, path: '/search',
      at: new Date(Date.now() - index * 60_000),
    })));
    assert.equal((await api(`/api/admin/insights/students/${studentId}`, { cookie: staffCookie })).status, 403);
    const page = await api(`/api/admin/insights/students/${studentId}?limit=2&page=2`, { cookie: adminCookie });
    assert.equal(page.status, 200);
    assert.equal(page.body.total, 5);
    assert.equal(page.body.items.length, 2);
    assert.equal(page.body.student.email, 'drill@example.com');
    assert.deepEqual(page.body.items.map((item) => item.query), ['query 2', 'query 3'], 'newest first, page 2');
    assert.equal((await api('/api/admin/insights/students/nope', { cookie: adminCookie })).status, 404);
  });

  test('without personalisation consent nothing is stored and no visitor id is issued', async () => {
    const before = await db.collection('student_events').countDocuments({});
    for (const consent of [null, 'essential']) {
      const result = await api('/api/insights/events', { method: 'POST', consent, body: { events: [{ type: 'search', query: 'no consent', city: 'Pune' }] } });
      assert.equal(result.status, 202);
      assert.deepEqual(result.body, { accepted: 0, dropped: 1, consent: false });
      assert.equal(cookieFrom(result, 'gv_visitor'), undefined, `no id is minted (${consent ?? 'undecided'})`);
    }
    assert.equal(await db.collection('student_events').countDocuments({}), before);
  });

  test('a cookie decision is stored anonymously, sets the consent cookie and withdrawal clears the visitor id', async () => {
    assert.equal((await api('/api/consent', { method: 'POST', consent: null, body: { choice: 'maybe' } })).status, 400);
    const accepted = await api('/api/consent', { method: 'POST', consent: null, body: { choice: 'all' } });
    assert.equal(accepted.status, 204);
    const raw = cookieFrom(accepted, 'gv_consent');
    assert.match(raw, /^gv_consent=all;/);
    assert.doesNotMatch(raw, /HttpOnly/i, 'the page reads it to decide whether to show the banner');
    assert.match(raw, /Max-Age=15552000/);

    const withdrawn = await api('/api/consent', { method: 'POST', consent: 'all', cookie: 'gv_visitor=66666666-6666-4666-8666-666666666666', body: { choice: 'essential' } });
    assert.match(cookieFrom(withdrawn, 'gv_visitor'), /^gv_visitor=;/, 'the personalisation id is removed straight away');
    const rows = await db.collection('consent_events').find({}).toArray();
    assert.deepEqual(rows.map((row) => [row.choice, row.changed]), [['all', false], ['essential', true]]);
    assert.deepEqual(Object.keys(rows[0]).toSorted(), ['_id', 'at', 'changed', 'choice'], 'no visitor id, IP or browser details');
  });

  test('the homepage suggestions are public, follow the course and personalise only with consent', async () => {
    const visitorId = '77777777-7777-4777-8777-777777777777';
    await seedEvents(visitorId, [{ type: 'search', query: 'engineering pune', city: 'Pune', state: 'Maharashtra', stream: 'Engineering', results: 2, at: new Date() }]);
    const anonymous = await api('/api/insights/home?course=mba', { consent: null });
    assert.equal(anonymous.status, 200);
    assert.equal(anonymous.body.personalised, false);
    assert.deepEqual(anonymous.body.items.map((item) => item.id), ['pune-college-of-management'], 'only institutions offering the course');
    assert.equal(anonymous.body.items[0].score, undefined, 'internal scores stay internal');

    recommend.invalidateRecommendationCache();
    const personal = await api('/api/insights/home?course=btech', { cookie: `gv_visitor=${visitorId}` });
    assert.equal(personal.body.personalised, true);
    assert.equal(personal.body.items[0].id, 'pune-institute-of-engineering', 'the Pune search outranks Delhi');
    assert.match(personal.body.items[0].reason, /^Because you searched/);

    recommend.invalidateRecommendationCache();
    const declined = await api('/api/insights/home?course=btech', { consent: 'essential', cookie: `gv_visitor=${visitorId}` });
    assert.equal(declined.body.personalised, false, 'a stale visitor cookie is ignored once consent is withdrawn');
  });

  test('the admin cookie report counts decisions and estimates visitors', async () => {
    assert.equal((await api('/api/admin/insights/consent')).status, 401);
    const report = await api('/api/admin/insights/consent?days=30', { cookie: adminCookie });
    assert.equal(report.status, 200);
    assert.equal(report.body.days, 30);
    assert.deepEqual(report.body.totals, { all: 1, essential: 1 });
    assert.equal(report.body.decisions, 2);
    assert.equal(report.body.changed, 1);
    assert.equal(report.body.acceptanceRate, 0.5);
    assert.ok(report.body.trackedVisitors > 0);
    assert.equal(report.body.estimatedVisitors, Math.round(report.body.trackedVisitors / 0.5));
    assert.equal(report.body.daily.reduce((sum, row) => sum + row.all + row.essential, 0), 2);
  });

  test('the raw-event TTL index expires activity after 180 days', async () => {
    const indexes = await db.collection('student_events').indexes();
    const ttl = indexes.find((index) => index.name === 'student_events_ttl');
    assert.deepEqual(ttl.key, { at: 1 });
    assert.equal(ttl.expireAfterSeconds, 180 * 24 * 60 * 60);
  });
});
