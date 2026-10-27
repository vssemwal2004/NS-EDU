import { after, before, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// env.js reads process.env at import time, so configure before importing the app.
const skip = process.env.MONGODB_URI ? false : 'MONGODB_URI is not set';
process.env.MONGODB_DATABASE = `nsedu_test_${randomBytes(4).toString('hex')}`;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.PUBLIC_SITE_URL = 'https://gyaanvidhya.test/';
process.env.OTP_DELIVERY = 'console';
process.env.NODE_ENV = 'test';
process.env.DRIVE_SUBMITS_PER_FORM_MINUTE = '5';

const ADMIN = { email: 'owner@nsedu.test', password: 'correct-horse-battery' };
const SCHOOL = { name: 'Doon Public School', district: 'Dehradun', state: 'Uttarakhand', city: 'Dehradun' };

describe('school drive forms', { skip }, () => {
  let server; let base; let db; let closeDb; let resetRateLimits; let formToken;
  let owner; let employee; let drive; let customId;

  async function api(path, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(cookie && { cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const type = response.headers.get('content-type') ?? '';
    const body_ = type.includes('json') ? await response.json() : type.startsWith('image/png') ? Buffer.from(await response.arrayBuffer()) : await response.text();
    return { status: response.status, body: body_, headers: response.headers, setCookies: response.headers.getSetCookie() };
  }
  const cookieFrom = (result, name) => result.setCookies.find((item) => item.startsWith(`${name}=`))?.split(';')[0];
  // A token issued 10 s ago: real pages are older than the 3 s minimum by the time a student submits.
  const aged = (id) => formToken(id, Date.now() - 10_000);
  const submission = (overrides = {}) => ({
    token: aged(drive.id),
    answers: { fullName: 'Asha Rawat', phone: '98765 43210', email: 'Asha@Example.com', classLevel: '12', schoolStream: 'pcm', [customId]: ['Engineering', 'Design'], ...overrides.answers },
    consent: { contact: true, privacy: true, guardian: true, ...overrides.consent },
    source: { utmSource: 'poster', utmCampaign: 'oct-drive' },
    website: overrides.website ?? '',
  });

  before(async () => {
    mock.method(console, 'log', () => {});
    const [{ app }, collections, rateLimit, { hashPassword }, service] = await Promise.all([
      import('../src/app.js'), import('../src/db/collections.js'), import('../src/lib/rate-limit.js'), import('../src/lib/password.js'),
      import('../src/modules/drives/drive-service.js'),
    ]);
    ({ closeDb } = collections);
    ({ resetRateLimits } = rateLimit);
    ({ formToken } = service);
    db = await collections.getDb();
    await db.collection('admins').insertOne({ email: ADMIN.email, role: 'admin', passwordHash: await hashPassword(ADMIN.password), createdAt: new Date(), lastLoginAt: null });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    owner = cookieFrom(await api('/api/admin/auth/login', { method: 'POST', body: ADMIN }), 'nsedu_admin');
    const created = await api('/api/admin/employees', { method: 'POST', cookie: owner, body: { email: 'emp@nsedu.test', phone: '+919876500000', password: 'Temporary!Pass9' } });
    assert.equal(created.status, 201);
    employee = cookieFrom(await api('/api/admin/auth/login', { method: 'POST', body: { email: 'emp@nsedu.test', password: 'Temporary!Pass9' } }), 'nsedu_admin');
    assert.equal((await api('/api/admin/auth/change-password', { method: 'POST', cookie: employee, body: { currentPassword: 'Temporary!Pass9', newPassword: 'Changed!Pass9' } })).status, 200);
  });

  after(async () => {
    mock.restoreAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.dropDatabase();
    await closeDb?.();
  });

  beforeEach(() => resetRateLimits());

  test('only the owner admin manages drives', async () => {
    assert.equal((await api('/api/admin/drives')).status, 401);
    assert.equal((await api('/api/admin/drives', { cookie: employee })).status, 403);
    assert.equal((await api('/api/admin/drives', { method: 'POST', cookie: employee, body: { school: SCHOOL } })).status, 403);
  });

  test('creating a drive issues a stable short code and the default questions', async () => {
    const invalid = await api('/api/admin/drives', { method: 'POST', cookie: owner, body: { school: { name: 'X', state: 'Atlantis' } } });
    assert.equal(invalid.status, 400);
    assert.deepEqual(Object.keys(invalid.body.fields).sort(), ['school.district', 'school.name', 'school.state']);

    const created = await api('/api/admin/drives', { method: 'POST', cookie: owner, body: { school: SCHOOL, campaign: 'October 2026' } });
    assert.equal(created.status, 201);
    drive = created.body.item;
    assert.match(drive.shortCode, /^[a-hjkmnp-z2-9]{8}$/);
    assert.equal(drive.publicUrl, `https://gyaanvidhya.test/r/${drive.shortCode}`);
    assert.equal(drive.title, 'Student registration — Doon Public School');
    assert.equal(drive.status, 'active');
    assert.deepEqual(drive.fields.map((field) => field.id), ['fullName', 'phone', 'email', 'classLevel', 'schoolStream']);
    assert.ok(drive.fields.every((field) => field.builtIn));
    assert.equal(drive.guardianConsent, true);

    const listed = await api('/api/admin/drives?q=doon', { cookie: owner });
    assert.equal(listed.status, 200);
    assert.equal(listed.body.total, 1);
    assert.equal(listed.body.counts.active, 1);
    assert.deepEqual(listed.body.groups.map((group) => [group.state, group.districts.map((item) => item.district)]), [['Uttarakhand', ['Dehradun']]]);
  });

  test('editing details and questions never changes the short code; field rules hold', async () => {
    const fields = [
      ...drive.fields.map((field) => (field.id === 'phone' ? { ...field, enabled: false, required: false, label: 'Your mobile' } : field)),
      { label: 'Careers you are curious about', type: 'checkbox', options: ['Engineering', 'Medicine', 'Design', ' Engineering '], required: true },
    ];
    const duplicateOption = await api(`/api/admin/drives/${drive.id}`, { method: 'PATCH', cookie: owner, body: { fields } });
    assert.equal(duplicateOption.status, 400);
    assert.ok(duplicateOption.body.fields['fields.5.options']);

    fields[5].options = ['Engineering', 'Medicine', 'Design'];
    const saved = await api(`/api/admin/drives/${drive.id}`, { method: 'PATCH', cookie: owner, body: { fields, title: 'Careers week', shortCode: 'aaaaaaaa', school: { ...SCHOOL, name: 'Doon Public School, Rajpur Road' } } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.item.shortCode, drive.shortCode);
    assert.equal(saved.body.item.title, 'Careers week');
    const phone = saved.body.item.fields.find((field) => field.id === 'phone');
    assert.deepEqual([phone.enabled, phone.required, phone.label], [true, true, 'Your mobile'], 'mobile stays on and required');
    const custom = saved.body.item.fields.at(-1);
    assert.match(custom.id, /^[a-hjkmnp-z2-9]{8}$/);
    customId = custom.id;

    const forged = await api(`/api/admin/drives/${drive.id}`, { method: 'PATCH', cookie: owner, body: { fields: [...saved.body.item.fields, { id: 'zzzzzzzz', label: 'Sneaky', type: 'text' }] } });
    assert.equal(forged.status, 400);
    assert.ok(forged.body.fields['fields.6.id']);
    const tooMany = await api(`/api/admin/drives/${drive.id}`, { method: 'PATCH', cookie: owner, body: { fields: [...saved.body.item.fields, ...Array.from({ length: 30 }, (_, index) => ({ label: `Q${index}`, type: 'text' }))] } });
    assert.equal(tooMany.status, 400);
    assert.ok(tooMany.body.fields.fields);

    const again = await api(`/api/admin/drives/${drive.id}`, { method: 'PATCH', cookie: owner, body: { fields: saved.body.item.fields } });
    assert.equal(again.body.item.fields.at(-1).id, customId, 'saving again keeps the custom id');
    drive = again.body.item;
  });

  test('QR codes encode the public link as PNG and SVG', async () => {
    const png = await api(`/api/admin/drives/${drive.id}/qr.png?size=300`, { cookie: owner });
    assert.equal(png.status, 200);
    assert.equal(png.headers.get('content-type'), 'image/png');
    assert.deepEqual([...png.body.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    const svg = await api(`/api/admin/drives/${drive.id}/qr.svg?download=1`, { cookie: owner });
    assert.equal(svg.status, 200);
    assert.match(svg.headers.get('content-type'), /^image\/svg\+xml/);
    assert.match(svg.body, /<svg/);
    assert.match(svg.headers.get('content-disposition'), /attachment; filename="doon-public-school-rajpur-road-[a-z2-9]{8}-qr\.svg"/);
    assert.equal((await api(`/api/admin/drives/${drive.id}/qr.png`, { cookie: employee })).status, 403);
  });

  test('the public form needs no login and returns only enabled questions with a token', async () => {
    assert.equal((await api('/api/forms/not-a-code')).status, 404);
    assert.equal((await api('/api/forms/abcdefgh')).status, 404);
    const form = await api(`/api/forms/${drive.shortCode.toUpperCase()}`);
    assert.equal(form.status, 200);
    assert.equal(form.body.form.school.name, 'Doon Public School, Rajpur Road');
    assert.deepEqual(form.body.form.fields.map((field) => field.id), ['fullName', 'phone', 'email', 'classLevel', 'schoolStream', customId]);
    assert.deepEqual(form.body.form.fields.find((field) => field.id === 'classLevel').options[0], { value: '9', label: 'Class 9' });
    assert.ok(form.body.form.consent.guardian);
    assert.match(form.body.token, /^\d{13}\.[\w-]{43}$/);
    assert.equal(form.headers.get('cache-control'), 'no-store');
  });

  test('a submission becomes a school-drive lead visible in the admin leads list', async () => {
    const tooFast = await api(`/api/forms/${drive.shortCode}/submit`, { method: 'POST', body: { ...submission(), token: formToken(drive.id) } });
    assert.equal(tooFast.status, 400);
    assert.equal(tooFast.body.retry, true);
    const forgedToken = await api(`/api/forms/${drive.shortCode}/submit`, { method: 'POST', body: { ...submission(), token: `${Date.now() - 10_000}.${'a'.repeat(43)}` } });
    assert.equal(forgedToken.body.tokenExpired, true);

    const invalid = await api(`/api/forms/${drive.shortCode}/submit`, { method: 'POST', body: submission({ answers: { phone: '12345', classLevel: '13', [customId]: ['Astronomy'] }, consent: { guardian: false } }) });
    assert.equal(invalid.status, 400);
    assert.deepEqual(Object.keys(invalid.body.fields).sort(), [`answers.${customId}`, 'answers.classLevel', 'answers.phone', 'consent.guardian'].sort());

    const created = await api(`/api/forms/${drive.shortCode}/submit`, { method: 'POST', body: submission() });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.match(created.body.ref, /^GV-\d{4}-\d{6}$/);

    const lead = await db.collection('applications').findOne({ ref: created.body.ref });
    assert.equal(lead.channel, 'school-drive');
    assert.equal(lead.formId.toString(), drive.id);
    assert.equal(lead.studentId, null);
    assert.deepEqual(lead.applicant, { fullName: 'Asha Rawat', email: 'asha@example.com', phone: '+919876543210', city: 'Dehradun', state: 'Uttarakhand' });
    assert.deepEqual(lead.school, { name: 'Doon Public School, Rajpur Road', district: 'Dehradun', districtKey: 'dehradun', state: 'Uttarakhand', city: 'Dehradun' });
    assert.deepEqual(lead.academics, { classLevel: '12', schoolStream: 'pcm' });
    assert.deepEqual(lead.answers, [{ id: customId, label: 'Careers you are curious about', type: 'checkbox', value: ['Engineering', 'Design'] }]);
    assert.equal(lead.consent.text.guardian.length > 20, true);
    assert.equal(lead.source.path, `/r/${drive.shortCode}`);
    assert.equal(lead.source.utmSource, 'poster');
    assert.deepEqual(lead.nameTokens, ['asha', 'rawat']);

    const listed = await api(`/api/admin/leads?form=${drive.id}&columns=schoolName,classLevel,answer:${customId}`, { cookie: owner });
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    assert.equal(listed.body.total, 1);
    assert.deepEqual(listed.body.items[0].values, { schoolName: 'Doon Public School, Rajpur Road', classLevel: 'Class 12', [`answer:${customId}`]: 'Engineering; Design' });

    const detail = await api(`/api/admin/drives/${drive.id}`, { cookie: owner });
    assert.equal(detail.body.item.submissionCount, 1);
    assert.ok(detail.body.item.lastSubmissionAt);
  });

  test('a repeat phone returns the first reference; the honeypot stores nothing', async () => {
    const first = await db.collection('applications').findOne({ formId: { $exists: true }, channel: 'school-drive' });
    const repeat = await api(`/api/forms/${drive.shortCode}/submit`, { method: 'POST', body: submission({ answers: { phone: '+91 98765-43210', fullName: 'Asha R' } }) });
    assert.equal(repeat.status, 200);
    assert.deepEqual(repeat.body, { ok: true, ref: first.ref, alreadyRegistered: true });
    const stranger = await api(`/api/forms/${drive.shortCode}/submit`, { method: 'POST', body: submission({ answers: { phone: '9876543210', fullName: 'Someone Else' } }) });
    assert.deepEqual(stranger.body, { ok: true, ref: null, alreadyRegistered: true }, 'a phone number alone does not reveal the reference');

    const before_ = await db.collection('applications').countDocuments();
    const bot = await api(`/api/forms/${drive.shortCode}/submit`, { method: 'POST', body: submission({ website: 'https://spam.example', answers: { phone: '9123456780' } }) });
    assert.equal(bot.status, 201);
    assert.equal(bot.body.ref, null);
    assert.equal(await db.collection('applications').countDocuments(), before_);
    assert.equal((await api(`/api/admin/drives/${drive.id}`, { cookie: owner })).body.item.submissionCount, 1);
  });

  test('junk posts and typing mistakes do not use up the drive-wide submit budget', async () => {
    const other = (await api('/api/admin/drives', { method: 'POST', cookie: owner, body: { school: { ...SCHOOL, name: 'Busy Hall School' } } })).body.item;
    const post = (body) => api(`/api/forms/${other.shortCode}/submit`, { method: 'POST', body });
    const valid = (phone, extra = {}) => ({ token: aged(other.id), answers: { fullName: 'Hall Student', phone, classLevel: '11', schoolStream: 'pcb' }, consent: { contact: true, privacy: true, guardian: true }, ...extra });
    for (let index = 0; index < 6; index += 1) {
      assert.equal((await post({})).status, 400);
      assert.equal((await post({ ...valid('12345'), token: formToken(other.id) })).body.retry, true);
      assert.equal((await post(valid('12345'))).status, 400);
    }
    for (let index = 0; index < 5; index += 1) assert.equal((await post(valid(`91000000${10 + index}`))).status, 201);
    const busy = await post(valid('9100000099'));
    assert.equal(busy.status, 429, 'the per-form cap (5/min in this test) still applies to real registrations');
    assert.ok(busy.body.retryAfterSeconds >= 1);
    assert.equal((await api(`/api/admin/drives/${other.id}`, { method: 'DELETE', cookie: owner })).body.item.status, 'archived');
  });

  test('a registration limit closes the drive; closed and archived links answer 410', async () => {
    const lowered = await api(`/api/admin/drives/${drive.id}`, { method: 'PATCH', cookie: owner, body: { maxSubmissions: 1 } });
    assert.equal(lowered.status, 200);
    assert.deepEqual([lowered.body.item.status, lowered.body.item.closedReason], ['closed', 'limit'], 'a limit at the count closes the drive at once');
    assert.equal((await api(`/api/forms/${drive.shortCode}`)).status, 410);
    const limited = await api(`/api/admin/drives/${drive.id}`, { method: 'PATCH', cookie: owner, body: { status: 'active', maxSubmissions: 2 } });
    assert.equal(limited.status, 200);
    assert.equal(limited.body.item.status, 'active');
    const second = await api(`/api/forms/${drive.shortCode}/submit`, { method: 'POST', body: submission({ answers: { phone: '9123456780', fullName: 'Ravi Negi' } }) });
    assert.equal(second.status, 201);
    const closed = await api(`/api/admin/drives/${drive.id}`, { cookie: owner });
    assert.equal(closed.body.item.status, 'closed');
    assert.equal(closed.body.item.closedReason, 'limit');
    const gone = await api(`/api/forms/${drive.shortCode}`);
    assert.equal(gone.status, 410);
    assert.equal(gone.body.error, 'Registration closed');
    assert.equal(gone.body.school.name, 'Doon Public School, Rajpur Road');
    assert.equal((await api(`/api/forms/${drive.shortCode}/submit`, { method: 'POST', body: submission({ answers: { phone: '9000000001' } }) })).status, 410);

    const blocked = await api(`/api/admin/drives/${drive.id}`, { method: 'PATCH', cookie: owner, body: { status: 'active' } });
    assert.equal(blocked.status, 400);
    assert.ok(blocked.body.fields.status);
    const reopened = await api(`/api/admin/drives/${drive.id}`, { method: 'PATCH', cookie: owner, body: { status: 'active', maxSubmissions: null } });
    assert.equal(reopened.body.item.status, 'active');
    assert.equal((await api(`/api/forms/${drive.shortCode}`)).status, 200);

    assert.equal((await api(`/api/admin/drives/${drive.id}?permanent=1`, { method: 'DELETE', cookie: owner })).status, 409);
    const archived = await api(`/api/admin/drives/${drive.id}`, { method: 'DELETE', cookie: owner });
    assert.equal(archived.status, 200);
    assert.equal(archived.body.item.status, 'archived');
    assert.equal(archived.body.item.shortCode, drive.shortCode);
    assert.equal((await api(`/api/forms/${drive.shortCode}`)).status, 410);
    assert.equal((await api('/api/admin/drives', { cookie: owner })).body.total, 0, 'archived drives leave the default list');
    assert.equal((await api('/api/admin/drives?status=archived&q=doon', { cookie: owner })).body.total, 1);
    assert.equal((await api(`/api/admin/leads?form=${drive.id}`, { cookie: owner })).body.total, 2, 'archiving keeps the leads');
  });

  test('a drive without registrations can be deleted for good', async () => {
    const created = await api('/api/admin/drives', { method: 'POST', cookie: owner, body: { school: { ...SCHOOL, name: 'Empty School' } } });
    assert.equal((await api(`/api/admin/drives/${created.body.item.id}?permanent=1`, { method: 'DELETE', cookie: owner })).body.deleted, true);
    assert.equal((await api(`/api/admin/drives/${created.body.item.id}`, { cookie: owner })).status, 404);
  });
});
