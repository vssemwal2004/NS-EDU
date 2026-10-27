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

const ADMIN = { email: 'owner@insights.test', password: 'correct-horse-battery' };
const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60_000;

describe('admin leads dashboard insights', { skip }, () => {
  let server; let base; let db; let closeDb; let resetRateLimits; let clearAllCaches; let ObjectId; let service; let insights;
  let owner; let alice; let formId; let todayStart; let today;

  async function api(path, cookie = owner) {
    const response = await fetch(`${base}${path}`, { headers: cookie ? { cookie } : {} });
    const text = await response.text();
    return { status: response.status, body: text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text, setCookies: response.headers.getSetCookie() };
  }
  async function post(path, body, cookie = owner) {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie && { cookie }) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json(), setCookies: response.headers.getSetCookie() };
  }
  const cookieFrom = (result, name) => result.setCookies.find((item) => item.startsWith(`${name}=`))?.split(';')[0];
  const day = (offset) => new Date(todayStart.getTime() + offset * DAY + 5.5 * 60 * MINUTE).toISOString().slice(0, 10);
  const get = async (query = '', cookie = owner) => {
    const result = await api(`/api/admin/leads/insights${query}`, cookie);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  };
  const counts = (rows) => Object.fromEntries(rows.map((row) => [row.value, row.count]));

  before(async () => {
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    const [{ app }, collections, rateLimit, ttl, { hashPassword }, applications, leadInsights, mongodb] = await Promise.all([
      import('../src/app.js'), import('../src/db/collections.js'), import('../src/lib/rate-limit.js'), import('../src/lib/ttl-cache.js'), import('../src/lib/password.js'),
      import('../src/modules/applications/service.js'), import('../src/modules/applications/lead-insights.js'), import('mongodb'),
    ]);
    ({ closeDb } = collections);
    ({ resetRateLimits } = rateLimit);
    ({ clearAllCaches } = ttl);
    ({ ObjectId } = mongodb);
    service = applications;
    insights = leadInsights;
    db = await collections.getDb();
    const now = new Date();
    today = service.istToday(now);
    todayStart = service.istDayStart(today);
    await db.collection('admins').insertOne({ email: ADMIN.email, role: 'admin', passwordHash: await hashPassword(ADMIN.password), createdAt: now, lastLoginAt: null });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    owner = cookieFrom(await post('/api/admin/auth/login', ADMIN, null), 'nsedu_admin');
    const employee = async (email) => {
      const created = await post('/api/admin/employees', { email, phone: '+919876500000', password: 'Temporary!Pass9' });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const cookie = cookieFrom(await post('/api/admin/auth/login', { email, password: 'Temporary!Pass9' }, null), 'nsedu_admin');
      assert.equal((await post('/api/admin/auth/change-password', { currentPassword: 'Temporary!Pass9', newPassword: 'Changed!Pass9' }, cookie)).status, 200);
      return { id: created.body.item.id, cookie };
    };
    alice = await employee('alice@insights.test');
    await employee('bob@insights.test');

    formId = new ObjectId();
    await db.collection('lead_forms').insertOne({
      _id: formId, title: 'Career day 2026', shortCode: 'dps-ins', status: 'active', fields: [], createdAt: now,
      school: { name: 'DPS Dehradun', district: 'Dehradun', districtKey: 'dehradun', state: 'Uttarakhand', city: 'Dehradun' },
    });
    const emptyPreference = { institutionSlug: '', institutionName: '', city: '', state: '', courseSlug: '', courseName: '', programmeName: '', intakeYear: null };
    let seq = 0;
    const lead = (createdAt, { status = 'new', state = 'Maharashtra', assigned = [], ...rest }) => {
      seq += 1;
      const applicant = { fullName: `Student ${seq}`, email: '', phone: `+9190000${String(seq).padStart(5, '0')}`, city: '', state };
      return {
        ref: `GV-2026-${String(800000 + seq)}`, channel: 'web-apply', mode: 'quick', studentId: null, formId: null, school: null, applicant, academics: null, exams: [],
        preference: emptyPreference, careerField: null, contactVerified: { email: false, phone: false }, consent: { contactConsent: true, privacyAccepted: true, version: '2026-10', at: createdAt, text: {} },
        source: { path: '/' }, status, statusHistory: [{ status: 'new', at: createdAt, byAdminId: null }], assignedEmployeeIds: assigned, createdAt, updatedAt: createdAt,
        ...service.leadKeys(applicant), ...rest,
      };
    };
    const aliceId = new ObjectId(alice.id);
    const drive = { channel: 'school-drive', mode: null, formId, school: { name: 'DPS Dehradun', district: 'Dehradun', districtKey: 'dehradun', state: 'Uttarakhand', city: 'Dehradun' }, state: 'Uttarakhand', status: 'contacted', assigned: [aliceId] };
    await db.collection('applications').insertMany([
      ...[1, 2, 3].map((minutes) => lead(new Date(todayStart.getTime() + minutes * MINUTE), { preference: { ...emptyPreference, courseSlug: 'btech', courseName: 'B.Tech' } })),
      // One minute either side of IST midnight (18:30Z): both fall on yesterday in India.
      lead(new Date(todayStart.getTime() - MINUTE), drive),
      lead(new Date(todayStart.getTime() - DAY + MINUTE), drive),
      lead(new Date(todayStart.getTime() - 5 * DAY + 3 * 60 * MINUTE), { channel: 'callback', mode: null, state: '', status: 'admitted', careerField: { slug: 'engineering', name: 'Engineering' } }),
      (({ channel, mode, ...legacy }) => legacy)(lead(new Date(todayStart.getTime() - 20 * DAY), { state: 'Delhi', status: 'closed', assigned: [aliceId] })),
      lead(new Date(todayStart.getTime() - 60 * DAY), { status: 'not-interested' }),
      lead(new Date(todayStart.getTime() - 200 * DAY), { status: 'in-progress' }),
    ]);
  });

  after(async () => {
    mock.restoreAll();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (db) await db.dropDatabase();
    await closeDb?.();
  });

  beforeEach(() => { resetRateLimits(); clearAllCaches(); });

  test('requires a staff session', async () => {
    assert.equal((await api('/api/admin/leads/insights', null)).status, 401);
  });

  test('defaults to the last 30 India days with a zero-filled daily trend', async () => {
    const body = await get();
    assert.deepEqual(body.range, { preset: '30d', from: day(-29), to: today, days: 30 });
    assert.equal(body.trend.length, 30);
    assert.equal(body.trend[0].date, day(-29));
    assert.equal(body.trend.at(-1).date, today);
    const perDay = Object.fromEntries(body.trend.map((row) => [row.date, row.count]));
    assert.equal(perDay[today], 3);
    assert.equal(perDay[day(-1)], 2, 'both leads either side of 18:30Z belong to yesterday in IST');
    assert.equal(perDay[day(-2)], 0);
    assert.equal(perDay[day(-5)], 1);
    assert.equal(body.total, 7);
    assert.equal(body.trend.reduce((sum, row) => sum + row.count, 0), body.total);
    assert.ok(!Number.isNaN(Date.parse(body.generatedAt)));
  });

  test('breaks the range down by channel, status, state, course, school drive and career field', async () => {
    const body = await get('?range=30d');
    assert.deepEqual(counts(body.byChannel), { 'web-apply': 4, 'school-drive': 2, callback: 1 }, 'legacy leads without a channel count as website');
    assert.deepEqual(body.byStatus.map((row) => row.value), ['new', 'contacted', 'in-progress', 'applied-to-university', 'admitted', 'not-interested', 'closed']);
    assert.deepEqual(counts(body.byStatus), { new: 3, contacted: 2, 'in-progress': 0, 'applied-to-university': 0, admitted: 1, 'not-interested': 0, closed: 1 });
    assert.deepEqual(body.byState, [
      { value: 'Maharashtra', label: 'Maharashtra', count: 3 }, { value: 'Uttarakhand', label: 'Uttarakhand', count: 2 },
      { value: '', label: 'Not given', count: 1 }, { value: 'Delhi', label: 'Delhi', count: 1 },
    ]);
    assert.deepEqual(body.byCourse, [{ value: 'btech', label: 'B.Tech', count: 3 }]);
    assert.deepEqual(body.bySchool, [{ value: formId.toString(), label: 'DPS Dehradun', title: 'Career day 2026', district: 'Dehradun', state: 'Uttarakhand', count: 2 }]);
    assert.deepEqual(body.byCareerField, [{ value: 'engineering', label: 'Engineering', count: 1 }]);
  });

  test('KPIs are fixed windows and all-time status totals', async () => {
    const { kpis } = await get('?range=today');
    assert.deepEqual(kpis, { today: 3, yesterday: 2, last7: 6, last30: 7, open: 6, closed: 2, admitted: 1 });
  });

  test('presets and custom ranges', async () => {
    assert.equal((await get('?range=today')).total, 3);
    assert.equal((await get('?range=7d')).total, 6);
    assert.equal((await get('?range=90d')).total, 8);
    const month = await get('?range=month');
    assert.equal(month.range.from, `${today.slice(0, 8)}01`);
    assert.equal(month.trend.length, month.range.days);
    const custom = await get(`?from=${day(-210)}&to=${day(-1)}`);
    assert.deepEqual(custom.range, { preset: '', from: day(-210), to: day(-1), days: 210 });
    assert.equal(custom.total, 6);
    const toOnly = await get(`?to=${day(-1)}`);
    assert.equal(toOnly.range.from, day(-30));
    assert.equal(toOnly.range.days, 30);
  });

  test('rejects unknown, reversed, impossible and over-long ranges', async () => {
    for (const query of ['?range=1y', `?from=${today}&to=${day(-3)}`, '?from=2026-02-31', '?from=26-1-1', `?from=${day(-401)}&to=${today}`]) {
      const result = await api(`/api/admin/leads/insights${query}`);
      assert.equal(result.status, 400, query);
      assert.ok(result.body.fields, query);
    }
    assert.equal((await get(`?from=${day(-399)}&to=${today}`)).range.days, 400);
  });

  test('administrators see per-employee workload, including idle employees', async () => {
    const body = await get();
    assert.equal(body.unassigned, 4);
    assert.deepEqual(body.employees.map(({ id, ...row }) => row), [
      { email: 'alice@insights.test', assigned: 3, open: 2, contacted: 3, admitted: 0 },
      { email: 'bob@insights.test', assigned: 0, open: 0, contacted: 0, admitted: 0 },
    ]);
    assert.equal(body.employees[0].id, alice.id);
    // Leads still held by someone who is no longer an employee keep a row, so they can be reassigned.
    const ghost = new ObjectId();
    await db.collection('applications').insertOne({ ref: 'GV-2026-899999', channel: 'web-apply', status: 'new', applicant: { state: 'Maharashtra' }, assignedEmployeeIds: [ghost], createdAt: new Date(todayStart.getTime() + 5 * MINUTE) });
    clearAllCaches();
    try {
      const withGhost = await get();
      assert.deepEqual(withGhost.employees.find((row) => row.id === ghost.toString()), { id: ghost.toString(), email: 'Former staff', assigned: 1, open: 1, contacted: 0, admitted: 0 });
      assert.equal(withGhost.unassigned, 4);
    } finally {
      await db.collection('applications').deleteOne({ ref: 'GV-2026-899999' });
    }
  });

  test('employees only see their assigned leads and no workload table', async () => {
    const body = await get('', alice.cookie);
    assert.equal(body.total, 3);
    assert.equal(body.employees, null);
    assert.equal(body.unassigned, null);
    assert.deepEqual(counts(body.byChannel), { 'web-apply': 1, 'school-drive': 2, callback: 0 });
    assert.deepEqual(body.kpis, { today: 0, yesterday: 2, last7: 2, last30: 3, open: 2, closed: 1, admitted: 0 });
    // The employee path buckets days in one grouped pass; both 18:30Z-boundary leads are Alice's.
    assert.equal(body.trend.length, 30);
    assert.equal(body.trend.find((row) => row.date === day(-1)).count, 2);
    assert.equal(body.trend.find((row) => row.date === day(-20)).count, 1);
    assert.deepEqual(counts(body.byStatus), { new: 0, contacted: 2, 'in-progress': 0, 'applied-to-university': 0, admitted: 0, 'not-interested': 0, closed: 1 });
    assert.deepEqual(body.byState.map((row) => [row.value, row.count]), [['Uttarakhand', 2], ['Delhi', 1]]);
    assert.equal(body.bySchool[0].count, 2);
    // The admin's cached response must not leak into the employee's (cache keys include the viewer).
    const admin = await get();
    assert.equal(admin.total, 7);
    assert.equal((await get('', alice.cookie)).total, 3);
  });

  test('responses are cached for a minute per viewer and range', async () => {
    const first = await get('?range=7d');
    await db.collection('applications').updateOne({ status: 'new' }, { $set: { status: 'contacted' } });
    const second = await get('?range=7d');
    assert.equal(second.generatedAt, first.generatedAt);
    await db.collection('applications').updateOne({ status: 'contacted', channel: 'web-apply' }, { $set: { status: 'new' } });
  });

  test('every dashboard query is index-backed; fixed breakdowns never read documents', async () => {
    const leads = db.collection('applications');
    const range = insights.insightRange({ range: '90d' });
    const winning = (explain) => JSON.stringify(explain.queryPlanner?.winningPlan ?? explain.stages?.[0]?.$cursor?.queryPlanner?.winningPlan ?? explain);
    for (const staff of [{ role: 'admin' }, { role: 'employee', _id: new ObjectId(alice.id) }]) {
      const queries = insights.insightQueries(range, staff);
      for (const [name, { pipeline, options }] of Object.entries(queries.groups)) {
        const plan = winning(await leads.aggregate(pipeline, options).explain('queryPlanner'));
        assert.match(plan, /IXSCAN/, `${staff.role} ${name}`);
        assert.doesNotMatch(plan, /COLLSCAN/, `${staff.role} ${name}`);
      }
      if (staff.role !== 'admin') continue;
      for (const filter of [queries.days[0].filter, queries.counts['status:new'], queries.counts['state:Delhi'], queries.counts['channel:callback']]) {
        const plan = winning(await leads.aggregate([{ $match: filter }, { $group: { _id: 1, n: { $sum: 1 } } }]).explain('queryPlanner'));
        assert.match(plan, /IXSCAN|COUNT_SCAN/, JSON.stringify(filter));
        assert.doesNotMatch(plan, /FETCH|COLLSCAN/, `admin counts read only the index: ${JSON.stringify(filter)} ${plan}`);
      }
    }
    const admin = insights.insightQueries(range, { role: 'admin' });
    const employee = insights.insightQueries(range, { role: 'employee', _id: new ObjectId(alice.id) });
    assert.deepEqual(Object.keys(admin.groups).sort(), ['byCareerField', 'byCourse', 'bySchool', 'workload']);
    assert.deepEqual(Object.keys(employee.groups).sort(), ['byCareerField', 'byCourse', 'bySchool', 'facts']);
    assert.deepEqual(employee.counts, {});
  });
});
