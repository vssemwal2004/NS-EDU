// Demo data for the staff CRM: two mentor teams, counsellors, an analyst, and ~1,200 leads with calls,
// notes, follow-ups and temperatures, so every CRM screen has something real to show.
//
// Usage: npm run crm:demo                   seed (refuses if real leads exist or NODE_ENV=production)
//        npm run crm:demo -- --count 3000   more leads
//        npm run crm:demo -- --clean        remove everything this script created
//
// Everything is marked `demo: true` and cleaned by that mark alone. Demo staff share one password,
// printed at the end, and exist only to try the roles (owner accounts are never touched).
import { ObjectId } from 'mongodb';
import { COLLECTIONS, closeDb, getDb } from '../db/collections.js';
import { hashPassword } from '../lib/password.js';
import { clearLeadCounts, leadKeys, nextRef } from '../modules/applications/service.js';
import { crmUpdate } from '../modules/crm/crm-model.js';
import { roleMap } from '../modules/access/access-service.js';

const arg = (name, fallback) => { const index = process.argv.indexOf(`--${name}`); return index === -1 ? fallback : process.argv[index + 1]; };
const COUNT = Math.min(20_000, Math.max(50, Number(arg('count', 1200)) || 1200));
const PASSWORD = 'Demo@12345';
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

if (process.env.NODE_ENV === 'production') { console.error('Refusing to seed demo data when NODE_ENV=production.'); process.exit(1); }

let seed = 0x1badb002;
const random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (list) => list[Math.floor(random() * list.length)];
const weighted = (entries) => { let roll = random() * entries.reduce((sum, [, weight]) => sum + weight, 0); for (const [value, weight] of entries) { roll -= weight; if (roll < 0) return value; } return entries.at(-1)[0]; };

const FIRST = ['Aarav', 'Aditi', 'Ananya', 'Arjun', 'Bhavna', 'Chirag', 'Deepak', 'Divya', 'Esha', 'Farhan', 'Gauri', 'Harsh', 'Isha', 'Jatin', 'Kavya', 'Lakshya', 'Mansi', 'Nikhil', 'Omkar', 'Pallavi', 'Qasim', 'Ritika', 'Sanjana', 'Tarun', 'Uma', 'Vivek', 'Yash', 'Zoya', 'Rohan', 'Sneha', 'Pranav', 'Tanya'];
const LAST = ['Sharma', 'Verma', 'Rawat', 'Negi', 'Bisht', 'Joshi', 'Gupta', 'Singh', 'Khan', 'Das', 'Borah', 'Sangma', 'Thapa', 'Rai', 'Patel', 'Nair', 'Iyer', 'Reddy', 'Mishra', 'Pandey', 'Chauhan', 'Kapoor'];
const PLACES = [['Dehradun', 'Uttarakhand', 9], ['Haridwar', 'Uttarakhand', 4], ['Guwahati', 'Assam', 6], ['Shillong', 'Meghalaya', 3], ['Delhi', 'Delhi', 7], ['Lucknow', 'Uttar Pradesh', 4], ['Patna', 'Bihar', 3], ['Jaipur', 'Rajasthan', 3], ['Pune', 'Maharashtra', 3], ['Bengaluru', 'Karnataka', 3], ['Kolkata', 'West Bengal', 2], ['Imphal', 'Manipur', 1], ['Gangtok', 'Sikkim', 1], ['Agartala', 'Tripura', 1]];
const COURSES = ['B.Tech Computer Science', 'MBA', 'BBA', 'B.Sc Nursing', 'MBBS', 'B.Pharm', 'BCA', 'B.Com', 'LL.B', 'B.Des', 'M.Tech'];
const KINDS = [['call', 6], ['whatsapp', 3], ['email', 1], ['meeting', 1], ['note', 3]];
const SCHOOLS = ['DPS Dehradun', 'St. Joseph’s Academy', 'Welham Girls’ School', 'Kendriya Vidyalaya ONGC', 'Guwahati Public School'];

const db = await getDb();
const admins = db.collection(COLLECTIONS.admins);
const leads = db.collection(COLLECTIONS.applications);
const notes = db.collection(COLLECTIONS.applicationNotes);
const tasks = db.collection(COLLECTIONS.leadTasks);

async function clean() {
  const demoLeads = await leads.find({ demo: true }, { projection: { _id: 1 } }).toArray();
  const ids = demoLeads.map((lead) => lead._id);
  const [n, t, l, a] = await Promise.all([
    notes.deleteMany({ applicationId: { $in: ids } }).then((r) => r.deletedCount), tasks.deleteMany({ leadId: { $in: ids } }).then((r) => r.deletedCount),
    leads.deleteMany({ demo: true }).then((r) => r.deletedCount), admins.deleteMany({ demo: true }).then((r) => r.deletedCount),
  ]);
  clearLeadCounts();
  console.log(`Removed ${l} demo leads, ${n} notes, ${t} follow-ups and ${a} demo staff.`);
}

try {
  if (process.argv.includes('--clean')) { await clean(); }
  else {
    const real = await leads.countDocuments({ demo: { $ne: true } }, { limit: 1 });
    if (real) throw new Error('This database has real leads. The demo seeder only runs on a database without them (or clean first).');
    await clean();
    await roleMap(); // makes sure the built-in roles exist
    const now = new Date();
    const hash = await hashPassword(PASSWORD);
    const mk = (email, name, roleId, title, managerId = null) => ({ email, name, title, phone: '+919800000000', role: 'employee', roleId, managerId, status: 'active', passwordHash: hash, mustChangePassword: false, createdAt: new Date(now - 90 * DAY), lastLoginAt: new Date(now - random() * DAY), demo: true });
    const teamLeads = [mk('anita.rawat@demo.gyaanvidhya.test', 'Anita Rawat', 'team-lead', 'Senior mentor, Uttarakhand'), mk('vikram.bisht@demo.gyaanvidhya.test', 'Vikram Bisht', 'team-lead', 'Mentor, North-East desk')];
    const { insertedIds } = await admins.insertMany(teamLeads);
    const [anita, vikram] = [insertedIds[0], insertedIds[1]];
    const execs = [
      ['amit.kumar', 'Amit Kumar', anita], ['riya.sharma', 'Riya Sharma', anita], ['neha.joshi', 'Neha Joshi', anita], ['karan.singh', 'Karan Singh', anita],
      ['pooja.verma', 'Pooja Verma', vikram], ['sameer.khan', 'Sameer Khan', vikram], ['tanvi.gupta', 'Tanvi Gupta', vikram], ['rahul.das', 'Rahul Das', null],
    ].map(([user, name, manager]) => mk(`${user}@demo.gyaanvidhya.test`, name, 'executive', 'Admissions counsellor', manager));
    const exec = await admins.insertMany(execs);
    await admins.insertMany([mk('meera.iyer@demo.gyaanvidhya.test', 'Meera Iyer', 'analyst', 'Reporting analyst'), mk('dev.patel@demo.gyaanvidhya.test', 'Dev Patel', 'data-editor', 'Content & data editor')]);
    const execIds = Object.values(exec.insertedIds);
    // Each counsellor works at a different pace, so the leaderboard has something to say.
    const pace = new Map(execIds.map((id, index) => [id.toString(), [1.2, 1.0, 0.7, 0.5, 1.4, 0.9, 0.6, 0.3][index]]));

    const leadDocs = []; const noteDocs = []; const taskDocs = [];
    for (let index = 0; index < COUNT; index += 1) {
      const ageDays = Math.pow(random(), 1.6) * 75; // more recent leads than old ones
      const createdAt = new Date(now - ageDays * DAY);
      createdAt.setHours(Math.min(23, Math.max(7, Math.round(10 + (random() + random() - 1) * 6))), Math.floor(random() * 60), 0, 0);
      if (createdAt > now) createdAt.setTime(now.getTime() - 5 * 60_000);
      const channel = weighted([['web-apply', 50], ['school-drive', 28], ['callback', 14], ['manual', 8]]);
      const [city, state] = weighted(PLACES.map(([c, s, w]) => [[c, s], w]));
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const assignee = random() < (ageDays < 1 ? 0.55 : 0.93) ? weighted(execIds.map((id) => [id, 0.5 + pace.get(id.toString())])) : null;
      const speed = assignee ? pace.get(assignee.toString()) : 0;
      // Older leads have had time to move; faster counsellors move more of them.
      const progress = assignee ? Math.min(0.97, (0.25 + Math.min(1, ageDays / 20)) * (0.55 + speed * 0.4)) : 0;
      const contacted = random() < progress;
      const status = !contacted ? 'new' : weighted([['contacted', 24], ['in-progress', 26], ['applied-to-university', 14 + speed * 4], ['admitted', 6 + speed * 6], ['not-interested', 14], ['closed', 6]]);
      const firstContact = contacted ? new Date(createdAt.getTime() + (0.4 + random() * random() * 60 / Math.max(0.5, speed)) * HOUR) : null;
      const history = [{ status: 'new', at: createdAt, byAdminId: null }];
      let lastAt = createdAt;
      if (contacted && firstContact < now) {
        history.push({ status: 'contacted', at: firstContact, byAdminId: assignee }); lastAt = firstContact;
        const path = ['in-progress', 'applied-to-university', 'admitted'];
        const target = ['not-interested', 'closed'].includes(status) ? status : status;
        if (path.includes(target)) for (const step of path.slice(0, path.indexOf(target) + 1)) { lastAt = new Date(Math.min(now, new Date(lastAt.getTime() + (0.5 + random() * 4) * DAY))); history.push({ status: step, at: lastAt, byAdminId: assignee }); }
        else if (['not-interested', 'closed'].includes(target)) { lastAt = new Date(Math.min(now, new Date(lastAt.getTime() + (1 + random() * 6) * DAY))); history.push({ status: target, at: lastAt, byAdminId: assignee }); }
      }
      const phone = `+91${weighted([['9', 5], ['8', 3], ['7', 2], ['6', 1]])}${String(Math.floor(random() * 1e9)).padStart(9, '0')}`;
      const applicant = { fullName: name, email: random() < 0.7 ? `${name.toLowerCase().replace(/[^a-z]+/g, '.')}${index}@example.com` : '', phone, city, state };
      const doc = {
        _id: new ObjectId(), ref: await nextRef(createdAt), channel, mode: channel === 'web-apply' ? (random() < 0.45 ? 'detailed' : 'quick') : null, status,
        applicant, preference: channel === 'web-apply' || channel === 'manual' ? { courseName: pick(COURSES), courseSlug: random() < 0.6 ? 'btech' : '' } : {}, academics: null,
        contactVerified: { phone: random() < 0.6, email: random() < 0.35 }, consent: { contactConsent: random() < 0.85, privacyAccepted: true, at: createdAt, version: '1', text: {} },
        school: channel === 'school-drive' ? { name: pick(SCHOOLS), district: 'Dehradun', state: 'Uttarakhand', city: 'Dehradun' } : null,
        source: { kind: channel === 'manual' ? 'staff' : 'demo' }, assignedEmployeeIds: assignee ? [assignee] : [], statusHistory: history, createdAt, updatedAt: lastAt, demo: true, ...leadKeys(applicant),
      };
      doc.crm = { priority: weighted([['normal', 70], ['high', 18], ['urgent', 7], ['low', 5]]), tags: random() < 0.15 ? [pick(['scholarship', 'hostel', 'vip', 'parent-call', 'education-loan'])] : [], lastActivityAt: lastAt };
      if (firstContact && firstContact < now) Object.assign(doc.crm, { firstContactedAt: firstContact, lastContactedAt: lastAt });
      const open = !['admitted', 'not-interested', 'closed'].includes(status);

      // Activity: a few calls and notes between first contact and the last move.
      const touches = contacted ? 1 + Math.floor(random() * (2 + speed * 3)) : 0;
      let touchAt = firstContact ?? createdAt;
      for (let touch = 0; touch < touches && touchAt < now; touch += 1) {
        const kind = weighted(KINDS);
        const outcome = kind === 'note' ? '' : weighted([['connected', 45], ['interested', 18], ['no-answer', 20], ['busy', 8], ['callback-requested', 7], ['wrong-number', 1], ['not-interested', 1]]);
        noteDocs.push({ applicationId: doc._id, kind, outcome, text: kind === 'note' ? pick(['Parent wants fee details before deciding.', 'Shortlisted two universities, will confirm this week.', 'Asked about hostel and scholarship options.', 'Needs to discuss with family.', 'Documents partly uploaded.']) : (outcome === 'connected' || outcome === 'interested' ? pick(['Spoke for 6 minutes, keen on the course.', 'Discussed fees and placements.', 'Will send marksheet by tomorrow.']) : ''), authorId: assignee, authorEmail: 'demo', authorRole: 'employee', createdAt: touchAt });
        doc.crm.lastActivityAt = touchAt; touchAt = new Date(touchAt.getTime() + (0.3 + random() * 3) * DAY);
      }
      // Follow-ups: open leads usually have one; some are late, which is what the "My day" queue is for.
      if (open && assignee && contacted && random() < 0.7) {
        const due = new Date(now.getTime() + weighted([[-3, 8], [-1, 12], [0, 16], [1, 18], [3, 22], [7, 14]]) * DAY + (random() - 0.4) * 8 * HOUR);
        taskDocs.push({ leadId: doc._id, leadRef: doc.ref, leadName: name, leadPhone: phone, assigneeId: assignee, assigneeEmail: 'demo', title: pick(['Call back about fees', 'Send brochure on WhatsApp', 'Confirm documents', 'Check application status', 'Campus visit reminder']), kind: pick(['call', 'whatsapp', 'call', 'email']), dueAt: due, doneAt: null, createdById: assignee, createdByEmail: 'demo', createdAt: new Date(Math.min(now, lastAt)) });
        doc.crm.nextFollowUpAt = due;
      }
      if (contacted && random() < 0.5) taskDocs.push({ leadId: doc._id, leadRef: doc.ref, leadName: name, leadPhone: phone, assigneeId: assignee, assigneeEmail: 'demo', title: 'Intro call', kind: 'call', dueAt: new Date(firstContact), doneAt: new Date(firstContact), doneById: assignee, doneByEmail: 'demo', createdById: assignee, createdByEmail: 'demo', createdAt: createdAt });
      // Score last, from everything above.
      const scored = crmUpdate(doc, now);
      for (const [key, value] of Object.entries(scored)) doc.crm[key.slice('crm.'.length)] = value;
      if (random() < 0.06 && open) { doc.crm.heat = pick(['hot', 'warm']); doc.crm.heatSource = 'manual'; }
      leadDocs.push(doc);
    }
    const insertAll = async (collection, rows) => { for (let start = 0; start < rows.length; start += 500) await collection.insertMany(rows.slice(start, start + 500), { ordered: false }); };
    await insertAll(leads, leadDocs);
    await insertAll(notes, noteDocs);
    await insertAll(tasks, taskDocs);
    clearLeadCounts();
    console.log(`Inserted ${leadDocs.length} leads, ${noteDocs.length} activities and ${taskDocs.length} follow-ups in "${db.databaseName}".`);
    console.log(`Demo staff (all use the password ${PASSWORD}): anita.rawat@ and vikram.bisht@ (team leads), amit.kumar@, riya.sharma@ … (counsellors), meera.iyer@ (analyst), dev.patel@ (data editor), all @demo.gyaanvidhya.test`);
  }
} finally {
  await closeDb();
}
