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
const COLLEGE_KEYS = ['annualTuitionInr', 'art', 'city', 'collegeId', 'courseId', 'demoRating', 'highestSalaryLpa', 'id', 'isIllustrative', 'medianSalaryLpa', 'name', 'placementYear', 'shortName', 'state', 'tuitionYear'];

describe('auth, catalog and admin API', { skip }, () => {
  let server; let base; let db; let closeDb; let resetRateLimits;
  let adminCookie; let studentCookie; let studentId;

  async function api(path, { method = 'GET', body, cookie, headers = {} } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(cookie && { cookie }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers, setCookies: response.headers.getSetCookie() };
  }
  const cookieFrom = (result, name) => result.setCookies.find((item) => item.startsWith(`${name}=`))?.split(';')[0];
  const tokenOf = (cookie) => cookie.split('=')[1];
  const loginAdmin = () => api('/api/admin/auth/login', { method: 'POST', body: ADMIN });
  async function signInStudent(channel, identifier) {
    const requested = await api('/api/auth/otp/request', { method: 'POST', body: { channel, identifier } });
    assert.equal(requested.status, 200, JSON.stringify(requested.body));
    const verified = await api('/api/auth/otp/verify', { method: 'POST', body: { channel, identifier, code: requested.body.devCode } });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    return { requested, verified, cookie: cookieFrom(verified, 'nsedu_student') };
  }

  before(async () => {
    mock.method(console, 'log', () => {});
    const [{ app }, collections, rateLimit, { hashPassword }] = await Promise.all([
      import('../src/app.js'), import('../src/db/collections.js'), import('../src/lib/rate-limit.js'), import('../src/lib/password.js'),
    ]);
    ({ closeDb } = collections);
    ({ resetRateLimits } = rateLimit);
    db = await collections.getDb();
    await db.collection('admins').insertOne({ email: ADMIN.email, name: 'Test Admin', role: 'admin', passwordHash: await hashPassword(ADMIN.password), createdAt: new Date(), lastLoginAt: null });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    mock.restoreAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.dropDatabase();
    await closeDb?.();
  });

  beforeEach(() => resetRateLimits());

  test('admin routes require an admin session', async () => {
    const response = await api('/api/admin/dashboard');
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: 'Admin session required' });
    assert.equal((await api('/api/admin/courses', { cookie: 'nsedu_admin=not-a-jwt' })).status, 401);
  });

  test('admin login sets a strict httpOnly cookie and rejects bad credentials', async () => {
    const wrong = await api('/api/admin/auth/login', { method: 'POST', body: { ...ADMIN, password: 'nope' } });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, { error: 'Invalid email or password' });
    const unknown = await api('/api/admin/auth/login', { method: 'POST', body: { email: 'ghost@nsedu.test', password: 'whatever' } });
    assert.deepEqual([unknown.status, unknown.body], [401, { error: 'Invalid email or password' }]);
    const invalid = await api('/api/admin/auth/login', { method: 'POST', body: { email: 'bad' } });
    assert.equal(invalid.status, 400);
    assert.ok(invalid.body.fields.email && invalid.body.fields.password);

    const ok = await api('/api/admin/auth/login', { method: 'POST', body: { email: ' ADMIN@nsedu.test ', password: ADMIN.password } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.admin.email, ADMIN.email);
    assert.ok(ok.body.admin.lastLoginAt);
    assert.equal(ok.body.admin.passwordHash, undefined);
    const raw = ok.setCookies.find((item) => item.startsWith('nsedu_admin='));
    assert.match(raw, /HttpOnly/i);
    assert.match(raw, /SameSite=Strict/i);
    adminCookie = cookieFrom(ok, 'nsedu_admin');

    const me = await api('/api/admin/auth/me', { cookie: adminCookie });
    assert.deepEqual([me.status, me.body.admin.email], [200, ADMIN.email]);
    const bearer = await api('/api/admin/auth/me', { headers: { authorization: `Bearer ${tokenOf(adminCookie)}` } });
    assert.equal(bearer.status, 200);
    const logout = await api('/api/admin/auth/logout', { method: 'POST', cookie: adminCookie });
    assert.equal(logout.status, 204);
    assert.match(logout.setCookies[0], /^nsedu_admin=;/);
  });

  test('admin login is rate limited per IP', async () => {
    for (let index = 0; index < 10; index++) {
      const attempt = await api('/api/admin/auth/login', { method: 'POST', body: { email: `user${index}@nsedu.test`, password: 'x' } });
      assert.equal(attempt.status, 401);
    }
    const blocked = await loginAdmin();
    assert.equal(blocked.status, 429);
    assert.ok(blocked.body.retryAfterSeconds > 0);
    assert.ok(blocked.headers.get('retry-after'));
    resetRateLimits();
    assert.equal((await loginAdmin()).status, 200);
  });

  test('admin login is rate limited per email across IPs', async () => {
    for (let index = 0; index < 10; index++) {
      await api('/api/admin/auth/login', { method: 'POST', body: { ...ADMIN, password: 'wrong' }, headers: { 'x-forwarded-for': `10.0.0.${index}` } });
    }
    const blocked = await api('/api/admin/auth/login', { method: 'POST', body: ADMIN, headers: { 'x-forwarded-for': '10.0.1.1' } });
    assert.equal(blocked.status, 429);
  });

  test('email OTP sign-in creates the student, sets a lax cookie and supports profile updates', async () => {
    const { requested, verified, cookie } = await signInStudent('email', '  New.Student@Example.COM ');
    assert.equal(requested.body.identifier, 'new.student@example.com');
    assert.equal(requested.body.expiresInSeconds, 300);
    assert.equal(requested.body.resendInSeconds, 30);
    assert.match(requested.body.devCode, /^\d{6}$/);
    assert.equal(verified.body.isNew, true);
    assert.deepEqual(Object.keys(verified.body.student).sort(), ['createdAt', 'email', 'id', 'name', 'phone']);
    assert.equal(verified.body.student.phone, null);
    assert.match(verified.setCookies.find((item) => item.startsWith('nsedu_student=')), /HttpOnly.*SameSite=Lax|SameSite=Lax.*HttpOnly/i);
    studentCookie = cookie;
    studentId = verified.body.student.id;

    const me = await api('/api/auth/me', { cookie });
    assert.deepEqual([me.status, me.body.student.email], [200, 'new.student@example.com']);
    const renamed = await api('/api/auth/me', { method: 'PATCH', cookie, body: { name: '  Asha  Rao ', role: 'admin' } });
    assert.deepEqual([renamed.status, renamed.body.student.name], [200, 'Asha Rao']);
    assert.equal((await api('/api/auth/me', { method: 'PATCH', cookie, body: { name: '' } })).status, 400);
    assert.equal((await api('/api/auth/me')).status, 401);
    assert.deepEqual((await api('/api/auth/me')).body, { error: 'Not signed in' });

    resetRateLimits(); // skip the 30-second resend cooldown
    const again = await signInStudent('email', 'new.student@example.com');
    assert.equal(again.verified.body.isNew, false);
    assert.equal(again.verified.body.student.id, studentId);
    const stored = await db.collection('students').findOne({ email: 'new.student@example.com' });
    assert.equal(stored.loginCount, 2);
    const logout = await api('/api/auth/logout', { method: 'POST', cookie });
    assert.equal(logout.status, 204);
    assert.match(logout.setCookies[0], /^nsedu_student=;/);
  });

  test('student and admin tokens are not interchangeable', async () => {
    const admin = cookieFrom(await loginAdmin(), 'nsedu_admin');
    const student = tokenOf(studentCookie);
    assert.equal((await api('/api/admin/dashboard', { cookie: `nsedu_admin=${student}` })).status, 401);
    assert.equal((await api('/api/admin/dashboard', { headers: { authorization: `Bearer ${student}` } })).status, 401);
    assert.equal((await api('/api/auth/me', { cookie: `nsedu_student=${tokenOf(admin)}` })).status, 401);
    adminCookie = admin;
  });

  test('phone OTP validates numbers, enforces resend cooldown and limits wrong attempts', async () => {
    for (const identifier of ['12345', '5876543210', '+1 9876543210']) {
      const invalid = await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'phone', identifier } });
      assert.equal(invalid.status, 400);
      assert.ok(invalid.body.fields.identifier);
    }
    assert.equal((await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'sms', identifier: '9876543210' } })).status, 400);

    const requested = await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'phone', identifier: '+91 98765-43210' } });
    assert.equal(requested.body.identifier, '+919876543210');
    const resend = await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'phone', identifier: '9876543210' } });
    assert.equal(resend.status, 429);
    assert.ok(resend.body.retryAfterSeconds > 0 && resend.body.retryAfterSeconds <= 30);

    const body = { channel: 'phone', identifier: '9876543210', code: requested.body.devCode === '000000' ? '111111' : '000000' };
    assert.equal((await api('/api/auth/otp/verify', { method: 'POST', body: { ...body, code: '12ab56' } })).status, 400);
    for (const left of [4, 3, 2]) {
      const wrong = await api('/api/auth/otp/verify', { method: 'POST', body });
      assert.deepEqual([wrong.status, wrong.body], [400, { error: `Incorrect code. ${left} attempts left.` }]);
    }
    assert.equal((await api('/api/auth/otp/verify', { method: 'POST', body })).body.error, 'Incorrect code. 1 attempt left.');
    const locked = await api('/api/auth/otp/verify', { method: 'POST', body });
    assert.deepEqual([locked.status, locked.body], [429, { error: 'Too many incorrect attempts. Request a new code.' }]);
    const expired = await api('/api/auth/otp/verify', { method: 'POST', body: { ...body, code: requested.body.devCode } });
    assert.deepEqual([expired.status, expired.body], [400, { error: 'This code has expired. Request a new one.' }]);
  });

  test('OTP sends are limited per identifier and per IP', async () => {
    const original = Date.now;
    let offset = 0;
    mock.method(Date, 'now', () => original() + offset);
    try {
      for (let index = 0; index < 5; index++) {
        assert.equal((await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'email', identifier: 'busy@example.com' } })).status, 200);
        offset += 31_000;
      }
      assert.equal((await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'email', identifier: 'busy@example.com' } })).status, 429);
    } finally { Date.now.mock.restore(); }
    resetRateLimits();
    for (let index = 0; index < 20; index++) {
      await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'email', identifier: `ip${index}@example.com` } });
    }
    assert.equal((await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'email', identifier: 'ip-last@example.com' } })).status, 429);
  });

  test('course CRUD validates, generates slugs and reports duplicates', async () => {
    const meta = await api('/api/admin/resources', { cookie: adminCookie });
    assert.equal(meta.status, 200);
    assert.deepEqual(Object.keys(meta.body.resources).sort(), ['cities', 'courses', 'exams', 'institutions', 'programmes', 'scholarships', 'states']);
    assert.equal(meta.body.resources.programmes.fields.find((field) => field.name === 'courseSlug').ref, 'courses');

    const invalid = await api('/api/admin/courses', { method: 'POST', cookie: adminCookie, body: { name: '', icon: 'rocket', order: -1 } });
    assert.equal(invalid.status, 400);
    assert.deepEqual(Object.keys(invalid.body.fields).sort(), ['field', 'icon', 'name', 'order']);

    const created = await api('/api/admin/courses', { method: 'POST', cookie: adminCookie, body: { name: 'Test Course 101', field: 'Testing', unknown: 'dropped' } });
    assert.equal(created.status, 201);
    const course = created.body.item;
    assert.equal(course.slug, 'test-course-101');
    assert.equal(course.icon, 'cap');
    assert.equal(course.active, true);
    assert.equal(course.unknown, undefined);
    assert.equal(course._id, undefined);
    assert.match(course.id, /^[a-f0-9]{24}$/);

    const duplicate = await api('/api/admin/courses', { method: 'POST', cookie: adminCookie, body: { name: 'Test Course 101', field: 'Other' } });
    assert.deepEqual([duplicate.status, duplicate.body], [409, { error: 'A course with this slug already exists', fields: { slug: 'Already in use' } }]);

    const patched = await api(`/api/admin/courses/${course.id}`, { method: 'PATCH', cookie: adminCookie, body: { summary: ' Updated ', popular: true } });
    assert.equal(patched.status, 200);
    assert.deepEqual([patched.body.item.summary, patched.body.item.popular, patched.body.item.name], ['Updated', true, 'Test Course 101']);
    assert.equal((await api(`/api/admin/courses/${course.id}`, { method: 'PATCH', cookie: adminCookie, body: { order: 'x' } })).status, 400);

    const list = await api('/api/admin/courses?q=course%20101&limit=500', { cookie: adminCookie });
    assert.deepEqual([list.body.total, list.body.limit, list.body.items[0].id], [1, 100, course.id]);
    assert.equal((await api('/api/admin/courses?q=.*', { cookie: adminCookie })).body.total, 0);

    assert.equal((await api('/api/admin/courses/not-an-id', { cookie: adminCookie })).status, 404);
    assert.equal((await api('/api/admin/widgets', { cookie: adminCookie })).status, 404);
    assert.equal((await api(`/api/admin/courses/${course.id}`, { method: 'DELETE', cookie: adminCookie })).status, 204);
    assert.equal((await api(`/api/admin/courses/${course.id}`, { cookie: adminCookie })).status, 404);
  });

  test('programmes reference real records and protect referenced institutions', async () => {
    const post = (resource, body) => api(`/api/admin/${resource}`, { method: 'POST', cookie: adminCookie, body });
    const institution = (await post('institutions', { name: 'Test Institute', shortName: 'Test', city: 'Pune', state: '', demoRating: '4.5', art: [1, 2, 3, 4] })).body.item;
    assert.equal(institution.state, null);
    assert.equal(institution.demoRating, 4.5);
    const course = (await post('courses', { name: 'B.Tech', slug: 'btech', field: 'Engineering', icon: 'gear', fullName: 'Bachelor of Technology', popular: true })).body.item;
    const missingRef = await post('programmes', { institutionSlug: 'nowhere', courseSlug: 'btech', annualTuitionInr: 1 });
    assert.equal(missingRef.status, 400);
    assert.ok(missingRef.body.fields.institutionSlug);

    const programme = await post('programmes', { institutionSlug: institution.slug, courseSlug: course.slug, annualTuitionInr: 200000, medianSalaryLpa: 7.5, highestSalaryLpa: '' });
    assert.equal(programme.status, 201);
    assert.equal(programme.body.item.slug, 'test-institute-btech');
    assert.equal(programme.body.item.highestSalaryLpa, null);
    assert.equal(programme.body.item.tuitionYear, '2026–27');

    const blocked = await api(`/api/admin/institutions/${institution.id}`, { method: 'DELETE', cookie: adminCookie });
    assert.deepEqual([blocked.status, blocked.body], [409, { error: 'Remove its 1 programme first' }]);
    const rename = await api(`/api/admin/institutions/${institution.id}`, { method: 'PATCH', cookie: adminCookie, body: { slug: 'renamed' } });
    assert.equal(rename.status, 400);
    assert.ok(rename.body.fields.slug);

    const colleges = await api('/api/catalog/colleges');
    assert.equal(colleges.headers.get('cache-control'), 'no-store');
    assert.deepEqual(colleges.body.items, [{
      id: 'test-institute-btech', collegeId: 'test-institute', courseId: 'btech', name: 'Test Institute', shortName: 'Test',
      city: 'Pune', state: null, demoRating: 4.5, art: [1, 2, 3, 4], annualTuitionInr: 200000, medianSalaryLpa: 7.5,
      highestSalaryLpa: null, tuitionYear: '2026–27', placementYear: '2024–25', isIllustrative: true,
    }]);
    assert.deepEqual(Object.keys(colleges.body.items[0]).sort(), COLLEGE_KEYS);

    const courses = await api('/api/catalog/courses');
    assert.deepEqual(courses.body.items, [{ id: 'btech', name: 'B.Tech', fullName: 'Bachelor of Technology', field: 'Engineering', icon: 'gear', summary: '', popular: true }]);
    const search = await api('/api/catalog/search?q=%20TEST%20inst');
    assert.deepEqual(search.body.colleges, [{ id: 'test-institute', name: 'Test Institute', city: 'Pune', state: null, courses: ['btech'] }]);
    assert.deepEqual((await api('/api/catalog/search?q=(')).body, { query: '(', courses: [], exams: [], colleges: [] });
    assert.deepEqual((await api('/api/catalog/search')).body, { query: '', courses: [], exams: [], colleges: [] });

    await api(`/api/admin/courses/${course.id}`, { method: 'PATCH', cookie: adminCookie, body: { active: false } });
    assert.deepEqual((await api('/api/catalog/colleges')).body.items, []);
    const stats = await api('/api/platform/stats');
    assert.deepEqual(stats.body, { courses: 0, exams: 0, institutions: 1, programmes: 1, cities: 0, states: 0, scholarships: 0 });

    assert.equal((await api(`/api/admin/programmes/${programme.body.item.id}`, { method: 'DELETE', cookie: adminCookie })).status, 204);
    assert.equal((await api(`/api/admin/institutions/${institution.id}`, { method: 'DELETE', cookie: adminCookie })).status, 204);
  });

  test('locations are sorted featured first and expose crops', async () => {
    const post = (resource, body) => api(`/api/admin/${resource}`, { method: 'POST', cookie: adminCookie, body });
    await post('cities', { name: 'Kolkata', order: 0 });
    await post('cities', { name: 'Pune', landmark: 'Shaniwar Wada', crop: [1, 2, 3, 4], featured: true, order: 5 });
    const duplicate = await post('cities', { name: 'Pune' });
    assert.deepEqual([duplicate.status, duplicate.body.fields], [409, { name: 'Already in use' }]);
    const locations = await api('/api/catalog/locations');
    assert.deepEqual(locations.body.cities, [
      { name: 'Pune', landmark: 'Shaniwar Wada', crop: [1, 2, 3, 4], featured: true },
      { name: 'Kolkata', landmark: '', crop: null, featured: false },
    ]);
  });

  test('dashboard counts students and admins can block a student', async () => {
    const dashboard = await api('/api/admin/dashboard', { cookie: adminCookie });
    assert.equal(dashboard.status, 200);
    const { counts, recentStudents, studentsByDay, programmesByCourse } = dashboard.body;
    const total = await db.collection('students').countDocuments();
    assert.equal(counts.students, total);
    assert.equal(counts.newStudents7d, total);
    assert.equal(counts.blockedStudents, 0);
    assert.equal(counts.cities, 2);
    assert.equal(studentsByDay.length, 14);
    assert.equal(studentsByDay.at(-1).date, new Date().toISOString().slice(0, 10));
    assert.equal(studentsByDay.reduce((sum, day) => sum + day.count, 0), total);
    assert.ok(recentStudents.length >= 1 && recentStudents.length <= 5);
    assert.ok(Array.isArray(programmesByCourse));

    const list = await api('/api/admin/students?q=new.student', { cookie: adminCookie });
    assert.deepEqual([list.body.total, list.body.items[0].id], [1, studentId]);
    assert.equal((await api('/api/admin/students?status=gone', { cookie: adminCookie })).status, 400);
    const blocked = await api(`/api/admin/students/${studentId}`, { method: 'PATCH', cookie: adminCookie, body: { status: 'blocked' } });
    assert.deepEqual([blocked.status, blocked.body.item.status], [200, 'blocked']);
    assert.equal((await api('/api/admin/students?status=blocked', { cookie: adminCookie })).body.total, 1);

    assert.equal((await api('/api/auth/me', { cookie: studentCookie })).status, 401);
    const requested = await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'email', identifier: 'new.student@example.com' } });
    const denied = await api('/api/auth/otp/verify', { method: 'POST', body: { channel: 'email', identifier: 'new.student@example.com', code: requested.body.devCode } });
    assert.deepEqual([denied.status, denied.body], [403, { error: 'This account is suspended. Please contact support.' }]);
    assert.equal((await api('/api/admin/students/000000000000000000000000', { method: 'PATCH', cookie: adminCookie, body: { status: 'active' } })).status, 404);
  });
});
