import { after, before, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// env.js reads process.env at import time, so configure before importing anything from src/. A static
// import here once loaded env.js first, ran this suite against the real `nsedu` and dropped it.
const skip = process.env.MONGODB_URI ? false : 'MONGODB_URI is not set';
process.env.MONGODB_DATABASE = `nsedu_test_${randomBytes(4).toString('hex')}`;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.OTP_DELIVERY = 'console';
process.env.SMS_PROVIDER = 'console';
process.env.NODE_ENV = 'test';

const { HOT_AT, WARM_AT, crmUpdate, heatOf, scoreLead } = await import('../src/modules/crm/crm-model.js');
const { PERMISSION_KEYS, SYSTEM_ROLES, expand } = await import('../src/modules/access/permissions.js');

const PASSWORD = 'Correct-Horse-9!';
const DAY = 24 * 60 * 60 * 1000;

describe('permissions catalogue', () => {
  test('implied permissions expand, and every built-in role only uses known permissions', () => {
    assert.deepEqual([...expand(['leads.view_all'])].sort(), ['leads.view_all', 'leads.view_own', 'leads.view_team']);
    for (const role of SYSTEM_ROLES.filter((item) => !item.locked)) {
      assert.ok(role.permissions.every((key) => PERMISSION_KEYS.includes(key)), `${role.slug} uses an unknown permission`);
    }
    const executive = expand(SYSTEM_ROLES.find((role) => role.slug === 'executive').permissions);
    assert.ok(!executive.has('leads.export') && !executive.has('leads.delete') && !executive.has('leads.view_all'), 'counsellors cannot export, delete or see everything');
  });
});

describe('lead temperature', () => {
  const now = new Date('2026-10-30T10:00:00Z');
  const base = { status: 'new', channel: 'web-apply', mode: 'detailed', createdAt: new Date(now - 0.2 * DAY), updatedAt: new Date(now - 0.2 * DAY), contactVerified: { phone: true, email: true }, consent: { contactConsent: true }, preference: { courseSlug: 'btech' } };

  test('a fresh, complete, verified application is hot and explains itself', () => {
    const { score, heat, reasons } = scoreLead(base, now);
    assert.ok(score >= HOT_AT && heat === 'hot', `score ${score}`);
    assert.ok(reasons.some((reason) => /full application/i.test(reason.label)));
  });

  test('time and silence cool a lead down; progress and callbacks warm it up', () => {
    const stale = scoreLead({ ...base, createdAt: new Date(now - 40 * DAY), updatedAt: new Date(now - 40 * DAY) }, now);
    assert.equal(stale.heat, 'cold');
    const callback = scoreLead({ ...base, channel: 'callback', mode: null, preference: {}, contactVerified: {}, consent: {} }, now);
    assert.ok(callback.score > scoreLead({ ...base, channel: 'school-drive', mode: null, preference: {}, contactVerified: {}, consent: {} }, now).score);
    assert.ok(scoreLead({ ...base, status: 'applied-to-university' }, now).score > scoreLead(base, now).score);
    assert.equal(heatOf(WARM_AT), 'warm');
    assert.equal(heatOf(WARM_AT - 1), 'cold');
  });

  test('closed leads are cold, admitted leads are won, and a manual temperature sticks while the score keeps moving', () => {
    assert.equal(scoreLead({ ...base, status: 'not-interested' }, now).heat, 'cold');
    assert.equal(scoreLead({ ...base, status: 'admitted' }, now).score, 100);
    const manual = crmUpdate({ ...base, crm: { heat: 'cold', heatSource: 'manual' } }, now);
    assert.equal(manual['crm.heat'], 'cold');
    assert.equal(manual['crm.heatSource'], 'manual');
    assert.ok(manual['crm.score'] >= HOT_AT, 'the score still reflects the lead');
    assert.equal(crmUpdate({ ...base, crm: { heat: 'cold', heatSource: 'auto' } }, now)['crm.heat'], 'hot');
  });
});

describe('roles, teams and the CRM', { skip }, () => {
  let server; let base; let db; let closeDb; let resetRateLimits; let ObjectId; let hashPassword;
  const who = {};

  async function api(path, { method = 'GET', body, as = 'owner' } = {}) {
    const response = await fetch(`${base}${path}`, {
      method, headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(who[as]?.cookie && { cookie: who[as].cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text, setCookies: response.headers.getSetCookie() };
  }
  async function makeStaff(key, { roleId, role = 'employee', managerId = null } = {}) {
    const email = `${key}@access.test`;
    const doc = { email, role, ...(roleId && { roleId }), managerId, passwordHash: await hashPassword(PASSWORD), mustChangePassword: false, createdAt: new Date(), lastLoginAt: null, status: 'active', name: key };
    const { insertedId } = await db.collection('admins').insertOne(doc);
    who[key] = { id: insertedId, email };
    return who[key];
  }
  async function signIn(key) {
    resetRateLimits();
    const result = await api('/api/admin/auth/login', { method: 'POST', body: { email: who[key].email, password: PASSWORD }, as: 'nobody' });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    who[key].cookie = result.setCookies.find((item) => item.startsWith('nsedu_admin='))?.split(';')[0];
    return result.body.admin;
  }
  const lead = async (name, phone, { assignees = [], status = 'new', createdAt = new Date() } = {}) => {
    const { insertedId } = await db.collection('applications').insertOne({
      ref: `GV-T-${phone.slice(-6)}`, channel: 'web-apply', mode: 'detailed', status, applicant: { fullName: name, email: '', phone, city: 'Dehradun', state: 'Uttarakhand' },
      preference: {}, assignedEmployeeIds: assignees, statusHistory: [{ status, at: createdAt }], createdAt, updatedAt: createdAt, nameTokens: [name.toLowerCase()], cityKey: 'dehradun', keysV: 2,
    });
    return insertedId.toString();
  };

  before(async () => {
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    const [{ app }, collections, rateLimit, password, mongodb] = await Promise.all([
      import('../src/app.js'), import('../src/db/collections.js'), import('../src/lib/rate-limit.js'), import('../src/lib/password.js'), import('mongodb'),
    ]);
    ({ closeDb } = collections); ({ resetRateLimits } = rateLimit); ({ hashPassword } = password); ({ ObjectId } = mongodb);
    db = await collections.getDb();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    await makeStaff('owner', { role: 'admin' });
    await makeStaff('lead', { roleId: 'team-lead' });
    await makeStaff('amit', { roleId: 'executive', managerId: who.lead.id });
    await makeStaff('riya', { roleId: 'executive', managerId: who.lead.id });
    await makeStaff('outsider', { roleId: 'executive' });
    await makeStaff('analyst', { roleId: 'analyst' });
    await makeStaff('editor', { roleId: 'data-editor' });
    for (const key of Object.keys(who)) await signIn(key);
  });
  after(async () => {
    server?.close();
    if (db?.databaseName.startsWith('nsedu_test_')) await db.dropDatabase();
    await closeDb?.();
  });

  test('a session carries the role, permissions and lead scope; legacy accounts map to Owner and Counsellor', async () => {
    const owner = (await api('/api/admin/auth/me')).body.admin;
    assert.equal(owner.roleId, 'owner'); assert.equal(owner.isOwner, true); assert.equal(owner.leadScope, 'all');
    assert.ok(PERMISSION_KEYS.every((key) => owner.permissions.includes(key)));
    const amit = (await api('/api/admin/auth/me', { as: 'amit' })).body.admin;
    assert.equal(amit.roleId, 'executive'); assert.equal(amit.leadScope, 'own'); assert.equal(amit.isOwner, false);
    assert.ok(!amit.permissions.includes('leads.export'));
    const lead = (await api('/api/admin/auth/me', { as: 'lead' })).body.admin;
    assert.equal(lead.leadScope, 'team');
  });

  test('each area answers to its own permission', async () => {
    assert.equal((await api('/api/admin/dashboard', { as: 'amit' })).status, 403, 'counsellors have no platform dashboard');
    assert.equal((await api('/api/admin/dashboard', { as: 'analyst' })).status, 200);
    assert.equal((await api('/api/admin/institutions', { as: 'editor' })).status, 200, 'the data editor maintains the directory');
    assert.equal((await api('/api/admin/institutions', { as: 'amit' })).status, 403);
    assert.equal((await api('/api/admin/leads/export?format=csv', { as: 'amit' })).status, 403);
    assert.equal((await api('/api/admin/leads/export/check?format=csv', { as: 'analyst' })).status, 200, 'analysts may export');
    assert.equal((await api('/api/admin/access/staff', { as: 'amit' })).status, 403);
    assert.equal((await api('/api/admin/access/staff', { as: 'analyst' })).status, 200, 'team.view lets analysts see names and roles');
    assert.equal((await api('/api/admin/access/audit', { as: 'analyst' })).status, 403);
    const leads = await api('/api/admin/leads', { as: 'editor' });
    assert.equal(leads.body.total, 0, 'the data editor has no lead access');
  });

  test('roles are editable, but never beyond the editor’s own level', async () => {
    const made = await api('/api/admin/access/roles', { method: 'POST', body: { name: 'Admissions desk', color: 'teal', permissions: ['leads.view_all', 'leads.notes'] } });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    assert.equal(made.body.item.slug, 'admissions-desk');
    assert.equal((await api('/api/admin/access/roles', { method: 'POST', body: { name: 'Admissions desk', permissions: [] } })).status, 409, 'duplicate name');
    assert.equal((await api('/api/admin/access/roles', { method: 'POST', body: { name: 'Sneaky', permissions: ['nope.nothing'] } })).status, 400, 'unknown permission');
    assert.equal((await api('/api/admin/access/roles/owner', { method: 'PATCH', body: { permissions: [] } })).status, 403, 'owner is locked');
    assert.equal((await api('/api/admin/access/roles', { method: 'POST', body: { name: 'Nope', permissions: [] }, as: 'lead' })).status, 403, 'team leads cannot edit roles');
    // A manager of roles can only hand out what they hold themselves.
    await api('/api/admin/access/roles/team-lead', { method: 'PATCH', body: { permissions: [...SYSTEM_ROLES.find((role) => role.slug === 'team-lead').permissions, 'roles.manage'] } });
    const escalate = await api('/api/admin/access/roles', { method: 'POST', body: { name: 'Super', permissions: ['leads.delete'] }, as: 'lead' });
    assert.equal(escalate.status, 403, 'a team lead cannot mint a role stronger than their own');
    const ok = await api('/api/admin/access/roles', { method: 'POST', body: { name: 'Trainee', permissions: ['leads.view_own'] }, as: 'lead' });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal((await api('/api/admin/access/roles/trainee', { method: 'DELETE', as: 'owner' })).status, 204);
    assert.equal((await api('/api/admin/access/roles/executive', { method: 'DELETE' })).status, 403, 'built-in roles stay');
    await api('/api/admin/access/roles/team-lead', { method: 'PATCH', body: { permissions: SYSTEM_ROLES.find((role) => role.slug === 'team-lead').permissions } });
  });

  test('staff: mentors, loops, self-protection, suspension and the last owner', async () => {
    const created = await api('/api/admin/access/staff', { method: 'POST', body: { email: 'new@access.test', phone: '9876543210', password: PASSWORD, roleId: 'executive', managerId: who.lead.id.toString(), name: 'New Hire' } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.item.managerName, 'lead');
    assert.equal(created.body.item.mustChangePassword, true);
    assert.equal((await api('/api/admin/access/staff', { method: 'POST', body: { email: 'new@access.test', phone: '9876543210', password: PASSWORD } })).status, 409);
    // Loops: the owner cannot be mentored by someone who reports (even indirectly) to them.
    await api(`/api/admin/access/staff/${who.lead.id}`, { method: 'PATCH', body: { managerId: who.owner.id.toString() } });
    assert.equal((await api(`/api/admin/access/staff/${who.owner.id}`, { method: 'PATCH', body: { managerId: who.amit.id.toString() } })).status, 400, 'loop');
    assert.equal((await api(`/api/admin/access/staff/${who.amit.id}`, { method: 'PATCH', body: { managerId: who.amit.id.toString() } })).status, 400, 'self mentor');
    assert.equal((await api(`/api/admin/access/staff/${who.owner.id}`, { method: 'PATCH', body: { roleId: 'executive' } })).status, 403, 'cannot change own role');
    assert.equal((await api(`/api/admin/access/staff/${who.owner.id}`, { method: 'PATCH', body: { status: 'suspended' } })).status, 403, 'cannot suspend self');
    // A suspended account is locked out at once, session cookie and all.
    assert.equal((await api(`/api/admin/access/staff/${who.outsider.id}`, { method: 'PATCH', body: { status: 'suspended' } })).status, 200);
    assert.equal((await api('/api/admin/auth/me', { as: 'outsider' })).status, 401);
    resetRateLimits();
    assert.equal((await api('/api/admin/auth/login', { method: 'POST', body: { email: who.outsider.email, password: PASSWORD }, as: 'nobody' })).status, 403);
    assert.equal((await api(`/api/admin/access/staff/${who.outsider.id}`, { method: 'PATCH', body: { status: 'active' } })).status, 200);
    await signIn('outsider');
    const roles = await api('/api/admin/access/roles');
    assert.equal(roles.body.items.find((role) => role.slug === 'owner').members, 1);
    const audit = await api('/api/admin/access/audit?action=staff');
    assert.ok(audit.body.items.some((row) => row.action === 'staff.create'), 'creation is in the activity log');
    assert.ok(audit.body.items.some((row) => row.action === 'staff.update'));
  });

  test('staff are removed only when nothing points at them; the activity log filters by day', async () => {
    const temp = await api('/api/admin/access/staff', { method: 'POST', body: { email: 'temp@access.test', phone: '9876500000', password: PASSWORD, roleId: 'executive', managerId: who.amit.id.toString() } });
    assert.equal(temp.status, 201, JSON.stringify(temp.body));
    const id = temp.body.item.id;
    assert.equal((await api(`/api/admin/access/staff/${id}`, { method: 'DELETE', as: 'analyst' })).status, 403, 'needs team.manage');
    assert.equal((await api(`/api/admin/access/staff/${who.owner.id}`, { method: 'DELETE' })).status, 403, 'not yourself');
    const mentor = await api(`/api/admin/access/staff/${who.amit.id}`, { method: 'DELETE' });
    assert.equal(mentor.status, 409, 'someone reports to them');
    assert.match(mentor.body.error, /1 person reports to them/);
    await lead('Temp Lead', '9000000099', { assignees: [new ObjectId(id)] });
    const busy = await api(`/api/admin/access/staff/${id}`, { method: 'DELETE' });
    assert.equal(busy.status, 409, 'a lead is still assigned');
    assert.match(busy.body.error, /1 lead still assigned/);
    await db.collection('applications').deleteOne({ 'applicant.fullName': 'Temp Lead' });
    assert.equal((await api(`/api/admin/access/staff/${id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await api('/api/admin/access/staff')).body.items.some((person) => person.id === id), false);
    assert.equal((await api(`/api/admin/access/staff/${id}`, { method: 'DELETE' })).status, 404);
    const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const removed = await api(`/api/admin/access/audit?action=staff.delete&from=${today}&to=${today}`);
    assert.equal(removed.body.items.length, 1);
    assert.equal(removed.body.items[0].targetLabel, 'temp@access.test');
    assert.equal((await api('/api/admin/access/audit?from=2001-01-01&to=2001-01-02')).body.total, 0, 'an old range is empty');
    assert.equal((await api('/api/admin/access/catalogue', { as: 'amit' })).status, 403, 'the catalogue still needs a Team & access permission');
    assert.equal((await api('/api/admin/access/catalogue', { as: 'analyst' })).status, 200);
  });

  test('mentors see their team’s leads, counsellors their own, and assignment stays inside the team', async () => {
    const a = await lead('Aarav Own', '9000000001', { assignees: [who.amit.id] });
    await lead('Riya Own', '9000000002', { assignees: [who.riya.id] });
    const o = await lead('Outside Lead', '9000000003', { assignees: [who.outsider.id] });
    const free = await lead('Unassigned', '9000000004');
    const names = async (as) => (await api('/api/admin/leads?limit=100', { as })).body.items.map((item) => item.applicant.fullName).sort();
    assert.deepEqual(await names('amit'), ['Aarav Own']);
    assert.deepEqual(await names('lead'), ['Aarav Own', 'Riya Own'], 'a mentor sees their reports’ leads and no one else’s');
    assert.equal((await names('owner')).length >= 4, true);
    assert.equal((await api(`/api/admin/leads/${o}`, { as: 'lead' })).status, 404, 'cannot open a lead outside the team');
    // Assignment: team only.
    const toOutsider = await api(`/api/admin/leads/${a}/assignments`, { method: 'PATCH', body: { employeeIds: [who.outsider.id.toString()] }, as: 'lead' });
    assert.equal(toOutsider.status, 403);
    const toTeam = await api(`/api/admin/leads/${a}/assignments`, { method: 'PATCH', body: { employeeIds: [who.riya.id.toString()] }, as: 'lead' });
    assert.equal(toTeam.status, 200, JSON.stringify(toTeam.body));
    assert.equal((await api(`/api/admin/leads/${a}/assignments`, { method: 'PATCH', body: { employeeIds: [who.amit.id.toString()] }, as: 'amit' })).status, 403, 'counsellors cannot assign');
    assert.equal((await api('/api/admin/leads/assignments/bulk', { method: 'POST', body: { applicationIds: [free], employeeIds: [who.riya.id.toString()] }, as: 'lead' })).status, 404, 'unassigned leads are outside a mentor’s scope');
  });

  test('CRM: add a lead, log a call, schedule and finish follow-ups, set temperature, filter and bulk-act', async () => {
    const created = await api('/api/admin/crm/leads', { method: 'POST', as: 'lead', body: { fullName: 'Walk In Student', phone: '98765 43211', city: 'Dehradun', state: 'Uttarakhand', courseName: 'B.Tech CSE', source: 'Walk-in' } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.item.id;
    assert.equal(created.body.item.channel, 'manual');
    assert.equal(created.body.item.applicant.phone, '+919876543211', 'phones are stored normalised');
    assert.equal(created.body.item.crm.priority, 'normal');
    assert.ok(created.body.item.crm.heat, 'a new lead is scored on creation');
    // Regression: a fresh manual lead has no follow-up (an explicit null in the database, never a date), so it is
    // never "Overdue", and its score explains the right channel.
    assert.equal(created.body.item.crm.nextFollowUpAt, null);
    const stored = await db.collection('applications').findOne({ _id: new ObjectId(id) });
    assert.ok('nextFollowUpAt' in stored.crm && stored.crm.nextFollowUpAt === null, 'stored as null, not missing');
    assert.ok(!created.body.item.crm.reasons.some((reason) => /overdue|school drive/i.test(reason.label)), JSON.stringify(created.body.item.crm.reasons));
    assert.ok(created.body.item.crm.reasons.some((reason) => /walk-in|referral/i.test(reason.label)));
    const overdueNames = (await api('/api/admin/leads?followUp=overdue&limit=100', { as: 'lead' })).body.items.map((item) => item.id);
    assert.ok(!overdueNames.includes(id), 'not in the Overdue quick view');
    assert.ok((await api('/api/admin/leads?followUp=none&limit=100', { as: 'lead' })).body.items.some((item) => item.id === id), 'listed under "None scheduled"');
    assert.equal((await api('/api/admin/crm/leads', { method: 'POST', as: 'lead', body: { fullName: 'Dup', phone: '9876543211' } })).status, 409, 'duplicate phone');
    assert.equal((await api('/api/admin/crm/leads', { method: 'POST', as: 'amit', body: { fullName: 'Nope', phone: '9876543299' } })).status, 403, 'counsellors cannot add leads until granted');

    // First real conversation moves New → Contacted and starts the response clock.
    const called = await api(`/api/admin/crm/leads/${id}/activities`, { method: 'POST', as: 'lead', body: { kind: 'call', outcome: 'connected', text: 'Interested in CSE, wants fee details', followUpAt: new Date(Date.now() + DAY).toISOString() } });
    assert.equal(called.status, 201, JSON.stringify(called.body));
    assert.equal(called.body.lead.status, 'contacted');
    assert.ok(called.body.lead.crm.lastContactedAt);
    assert.ok(called.body.lead.crm.nextFollowUpAt, 'the follow-up is on the lead');
    const missed = await api(`/api/admin/crm/leads/${id}/activities`, { method: 'POST', as: 'lead', body: { kind: 'call', outcome: 'no-answer' } });
    assert.equal(missed.body.lead.status, 'contacted', 'a missed call changes nothing');

    // Tasks.
    const mine = await api('/api/admin/crm/tasks?state=open', { as: 'lead' });
    assert.equal(mine.body.items.length, 1);
    assert.equal(mine.body.items[0].leadName, 'Walk In Student');
    const done = await api(`/api/admin/crm/tasks/${mine.body.items[0].id}`, { method: 'PATCH', as: 'lead', body: { done: true } });
    assert.ok(done.body.item.doneAt);
    assert.equal((await api(`/api/admin/leads/${id}`, { as: 'lead' })).body.item.crm.nextFollowUpAt, null, 'finishing the last follow-up clears the date');
    const toRiya = await api(`/api/admin/crm/leads/${id}/tasks`, { method: 'POST', as: 'lead', body: { title: 'Send brochure', dueAt: new Date(Date.now() + 2 * DAY).toISOString(), assigneeId: who.riya.id.toString() } });
    assert.equal(toRiya.status, 201, JSON.stringify(toRiya.body));
    assert.equal((await api(`/api/admin/crm/leads/${id}/tasks`, { method: 'POST', as: 'lead', body: { title: 'x', dueAt: new Date(Date.now() + DAY).toISOString(), assigneeId: who.outsider.id.toString() } })).status, 403, 'mentors schedule only for their team');
    assert.equal((await api('/api/admin/crm/tasks?scope=team', { as: 'lead' })).body.total >= 1, true);
    assert.equal((await api('/api/admin/crm/tasks?scope=all', { as: 'lead' })).status, 403);
    assert.equal((await api('/api/admin/crm/tasks?state=overdue', { as: 'riya' })).status, 200);
    // My day sections never overlap: a follow-up due earlier today is Overdue, not also "Due today".
    const earlier = new Date(Date.now() - 60_000);
    const { insertedId: pastToday } = await db.collection('lead_tasks').insertOne({ leadId: new ObjectId(id), leadRef: 'x', leadName: 'x', assigneeId: who.lead.id, assigneeEmail: who.lead.email, title: 'Due a minute ago', kind: 'call', dueAt: earlier, doneAt: null, createdAt: earlier });
    const sections = await api('/api/admin/crm/tasks?state=today&limit=100', { as: 'lead' });
    assert.ok(!sections.body.items.some((task) => task.id === pastToday.toString()), 'not in Due today');
    assert.ok((await api('/api/admin/crm/tasks?state=overdue&limit=100', { as: 'lead' })).body.items.some((task) => task.id === pastToday.toString()), 'in Overdue');
    await db.collection('lead_tasks').deleteOne({ _id: pastToday });

    // Temperature, priority and tags.
    const hot = await api(`/api/admin/crm/leads/${id}`, { method: 'PATCH', as: 'lead', body: { heat: 'cold', priority: 'urgent', tags: ['VIP', 'scholarship!'] } });
    assert.equal(hot.body.item.crm.heat, 'cold'); assert.equal(hot.body.item.crm.heatSource, 'manual');
    assert.deepEqual(hot.body.item.crm.tags, ['vip', 'scholarship']);
    assert.equal((await api(`/api/admin/crm/leads/${id}`, { method: 'PATCH', as: 'lead', body: { heat: 'lukewarm' } })).status, 400);
    assert.equal((await api(`/api/admin/crm/leads/${id}`, { method: 'PATCH', as: 'analyst', body: { heat: 'hot' } })).status, 403, 'read-only roles cannot');
    const back = await api(`/api/admin/crm/leads/${id}`, { method: 'PATCH', as: 'lead', body: { heat: 'auto' } });
    assert.equal(back.body.item.crm.heatSource, 'auto');

    // Filters.
    const urgent = await api('/api/admin/leads?priority=urgent', { as: 'lead' });
    assert.deepEqual(urgent.body.items.map((item) => item.id), [id]);
    assert.equal((await api('/api/admin/leads?tag=vip', { as: 'lead' })).body.total, 1);
    assert.equal((await api('/api/admin/leads?followUp=upcoming', { as: 'lead' })).body.items.some((item) => item.id === id), true);
    assert.equal((await api('/api/admin/leads?followUp=bogus', { as: 'lead' })).status, 400);
    assert.equal((await api('/api/admin/leads?heat=hot,warm,cold&assignee=me', { as: 'lead' })).status, 200);

    // Quick-view counts: one request, scoped like the list; counsellors get no Unassigned / Mine.
    const views = await api('/api/admin/leads/view-counts', { as: 'lead' });
    assert.equal(views.status, 200, JSON.stringify(views.body));
    assert.deepEqual(Object.keys(views.body.counts).sort(), ['hot', 'mine', 'overdue', 'today', 'unassigned', 'untouched']);
    assert.equal(views.body.counts.mine, (await api('/api/admin/leads?assignee=me', { as: 'lead' })).body.total);
    assert.deepEqual(Object.keys((await api('/api/admin/leads/view-counts', { as: 'amit' })).body.counts).sort(), ['hot', 'overdue', 'today', 'untouched']);
    // "Mine" is personal even for people who share the company-wide scope (the count cache must not mix them).
    await lead('Owner Held', '9000000077', { assignees: [who.owner.id] });
    const ownerMine = (await api('/api/admin/leads/view-counts')).body.counts.mine;
    assert.ok(ownerMine >= 1);
    const analystMine = (await api('/api/admin/leads/view-counts', { as: 'analyst' })).body.counts.mine;
    assert.equal(ownerMine, (await api('/api/admin/leads?assignee=me')).body.total);
    assert.equal(analystMine, 0, 'the analyst holds no leads, whatever the owner’s count was');

    // Timeline mixes calls, notes, status moves and tasks, newest first.
    const timeline = await api(`/api/admin/crm/leads/${id}/timeline`, { as: 'lead' });
    const types = new Set(timeline.body.items.map((item) => item.type));
    for (const type of ['activity', 'status', 'task-created', 'task-done']) assert.ok(types.has(type), `timeline has ${type}`);

    // Edit.
    const edited = await api(`/api/admin/crm/leads/${id}/details`, { method: 'PATCH', as: 'lead', body: { fullName: 'Walk-In Student Sharma', city: 'Haridwar' } });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.item.applicant.fullName, 'Walk-In Student Sharma');
    assert.equal(edited.body.item.applicant.phone, '+919876543211', 'untouched fields stay');
    assert.equal((await api('/api/admin/leads?q=sharma', { as: 'lead' })).body.items.some((item) => item.id === id), true, 'search keys follow the edit');
    assert.equal((await api(`/api/admin/crm/leads/${id}/details`, { method: 'PATCH', as: 'amit', body: { city: 'Delhi' } })).status, 403, 'counsellors cannot edit details');
    assert.equal((await api(`/api/admin/crm/leads/${id}/details`, { method: 'PATCH', as: 'lead', body: { phone: '12345' } })).status, 400, 'a bad number is refused');
  });

  test('bulk actions respect scope and permission; delete goes to a bin that owners can restore or purge', async () => {
    const x = await lead('Bulk One', '9000000011', { assignees: [who.amit.id] });
    const y = await lead('Bulk Two', '9000000012', { assignees: [who.riya.id] });
    const z = await lead('Bulk Three', '9000000013', { assignees: [who.outsider.id] });
    assert.equal((await api('/api/admin/crm/leads/bulk', { method: 'POST', as: 'amit', body: { ids: [x], action: 'heat', value: 'hot' } })).status, 403, 'counsellors have no bulk');
    const heat = await api('/api/admin/crm/leads/bulk', { method: 'POST', as: 'lead', body: { ids: [x, y], action: 'heat', value: 'hot' } });
    assert.equal(heat.status, 200, JSON.stringify(heat.body)); assert.equal(heat.body.count, 2);
    assert.equal((await api('/api/admin/crm/leads/bulk', { method: 'POST', as: 'lead', body: { ids: [x, z], action: 'heat', value: 'hot' } })).status, 404, 'one lead outside the team stops the whole batch');
    assert.equal((await api('/api/admin/crm/leads/bulk', { method: 'POST', as: 'lead', body: { ids: [x], action: 'delete' } })).status, 403, 'team leads cannot delete');
    assert.equal((await api('/api/admin/crm/leads/bulk', { method: 'POST', body: { ids: Array.from({ length: 101 }, () => new ObjectId().toString()), action: 'status', value: 'contacted' } })).status, 400, 'at most 100');
    const status = await api('/api/admin/crm/leads/bulk', { method: 'POST', body: { ids: [x, y, z], action: 'status', value: 'in-progress' } });
    assert.equal(status.body.count, 3);
    assert.equal((await api('/api/admin/crm/leads/bulk', { method: 'POST', body: { ids: [x], action: 'explode' } })).status, 400);

    const removed = await api(`/api/admin/crm/leads/${z}`, { method: 'DELETE' });
    assert.equal(removed.status, 204);
    assert.equal((await api(`/api/admin/leads/${z}`)).status, 404);
    const bin = await api('/api/admin/crm/trash');
    assert.equal(bin.body.items.some((item) => item.name === 'Bulk Three'), true);
    assert.equal((await api('/api/admin/crm/trash', { as: 'lead' })).status, 403);
    assert.equal((await api(`/api/admin/crm/trash/${z}/restore`, { method: 'POST' })).status, 204);
    assert.equal((await api(`/api/admin/leads/${z}`)).status, 200, 'restored with its history');
    await api(`/api/admin/crm/leads/${z}`, { method: 'DELETE' });
    assert.equal((await api(`/api/admin/crm/trash/${z}`, { method: 'DELETE', as: 'analyst' })).status, 403, 'only owners purge');
    assert.equal((await api(`/api/admin/crm/trash/${z}`, { method: 'DELETE' })).status, 204);
    const audit = await api('/api/admin/access/audit?action=lead');
    for (const action of ['lead.create', 'lead.delete', 'lead.restore', 'lead.purge', 'lead.bulk_heat']) assert.ok(audit.body.items.some((row) => row.action === action), `${action} is logged`);
  });

  test('the CRM dashboard is scoped: owners see everyone, mentors their team, counsellors only themselves', async () => {
    const owner = await api('/api/admin/crm/dashboard?range=30d');
    assert.equal(owner.status, 200, JSON.stringify(owner.body));
    assert.equal(owner.body.scope, 'all');
    for (const key of ['kpis', 'heat', 'funnel', 'trend', 'channels', 'leaderboard', 'aging', 'heatmap', 'actions']) assert.ok(owner.body[key], `${key} present`);
    assert.equal(owner.body.trend.days.length, 30);
    assert.equal(owner.body.heatmap.grid.length, 7);
    const team = await api('/api/admin/crm/dashboard?range=7d', { as: 'lead' });
    assert.equal(team.body.scope, 'team');
    assert.ok(team.body.leaderboard.every((person) => [who.lead.email, who.amit.email, who.riya.email].includes(person.email)), 'a mentor’s leaderboard lists only their team');
    const own = await api('/api/admin/crm/dashboard?range=today', { as: 'amit' });
    assert.equal(own.body.scope, 'own');
    assert.ok(own.body.leaderboard.every((person) => person.email === who.amit.email));
    assert.equal((await api(`/api/admin/crm/dashboard?employee=${who.riya.id}`, { as: 'amit' })).status, 403, 'a counsellor cannot look at a colleague');
    assert.equal((await api(`/api/admin/crm/dashboard?employee=${who.outsider.id}`, { as: 'lead' })).status, 403, 'a mentor cannot look outside the team');
    assert.equal((await api(`/api/admin/crm/dashboard?employee=${who.amit.id}`, { as: 'lead' })).status, 200);
    assert.equal((await api('/api/admin/crm/dashboard', { as: 'editor' })).status, 403, 'no analytics permission');
    assert.equal((await api('/api/admin/crm/dashboard?range=bogus')).status, 400);
    const board = await api('/api/admin/crm/board');
    assert.equal(board.status, 200);
    assert.equal(board.body.columns.length, 7);
    assert.ok(board.body.columns.every((column) => typeof column.total === 'number' || column.total === null));
    assert.equal((await api('/api/admin/crm/board', { as: 'editor' })).status, 403);
  });
});
