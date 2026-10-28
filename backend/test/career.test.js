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
const callback = (overrides = {}) => ({ name: 'Meera Joshi', phone: '98111 22334', fieldSlug: 'technology-engineering', preferredTime: 'evening', message: 'Confused between CSE and ECE.', consent: true, consentVersion: '2026-10', website: '', ...overrides });

describe('career guidance counsellors and callbacks', { skip }, () => {
  let server; let base; let db; let closeDb; let resetRateLimits;
  let owner; let student; let tech; let lead;

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
  const callbacks = async () => db.collection('applications').find({ channel: 'callback' }).sort({ createdAt: 1 }).toArray();

  before(async () => {
    mock.method(console, 'log', () => {});
    const [{ app }, collections, rateLimit, { hashPassword }] = await Promise.all([
      import('../src/app.js'), import('../src/db/collections.js'), import('../src/lib/rate-limit.js'), import('../src/lib/password.js'),
    ]);
    ({ closeDb } = collections);
    ({ resetRateLimits } = rateLimit);
    db = await collections.getDb();
    await db.collection('admins').insertOne({ email: ADMIN.email, role: 'admin', passwordHash: await hashPassword(ADMIN.password), createdAt: new Date(), lastLoginAt: null });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    owner = cookieFrom(await api('/api/admin/auth/login', { method: 'POST', body: ADMIN }), 'nsedu_admin');
    const requested = await api('/api/auth/otp/request', { method: 'POST', body: { channel: 'email', identifier: 'kiran@example.com' } });
    const verified = await api('/api/auth/otp/verify', { method: 'POST', body: { channel: 'email', identifier: 'kiran@example.com', code: requested.body.devCode } });
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    student = { cookie: cookieFrom(verified, 'nsedu_student'), id: verified.body.student.id };
  });

  after(async () => {
    mock.restoreAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.dropDatabase();
    await closeDb?.();
  });

  beforeEach(() => resetRateLimits());

  test('admins manage fields and counsellors through the resource API', async () => {
    const created = await api('/api/admin/career_fields', { method: 'POST', cookie: owner, body: { name: 'Technology & Engineering', description: 'Engineering and IT.', order: 1 } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    tech = created.body.item;
    assert.equal(tech.slug, 'technology-engineering');
    assert.equal(tech.icon, 'compass');
    assert.equal((await api('/api/admin/career_fields', { method: 'POST', cookie: owner, body: { name: 'Hidden Field', active: false } })).status, 201);

    const invalid = await api('/api/admin/counsellors', { method: 'POST', cookie: owner, body: { name: 'X', fieldSlug: 'nowhere', phone: '12345', whatsapp: '555' } });
    assert.equal(invalid.status, 400);
    assert.deepEqual(Object.keys(invalid.body.fields).sort(), ['name', 'phone', 'whatsapp']);
    const unknownField = await api('/api/admin/counsellors', { method: 'POST', cookie: owner, body: { name: 'Ravi Kumar', fieldSlug: 'nowhere', phone: '9876543210' } });
    assert.equal(unknownField.status, 400);
    assert.ok(unknownField.body.fields.fieldSlug);

    const lead = await api('/api/admin/counsellors', { method: 'POST', cookie: owner, body: { name: 'Anita Sharma', title: 'Senior engineering counsellor', fieldSlug: tech.slug, isMaster: true, phone: '098765-43210', whatsapp: '+91 98765 43211', languages: 'Hindi, English', availability: 'Mon–Sat, 10 am–6 pm', order: 2 } });
    assert.equal(lead.status, 201, JSON.stringify(lead.body));
    assert.equal(lead.body.item.phone, '+919876543210');
    assert.equal(lead.body.item.whatsapp, '+919876543211');
    assert.deepEqual(lead.body.item.languages, ['Hindi', 'English']);
    const second = await api('/api/admin/counsellors', { method: 'POST', cookie: owner, body: { name: 'Vikram Rao', fieldSlug: tech.slug, phone: '9123456780', order: 1 } });
    assert.equal(second.status, 201);
    assert.equal(second.body.item.whatsapp, '');
    assert.equal((await api('/api/admin/counsellors', { method: 'POST', cookie: owner, body: { name: 'On Leave', fieldSlug: tech.slug, phone: '9123456781', active: false } })).status, 201);
    const edited = await api(`/api/admin/counsellors/${second.body.item.id}`, { method: 'PATCH', cookie: owner, body: { phone: '91234 56789' } });
    assert.equal(edited.body.item.phone, '+919123456789');
  });

  test('anonymous visitors see counsellors without contact details; the response is publicly cacheable', async () => {
    const response = await api('/api/career/fields');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
    assert.match(response.headers.get('vary'), /Cookie/i);
    assert.equal(response.body.contacts, false);
    assert.deepEqual(response.body.items.map((field) => field.slug), ['technology-engineering']);
    const [field] = response.body.items;
    assert.equal(field.name, 'Technology & Engineering');
    assert.deepEqual(field.counsellors.map((person) => person.name), ['Anita Sharma', 'Vikram Rao'], 'lead counsellor first, inactive hidden');
    assert.equal(field.counsellors[0].isMaster, true);
    for (const person of field.counsellors) {
      assert.ok(!('phone' in person) && !('whatsapp' in person), 'no contact keys for anonymous visitors');
    }
    assert.doesNotMatch(JSON.stringify(response.body), /98765|91234/);
    assert.deepEqual(response.body.callback.times.map((time) => time.value), ['morning', 'afternoon', 'evening', 'any']);
    assert.ok(response.body.callback.consent.text.length > 20);
  });

  test('signed-in students get phone and WhatsApp numbers, privately and rate limited', async () => {
    const response = await api('/api/career/fields', { cookie: student.cookie });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('vary'), /Cookie/i);
    assert.equal(response.body.contacts, true);
    const [anita, vikram] = response.body.items[0].counsellors;
    assert.equal(anita.phone, '+919876543210');
    assert.equal(anita.whatsapp, '+919876543211');
    assert.equal(vikram.whatsapp, '');
    // A forged or expired cookie is treated as anonymous rather than an error.
    const forged = await api('/api/career/fields', { cookie: 'nsedu_student=not.a.jwt' });
    assert.equal(forged.status, 200);
    assert.equal(forged.body.contacts, false);

    for (let index = 1; index < 60; index += 1) await api('/api/career/fields', { cookie: student.cookie });
    const limited = await api('/api/career/fields', { cookie: student.cookie });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  });

  test('renaming a field keeps its counsellors; its slug and deletion are guarded', async () => {
    const renamed = await api(`/api/admin/career_fields/${tech.id}`, { method: 'PATCH', cookie: owner, body: { name: 'Engineering & Technology' } });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.item.slug, 'technology-engineering');
    const listed = await api('/api/career/fields');
    assert.equal(listed.body.items[0].name, 'Engineering & Technology');
    assert.equal(listed.body.items[0].counsellors.length, 2);

    const slugChange = await api(`/api/admin/career_fields/${tech.id}`, { method: 'PATCH', cookie: owner, body: { slug: 'engineering' } });
    assert.equal(slugChange.status, 400);
    assert.match(slugChange.body.fields.slug, /3 counsellors/);
    const removal = await api(`/api/admin/career_fields/${tech.id}`, { method: 'DELETE', cookie: owner });
    assert.equal(removal.status, 409);
    assert.equal(removal.body.error, 'Remove its 3 counsellors first');
  });

  test('callback validation reports every bad field', async () => {
    const empty = await api('/api/career/callback', { method: 'POST', body: {} });
    assert.equal(empty.status, 400);
    assert.deepEqual(Object.keys(empty.body.fields).sort(), ['consent', 'fieldSlug', 'name', 'phone']);
    const invalid = await api('/api/career/callback', { method: 'POST', body: callback({ phone: '12345', preferredTime: 'midnight', message: 'x'.repeat(501), consent: false }) });
    assert.equal(invalid.status, 400);
    assert.deepEqual(Object.keys(invalid.body.fields).sort(), ['consent', 'message', 'phone', 'preferredTime']);
    const hidden = await api('/api/career/callback', { method: 'POST', body: callback({ fieldSlug: 'hidden-field' }) });
    assert.equal(hidden.body.fields.fieldSlug, 'Choose a career field from the list');
    const stale = await api('/api/career/callback', { method: 'POST', body: callback({ consentVersion: '2020-01' }) });
    assert.match(stale.body.fields.consent, /changed/);
    assert.equal((await callbacks()).length, 0);
  });

  test('an anonymous callback becomes a lead per the shared lead contract', async () => {
    const response = await api('/api/career/callback', { method: 'POST', body: callback({ source: { utmSource: 'instagram', utmMedium: 'x'.repeat(200) } }) });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    // Anonymous callers never get a reference: a sequential ref on a repeat would date the earlier request.
    assert.deepEqual(response.body, { ok: true, ref: null });
    [lead] = await callbacks();
    assert.match(lead.ref, /^GV-\d{4}-\d{6}$/);
    assert.equal(lead.studentId, null);
    assert.equal(lead.mode, null);
    assert.equal(lead.formId, null);
    assert.deepEqual(lead.applicant, { fullName: 'Meera Joshi', email: '', phone: '+919811122334', city: '', state: '' });
    assert.deepEqual(lead.careerField, { slug: 'technology-engineering', name: 'Engineering & Technology' });
    assert.deepEqual(lead.callback, { preferredTime: 'evening', message: 'Confused between CSE and ECE.' });
    assert.equal(lead.academics, null);
    assert.equal(lead.preference.institutionSlug, '');
    assert.deepEqual(lead.contactVerified, { email: false, phone: false });
    assert.equal(lead.consent.contactConsent, true);
    assert.match(lead.consent.text.contact, /counsellors may call/);
    assert.equal(lead.consent.version, '2026-10');
    assert.deepEqual(lead.source, { path: '/career-guidance', utmSource: 'instagram', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '' });
    assert.equal(lead.status, 'new');
    assert.deepEqual(lead.nameTokens, ['meera', 'joshi']);
    assert.equal(lead.keysV, 2);

    const leads = await api('/api/admin/leads?channel=callback&careerField=technology-engineering', { cookie: owner });
    assert.equal(leads.status, 200);
    assert.equal(leads.body.total, 1);
    assert.equal(leads.body.items[0].channel, 'callback');
    assert.equal(leads.body.items[0].careerField.name, 'Engineering & Technology');
    const detail = await api(`/api/admin/leads/${lead._id}`, { cookie: owner });
    assert.equal(detail.body.item.callback.preferredTime, 'evening');
  });

  test('repeat requests and bots get the same answer without new leads; the repeat question is kept as a note', async () => {
    const repeat = await api('/api/career/callback', { method: 'POST', body: callback({ phone: '+919811122334', name: 'Meera J', preferredTime: 'morning', message: 'Again' }) });
    assert.equal(repeat.status, 201);
    assert.deepEqual(repeat.body, { ok: true, ref: null });
    const bot = await api('/api/career/callback', { method: 'POST', body: callback({ phone: '9000000001', website: 'http://spam.example' }) });
    assert.equal(bot.status, 201);
    assert.deepEqual(bot.body, { ok: true, ref: null });
    assert.equal((await callbacks()).length, 1);

    const notes = await api(`/api/admin/leads/${lead._id}/notes`, { cookie: owner });
    assert.equal(notes.body.items.length, 1);
    assert.match(notes.body.items[0].text, /Meera J, Morning/);
    assert.match(notes.body.items[0].text, /Message: Again/);
    assert.equal(notes.body.items[0].authorRole, 'system');
  });

  test('a signed-in student’s callback is linked to them, gets its reference, and is not one of their applications', async () => {
    const response = await api('/api/career/callback', { method: 'POST', cookie: student.cookie, body: callback({ name: 'Kiran Patel', phone: '9822334455', preferredTime: undefined, message: '' }) });
    assert.equal(response.status, 201);
    assert.match(response.body.ref, /^GV-\d{4}-\d{6}$/);
    const doc = await db.collection('applications').findOne({ ref: response.body.ref });
    assert.equal(doc.studentId.toString(), student.id);
    assert.equal(doc.applicant.email, 'kiran@example.com');
    assert.deepEqual(doc.contactVerified, { email: true, phone: false });
    assert.equal(doc.callback.preferredTime, 'any');
    const mine = await api('/api/applications/mine', { cookie: student.cookie });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.items.length, 0);

    // Their own repeat returns their own reference.
    const again = await api('/api/career/callback', { method: 'POST', cookie: student.cookie, body: callback({ name: 'Kiran Patel', phone: '9822334455' }) });
    assert.equal(again.body.ref, response.body.ref);
    // A number someone else asked about anonymously is not matched to that request: the student gets a
    // fresh lead of their own, and learns nothing about the earlier one.
    const sharedPhone = await api('/api/career/callback', { method: 'POST', cookie: student.cookie, body: callback({ name: 'Kiran Patel', message: 'Please call after 6 pm' }) });
    assert.match(sharedPhone.body.ref, /^GV-\d{4}-\d{6}$/);
    assert.notEqual(sharedPhone.body.ref, lead.ref);
    const own = await db.collection('applications').findOne({ ref: sharedPhone.body.ref });
    assert.equal(own.studentId.toString(), student.id);
    assert.equal(own.callback.message, 'Please call after 6 pm');
    assert.equal((await db.collection('applications').findOne({ _id: lead._id })).studentId, null);
  });

  test('callbacks are rate limited per network', async () => {
    for (let index = 0; index < 10; index += 1) {
      const response = await api('/api/career/callback', { method: 'POST', body: callback({ phone: `97000000${String(index).padStart(2, '0')}` }) });
      assert.equal(response.status, 201);
    }
    const limited = await api('/api/career/callback', { method: 'POST', body: callback({ phone: '9700000099' }) });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  });
});
