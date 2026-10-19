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
const YEAR = new Date().getUTCFullYear();

const validApplication = (overrides = {}) => ({
  applicant: { fullName: '  Asha   Rao ', email: 'Asha.Rao@Example.com', phone: '98765 43210', dateOfBirth: `${YEAR - 18}-01-15`, gender: 'female', city: 'Pune', state: 'Maharashtra', pincode: '411001', ...overrides.applicant },
  academics: { highestQualification: 'class-12', board: 'CBSE', passingYear: YEAR, scoreType: 'percentage', score: '88.4', stream: ['Physics', 'Chemistry', 'Maths'], ...overrides.academics },
  exams: overrides.exams ?? [{ name: 'JEE Main', year: YEAR, scoreOrRank: '97.2 percentile' }, { name: '', year: '', scoreOrRank: '' }],
  preference: { institutionSlug: 'test-university', courseSlug: 'btech', intakeYear: YEAR, studyMode: 'full-time', hostelRequired: true, budgetPerYearInr: 200000, message: 'Interested in CSE.', ...overrides.preference },
  consent: { contactConsent: true, privacyAccepted: true, version: '2026-10', ...overrides.consent },
  source: { path: '/apply', utmSource: 'newsletter', ...overrides.source },
});

describe('applications and admin leads', { skip }, () => {
  let server; let base; let db; let closeDb; let resetRateLimits;
  let owner; let alice; let bob; let asha; let ravi; let firstLead;

  async function api(path, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(cookie && { cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const json = response.headers.get('content-type')?.includes('json');
    return { status: response.status, body: text && json ? JSON.parse(text) : text, headers: response.headers, setCookies: response.headers.getSetCookie() };
  }
  const cookieFrom = (result, name) => result.setCookies.find((item) => item.startsWith(`${name}=`))?.split(';')[0];
  async function signInStudent(identifier, channel = 'email') {
    const requested = await api('/api/auth/otp/request', { method: 'POST', body: { channel, identifier } });
    const verified = await api('/api/auth/otp/verify', { method: 'POST', body: { channel, identifier, code: requested.body.devCode } });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    return { cookie: cookieFrom(verified, 'nsedu_student'), id: verified.body.student.id };
  }
  async function makeEmployee(email) {
    const created = await api('/api/admin/employees', { method: 'POST', cookie: owner, body: { email, phone: '+919876500000', password: 'Temporary!Pass9' } });
    assert.equal(created.status, 201);
    const cookie = cookieFrom(await api('/api/admin/auth/login', { method: 'POST', body: { email, password: 'Temporary!Pass9' } }), 'nsedu_admin');
    assert.equal((await api('/api/admin/auth/change-password', { method: 'POST', cookie, body: { currentPassword: 'Temporary!Pass9', newPassword: 'Changed!Pass9' } })).status, 200);
    return { id: created.body.item.id, cookie };
  }

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
    await db.collection('institutions').insertMany([
      { slug: 'test-university', name: 'Test University', city: 'Pune', state: 'Maharashtra', active: true, verification: 'verified', createdAt: now },
      { slug: 'other-college', name: 'Other College', city: 'Jaipur', state: 'Rajasthan', active: true, createdAt: now },
      { slug: 'hidden-college', name: 'Hidden College', city: 'Delhi', state: 'Delhi', active: false, createdAt: now },
    ]);
    await db.collection('courses').insertMany([
      { slug: 'btech', name: 'B.Tech', active: true },
      { slug: 'mba', name: 'MBA', active: true },
      { slug: 'retired', name: 'Retired', active: false },
    ]);
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    owner = cookieFrom(await api('/api/admin/auth/login', { method: 'POST', body: ADMIN }), 'nsedu_admin');
    alice = await makeEmployee('alice@nsedu.test');
    bob = await makeEmployee('bob@nsedu.test');
    asha = await signInStudent('asha.rao@example.com');
    resetRateLimits();
    ravi = await signInStudent('ravi@example.com');
  });

  after(async () => {
    mock.restoreAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.dropDatabase();
    await closeDb?.();
  });

  beforeEach(() => resetRateLimits());

  test('applying requires a signed-in student', async () => {
    assert.deepEqual((await api('/api/applications', { method: 'POST', body: validApplication() })).status, 401);
    assert.equal((await api('/api/applications/mine')).status, 401);
    assert.equal((await api('/api/applications/prefill')).status, 401);
    assert.equal((await api('/api/applications/mine/GV-2026-000001')).status, 401);
    assert.equal((await api('/api/admin/leads', { cookie: asha.cookie })).status, 401);
  });

  test('validation reports every invalid field with a dotted path', async () => {
    const empty = await api('/api/applications', { method: 'POST', cookie: asha.cookie, body: {} });
    assert.equal(empty.status, 400);
    for (const field of ['applicant.fullName', 'applicant.email', 'applicant.phone', 'applicant.dateOfBirth', 'applicant.state', 'academics.highestQualification', 'academics.score', 'preference.institutionSlug', 'preference.intakeYear', 'consent.contactConsent', 'consent.privacyAccepted']) {
      assert.ok(empty.body.fields[field], `${field} should be reported`);
    }
    const invalid = await api('/api/applications', { method: 'POST', cookie: asha.cookie, body: validApplication({
      applicant: { phone: '12345', dateOfBirth: `${YEAR - 10}-02-01`, state: 'Atlantis', pincode: '0123', guardianPhone: 'x' },
      academics: { scoreType: 'cgpa', score: 11, class12: { board: 'CBSE' } },
      exams: Array.from({ length: 6 }, (_, index) => ({ name: `Exam ${index}`, year: YEAR })),
      preference: { courseSlug: '', programmeName: '', studyMode: 'evening', intakeYear: YEAR + 5, message: 'x'.repeat(1001) },
      consent: { contactConsent: false, version: 'old' },
    }) });
    assert.equal(invalid.status, 400);
    assert.deepEqual(Object.keys(invalid.body.fields).sort(), [
      'academics.class12.percentage', 'academics.class12.year', 'academics.score',
      'applicant.dateOfBirth', 'applicant.guardianPhone', 'applicant.phone', 'applicant.pincode', 'applicant.state',
      'consent.contactConsent', 'consent.version', 'exams',
      'preference.courseSlug', 'preference.intakeYear', 'preference.message', 'preference.studyMode',
    ].sort());
    const impossibleDate = await api('/api/applications', { method: 'POST', cookie: asha.cookie, body: validApplication({ applicant: { dateOfBirth: `${YEAR - 18}-02-30` } }) });
    assert.equal(impossibleDate.body.fields['applicant.dateOfBirth'], 'Enter a valid date');
    const noCourse = await api('/api/applications', { method: 'POST', cookie: asha.cookie, body: validApplication({ preference: { courseSlug: '' } }) });
    assert.ok(noCourse.body.fields['preference.courseSlug']);

    for (const [preference, field] of [
      [{ institutionSlug: 'nowhere' }, 'preference.institutionSlug'],
      [{ institutionSlug: 'hidden-college' }, 'preference.institutionSlug'],
      [{ courseSlug: 'retired' }, 'preference.courseSlug'],
    ]) {
      const result = await api('/api/applications', { method: 'POST', cookie: asha.cookie, body: validApplication({ preference }) });
      assert.equal(result.status, 400);
      assert.ok(result.body.fields[field], JSON.stringify(result.body));
    }
    assert.equal(await db.collection('applications').countDocuments(), 0);
  });

  test('a valid application gets a reference, normalised contact details and a consent record', async () => {
    const created = await api('/api/applications', { method: 'POST', cookie: asha.cookie, body: { ...validApplication(), status: 'admitted', studentId: ravi.id } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const { item } = created.body;
    assert.match(item.ref, new RegExp(`^GV-${YEAR}-\\d{6}$`));
    assert.equal(item.status, 'new');
    assert.equal(item.applicant.fullName, 'Asha Rao');
    assert.equal(item.applicant.email, 'asha.rao@example.com');
    assert.equal(item.applicant.phone, '+919876543210');
    assert.equal(item.academics.score, 88.4);
    assert.equal(item.academics.class12, null);
    assert.equal(item.exams.length, 1);
    assert.deepEqual([item.preference.institutionName, item.preference.courseName, item.preference.city], ['Test University', 'B.Tech', 'Pune']);
    assert.equal(item.consent, undefined);
    assert.equal(item.assignedEmployeeIds, undefined);

    const stored = await db.collection('applications').findOne({ ref: item.ref });
    assert.equal(stored.studentId.toString(), asha.id);
    assert.equal(stored.consent.contactConsent, true);
    assert.ok(stored.consent.ip);
    assert.match(stored.consent.text.contact, /Test University/);
    assert.deepEqual(stored.contactVerified, { email: true, phone: false });
    assert.deepEqual(stored.source, { path: '/apply', utmSource: 'newsletter', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '' });
    firstLead = { id: stored._id.toString(), ref: item.ref };

    const second = await api('/api/applications', { method: 'POST', cookie: asha.cookie, body: validApplication({ preference: { courseSlug: 'mba' } }) });
    assert.equal(second.status, 201);
    assert.equal(Number(second.body.item.ref.slice(-6)), Number(item.ref.slice(-6)) + 1);
  });

  test('a duplicate open application within 30 days returns 409 with the existing reference', async () => {
    const duplicate = await api('/api/applications', { method: 'POST', cookie: asha.cookie, body: validApplication() });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.ref, firstLead.ref);
    assert.match(duplicate.body.error, /already applied/);

    const freeText = validApplication({ preference: { institutionSlug: 'other-college', courseSlug: '', programmeName: 'B.Sc Agriculture' } });
    assert.equal((await api('/api/applications', { method: 'POST', cookie: asha.cookie, body: freeText })).status, 201);
    const again = await api('/api/applications', { method: 'POST', cookie: asha.cookie, body: { ...freeText, preference: { ...freeText.preference, programmeName: 'b.sc agriculture' } } });
    assert.equal(again.status, 409);
    // Another student may apply for the same programme.
    assert.equal((await api('/api/applications', { method: 'POST', cookie: ravi.cookie, body: validApplication({ applicant: { email: 'ravi@example.com', fullName: 'Ravi Kumar', state: 'Karnataka' } }) })).status, 201);
  });

  test('students only ever see their own applications', async () => {
    const mine = await api('/api/applications/mine', { cookie: asha.cookie });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.items.length, 3);
    assert.ok(mine.body.items.every((item, index, list) => index === 0 || list[index - 1].createdAt >= item.createdAt));
    assert.deepEqual(Object.keys(mine.body.items[0]).sort(), ['createdAt', 'mode', 'preference', 'ref', 'status', 'statusLabel', 'updatedAt']);
    assert.equal(mine.body.items[0].mode, 'detailed');
    const theirs = await api('/api/applications/mine', { cookie: ravi.cookie });
    assert.equal(theirs.body.items.length, 1);
    assert.ok(!theirs.body.items.some((item) => item.ref === firstLead.ref));

    assert.equal((await api(`/api/applications/mine/${firstLead.ref}`, { cookie: ravi.cookie })).status, 404);
    const own = await api(`/api/applications/mine/${firstLead.ref.toLowerCase()}`, { cookie: asha.cookie });
    assert.equal(own.status, 200);
    assert.equal(own.body.item.applicant.phone, '+919876543210');
    assert.equal(own.body.item.statusHistory[0].status, 'new');
    assert.equal(own.body.item.statusHistory[0].byAdminId, undefined);

    const prefill = await api('/api/applications/prefill', { cookie: asha.cookie });
    assert.equal(prefill.status, 200);
    assert.equal(prefill.body.applicant.fullName, 'Asha Rao');
    assert.equal(prefill.body.applicant.email, 'asha.rao@example.com');
    assert.equal(prefill.body.applicant.phone, '+919876543210');
    assert.equal(prefill.body.academics.board, 'CBSE');
    assert.deepEqual(prefill.body.verified, { email: 'asha.rao@example.com', phone: null });
  });

  test('employees see only assigned leads; administrators assign, filter and export', async () => {
    const all = await api('/api/admin/leads', { cookie: owner });
    assert.equal(all.status, 200);
    assert.equal(all.body.total, 4);
    assert.equal(all.body.items[0].applicant.fullName, 'Ravi Kumar');
    assert.equal(all.body.items[0].consent, undefined);

    assert.equal((await api('/api/admin/leads', { cookie: alice.cookie })).body.total, 0);
    assert.equal((await api(`/api/admin/leads/${firstLead.id}`, { cookie: alice.cookie })).status, 404);
    assert.equal((await api(`/api/admin/leads/${firstLead.id}/notes`, { method: 'POST', cookie: alice.cookie, body: { text: 'Not mine' } })).status, 404);
    assert.equal((await api(`/api/admin/leads/${firstLead.id}/status`, { method: 'PATCH', cookie: alice.cookie, body: { status: 'contacted' } })).status, 404);
    assert.equal((await api(`/api/admin/leads/${firstLead.id}/assignments`, { method: 'PATCH', cookie: alice.cookie, body: { employeeIds: [alice.id] } })).status, 403);
    assert.equal((await api('/api/admin/leads/export.csv', { cookie: alice.cookie })).status, 403);
    assert.equal((await api('/api/admin/leads/assignments/bulk', { method: 'POST', cookie: alice.cookie, body: { applicationIds: [firstLead.id], employeeIds: [alice.id] } })).status, 403);

    assert.equal((await api(`/api/admin/leads/${firstLead.id}/assignments`, { method: 'PATCH', cookie: owner, body: { employeeIds: ['nope'] } })).status, 400);
    const assigned = await api(`/api/admin/leads/${firstLead.id}/assignments`, { method: 'PATCH', cookie: owner, body: { employeeIds: [alice.id] } });
    assert.equal(assigned.status, 200);
    assert.deepEqual(assigned.body.item.assignedEmployees, [{ id: alice.id, email: 'alice@nsedu.test' }]);

    const visible = await api('/api/admin/leads', { cookie: alice.cookie });
    assert.deepEqual([visible.body.total, visible.body.items[0].ref], [1, firstLead.ref]);
    const detail = await api(`/api/admin/leads/${firstLead.id}`, { cookie: alice.cookie });
    assert.equal(detail.status, 200);
    const { item } = detail.body;
    assert.equal(item.applicant.dateOfBirth, `${YEAR - 18}-01-15`);
    assert.equal(item.academics.stream.length, 3);
    assert.equal(item.exams[0].name, 'JEE Main');
    assert.equal(item.preference.hostelRequired, true);
    assert.equal(item.consent.contactConsent, true);
    assert.equal(item.consent.ip, undefined);
    assert.equal(item.consent.userAgent, undefined);
    assert.ok((await api(`/api/admin/leads/${firstLead.id}`, { cookie: owner })).body.item.consent.userAgent !== undefined);
    assert.equal((await api('/api/admin/leads?assignee=unassigned', { cookie: alice.cookie })).body.total, 1);

    const others = all.body.items.filter((lead) => lead.id !== firstLead.id).map((lead) => lead.id);
    assert.equal((await api('/api/admin/leads/assignments/bulk', { method: 'POST', cookie: owner, body: { applicationIds: [...others, 'bad'], employeeIds: [bob.id] } })).status, 400);
    assert.deepEqual((await api('/api/admin/leads/assignments/bulk', { method: 'POST', cookie: owner, body: { applicationIds: others, employeeIds: [bob.id] } })).body, { count: 3 });
    assert.equal((await api('/api/admin/leads', { cookie: bob.cookie })).body.total, 3);
    assert.equal((await api(`/api/admin/leads?assignee=${bob.id}`, { cookie: owner })).body.total, 3);
    assert.equal((await api('/api/admin/leads?assignee=unassigned', { cookie: owner })).body.total, 0);

    const query = async (params) => (await api(`/api/admin/leads?${new URLSearchParams(params)}`, { cookie: owner })).body.total;
    assert.equal(await query({ institution: 'test-university' }), 3);
    assert.equal(await query({ course: 'mba' }), 1);
    assert.equal(await query({ state: 'Karnataka' }), 1);
    assert.equal(await query({ q: firstLead.ref }), 1);
    assert.equal(await query({ q: 'ravi@' }), 1);
    assert.equal(await query({ q: '98765' }), 4);
    assert.equal(await query({ q: 'asha' }), 3);
    assert.equal(await query({ q: '.*' }), 0);
    assert.equal(await query({ from: '2000-01-01', to: '2000-01-31' }), 0);
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    assert.equal(await query({ from: today, to: today }), 4);
    assert.equal((await api('/api/admin/leads?status=bogus', { cookie: owner })).status, 400);
    assert.equal((await api('/api/admin/leads?from=yesterday', { cookie: owner })).status, 400);

    const csv = await api('/api/admin/leads/export.csv?institution=test-university', { cookie: owner });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.match(csv.headers.get('content-disposition'), /attachment; filename="gyaan-vidhya-leads-/);
    const lines = csv.body.trim().split('\r\n');
    assert.equal(lines.length, 4);
    assert.match(lines[0], /"Reference","Submitted \(IST\)","Status"/);
    assert.ok(lines.some((line) => line.includes(`"${firstLead.ref}"`) && line.includes('"alice@nsedu.test"')));
    assert.ok(!csv.body.includes('consent'));
  });

  test('status changes keep a history and notes form a follow-up thread', async () => {
    assert.equal((await api(`/api/admin/leads/${firstLead.id}/status`, { method: 'PATCH', cookie: alice.cookie, body: { status: 'won' } })).status, 400);
    const contacted = await api(`/api/admin/leads/${firstLead.id}/status`, { method: 'PATCH', cookie: alice.cookie, body: { status: 'contacted' } });
    assert.equal(contacted.status, 200);
    assert.equal(contacted.body.item.status, 'contacted');
    const unchanged = await api(`/api/admin/leads/${firstLead.id}/status`, { method: 'PATCH', cookie: alice.cookie, body: { status: 'contacted' } });
    assert.equal(unchanged.body.item.statusHistory.length, 2);
    const progressed = await api(`/api/admin/leads/${firstLead.id}/status`, { method: 'PATCH', cookie: owner, body: { status: 'in-progress' } });
    assert.deepEqual(progressed.body.item.statusHistory.map((entry) => [entry.status, entry.by?.email ?? null]), [
      ['new', null], ['contacted', 'alice@nsedu.test'], ['in-progress', ADMIN.email],
    ]);
    const studentView = await api(`/api/applications/mine/${firstLead.ref}`, { cookie: asha.cookie });
    assert.deepEqual([studentView.body.item.status, studentView.body.item.statusLabel], ['in-progress', 'In progress']);

    assert.equal((await api(`/api/admin/leads/${firstLead.id}/notes`, { method: 'POST', cookie: alice.cookie, body: { text: '   ' } })).status, 400);
    const note = await api(`/api/admin/leads/${firstLead.id}/notes`, { method: 'POST', cookie: alice.cookie, body: { text: 'Called; sending the brochure.' } });
    assert.equal(note.status, 201);
    assert.deepEqual([note.body.item.authorEmail, note.body.item.authorRole], ['alice@nsedu.test', 'employee']);
    await api(`/api/admin/leads/${firstLead.id}/notes`, { method: 'POST', cookie: owner, body: { text: 'Follow up on Friday.' } });
    const notes = await api(`/api/admin/leads/${firstLead.id}/notes`, { cookie: alice.cookie });
    assert.deepEqual([notes.body.total, notes.body.items[0].text], [2, 'Follow up on Friday.']);
    assert.equal((await api(`/api/admin/leads/${firstLead.id}/notes`, { cookie: bob.cookie })).status, 404);

    const stats = await api('/api/admin/leads/stats', { cookie: owner });
    assert.equal(stats.body.total, 4);
    assert.equal(stats.body.byStatus.find((row) => row.status === 'in-progress').count, 1);
    assert.equal(stats.body.byStatus.find((row) => row.status === 'new').count, 3);
    assert.equal(stats.body.last14Days.length, 14);
    assert.equal(stats.body.last14Days.at(-1).count, 4);
    assert.equal((await api('/api/admin/leads/stats', { cookie: alice.cookie })).body.total, 1);
  });

  test('closed leads allow a fresh application and submissions are capped per student per day', async () => {
    await api(`/api/admin/leads/${firstLead.id}/status`, { method: 'PATCH', cookie: owner, body: { status: 'closed' } });
    const reopened = await api('/api/applications', { method: 'POST', cookie: asha.cookie, body: validApplication() });
    assert.equal(reopened.status, 201);
    for (let index = 0; index < 6; index++) {
      const result = await api('/api/applications', { method: 'POST', cookie: asha.cookie, body: validApplication({ preference: { courseSlug: '', programmeName: `Programme ${index}` } }) });
      assert.equal(result.status, 201);
    }
    const capped = await api('/api/applications', { method: 'POST', cookie: asha.cookie, body: validApplication({ preference: { courseSlug: '', programmeName: 'One too many' } }) });
    assert.equal(capped.status, 429);
    assert.ok(capped.headers.get('retry-after'));
  });

  const quick = (overrides = {}) => ({
    mode: 'quick',
    applicant: { fullName: ' Kiran  Das ', phone: '+91 91234 56789', email: 'spoofed@example.com', city: 'Kochi', ...overrides.applicant },
    academics: overrides.academics,
    preference: { institutionSlug: 'other-college', courseSlug: 'mba', ...overrides.preference },
    consent: { contactConsent: true, privacyAccepted: true, version: '2026-10', ...overrides.consent },
    source: { path: '/universities/other-college' },
  });

  test('quick apply validates only the short form and reports dotted field paths', async () => {
    const kiran = await signInStudent('kiran@example.com');
    const empty = await api('/api/applications', { method: 'POST', cookie: kiran.cookie, body: { mode: 'quick' } });
    assert.equal(empty.status, 400);
    assert.deepEqual(Object.keys(empty.body.fields).sort(), [
      'applicant.fullName', 'applicant.phone', 'consent.contactConsent', 'consent.privacyAccepted', 'consent.version', 'preference.institutionSlug',
    ]);
    const invalid = await api('/api/applications', { method: 'POST', cookie: kiran.cookie, body: quick({
      applicant: { phone: '12345', state: 'Atlantis' },
      academics: { highestQualification: 'phd', scoreType: 'cgpa', score: 11 },
      preference: { intakeYear: YEAR + 5 },
      consent: { privacyAccepted: false },
    }) });
    assert.deepEqual(Object.keys(invalid.body.fields).sort(), [
      'academics.highestQualification', 'academics.score', 'applicant.phone', 'applicant.state', 'consent.privacyAccepted', 'preference.intakeYear',
    ]);
    for (const [preference, field] of [[{ institutionSlug: 'hidden-college' }, 'preference.institutionSlug'], [{ courseSlug: 'retired' }, 'preference.courseSlug']]) {
      const result = await api('/api/applications', { method: 'POST', cookie: kiran.cookie, body: quick({ preference }) });
      assert.equal(result.status, 400);
      assert.ok(result.body.fields[field], JSON.stringify(result.body));
    }
    assert.equal(await db.collection('applications').countDocuments({ mode: 'quick' }), 0);
  });

  test('quick apply uses the verified account email, defaults the intake and blocks duplicates', async () => {
    const kiran = await signInStudent('kiran@example.com');
    const created = await api('/api/applications', { method: 'POST', cookie: kiran.cookie, body: quick() });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const { item } = created.body;
    assert.match(item.ref, new RegExp(`^GV-${YEAR}-\\d{6}$`));
    assert.equal(item.mode, 'quick');
    assert.deepEqual(item.applicant, { fullName: 'Kiran Das', email: 'kiran@example.com', phone: '+919123456789', city: 'Kochi', state: '' });
    assert.equal(item.academics, null);
    assert.deepEqual(item.exams, []);
    assert.deepEqual([item.preference.institutionName, item.preference.courseName], ['Other College', 'MBA']);
    assert.ok([YEAR, YEAR + 1].includes(item.preference.intakeYear));
    const stored = await db.collection('applications').findOne({ ref: item.ref });
    assert.deepEqual(stored.contactVerified, { email: true, phone: false });
    assert.match(stored.consent.text.privacy, /Other College/);

    const duplicate = await api('/api/applications', { method: 'POST', cookie: kiran.cookie, body: quick({ applicant: { fullName: 'Kiran D' } }) });
    assert.deepEqual([duplicate.status, duplicate.body.ref], [409, item.ref]);
    const withScore = await api('/api/applications', { method: 'POST', cookie: kiran.cookie, body: quick({
      academics: { highestQualification: 'ug', score: '72.5' }, preference: { courseSlug: '', programmeName: 'MBA in Finance', intakeYear: YEAR + 1 },
    }) });
    assert.equal(withScore.status, 201, JSON.stringify(withScore.body));
    assert.deepEqual(withScore.body.item.academics, { highestQualification: 'ug', scoreType: 'percentage', score: 72.5 });
    assert.equal(withScore.body.item.preference.intakeYear, YEAR + 1);

    // An account without an email (mobile sign-in) must supply one.
    const meera = await signInStudent('9123400000', 'phone');
    const noEmail = await api('/api/applications', { method: 'POST', cookie: meera.cookie, body: quick({ applicant: { email: '' } }) });
    assert.equal(noEmail.body.fields['applicant.email'], 'Enter your email address');
    const meeraApp = await api('/api/applications', { method: 'POST', cookie: meera.cookie, body: quick({ applicant: { email: 'Meera@Example.com', phone: '9123400000' } }) });
    assert.equal(meeraApp.status, 201, JSON.stringify(meeraApp.body));
    assert.equal(meeraApp.body.item.applicant.email, 'meera@example.com');
    assert.deepEqual((await db.collection('applications').findOne({ ref: meeraApp.body.item.ref })).contactVerified, { email: false, phone: true });

    const leads = await api('/api/admin/leads?mode=quick', { cookie: owner });
    assert.equal(leads.body.total, 3);
    assert.ok(leads.body.items.every((lead) => lead.mode === 'quick'));
    assert.equal((await api('/api/admin/leads?mode=detailed', { cookie: owner })).body.items.every((lead) => lead.mode === 'detailed'), true);
    assert.equal((await api('/api/admin/leads?mode=other', { cookie: owner })).status, 400);
    const detail = await api(`/api/admin/leads/${leads.body.items[0].id}`, { cookie: owner });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.item.mode, 'quick');
    const csv = await api('/api/admin/leads/export.csv?mode=quick', { cookie: owner });
    assert.equal(csv.status, 200);
    const lines = csv.body.trim().split('\r\n');
    assert.equal(lines.length, 4);
    assert.ok(lines.slice(1).every((line) => line.includes('"Quick apply"')));
  });
});
