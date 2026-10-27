// Synthetic leads for load testing the admin leads list and dashboard.
// Usage: npm run leads:synthetic --workspace backend -- --db nsedu_bench [--count 200000] [--days 180] [--runs 20] [--no-bench] [--drop]
//
// Writes contract-shaped leads (all three channels, school drives, statuses, assignees) into a SEPARATE
// database, then times the queries behind the list, counts and the dashboard (p50/p95, caches cleared).
// Refuses the real database and any database that holds leads it did not write.
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};
const flag = (name) => process.argv.includes(`--${name}`);
const dbName = String(arg('db', '') ?? '').trim();
const configured = process.env.MONGODB_DATABASE || 'nsedu';
if (!/^[A-Za-z0-9_-]{1,60}$/.test(dbName) || dbName === 'nsedu' || dbName === configured) {
  console.error(`Pass --db <throwaway database>, e.g. --db nsedu_bench. It may not be "nsedu" or the configured database ("${configured}").`);
  process.exit(1);
}
// --count 0 benchmarks what an earlier run seeded.
const COUNT = Math.max(0, Math.floor(Number(arg('count', 200_000)))) || 0;
const DAYS = Math.min(400, Math.max(1, Number(arg('days', 180)) || 180));
const RUNS = Math.max(1, Number(arg('runs', 20)) || 20);
const BATCH = 5000;
const MARK = 'synthetic';
process.env.MONGODB_DATABASE = dbName;

const { closeDb, COLLECTIONS, getDb } = await import('../db/collections.js');
const { CONSENT_VERSION, INDIAN_STATES, STATUSES } = await import('../modules/applications/schema.js');
const service = await import('../modules/applications/service.js');
const { DEFAULT_COLUMN_KEYS, projectionFor, resolveColumns } = await import('../modules/applications/lead-columns.js');
const { clearLeadInsights, insightQueries, insightRange, leadInsights } = await import('../modules/applications/lead-insights.js');
const { slugify } = await import('../lib/validation.js');

// Seeded PRNG so two runs with the same --count produce the same data.
let seed = 0x9e3779b9;
const random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (list) => list[Math.floor(random() * list.length)];
function weighted(entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of entries) { roll -= weight; if (roll < 0) return value; }
  return entries.at(-1)[0];
}

// Lead volume by state roughly follows population; everything else shares a small tail.
const STATE_WEIGHTS = new Map([['Uttar Pradesh', 16], ['Maharashtra', 10], ['Bihar', 9], ['Uttarakhand', 8], ['Delhi', 7], ['Rajasthan', 6], ['Madhya Pradesh', 6], ['West Bengal', 5], ['Haryana', 4], ['Karnataka', 4], ['Gujarat', 4], ['Tamil Nadu', 3], ['Punjab', 3], ['Jharkhand', 3]]);
const STATE_ENTRIES = INDIAN_STATES.map((state) => [state, STATE_WEIGHTS.get(state) ?? 0.4]);
const CITIES = { 'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Noida', 'Varanasi'], Maharashtra: ['Pune', 'Mumbai', 'Nagpur'], Bihar: ['Patna', 'Gaya'], Uttarakhand: ['Dehradun', 'Haridwar', 'Haldwani'], Delhi: ['New Delhi'], Rajasthan: ['Jaipur', 'Kota'], 'Madhya Pradesh': ['Indore', 'Bhopal'] };
const FIRST = ['Aarav', 'Asha', 'Rohan', 'Priya', 'Vivaan', 'Ananya', 'Ishaan', 'Diya', 'Kabir', 'Meera', 'Arjun', 'Sneha', 'Aditya', 'Kavya', 'Rahul', 'Pooja', 'Yash', 'Neha', 'Siddharth', 'Riya', 'Mohammed', 'Fatima', 'Harpreet', 'Gurleen', 'Karthik', 'Lakshmi'];
const LAST = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Rao', 'Patel', 'Yadav', 'Joshi', 'Negi', 'Rawat', 'Mishra', 'Khan', 'Das', 'Iyer', 'Nair', 'Reddy', 'Bisht', 'Chauhan', 'Agarwal'];
const COURSES = [['btech', 'B.Tech'], ['bba', 'BBA'], ['bca', 'BCA'], ['mba', 'MBA'], ['bsc-nursing', 'B.Sc Nursing'], ['bcom', 'B.Com'], ['ba-llb', 'BA LLB'], ['bpharm', 'B.Pharm'], ['bdes', 'B.Des'], ['mbbs', 'MBBS']];
const INSTITUTIONS = Array.from({ length: 40 }, (_, index) => [`synthetic-university-${index + 1}`, `Synthetic University ${index + 1}`]);
const CAREER_FIELDS = [['engineering', 'Engineering'], ['medicine', 'Medicine'], ['management', 'Management'], ['law', 'Law'], ['design', 'Design'], ['commerce', 'Commerce'], ['computer-applications', 'Computer applications'], ['nursing', 'Nursing']];
const CLASSES = [['10', 2], ['11', 3], ['12', 5], ['passed-12', 1]];
const STREAMS = [['pcm', 4], ['pcb', 2], ['pcmb', 1], ['commerce', 3], ['arts', 2], ['not-decided', 1]];
const DAY_MS = 24 * 60 * 60 * 1000;

const now = new Date();
const windowStart = service.istDayStart(service.istToday(new Date(now.getTime() - (DAYS - 1) * DAY_MS)));

// Recent days are busier (linear growth) and Sundays quieter; times fall in Indian daytime.
function createdAtFor() {
  for (;;) {
    const dayIndex = Math.floor(DAYS * Math.sqrt(random()));
    const dayStart = windowStart.getTime() + Math.min(dayIndex, DAYS - 1) * DAY_MS;
    const weekday = new Date(dayStart + service.IST_OFFSET).getUTCDay();
    if (weekday === 0 && random() < 0.4) continue;
    const at = new Date(dayStart + (8 * 60 + random() * 14 * 60) * 60_000);
    if (at <= now) return at;
  }
}
// Older leads have moved further through the funnel.
function statusFor(ageDays) {
  if (ageDays < 1) return weighted([['new', 85], ['contacted', 15]]);
  const progress = Math.min(1, ageDays / 45);
  return weighted([
    ['new', 40 * (1 - progress) + 4], ['contacted', 22], ['in-progress', 14 * progress + 6], ['applied-to-university', 10 * progress + 2],
    ['admitted', 7 * progress + 0.5], ['not-interested', 9 * progress + 2], ['closed', 6 * progress + 1],
  ]);
}
const PATH = ['new', 'contacted', 'in-progress', 'applied-to-university', 'admitted'];
function historyFor(status, createdAt, employeeId) {
  const steps = status === 'new' ? ['new'] : PATH.includes(status) ? PATH.slice(0, PATH.indexOf(status) + 1) : ['new', 'contacted', status];
  const span = Math.max(60_000, now - createdAt);
  return steps.map((step, index) => ({ status: step, at: new Date(createdAt.getTime() + (span * index) / (steps.length + 1)), byAdminId: index ? employeeId : null }));
}
const EMPTY_PREFERENCE = { institutionSlug: '', institutionName: '', city: '', state: '', courseSlug: '', courseName: '', programmeName: '', intakeYear: null };
const CONSENT_TEXT = { contact: 'I agree that Gyaan Vidhya’s admissions team may contact me.', privacy: 'I have read the Privacy policy.' };

function makeLead(sequence, { forms, employees }) {
  const createdAt = createdAtFor();
  const ageDays = (now - createdAt) / DAY_MS;
  const channel = weighted([['web-apply', 50], ['school-drive', 35], ['callback', 15]]);
  const status = statusFor(ageDays);
  const assignee = status !== 'new' || random() < 0.35 ? pick(employees) : null;
  const form = channel === 'school-drive' ? pick(forms) : null;
  const state = form ? form.school.state : channel === 'callback' ? '' : weighted(STATE_ENTRIES);
  const city = form ? form.school.city : state ? pick(CITIES[state] ?? [`${state.split(' ')[0]} City`]) : '';
  const fullName = `${pick(FIRST)} ${pick(LAST)}`;
  // Unique per lead, so the one-phone-per-drive index never rejects a batch.
  const applicant = { fullName, email: channel === 'school-drive' && random() < 0.6 ? '' : `${slugify(fullName)}.${sequence}@example.com`, phone: `+919${String(sequence).padStart(9, '0')}`, city, state };
  const course = channel === 'web-apply' ? pick(COURSES) : null;
  const institution = channel === 'web-apply' ? pick(INSTITUTIONS) : null;
  const careerField = channel === 'callback' ? pick(CAREER_FIELDS) : null;
  return {
    ref: `GV-${new Date(createdAt.getTime() + service.IST_OFFSET).getUTCFullYear()}-${String(sequence).padStart(6, '0')}`,
    channel, mode: channel === 'web-apply' ? (random() < 0.6 ? 'quick' : 'detailed') : null,
    studentId: null, formId: form?._id ?? null,
    school: form ? form.school : null,
    applicant,
    academics: form ? { classLevel: weighted(CLASSES), schoolStream: weighted(STREAMS) } : null,
    exams: [],
    preference: course ? { ...EMPTY_PREFERENCE, institutionSlug: institution[0], institutionName: institution[1], courseSlug: course[0], courseName: course[1], intakeYear: 2027 } : EMPTY_PREFERENCE,
    answers: form ? [{ id: 'goal', label: 'Dream career', type: 'text', value: pick(CAREER_FIELDS)[1] }] : [],
    careerField: careerField ? { slug: careerField[0], name: careerField[1] } : null,
    callback: careerField ? { preferredTime: pick(['morning', 'afternoon', 'evening', 'anytime']), message: '' } : null,
    contactVerified: { email: false, phone: channel === 'web-apply' },
    consent: { contactConsent: true, privacyAccepted: true, version: CONSENT_VERSION, at: createdAt, text: CONSENT_TEXT, ip: '127.0.0.1', userAgent: 'synthetic' },
    source: { path: form ? `/r/${form.shortCode}` : channel === 'callback' ? '/career-guidance' : '/apply', utmSource: MARK, utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '' },
    status, statusHistory: historyFor(status, createdAt, assignee), assignedEmployeeIds: assignee ? [assignee] : [],
    createdAt, updatedAt: createdAt,
    ...service.leadKeys(applicant),
  };
}

async function supportingData(db) {
  const employees = db.collection(COLLECTIONS.admins);
  if (!await employees.countDocuments({ role: 'employee' })) {
    // No password hash: these accounts exist for the workload table and cannot sign in.
    await employees.insertMany(Array.from({ length: 8 }, (_, index) => ({ email: `counsellor${index + 1}@synthetic.test`, phone: '+919000000000', role: 'employee', passwordHash: '', mustChangePassword: true, createdAt: now, lastLoginAt: null })));
  }
  const forms = db.collection(COLLECTIONS.leadForms);
  if (!await forms.countDocuments({ shortCode: /^syn-/ })) {
    await forms.insertMany(Array.from({ length: 80 }, (_, index) => {
      const state = weighted(STATE_ENTRIES);
      const district = pick(CITIES[state] ?? [`${state.split(' ')[0]} District`]);
      return {
        title: `Career day ${index + 1}`, shortCode: `syn-${String(index + 1).padStart(3, '0')}`, status: index % 9 === 0 ? 'closed' : 'active',
        school: { name: `${pick(['St. Mary’s', 'Kendriya Vidyalaya', 'DAV Public School', 'Delhi Public School', 'Saraswati Vidya Mandir', 'Army Public School'])} ${district} ${index + 1}`, district, districtKey: slugify(district), state, city: district },
        fields: [{ id: 'fullName', label: 'Full name', type: 'text', builtIn: true }, { id: 'goal', label: 'Dream career', type: 'text' }],
        submissionCount: 0, createdAt: new Date(windowStart.getTime() - DAY_MS), updatedAt: now,
      };
    }));
  }
  const fields = db.collection(COLLECTIONS.careerFields);
  if (!await fields.countDocuments()) await fields.insertMany(CAREER_FIELDS.map(([slug, name], order) => ({ slug, name, order, active: true })));
  return {
    employees: (await employees.find({ role: 'employee' }, { projection: { _id: 1 } }).toArray()).map((doc) => doc._id),
    forms: await forms.find({ shortCode: /^syn-/ }).toArray(),
  };
}

async function seedLeads(db) {
  const leads = db.collection(COLLECTIONS.applications);
  if (await leads.findOne({ 'source.utmSource': { $ne: MARK } }, { projection: { _id: 1 } })) {
    throw new Error(`Database "${dbName}" holds leads this script did not write. Use an empty throwaway database.`);
  }
  const support = await supportingData(db);
  const offset = await leads.estimatedDocumentCount();
  if (!COUNT) return;
  console.log(`Seeding ${COUNT.toLocaleString('en-IN')} leads over ${DAYS} days into "${dbName}" (already ${offset.toLocaleString('en-IN')})…`);
  const started = performance.now();
  for (let done = 0; done < COUNT; done += BATCH) {
    const size = Math.min(BATCH, COUNT - done);
    await leads.insertMany(Array.from({ length: size }, (_, index) => makeLead(offset + done + index + 1, support)), { ordered: false });
    if ((done / BATCH) % 10 === 9 || done + size >= COUNT) console.log(`  ${(done + size).toLocaleString('en-IN')} / ${COUNT.toLocaleString('en-IN')}`);
  }
  const seconds = (performance.now() - started) / 1000;
  console.log(`Inserted in ${seconds.toFixed(1)} s (${Math.round(COUNT / seconds).toLocaleString('en-IN')} leads/s, indexes maintained).`);
  // Keep nextRef() ahead of the synthetic refs and the drive counters honest, in case the app is pointed here.
  const last = offset + COUNT;
  const yearOf = (date) => new Date(date.getTime() + service.IST_OFFSET).getUTCFullYear();
  const years = Array.from({ length: yearOf(now) - yearOf(windowStart) + 1 }, (_, index) => yearOf(windowStart) + index);
  await Promise.all(years.map((year) => db.collection(service.COUNTERS).updateOne({ _id: `applications-${year}` }, { $max: { seq: last } }, { upsert: true })));
  for (const row of await leads.aggregate([{ $match: { formId: { $type: 'objectId' } } }, { $group: { _id: '$formId', count: { $sum: 1 } } }]).toArray()) {
    await db.collection(COLLECTIONS.leadForms).updateOne({ _id: row._id }, { $set: { submissionCount: row.count } });
  }
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
async function time(label, run, { cold = true } = {}) {
  const samples = [];
  let result;
  for (let index = 0; index < RUNS; index += 1) {
    if (cold) { service.clearLeadCounts(); clearLeadInsights(); }
    const started = performance.now();
    result = await run();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  console.log(`${label.padEnd(46)} p50 ${percentile(samples, 0.5).toFixed(1).padStart(8)} ms   p95 ${percentile(samples, 0.95).toFixed(1).padStart(8)} ms`);
  return result;
}
const indexesIn = (plan) => [...new Set([...JSON.stringify(plan).matchAll(/"indexName":"([^"]+)"/g)].map((match) => match[1]))].join(', ') || (JSON.stringify(plan).includes('COLLSCAN') ? 'COLLSCAN' : 'none');

async function benchmark(db) {
  const leads = db.collection(COLLECTIONS.applications);
  const admin = { role: 'admin' };
  const employee = { role: 'employee', _id: (await db.collection(COLLECTIONS.admins).findOne({ role: 'employee' }))._id };
  const projection = projectionFor(resolveColumns(DEFAULT_COLUMN_KEYS, { staff: admin }), ['applicant', 'preference', 'ref', 'channel', 'mode', 'status', 'school', 'academics.classLevel', 'academics.schoolStream', 'careerField', 'assignedEmployeeIds', 'updatedAt']);
  const sample = await leads.findOne({}, { sort: { createdAt: -1 }, projection: { applicant: 1 } });
  const nameQuery = sample.applicant.fullName.toLowerCase().replace(/(\S+)\s+(\S{3}).*/, '$1 $2');
  // Mirrors GET /api/admin/leads: one page of rows and the (cached in the app, cleared here) count, in parallel.
  const listPage = (query, staff = admin) => {
    const filter = service.leadFilter(query, staff);
    const page = Number(query.page ?? 1);
    return Promise.all([
      leads.find(filter, { projection }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 25).limit(26).maxTimeMS(10_000).toArray(),
      service.countLeads(filter, service.filterKey(query, staff)),
    ]);
  };
  const total = await leads.estimatedDocumentCount();
  console.log(`\nTimings over ${RUNS} runs on ${total.toLocaleString('en-IN')} leads (caches cleared before each run unless marked cached):`);
  await time('list page 1 (newest, no filters)', () => listPage({}));
  await time('list page 1999 (skip 49,950)', () => listPage({ page: 1999 }));
  await time('list state=Uttar Pradesh + range=30d', () => listPage({ state: 'Uttar Pradesh', range: '30d' }));
  await time(`list name search q="${nameQuery}"`, () => listPage({ q: nameQuery }));
  await time('list channel=school-drive + status=new', () => listPage({ channel: 'school-drive', status: 'new' }));
  await time('count status=new', () => service.countLeads(service.leadFilter({ status: 'new' }, admin), 'bench|status=new'));
  await time('count range=30d', () => service.countLeads(service.leadFilter({ range: '30d' }, admin), 'bench|range=30d'));
  await time('employee list page 1 (assigned only)', () => listPage({}, employee));
  const insights30 = await time('insights 30d (admin, cold)', () => leadInsights({ range: '30d' }, admin));
  await time('insights 90d (admin, cold)', () => leadInsights({ range: '90d' }, admin));
  await time(`insights ${Math.min(DAYS, 400)} days (admin, cold)`, () => leadInsights({ from: service.istToday(new Date(now.getTime() - (Math.min(DAYS, 400) - 1) * DAY_MS)) }, admin));
  await time('insights 30d (employee, cold)', () => leadInsights({ range: '30d' }, employee));
  await time('insights 30d (cached)', () => leadInsights({ range: '30d' }, admin), { cold: false });
  console.log(`\n30-day window: ${insights30.total.toLocaleString('en-IN')} leads; KPIs ${JSON.stringify(insights30.kpis)}`);
  console.log('\nIndexes used (explain):');
  for (const [who, staff] of [['admin', admin], ['employee', employee]]) {
    const queries = insightQueries(insightRange({ range: '30d' }), staff);
    for (const [name, { pipeline, options }] of Object.entries(queries.groups)) {
      const explained = await leads.aggregate(pipeline, options).explain('queryPlanner');
      console.log(`  ${`insights ${name} (${who})`.padEnd(44)} ${indexesIn(explained.queryPlanner?.winningPlan ?? explained.stages?.[0]?.$cursor?.queryPlanner?.winningPlan ?? {})}`);
    }
    for (const name of ['status:new', 'state:Delhi', 'channel:school-drive'].filter((key) => queries.counts[key])) {
      const plan = (await leads.aggregate([{ $match: queries.counts[name] }, { $group: { _id: 1, n: { $sum: 1 } } }]).explain('queryPlanner')).queryPlanner?.winningPlan ?? {};
      console.log(`  ${`insights count ${name} (${who})`.padEnd(44)} ${indexesIn(plan)}${JSON.stringify(plan).includes('FETCH') ? '' : ' (index only)'}`);
    }
  }
  for (const [label, query] of [['list state + range', { state: 'Uttar Pradesh', range: '30d' }], ['list name search', { q: nameQuery }], ['list page 1999', {}]]) {
    const explained = await leads.find(service.leadFilter(query, admin)).sort({ createdAt: -1, _id: -1 }).limit(26).explain('queryPlanner');
    console.log(`  ${label.padEnd(44)} ${indexesIn(explained.queryPlanner.winningPlan)}`);
  }
}

try {
  const db = await getDb(); // creates every index first, so inserts pay the real index cost
  await seedLeads(db);
  if (!flag('no-bench')) await benchmark(db);
  if (flag('drop')) {
    await db.dropDatabase();
    console.log(`\nDropped "${dbName}".`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
