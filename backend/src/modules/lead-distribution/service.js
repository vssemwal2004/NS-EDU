import { randomUUID } from 'node:crypto';
import { collection, COLLECTIONS } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { audit } from '../access/access-service.js';
import { applications, clearLeadCounts, DAY, istDayStart, istToday } from '../applications/service.js';

const DEFAULTS = { checkInCutoff: '12:00', workEndTime: '18:00' };
const LEASE_MS = 120_000;
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const days = () => collection(COLLECTIONS.leadDistributionDays);
const attendance = () => collection(COLLECTIONS.leadAttendance);
const settingsCollection = () => collection(COLLECTIONS.leadDistributionSettings);
async function renewLease(coll, day, token) {
  const result = await coll.updateOne({ _id: day, leaseOwner: token }, { $set: { leaseUntil: new Date(Date.now() + LEASE_MS) } });
  if (!result.matchedCount) throw new Error('Distribution lease was lost; another worker will continue');
}

export const previousDay = (day) => istToday(new Date(istDayStart(day).getTime() - 1));
export const cutoffAt = (day, time) => new Date(istDayStart(day).getTime() + minutes(time) * 60_000);
export const sharePerEmployee = (leadCount, employeeCount) => employeeCount ? Math.floor(leadCount / employeeCount) : 0;
export const onTimeForBatch = (now, cutoff, rosterIds, employeeId) => now < cutoff && rosterIds.some((id) => id.equals(employeeId));
export function leastLoaded(active) {
  active.sort((a, b) => a.count - b.count || a.order - b.order);
  return active[0];
}

export async function distributionSettings() {
  const saved = await (await settingsCollection()).findOne({ _id: 'daily' });
  return { ...DEFAULTS, ...(saved && { checkInCutoff: saved.checkInCutoff, workEndTime: saved.workEndTime }) };
}

export async function updateDistributionSettings(actor, body) {
  const checkInCutoff = body?.checkInCutoff;
  const workEndTime = body?.workEndTime;
  if (!clock.test(checkInCutoff ?? '') || !clock.test(workEndTime ?? '') || minutes(workEndTime) <= minutes(checkInCutoff)) {
    throw new HttpError(400, 'Choose valid IST times, with work end after the check-in cutoff');
  }
  await (await settingsCollection()).updateOne({ _id: 'daily' }, { $set: { checkInCutoff, workEndTime, updatedAt: new Date(), updatedById: actor._id } }, { upsert: true });
  await audit(actor, 'distribution.settings', { type: 'settings', id: 'daily', label: 'Daily lead distribution' }, { checkInCutoff, workEndTime });
  return { checkInCutoff, workEndTime };
}

function pool(day) {
  const start = istDayStart(previousDay(day));
  return { createdAt: { $gte: start, $lt: new Date(start.getTime() + DAY) }, status: 'new', assignedEmployeeIds: [], assignmentSource: { $exists: false } };
}

async function ensureDay(now = new Date()) {
  const day = istToday(now);
  const coll = await days();
  const existing = await coll.findOne({ _id: day });
  if (existing) return existing;
  const [settings, people, initialCount] = await Promise.all([
    distributionSettings(),
    (await collection(COLLECTIONS.admins)).find({ role: 'employee', status: { $ne: 'suspended' } }, { projection: { _id: 1 } }).sort({ _id: 1 }).toArray(),
    (await applications()).countDocuments(pool(day)),
  ]);
  const doc = {
    _id: day, sourceDay: previousDay(day), cutoffAt: cutoffAt(day, settings.checkInCutoff),
    checkInCutoff: settings.checkInCutoff, workEndTime: settings.workEndTime,
    rosterIds: people.map((person) => person._id), initialCount,
    baseline: sharePerEmployee(initialCount, people.length), createdAt: now, finalizedAt: null,
  };
  const { _id, ...onInsert } = doc;
  await coll.updateOne({ _id: day }, { $setOnInsert: onInsert }, { upsert: true }).catch((error) => { if (error.code !== 11000) throw error; });
  return coll.findOne({ _id: day });
}

async function assignFromPool(day, employeeId, desired, token, now) {
  if (desired <= 0) return 0;
  const leads = await applications();
  const coll = await days();
  let done = 0;
  while (done < desired) {
    const candidates = await leads.find(pool(day), { projection: { _id: 1 } }).sort({ createdAt: 1, _id: 1 }).limit(Math.min(desired - done, 100)).toArray();
    if (!candidates.length) break;
    let progressed = false;
    for (const candidate of candidates) {
      const result = await leads.updateOne({ _id: candidate._id, ...pool(day) }, { $set: {
        assignedEmployeeIds: [employeeId], assignmentSource: 'automatic', autoDistributionDay: day,
        autoAssigneeId: employeeId, autoAssignedAt: now, updatedAt: now,
      } });
      done += result.modifiedCount;
      progressed ||= result.modifiedCount > 0;
      if (done > 0 && done % 50 === 0) await renewLease(coll, day, token);
      if (done >= desired) break;
    }
    if (!progressed) break;
  }
  return done;
}

async function runLocked(doc, token, now) {
  if (doc.finalizedAt) return;
  const present = await (await attendance()).find({ day: doc._id, eligible: true }, { projection: { employeeId: 1, checkedOutAt: 1 } }).toArray();
  const activeStaff = await (await collection(COLLECTIONS.admins)).find({
    _id: { $in: present.map((person) => person.employeeId) }, role: 'employee', status: { $ne: 'suspended' },
  }, { projection: { _id: 1 } }).toArray();
  const activeIds = new Set(activeStaff.map((person) => String(person._id)));
  const people = present.filter((person) => activeIds.has(String(person.employeeId)));
  const leads = await applications();
  for (const person of people.filter((entry) => !entry.checkedOutAt)) {
    const count = await leads.countDocuments({ autoDistributionDay: doc._id, autoAssigneeId: person.employeeId });
    await assignFromPool(doc._id, person.employeeId, Math.max(0, doc.baseline - count), token, now);
  }
  if (now < doc.cutoffAt) return;

  const active = people.filter((person) => !person.checkedOutAt).map((person, order) => ({ ...person, order, count: 0 }));
  for (const person of active) person.count = await leads.countDocuments({ autoDistributionDay: doc._id, autoAssigneeId: person.employeeId });
  if (active.length) {
    // Allocate the remainder to the least-loaded checked-in employee. Prior manual assignments
    // and already allocated leads are never touched, including after a restart or retry.
    for (;;) {
      const candidates = await leads.find(pool(doc._id), { projection: { _id: 1 } }).sort({ createdAt: 1, _id: 1 }).limit(100).toArray();
      if (!candidates.length) break;
      let progressed = false;
      for (const candidate of candidates) {
        const recipient = leastLoaded(active);
        const result = await leads.updateOne({ _id: candidate._id, ...pool(doc._id) }, { $set: {
          assignedEmployeeIds: [recipient.employeeId], assignmentSource: 'automatic', autoDistributionDay: doc._id,
          autoAssigneeId: recipient.employeeId, autoAssignedAt: now, updatedAt: now,
        } });
        recipient.count += result.modifiedCount;
        progressed ||= result.modifiedCount > 0;
        await renewLease(await days(), doc._id, token);
      }
      if (!progressed) break;
    }
  }
  const remaining = await leads.countDocuments(pool(doc._id));
  if (!active.length || !remaining) {
    const result = await (await days()).updateOne({ _id: doc._id, leaseOwner: token, finalizedAt: null }, {
      $set: { finalizedAt: new Date(), remainingAtCutoff: remaining, checkedInCount: active.length },
    });
    if (result.modifiedCount) await audit(null, 'distribution.finalize', { type: 'distribution', id: doc._id, label: doc._id }, {
      sourceDay: doc.sourceDay, initialCount: doc.initialCount, checkedInCount: active.length, remaining,
    }).catch((error) => console.error('Distribution audit:', error.message));
  }
  clearLeadCounts();
}

export async function reconcileDistribution(now = new Date()) {
  const doc = await ensureDay(now);
  if (doc.finalizedAt) return doc;
  const coll = await days();
  const token = randomUUID();
  const locked = await coll.findOneAndUpdate({ _id: doc._id, $or: [{ leaseUntil: { $lt: new Date() } }, { leaseUntil: { $exists: false } }] }, {
    $set: { leaseOwner: token, leaseUntil: new Date(Date.now() + LEASE_MS) },
  }, { returnDocument: 'after' });
  if (!locked) return coll.findOne({ _id: doc._id });
  try { await runLocked(locked, token, now); }
  finally { await coll.updateOne({ _id: doc._id, leaseOwner: token }, { $unset: { leaseOwner: '', leaseUntil: '' } }); }
  return coll.findOne({ _id: doc._id });
}

// Check-in and check-out toggle any number of times a day. One attendance record per employee and day keeps:
//   checkedInAt  first check-in of the day (decides `late` / `eligible` for the automatic share, never changes)
//   checkedOutAt null while on duty, else the latest check-out — the distribution only gives leads to people with null
//   sessions     every on-duty period [{ inAt, outAt }] for time tracking (records from before sessions have none)
// While checked out an employee gets no new automatic leads; checking in again resumes them (up to the same
// day's share — leads already given count towards it). Leads already assigned stay with the employee throughout.
// No limit on how often (owner's decision, 2026-11-24); a session is ~60 bytes, so a day's record stays tiny.

/** The sessions of a record, deriving one for records written before sessions existed. */
export const sessionsOf = (record) => (record?.sessions?.length ? record.sessions
  : record?.checkedInAt ? [{ inAt: record.checkedInAt, outAt: record.checkedOutAt ?? null }] : []);

export async function checkIn(staff, now = new Date()) {
  if (staff.role !== 'employee') throw new HttpError(403, 'Only employees check in');
  const doc = await ensureDay(now);
  const coll = await attendance();
  const eligible = onTimeForBatch(now, doc.cutoffAt, doc.rosterIds, staff._id);
  const late = now >= doc.cutoffAt;
  const notInRoster = !doc.rosterIds.some((id) => id.equals(staff._id));
  const id = `${doc._id}:${staff._id}`;
  const inserted = await coll.updateOne({ _id: id }, { $setOnInsert: {
    day: doc._id, employeeId: staff._id, checkedInAt: now, eligible, late, notInRoster, checkedOutAt: null, sessions: [{ inAt: now, outAt: null }],
  } }, { upsert: true });
  if (!inserted.upsertedCount) {
    const record = await coll.findOne({ _id: id });
    if (record.checkedOutAt) {
      const sessions = sessionsOf(record);
      // Conditional on the check-out we read, so a double click or a second tab cannot open two sessions.
      await coll.updateOne({ _id: id, checkedOutAt: record.checkedOutAt }, { $set: { checkedOutAt: null, sessions: [...sessions, { inAt: now, outAt: null }] } });
    }
  }
  await reconcileDistribution(now);
  return distributionStatus(staff, now);
}

export async function checkOut(staff, now = new Date()) {
  if (staff.role !== 'employee') throw new HttpError(403, 'Only employees check out');
  const coll = await attendance();
  const id = `${istToday(now)}:${staff._id}`;
  const record = await coll.findOne({ _id: id, checkedOutAt: null });
  if (!record) throw new HttpError(409, 'Check in before checking out');
  const sessions = sessionsOf(record).map((session) => (session.outAt ? session : { ...session, outAt: now }));
  const result = await coll.updateOne({ _id: id, checkedOutAt: null }, { $set: { checkedOutAt: now, sessions } });
  if (!result.modifiedCount) throw new HttpError(409, 'You are already checked out');
  return distributionStatus(staff, now);
}

export async function distributionStatus(staff, now = new Date()) {
  const doc = await reconcileDistribution(now);
  const record = staff.role === 'employee' ? await (await attendance()).findOne({ _id: `${doc._id}:${staff._id}` }) : null;
  const leads = await applications();
  const assignedToday = record ? await leads.countDocuments({ autoDistributionDay: doc._id, autoAssigneeId: staff._id }) : 0;
  const pending = staff.role === 'employee' ? await leads.countDocuments({ assignedEmployeeIds: staff._id, status: 'new' }) : null;
  const overview = staff.isOwner ? await (await attendance()).find({ day: doc._id }).toArray() : [];
  const currentlyCheckedIn = staff.isOwner ? overview.filter((entry) => !entry.checkedOutAt && entry.eligible).length : null;
  const olderUnassigned = staff.isOwner ? await leads.countDocuments({ status: 'new', assignedEmployeeIds: [], createdAt: { $lt: istDayStart(doc.sourceDay) } }) : null;
  const roster = staff.isOwner ? await (await collection(COLLECTIONS.admins)).find({ _id: { $in: doc.rosterIds } }, { projection: { name: 1, email: 1 } }).toArray() : [];
  const counts = staff.isOwner ? await leads.aggregate([{ $match: { autoDistributionDay: doc._id } }, { $group: { _id: '$autoAssigneeId', count: { $sum: 1 } } }]).toArray() : [];
  const rosterById = new Map(roster.map((person) => [String(person._id), person]));
  const attendanceById = new Map(overview.map((entry) => [String(entry.employeeId), entry]));
  const countById = new Map(counts.map((entry) => [String(entry._id), entry.count]));
  return {
    day: doc._id, sourceDay: doc.sourceDay, cutoffAt: doc.cutoffAt, cutoffPassed: now >= doc.cutoffAt, workEndTime: doc.workEndTime,
    initialCount: doc.initialCount, baseline: doc.baseline, rosterCount: doc.rosterIds.length,
    finalized: Boolean(doc.finalizedAt), remaining: doc.remainingAtCutoff ?? null, checkedInCount: doc.checkedInCount ?? null,
    currentlyCheckedIn,
    olderUnassigned,
    ...attendanceView(record, now), assignedToday, pending,
    ...(staff.isOwner && { employees: doc.rosterIds.map((id) => {
      const person = rosterById.get(String(id));
      const entry = attendanceById.get(String(id));
      return { id: String(id), name: person?.name || person?.email || 'Former employee', checkedInAt: entry?.checkedInAt ?? null,
        checkedOutAt: entry?.checkedOutAt ?? null, late: Boolean(entry?.late), assignedToday: countById.get(String(id)) ?? 0 };
    }) }),
  };
}

/** Total on-duty minutes over the day's sessions (an open session runs to `now`); null before a check-in. */
export function workedMinutes(record, now = new Date()) {
  const sessions = sessionsOf(record);
  if (!sessions.length) return null;
  const ms = sessions.reduce((sum, { inAt, outAt }) => sum + Math.max(0, (outAt ? new Date(outAt) : now) - new Date(inAt)), 0);
  return Math.round(ms / 60_000);
}

const attendanceView = (record, now) => {
  const sessions = sessionsOf(record);
  const open = sessions.at(-1)?.outAt === null ? sessions.at(-1) : null;
  return {
    checkedInAt: record?.checkedInAt ?? null, checkedOutAt: record?.checkedOutAt ?? null,
    onDutySince: open?.inAt ?? null, sessions, sessionCount: sessions.length,
    late: Boolean(record?.late), notInRoster: Boolean(record?.notInRoster), eligible: Boolean(record?.eligible),
    workedMinutes: workedMinutes(record, now),
  };
};

/**
 * The top-bar check-in button's state. Read-only and cheap (three point reads, no distribution run), so every
 * open console tab can poll it; the full figures come from distributionStatus when the popup opens.
 */
export async function myAttendance(staff, now = new Date()) {
  const day = istToday(now);
  const [doc, settings, record] = await Promise.all([
    (await days()).findOne({ _id: day }, { projection: { cutoffAt: 1, workEndTime: 1 } }),
    distributionSettings(),
    staff.role === 'employee' ? (await attendance()).findOne({ _id: `${day}:${staff._id}` }) : null,
  ]);
  const cutoff = doc?.cutoffAt ?? cutoffAt(day, settings.checkInCutoff);
  return {
    day, canCheckIn: staff.role === 'employee', cutoffAt: cutoff, cutoffPassed: now >= cutoff,
    workEndTime: doc?.workEndTime ?? settings.workEndTime, ...attendanceView(record, now),
  };
}

/** The signed-in employee's own recent days, newest first, with the automatic leads each day brought. */
export async function attendanceHistory(staff, { limit = 14 } = {}, now = new Date()) {
  if (staff.role !== 'employee') return { items: [] };
  const size = Math.min(Math.max(Number(limit) || 14, 1), 60);
  const records = await (await attendance()).find({ employeeId: staff._id }).sort({ day: -1 }).limit(size).toArray();
  const counts = records.length ? await (await applications()).aggregate([
    { $match: { autoAssigneeId: staff._id, autoDistributionDay: { $in: records.map((entry) => entry.day) } } },
    { $group: { _id: '$autoDistributionDay', count: { $sum: 1 } } },
  ]).toArray() : [];
  const countByDay = new Map(counts.map((entry) => [entry._id, entry.count]));
  return { items: records.map((record) => ({ day: record.day, ...attendanceView(record, now), assigned: countByDay.get(record.day) ?? 0 })) };
}

export function startDistributionWorker() {
  const run = () => reconcileDistribution().catch((error) => console.error('Daily lead distribution:', error.message));
  run();
  const timer = setInterval(run, 15_000);
  timer.unref();
  return () => clearInterval(timer);
}
