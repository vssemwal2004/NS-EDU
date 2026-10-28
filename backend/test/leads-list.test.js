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

const ADMIN = { email: 'owner@leads.test', password: 'correct-horse-battery' };
const DAY = 24 * 60 * 60 * 1000;
const WEB = 60; const DRIVE = 45; const CALLBACK = 15; const LEGACY = 5;
const TOTAL = WEB + DRIVE + CALLBACK + LEGACY;

describe('admin leads list, columns and exports', { skip }, () => {
  let server; let base; let db; let closeDb; let resetRateLimits; let ObjectId; let Collection; let FindCursor; let ExcelJS;
  let owner; let alice; let formId; let todayStart; let seeded = [];
  const aurangabad = {};

  async function api(path, { method = 'GET', body, cookie = owner, raw = false } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(cookie && { cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (raw) return { status: response.status, headers: response.headers, buffer: Buffer.from(await response.arrayBuffer()) };
    const text = await response.text();
    const json = response.headers.get('content-type')?.includes('json');
    return { status: response.status, body: text && json ? JSON.parse(text) : text, headers: response.headers, setCookies: response.headers.getSetCookie() };
  }
  const list = async (params, cookie = owner) => api(`/api/admin/leads?${new URLSearchParams(params)}`, { cookie });
  const total = async (params, cookie) => {
    const result = await list(params, cookie);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.total;
  };
  const cookieFrom = (result, name) => result.setCookies.find((item) => item.startsWith(`${name}=`))?.split(';')[0];

  before(async () => {
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    const [{ app }, collections, rateLimit, { hashPassword }, service, mongodb, excel] = await Promise.all([
      import('../src/app.js'), import('../src/db/collections.js'), import('../src/lib/rate-limit.js'), import('../src/lib/password.js'),
      import('../src/modules/applications/service.js'), import('mongodb'), import('exceljs'),
    ]);
    ({ closeDb } = collections);
    ({ resetRateLimits } = rateLimit);
    ({ ObjectId, Collection, FindCursor } = mongodb);
    ExcelJS = excel.default;
    db = await collections.getDb();
    const now = new Date();
    todayStart = service.istDayStart(service.istToday(now));
    await db.collection('admins').insertOne({ email: ADMIN.email, role: 'admin', passwordHash: await hashPassword(ADMIN.password), createdAt: now, lastLoginAt: null });

    formId = new ObjectId();
    await db.collection('lead_forms').insertOne({
      _id: formId, title: 'DPS Dehradun drive', shortCode: 'dps-ddn', status: 'active', submissionCount: DRIVE,
      school: { name: 'DPS Dehradun', district: 'Dehradun', districtKey: 'dehradun', state: 'Uttarakhand', city: 'Dehradun' },
      fields: [
        { id: 'fullName', label: 'Full name', type: 'text', builtIn: true },
        { id: 'goal', label: 'Dream career', type: 'text' },
        { id: 'subjects', label: 'Favourite subjects', type: 'multi' },
      ],
      createdAt: now,
    });
    // Two drives in districts that share a name but not a state.
    for (const state of ['Bihar', 'Maharashtra']) {
      aurangabad[state] = new ObjectId();
      await db.collection('lead_forms').insertOne({
        _id: aurangabad[state], title: `Aurangabad ${state} drive`, shortCode: `aur-${state.toLowerCase()}`, status: 'active', submissionCount: 1,
        school: { name: `Aurangabad School ${state}`, district: 'Aurangabad', districtKey: 'aurangabad', state, city: 'Aurangabad' }, fields: [],
        createdAt: new Date(now.getTime() - 60_000),
      });
    }
    await db.collection('career_fields').insertOne({ slug: 'engineering', name: 'Engineering', order: 1 });
    await db.collection('courses').insertOne({ slug: 'btech', name: 'B.Tech', active: true });

    // Newest first: lead i is i minutes older than today's first minute, except the first ten (today).
    const at = (index) => new Date(index < 10 ? todayStart.getTime() + (10 - index) * 60_000 : todayStart.getTime() - index * 30 * 60_000);
    const lead = (index, applicant) => ({
      ref: `GV-2026-${String(900000 + index)}`, studentId: null, status: index % 7 === 0 ? 'contacted' : 'new',
      applicant, exams: [], assignedEmployeeIds: [], contactVerified: { email: false, phone: false },
      consent: { contactConsent: true, privacyAccepted: true, version: '2026-10', at: at(index), text: {} }, source: { path: '/' },
      statusHistory: [{ status: 'new', at: at(index), byAdminId: null }], createdAt: at(index), updatedAt: at(index),
      ...service.leadKeys(applicant),
    });
    const emptyPreference = { institutionSlug: '', institutionName: '', city: '', state: '', courseSlug: '', courseName: '', programmeName: '', intakeYear: null };
    let index = 0;
    for (let n = 0; n < WEB; n++, index++) {
      seeded.push({ ...lead(index, { fullName: n === 0 ? 'Asha Rao' : n === 1 ? 'Āsha Verma' : `Web Student ${n}`, email: n === 0 ? 'asha.rao@example.com' : `web${n}@example.com`, phone: n === 0 ? '+919876543210' : `+9181000${String(n).padStart(5, '0')}`, city: n % 2 ? 'Pune' : 'Jaipur', state: n % 2 ? 'Maharashtra' : 'Rajasthan' }),
        channel: 'web-apply', mode: n % 3 === 0 ? 'quick' : 'detailed', formId: null, school: null, academics: null,
        preference: { ...emptyPreference, institutionSlug: 'test-university', institutionName: 'Test University', courseSlug: 'btech', courseName: 'B.Tech', intakeYear: 2027 } });
    }
    for (let n = 0; n < DRIVE; n++, index++) {
      seeded.push({ ...lead(index, { fullName: n === 0 ? '=HYPERLINK("http://evil")' : `Drive Student ${n}`, email: '', phone: `+9182000${String(n).padStart(5, '0')}`, city: 'Dehradun', state: 'Uttarakhand' }),
        channel: 'school-drive', mode: null, formId,
        school: { name: 'DPS Dehradun', district: 'Dehradun', districtKey: 'dehradun', state: 'Uttarakhand', city: 'Dehradun' },
        academics: { classLevel: ['11', '12', '10'][n % 3], schoolStream: n % 2 ? 'pcm' : 'commerce' },
        answers: [{ id: 'goal', label: 'Dream career', type: 'text', value: n === 0 ? '-2+3' : `Goal ${n}` }, { id: 'subjects', label: 'Favourite subjects', type: 'multi', value: ['Maths', 'Physics'] }],
        preference: emptyPreference });
    }
    for (let n = 0; n < CALLBACK; n++, index++) {
      seeded.push({ ...lead(index, { fullName: `Callback Student ${n}`, email: `cb${n}@example.com`, phone: `+9183000${String(n).padStart(5, '0')}`, city: '', state: '' }),
        channel: 'callback', mode: null, formId: null, school: null, academics: null, preference: emptyPreference,
        careerField: { slug: 'engineering', name: 'Engineering' }, callback: { preferredTime: 'Evening', message: 'Call me' } });
    }
    for (let n = 0; n < LEGACY; n++, index++) {
      // Stored before channels and quick apply existed: no `channel`, no `mode`.
      seeded.push({ ...lead(index, { fullName: `Legacy Student ${n}`, email: `old${n}@example.com`, phone: `+9184000${String(n).padStart(5, '0')}`, city: 'Delhi', state: 'Delhi' }),
        formId: null, school: null, academics: null, preference: { ...emptyPreference, institutionSlug: 'test-university', institutionName: 'Test University' } });
    }
    await db.collection('applications').insertMany(seeded);
    seeded = seeded.toSorted((a, b) => b.createdAt - a.createdAt || (b._id.toString() < a._id.toString() ? -1 : 1));

    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    owner = cookieFrom(await api('/api/admin/auth/login', { method: 'POST', body: ADMIN, cookie: null }), 'nsedu_admin');
    const created = await api('/api/admin/employees', { method: 'POST', body: { email: 'alice@leads.test', phone: '+919876500000', password: 'Temporary!Pass9' } });
    assert.equal(created.status, 201);
    const aliceCookie = cookieFrom(await api('/api/admin/auth/login', { method: 'POST', cookie: null, body: { email: 'alice@leads.test', password: 'Temporary!Pass9' } }), 'nsedu_admin');
    assert.equal((await api('/api/admin/auth/change-password', { method: 'POST', cookie: aliceCookie, body: { currentPassword: 'Temporary!Pass9', newPassword: 'Changed!Pass9' } })).status, 200);
    alice = { id: created.body.item.id, cookie: aliceCookie };
    // Three drive leads belong to Alice.
    await db.collection('applications').updateMany({ ref: { $in: seeded.filter((doc) => doc.channel === 'school-drive').slice(0, 3).map((doc) => doc.ref) } }, { $set: { assignedEmployeeIds: [new ObjectId(alice.id)] } });
    service.clearLeadCounts();
  });

  after(async () => {
    mock.restoreAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.dropDatabase();
    await closeDb?.();
  });

  beforeEach(() => resetRateLimits());

  test('page sizes snap to 25, 50 or 100 and report next/previous', async () => {
    const first = await list({});
    assert.equal(first.status, 200);
    assert.deepEqual([first.body.limit, first.body.items.length, first.body.total, first.body.totalExact], [25, 25, TOTAL, true]);
    assert.deepEqual([first.body.hasNext, first.body.hasPrevious, first.body.maxSkip], [true, false, 50_000]);
    assert.deepEqual(first.body.items.map((item) => item.ref), seeded.slice(0, 25).map((doc) => doc.ref));
    assert.equal((await list({ limit: '50' })).body.items.length, 50);
    assert.equal((await list({ limit: '100' })).body.items.length, 100);
    assert.equal((await list({ limit: '30' })).body.limit, 25);
    const last = await list({ limit: '100', page: '2' });
    assert.deepEqual([last.body.items.length, last.body.hasNext, last.body.hasPrevious], [TOTAL - 100, false, true]);
    assert.equal((await list({ page: '2001' })).status, 200);
    const tooDeep = await list({ page: '2002' });
    assert.equal(tooDeep.status, 400);
    assert.ok(tooDeep.body.fields.page);
  });

  test('keyset cursors page forwards and backwards and match skip pages', async () => {
    const one = (await list({})).body;
    const two = (await list({ cursor: one.cursors.last, dir: 'after' })).body;
    assert.deepEqual(two.items.map((item) => item.ref), seeded.slice(25, 50).map((doc) => doc.ref));
    assert.deepEqual(two.items.map((item) => item.ref), (await list({ page: '2' })).body.items.map((item) => item.ref));
    assert.deepEqual([two.hasNext, two.hasPrevious], [true, true]);
    const back = (await list({ cursor: two.cursors.first, dir: 'before' })).body;
    assert.deepEqual(back.items.map((item) => item.ref), one.items.map((item) => item.ref));
    assert.deepEqual([back.hasNext, back.hasPrevious], [true, false]);
    // The final cursor page reports no next page.
    const lastSkip = (await list({ limit: '100' })).body;
    const tail = (await list({ limit: '100', cursor: lastSkip.cursors.last, dir: 'after' })).body;
    assert.deepEqual([tail.items.length, tail.hasNext], [TOTAL - 100, false]);
    const oldest = (await list({ sort: 'oldest' })).body;
    assert.equal(oldest.items[0].ref, seeded.at(-1).ref);
    const oldestTwo = (await list({ sort: 'oldest', cursor: oldest.cursors.last, dir: 'after' })).body;
    assert.deepEqual(oldestTwo.items.map((item) => item.ref), seeded.toReversed().slice(25, 50).map((doc) => doc.ref));
    assert.equal((await list({ cursor: 'garbage', dir: 'after' })).status, 400);
    const empty = (await list({ q: 'zzzz-nobody' })).body;
    assert.deepEqual([empty.items.length, empty.cursors, empty.hasNext], [0, null, false]);
  });

  test('requested columns come back as values, including school-drive answers', async () => {
    const result = await list({ channel: 'school-drive', form: formId.toString(), columns: 'ref,fullName,channel,classLevel,schoolStream,schoolName,assigned,answer:goal,answer:subjects', limit: '50' });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    const lead = result.body.items.find((item) => item.applicant.fullName === 'Drive Student 4');
    assert.deepEqual(lead.values, {
      ref: lead.ref, fullName: 'Drive Student 4', channel: 'School drive', classLevel: 'Class 12', schoolStream: 'Commerce', schoolName: 'DPS Dehradun',
      assigned: '', 'answer:goal': 'Goal 4', 'answer:subjects': 'Maths; Physics',
    });
    assert.ok(result.body.items.some((item) => item.values.assigned === 'alice@leads.test'));
    assert.equal(lead.school.district, 'Dehradun');
    assert.equal(lead.classLevel, '12');
    assert.equal((await list({})).body.items[0].values, undefined);
    assert.equal((await list({ columns: 'ref,nope' })).status, 400);
    // A form's answer columns need that form in scope.
    assert.equal((await list({ columns: 'answer:goal' })).status, 400);
    // Employees never get the admin-only "assigned" column.
    const mine = await list({ columns: 'ref,assigned' }, alice.cookie);
    assert.equal(mine.body.total, 3);
    assert.deepEqual(Object.keys(mine.body.items[0].values), ['ref']);
  });

  test('column registry and filter options describe the drawer and picker', async () => {
    const columns = (await api('/api/admin/leads/columns')).body;
    assert.ok(columns.defaults.includes('ref') && columns.defaults.includes('assigned'));
    assert.ok(columns.items.every((item) => item.key && item.label && item.group));
    assert.ok(!columns.items.some((item) => item.key.startsWith('answer:')));
    assert.deepEqual(columns.formats.map((format) => [format.value, format.maxRows, format.maxColumns]), [['csv', null, null], ['xlsx', 200_000, null], ['pdf', 5_000, 12]]);
    const scoped = (await api(`/api/admin/leads/columns?form=${formId}`)).body;
    assert.deepEqual(scoped.items.filter((item) => item.group === 'Form answers').map((item) => [item.key, item.label]), [['answer:goal', 'Dream career'], ['answer:subjects', 'Favourite subjects']]);
    const employee = (await api('/api/admin/leads/columns', { cookie: alice.cookie })).body;
    assert.ok(!employee.items.some((item) => item.key === 'assigned'));
    assert.ok(!employee.defaults.includes('assigned'));

    const options = (await api('/api/admin/leads/filter-options')).body;
    assert.deepEqual(options.channels.map((item) => item.value), ['web-apply', 'school-drive', 'callback']);
    assert.equal(options.forms.length, 3);
    assert.deepEqual(options.forms[0], { id: formId.toString(), title: 'DPS Dehradun drive', school: 'DPS Dehradun', district: 'Dehradun', state: 'Uttarakhand', status: 'active', submissions: DRIVE });
    assert.deepEqual(options.districts, [
      { value: 'Aurangabad|Bihar', label: 'Aurangabad', state: 'Bihar' },
      { value: 'Aurangabad|Maharashtra', label: 'Aurangabad', state: 'Maharashtra' },
      { value: 'Dehradun|Uttarakhand', label: 'Dehradun', state: 'Uttarakhand' },
    ]);
    assert.deepEqual(options.careerFields, [{ value: 'engineering', label: 'Engineering' }]);
    assert.deepEqual(options.courses, [{ value: 'btech', label: 'B.Tech' }]);
    assert.deepEqual(options.ranges, ['today', 'yesterday', '7d', '30d', 'month']);
    assert.ok(options.classes.some((item) => item.value === 'passed-12'));
    assert.ok(options.streams.some((item) => item.value === 'pcm'));
  });

  test('channel, class, stream, district, form, career field, status and date filters', async () => {
    assert.equal(await total({ channel: 'school-drive' }), DRIVE);
    assert.equal(await total({ channel: 'callback' }), CALLBACK);
    assert.equal(await total({ channel: 'web-apply' }), WEB + LEGACY, 'leads without a channel are website leads');
    assert.equal(await total({ channel: 'web-apply,callback' }), WEB + LEGACY + CALLBACK);
    assert.equal((await list({ channel: 'carrier-pigeon' })).status, 400);
    assert.equal(await total({ class: '11' }), DRIVE / 3);
    assert.equal(await total({ class: '11,12' }), (DRIVE / 3) * 2);
    assert.equal((await list({ class: '13' })).status, 400);
    assert.equal(await total({ stream: 'pcm' }), Math.floor(DRIVE / 2));
    assert.equal(await total({ stream: 'pcm,commerce' }), DRIVE);
    assert.equal(await total({ district: 'Dehradun' }), DRIVE);
    assert.equal(await total({ district: 'Dehradun|Uttarakhand' }), DRIVE);
    assert.equal(await total({ district: 'Dehradun|Bihar' }), 0);
    assert.equal(await total({ form: formId.toString() }), DRIVE);
    assert.equal((await list({ form: 'nope' })).status, 400);
    assert.equal(await total({ careerField: 'engineering' }), CALLBACK);
    assert.equal(await total({ state: 'Maharashtra,Rajasthan' }), WEB);
    assert.equal(await total({ city: 'pune' }), WEB / 2);
    assert.equal(await total({ mode: 'quick' }), WEB / 3);
    assert.equal(await total({ mode: 'detailed' }), WEB - WEB / 3 + LEGACY);
    const contacted = seeded.filter((doc) => doc.status === 'contacted').length;
    assert.equal(await total({ status: 'contacted' }), contacted);
    assert.equal(await total({ status: 'new,contacted' }), TOTAL);
    assert.equal(await total({ range: 'today' }), 10);
    // Older leads step back 30 minutes each from 5 hours before today's start (IST).
    assert.equal(await total({ range: 'yesterday' }), seeded.filter((doc) => doc.createdAt < todayStart && doc.createdAt >= new Date(todayStart.getTime() - DAY)).length);
    assert.equal(await total({ range: '7d' }), seeded.filter((doc) => doc.createdAt >= new Date(todayStart.getTime() - 6 * DAY)).length);
    assert.equal((await list({ range: 'decade' })).status, 400);
    assert.equal(await total({ assignee: 'unassigned', channel: 'school-drive' }), DRIVE - 3);
    assert.equal(await total({ assignee: alice.id }), 3);
    assert.equal(await total({ channel: 'school-drive' }, alice.cookie), 3);
    assert.equal(await total({ channel: 'callback' }, alice.cookie), 0);
  });

  test('search matches reference, name words, phone digits and email prefixes', async () => {
    assert.equal(await total({ q: 'asha' }), 2, 'accent-folded name tokens');
    assert.equal(await total({ q: 'ash' }), 2);
    assert.equal(await total({ q: 'Asha Rao' }), 1);
    assert.equal(await total({ q: 'rao asha' }), 1);
    assert.equal(await total({ q: 'student 1' }), TOTAL - 3, 'one-character words are ignored');
    assert.equal(await total({ q: 'callback' }), CALLBACK);
    assert.equal(await total({ q: '+91 98765 43210' }), 1);
    assert.equal(await total({ q: '09876543210' }), 1);
    assert.equal(await total({ q: '98765' }), 1);
    assert.equal(await total({ q: '82000' }), DRIVE);
    assert.equal(await total({ q: 'Asha.Rao@' }), 1);
    assert.equal(await total({ q: 'cb1' }), 0, 'no @ means a name search');
    assert.equal(await total({ q: 'cb1@' }), 1);
    assert.equal(await total({ q: seeded[0].ref.toLowerCase() }), 1);
    assert.equal(await total({ q: '(.*)' }), 0);
  });

  test('export check reports counts and format limits; employees cannot export', async () => {
    const check = async (params, cookie = owner) => api(`/api/admin/leads/export/check?${new URLSearchParams(params)}`, { cookie });
    assert.deepEqual((await check({ format: 'csv', columns: 'ref,fullName', channel: 'callback' })).body, { total: CALLBACK, totalExact: true, maxRows: null, maxColumns: null, ok: true });
    assert.deepEqual((await check({ format: 'pdf', columns: 'ref' })).body, { total: TOTAL, totalExact: true, maxRows: 5000, maxColumns: 12, ok: true });
    const thirteen = 'ref,createdAt,status,channel,mode,updatedAt,assigned,fullName,phone,email,city,state,gender';
    assert.equal((await check({ format: 'pdf', columns: thirteen })).body.ok, false);
    assert.equal((await check({ format: 'xlsx', columns: thirteen })).body.ok, true);
    assert.equal((await check({ format: 'doc' })).status, 400);
    assert.equal((await check({ format: 'csv' }, alice.cookie)).status, 403);
    assert.equal((await api('/api/admin/leads/export?format=csv&columns=ref', { cookie: alice.cookie })).status, 403);
    assert.equal((await api('/api/admin/leads/export?format=pdf&columns=ref', { cookie: alice.cookie })).status, 403);
  });

  test('CSV export streams the chosen columns with the formula guard', async () => {
    const csv = await api(`/api/admin/leads/export?format=csv&channel=school-drive&form=${formId}&columns=ref,fullName,phone,answer:goal,classLevel`);
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /^text\/csv/);
    assert.match(csv.headers.get('content-disposition'), /attachment; filename="gyaan-vidhya-leads-\d{4}-\d{2}-\d{2}\.csv"/);
    // fetch's text() drops a leading BOM, so check the bytes (Excel needs it to read UTF-8).
    const bytes = await api(`/api/admin/leads/export?format=csv&channel=callback&columns=ref`, { raw: true });
    assert.deepEqual([...bytes.buffer.subarray(0, 3)], [0xEF, 0xBB, 0xBF]);
    const lines = csv.body.trim().split('\r\n');
    assert.equal(lines[0], '"Reference","Full name","Mobile","Dream career","Class"');
    assert.equal(lines.length, DRIVE + 1);
    const evil = lines.find((line) => line.includes('HYPERLINK'));
    assert.ok(evil.includes('"\'=HYPERLINK(""http://evil"")"'), evil);
    assert.ok(evil.includes('"+918200000000"'), 'phone numbers are not prefixed');
    assert.ok(evil.includes('"\'-2+3"'), 'a leading minus that is not a number is guarded');
    const defaults = await api('/api/admin/leads/export?format=csv&channel=callback');
    assert.match(defaults.body.split('\r\n')[0], /"Reference","Submitted \(IST\)","Status","Source"/);
    assert.equal((await api('/api/admin/leads/export?format=csv&columns=ref,bogus')).status, 400);
    // Legacy link keeps its fixed column order.
    const legacy = await api('/api/admin/leads/export.csv?channel=callback');
    assert.equal(legacy.status, 200);
    assert.match(legacy.body, /"Reference","Submitted \(IST\)","Status","Form","Full name"/);
  });

  test('Excel and PDF exports have the right type, columns and caps', async () => {
    const xlsx = await api('/api/admin/leads/export?format=xlsx&channel=callback&columns=ref,fullName,careerField,preferredTime', { raw: true });
    assert.equal(xlsx.status, 200);
    assert.equal(xlsx.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.match(xlsx.headers.get('content-disposition'), /\.xlsx"$/);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx.buffer);
    const sheet = workbook.getWorksheet('Leads');
    assert.deepEqual(sheet.getRow(1).values.slice(1), ['Reference', 'Full name', 'Career field', 'Preferred call time']);
    assert.equal(sheet.actualRowCount, CALLBACK + 1);
    assert.deepEqual(sheet.getRow(2).values.slice(3), ['Engineering', 'Evening']);

    const pdf = await api('/api/admin/leads/export?format=pdf&columns=ref,fullName,phone,channel', { raw: true });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(pdf.buffer.subarray(0, 5).toString(), '%PDF-');
    const pages = pdf.buffer.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;
    assert.ok(pages >= 2 && pages <= 6, `${TOTAL} short rows fit on a few pages (got ${pages})`);
    const thirteen = 'ref,createdAt,status,channel,mode,updatedAt,assigned,fullName,phone,email,city,state,gender';
    const wide = await api(`/api/admin/leads/export?format=pdf&columns=${thirteen}`);
    assert.equal(wide.status, 400);
    assert.ok(wide.body.fields.columns);
  });

  test('PDF refuses more than 5,000 rows', async () => {
    // A city no earlier test filtered on, so no cached count is reused.
    const now = Date.now();
    await db.collection('applications').insertMany(Array.from({ length: 5001 }, (_, index) => ({
      ref: `GV-2026-BULK${index}`, channel: 'callback', status: 'new', applicant: { fullName: 'Bulk', email: '', phone: '', city: 'Bulkpur', state: '' }, cityKey: 'bulkpur',
      createdAt: new Date(now - index * 1000), updatedAt: new Date(now), assignedEmployeeIds: [], statusHistory: [],
    })));
    const check = (await api('/api/admin/leads/export/check?format=pdf&columns=ref&city=Bulkpur')).body;
    assert.deepEqual([check.total, check.ok], [5001, false]);
    assert.equal((await api('/api/admin/leads/export?format=pdf&columns=ref&city=Bulkpur')).status, 413);
    assert.equal((await api('/api/admin/leads/export/check?format=xlsx&columns=ref&city=Bulkpur')).body.ok, true);
  });

  test('stats count every status for the viewer', async () => {
    const stats = (await api('/api/admin/leads/stats')).body;
    assert.equal(stats.byStatus.reduce((sum, row) => sum + row.count, 0), stats.total);
    assert.equal(stats.last14Days.length, 14);
    assert.equal((await api('/api/admin/leads/stats', { cookie: alice.cookie })).body.total, 3);
    const forForm = (await api(`/api/admin/leads/stats?form=${formId}`)).body;
    assert.equal(forForm.total, await db.collection('applications').countDocuments({ formId: new ObjectId(formId) }));
    assert.ok(forForm.total > 0 && forForm.total < stats.total);
    assert.equal((await api('/api/admin/leads/stats?form=nope')).status, 400);
  });

  test('same-named districts in different states stay apart; a lead without history still opens', async () => {
    const at = new Date(todayStart.getTime() - 400 * DAY);
    // Written without statusHistory, as an import or an older writer might.
    await db.collection('applications').insertMany(['Bihar', 'Maharashtra'].map((state) => ({
      ref: `GV-2025-AUR${state.toUpperCase()}`, channel: 'school-drive', mode: null, status: 'new', formId: aurangabad[state],
      school: { name: `Aurangabad School ${state}`, district: 'Aurangabad', districtKey: 'aurangabad', state, city: 'Aurangabad' },
      applicant: { fullName: `Aurangabad ${state}`, email: '', phone: `+9185000${state.length}0000`, city: 'Aurangabad', state },
      academics: { classLevel: '10', schoolStream: 'arts' }, preference: {}, assignedEmployeeIds: [], createdAt: at, updatedAt: at,
    })));
    assert.equal(await total({ district: 'Aurangabad|Maharashtra' }), 1);
    assert.equal(await total({ district: 'Aurangabad|Bihar' }), 1);
    assert.equal(await total({ district: 'Aurangabad' }), 2);
    assert.equal(await total({ district: 'Aurangabad|Kerala' }), 0);
    const rows = (await api('/api/admin/leads/export?format=csv&columns=ref,schoolDistrict&district=Aurangabad%7CMaharashtra')).body.trim().split('\r\n');
    assert.deepEqual(rows.slice(1), ['"GV-2025-AURMAHARASHTRA","Aurangabad"']);
    const lead = await db.collection('applications').findOne({ ref: 'GV-2025-AURBIHAR' });
    const opened = await api(`/api/admin/leads/${lead._id}`);
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.deepEqual(opened.body.item.statusHistory, []);
  });

  test('a count that times out blocks capped formats but not CSV; a slow list answers 503', async () => {
    const timeout = () => Object.assign(new Error('operation exceeded time limit'), { code: 50 });
    const counting = mock.method(Collection.prototype, 'countDocuments', async () => { throw timeout(); });
    try {
      const check = async (format) => (await api(`/api/admin/leads/export/check?format=${format}&columns=ref&city=Slowtown`)).body;
      assert.deepEqual(await check('csv'), { total: null, totalExact: false, maxRows: null, maxColumns: null, ok: true });
      assert.equal((await check('xlsx')).ok, false);
      assert.equal((await check('pdf')).ok, false);
    } finally { counting.mock.restore(); }
    const reading = mock.method(FindCursor.prototype, 'toArray');
    reading.mock.mockImplementationOnce(async () => { throw timeout(); });
    try {
      const slow = await list({ city: 'Slowtown2' });
      assert.equal(slow.status, 503);
      assert.match(slow.body.error, /took too long/);
    } finally { reading.mock.restore(); }
  });
});
