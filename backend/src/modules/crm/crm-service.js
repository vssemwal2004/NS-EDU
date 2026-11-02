// What staff do to a lead: log calls and notes, schedule follow-ups, set temperature and priority,
// add, edit and delete leads, and act on many at once. Everything respects the viewer's lead scope.
import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { assignableIds, audit, can } from '../access/access-service.js';
import { employeeAssignmentIds } from '../admin/employee-assignments.js';
import { STATUSES, INDIAN_STATES } from '../applications/schema.js';
import {
  accessFilter, applicationNotes, applications, clearLeadCounts, DAY, istDayStart, istToday, leadKeys, nextRef, staffEmails, statusLabel,
} from '../applications/service.js';
import { ACTIVITY_KINDS, CALL_OUTCOMES, HEATS, PRIORITIES, TASK_KINDS, crmUpdate } from './crm-model.js';

const tasks = () => collection(COLLECTIONS.leadTasks);
const trash = () => collection(COLLECTIONS.applicationsTrash);
const CONTACT_KINDS = ['call', 'whatsapp', 'email', 'meeting', 'visit'];
const MISSED = ['no-answer', 'busy', 'wrong-number'];
const MAX_BULK = 100;

const date = (value, field, { future = false } = {}) => {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new HttpError(400, 'Enter a valid date and time', { fields: { [field]: 'Enter a valid date and time.' } });
  const now = Date.now();
  if (parsed.getTime() > now + 2 * 365 * DAY) throw new HttpError(400, 'That date is too far ahead', { fields: { [field]: 'Choose a date within two years.' } });
  if (future && parsed.getTime() < now - 5 * 60_000) throw new HttpError(400, 'Choose a time in the future', { fields: { [field]: 'Choose a time in the future.' } });
  return parsed;
};
const text = (value, field, { max, required = false } = {}) => {
  const out = typeof value === 'string' ? value.trim() : '';
  if (required && !out) throw new HttpError(400, 'This field is required', { fields: { [field]: 'Required.' } });
  if (out.length > max) throw new HttpError(400, `Use at most ${max} characters`, { fields: { [field]: `Use at most ${max} characters.` } });
  return out;
};

/** Recomputes a lead's CRM block (next follow-up from its open tasks, score, temperature). */
async function refreshLead(leadId, extra = {}, now = new Date(), { status, push } = {}) {
  const leads = await applications();
  const lead = await leads.findOne({ _id: leadId });
  if (!lead) return null;
  const next = await (await tasks()).find({ leadId, doneAt: null }).sort({ dueAt: 1 }).limit(1).next();
  // A status change is scored as the new status, in the same write as the history entry.
  const set = { ...crmUpdate(status ? { ...lead, status } : lead, now, { nextFollowUpAt: next?.dueAt ?? null, ...extra }), updatedAt: now, ...(status && { status }) };
  return leads.findOneAndUpdate({ _id: leadId }, { $set: set, ...(push ? { $push: push } : {}) }, { returnDocument: 'after' });
}

// -----------------------------------------------------------------------------------------------
// Activities (the timeline)

export const serializeActivity = (note) => ({
  id: note._id.toString(), kind: note.kind ?? 'note', outcome: note.outcome ?? '', text: note.text ?? '',
  authorEmail: note.authorEmail, authorRole: note.authorRole, createdAt: note.createdAt,
});

export async function logActivity(staff, lead, body) {
  const kind = ACTIVITY_KINDS.includes(body?.kind) ? body.kind : 'note';
  const outcome = body?.outcome ? String(body.outcome) : '';
  if (outcome && !CALL_OUTCOMES.includes(outcome)) throw new HttpError(400, 'Unknown call outcome', { fields: { outcome: 'Choose a listed outcome.' } });
  const note = text(body?.text, 'text', { max: 2000, required: kind === 'note' && !outcome });
  const now = new Date();
  const activity = { applicationId: lead._id, kind, outcome, text: note, authorId: staff._id, authorEmail: staff.email, authorRole: staff.role, createdAt: now };
  await (await applicationNotes()).insertOne(activity);

  const reached = CONTACT_KINDS.includes(kind) && !MISSED.includes(outcome);
  const extra = { lastActivityAt: now, ...(reached && { lastContactedAt: now, firstContactedAt: lead.crm?.firstContactedAt ?? now }) };
  const advance = reached && lead.status === 'new';
  if (body?.followUpAt) {
    await createTask(staff, lead, { title: body.followUpTitle || `Follow up: ${kind === 'note' ? 'check in' : kind}`, kind: CONTACT_KINDS.includes(kind) ? kind : 'call', dueAt: body.followUpAt });
  }
  // The first real conversation moves a New lead to Contacted, and says so in the history.
  const updated = await refreshLead(lead._id, extra, now, advance ? { status: 'contacted', push: { statusHistory: { status: 'contacted', at: now, byAdminId: staff._id } } } : undefined);
  if (advance) clearLeadCounts();
  return { activity: serializeActivity(activity), lead: updated };
}

export async function timeline(lead) {
  const [notes, taskDocs] = await Promise.all([
    (await applicationNotes()).find({ applicationId: lead._id }).sort({ createdAt: -1 }).limit(200).toArray(),
    (await tasks()).find({ leadId: lead._id }).sort({ createdAt: -1 }).limit(100).toArray(),
  ]);
  const people = await staffEmails((lead.statusHistory ?? []).map((entry) => entry.byAdminId));
  const items = [
    ...notes.map((note) => ({ type: note.kind && note.kind !== 'note' ? 'activity' : 'note', id: note._id.toString(), at: note.createdAt, by: note.authorEmail, kind: note.kind ?? 'note', outcome: note.outcome ?? '', text: note.text ?? '' })),
    ...(lead.statusHistory ?? []).map((entry, index) => ({ type: 'status', id: `s${index}`, at: entry.at, by: people.get(String(entry.byAdminId)) ?? 'System', status: entry.status, statusLabel: statusLabel(entry.status) })),
    ...taskDocs.flatMap((task) => [
      { type: 'task-created', id: `t${task._id}`, at: task.createdAt, by: task.createdByEmail ?? '', title: task.title, kind: task.kind, dueAt: task.dueAt },
      ...(task.doneAt ? [{ type: 'task-done', id: `d${task._id}`, at: task.doneAt, by: task.doneByEmail ?? '', title: task.title, kind: task.kind }] : []),
    ]),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  return items;
}

// -----------------------------------------------------------------------------------------------
// Follow-up tasks

export const serializeTask = (task, now = new Date()) => ({
  id: task._id.toString(), leadId: task.leadId.toString(), leadRef: task.leadRef ?? '', leadName: task.leadName ?? '', leadPhone: task.leadPhone ?? '',
  assigneeId: task.assigneeId?.toString() ?? null, assigneeEmail: task.assigneeEmail ?? '', title: task.title, kind: task.kind, dueAt: task.dueAt, doneAt: task.doneAt ?? null,
  overdue: !task.doneAt && new Date(task.dueAt) < now, createdAt: task.createdAt,
});

function assertCanAssignTo(staff, assigneeId) {
  if (assigneeId.equals(staff._id)) return;
  if (!can(staff, 'tasks.manage_team') && !can(staff, 'leads.assign')) throw new HttpError(403, 'You can only schedule follow-ups for yourself');
  const allowed = assignableIds(staff);
  if (allowed && !allowed.some((id) => id.equals(assigneeId))) throw new HttpError(403, 'You can only schedule follow-ups for yourself and your team');
}

export async function createTask(staff, lead, body) {
  const kind = TASK_KINDS.includes(body?.kind) ? body.kind : 'call';
  const title = text(body?.title, 'title', { max: 120 }) || `${kind[0].toUpperCase()}${kind.slice(1)} ${lead.applicant?.fullName ?? ''}`.trim();
  const dueAt = date(body?.dueAt, 'dueAt', { future: true });
  const assigneeId = body?.assigneeId ? toObjectId(body.assigneeId) : staff._id;
  if (!assigneeId) throw new HttpError(400, 'Choose a valid assignee', { fields: { assigneeId: 'Unknown person.' } });
  assertCanAssignTo(staff, assigneeId);
  const assignee = assigneeId.equals(staff._id) ? staff : await (await collection(COLLECTIONS.admins)).findOne({ _id: assigneeId }, { projection: { email: 1, name: 1 } });
  if (!assignee) throw new HttpError(400, 'Choose a valid assignee', { fields: { assigneeId: 'Unknown person.' } });
  const now = new Date();
  const task = {
    leadId: lead._id, leadRef: lead.ref, leadName: lead.applicant?.fullName ?? '', leadPhone: lead.applicant?.phone ?? '',
    assigneeId, assigneeEmail: assignee.email, title, kind, dueAt, doneAt: null, createdById: staff._id, createdByEmail: staff.email, createdAt: now,
  };
  await (await tasks()).insertOne(task);
  await refreshLead(lead._id, {}, now);
  return serializeTask(task, now);
}

async function taskScope(staff, scope) {
  if (scope === 'all') {
    if (staff.leadScope !== 'all' && !staff.isOwner) throw new HttpError(403, 'Your role cannot see everyone’s follow-ups');
    return {};
  }
  if (scope === 'team') {
    if (!can(staff, 'tasks.manage_team') && staff.leadScope === 'own') throw new HttpError(403, 'Your role cannot see your team’s follow-ups');
    return { assigneeId: { $in: staff.leadScope === 'all' || staff.isOwner ? await allStaffIds() : [staff._id, ...(staff.teamIds ?? [])] } };
  }
  return { assigneeId: staff._id };
}
const allStaffIds = async () => (await (await collection(COLLECTIONS.admins)).find({}, { projection: { _id: 1 } }).toArray()).map((doc) => doc._id);

export async function listTasks(staff, query = {}) {
  const scopeFilter = await taskScope(staff, queryString(query.scope, 6) || 'mine');
  const { page, limit, skip } = pagination(query, { defaultLimit: 25, maxLimit: 100, allowedLimits: [25, 50, 100] });
  const today = istDayStart(istToday());
  const tomorrow = new Date(today.getTime() + DAY);
  const now = new Date();
  // The sections partition the open follow-ups: overdue (before now), today (from now to the end of the IST day),
  // upcoming (tomorrow on). A task due earlier today is overdue, never counted twice.
  const states = {
    open: { doneAt: null }, overdue: { doneAt: null, dueAt: { $lt: now } }, today: { doneAt: null, dueAt: { $gte: now, $lt: tomorrow } },
    upcoming: { doneAt: null, dueAt: { $gte: tomorrow } }, done: { doneAt: { $ne: null } },
  };
  const state = queryString(query.state, 10) || 'open';
  if (!states[state]) throw new HttpError(400, 'Unknown task filter', { fields: { state: 'Choose open, overdue, today, upcoming or done' } });
  const coll = await tasks();
  const [items, total, overdue, dueToday, upcoming] = await Promise.all([
    coll.find({ ...scopeFilter, ...states[state] }).sort(state === 'done' ? { doneAt: -1 } : { dueAt: 1 }).skip(skip).limit(limit).toArray(),
    coll.countDocuments({ ...scopeFilter, ...states[state] }),
    coll.countDocuments({ ...scopeFilter, ...states.overdue }),
    coll.countDocuments({ ...scopeFilter, ...states.today }),
    coll.countDocuments({ ...scopeFilter, ...states.upcoming }),
  ]);
  return { items: items.map((task) => serializeTask(task, now)), total, page, limit, counts: { overdue, today: dueToday, upcoming } };
}

export async function updateTask(staff, id, body) {
  const _id = toObjectId(id);
  const coll = await tasks();
  const task = _id && await coll.findOne({ _id });
  if (!task) throw new HttpError(404, 'Task not found');
  const mine = task.assigneeId?.equals(staff._id);
  if (!mine) {
    const allowed = assignableIds(staff);
    const team = staff.isOwner || staff.leadScope === 'all' || (can(staff, 'tasks.manage_team') && allowed?.some((member) => member.equals(task.assigneeId)));
    if (!team) throw new HttpError(404, 'Task not found');
  }
  const set = {};
  const extra = {};
  const now = new Date();
  if (body?.done !== undefined) {
    if (body.done) { set.doneAt = now; set.doneById = staff._id; set.doneByEmail = staff.email; extra.lastActivityAt = now; }
    else { set.doneAt = null; set.doneById = null; set.doneByEmail = null; }
  }
  if (body?.dueAt !== undefined) set.dueAt = date(body.dueAt, 'dueAt');
  if (body?.title !== undefined) set.title = text(body.title, 'title', { max: 120, required: true });
  if (body?.assigneeId !== undefined) {
    const assigneeId = toObjectId(body.assigneeId);
    if (!assigneeId) throw new HttpError(400, 'Choose a valid assignee', { fields: { assigneeId: 'Unknown person.' } });
    assertCanAssignTo(staff, assigneeId);
    const person = await (await collection(COLLECTIONS.admins)).findOne({ _id: assigneeId }, { projection: { email: 1 } });
    if (!person) throw new HttpError(400, 'Choose a valid assignee', { fields: { assigneeId: 'Unknown person.' } });
    set.assigneeId = assigneeId; set.assigneeEmail = person.email;
  }
  const updated = await coll.findOneAndUpdate({ _id }, { $set: set }, { returnDocument: 'after' });
  await refreshLead(task.leadId, extra, now);
  return serializeTask(updated, now);
}

export async function deleteTask(staff, id) {
  const _id = toObjectId(id);
  const coll = await tasks();
  const task = _id && await coll.findOne({ _id });
  if (!task || (!task.assigneeId?.equals(staff._id) && !task.createdById?.equals(staff._id) && !can(staff, 'tasks.manage_team'))) throw new HttpError(404, 'Task not found');
  await coll.deleteOne({ _id });
  await refreshLead(task.leadId);
}

// -----------------------------------------------------------------------------------------------
// Temperature, priority and tags

const tagOf = (value) => String(value).trim().toLowerCase().replace(/[^a-z0-9 -]+/g, '').replace(/\s+/g, '-').slice(0, 24);

export async function setCrm(staff, lead, body) {
  const extra = {};
  if (body?.heat !== undefined) {
    if (body.heat === 'auto') extra.heatSource = 'auto';
    else if (HEATS.includes(body.heat)) { extra.heat = body.heat; extra.heatSource = 'manual'; }
    else throw new HttpError(400, 'Choose hot, warm, cold or auto', { fields: { heat: 'Choose hot, warm, cold or auto.' } });
  }
  if (body?.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) throw new HttpError(400, 'Choose a listed priority', { fields: { priority: 'Choose urgent, high, normal or low.' } });
    extra.priority = body.priority;
  }
  if (body?.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.length > 8) throw new HttpError(400, 'Use up to 8 tags', { fields: { tags: 'Use up to 8 tags.' } });
    extra.tags = [...new Set(body.tags.map(tagOf).filter(Boolean))];
  }
  if (body?.lostReason !== undefined) extra.lostReason = text(body.lostReason, 'lostReason', { max: 160 });
  if (!Object.keys(extra).length) return lead;
  const updated = await refreshLead(lead._id, { ...extra, lastActivityAt: new Date() });
  clearLeadCounts();
  return updated;
}

// -----------------------------------------------------------------------------------------------
// Create, edit, delete

const PHONE = /^(?:\+91|91|0)?[\s-]?([6-9](?:[\s-]?\d){9})$/;
const phoneOf = (value) => { const match = PHONE.exec(String(value ?? '').trim()); return match ? `+91${match[1].replace(/[\s-]/g, '')}` : null; };

function applicantFrom(body, existing = {}) {
  const out = { ...existing };
  if (body.fullName !== undefined || !existing.fullName) {
    out.fullName = text(body.fullName, 'fullName', { max: 80, required: true });
    if (out.fullName.length < 2) throw new HttpError(400, 'Enter the full name', { fields: { fullName: 'Enter at least 2 characters.' } });
  }
  if (body.phone !== undefined || !existing.phone) {
    const phone = phoneOf(body.phone);
    if (!phone) throw new HttpError(400, 'Enter a 10-digit Indian mobile number', { fields: { phone: 'Enter a 10-digit Indian mobile number.' } });
    out.phone = phone;
  }
  if (body.email !== undefined) {
    const email = text(body.email, 'email', { max: 200 }).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address', { fields: { email: 'Enter a valid email address.' } });
    out.email = email;
  }
  if (body.city !== undefined) out.city = text(body.city, 'city', { max: 80 });
  if (body.state !== undefined) {
    const state = text(body.state, 'state', { max: 60 });
    if (state && !INDIAN_STATES.includes(state)) throw new HttpError(400, 'Choose a state from the list', { fields: { state: 'Choose a state from the list.' } });
    out.state = state;
  }
  return out;
}

export async function createLead(staff, body) {
  const applicant = applicantFrom(body ?? {});
  const leads = await applications();
  if (!body?.force) {
    const duplicate = await leads.findOne({ 'applicant.phone': applicant.phone }, { projection: { ref: 1, 'applicant.fullName': 1, status: 1 } });
    if (duplicate) throw new HttpError(409, `A lead with this number already exists (${duplicate.ref}, ${duplicate.applicant?.fullName ?? ''})`, { duplicateId: duplicate._id.toString(), duplicateRef: duplicate.ref });
  }
  let assigned = [staff._id];
  if (body?.assigneeIds !== undefined) {
    assigned = await employeeAssignmentIds(body.assigneeIds, { includeOwners: true });
    const allowed = assignableIds(staff);
    if (allowed && assigned.some((id) => !allowed.some((member) => member.equals(id)))) throw new HttpError(403, 'You can only assign leads to yourself and your team');
  }
  if (!staff.isOwner && !can(staff, 'leads.assign') && assigned.some((id) => !id.equals(staff._id))) throw new HttpError(403, 'You cannot assign leads to others');
  const now = new Date();
  const preference = {
    courseName: text(body?.courseName, 'courseName', { max: 120 }), institutionName: text(body?.institutionName, 'institutionName', { max: 160 }),
    message: text(body?.message, 'message', { max: 500 }),
  };
  const lead = {
    ref: await nextRef(now), channel: 'manual', mode: null, status: 'new', applicant, preference, academics: null,
    source: { kind: 'staff', note: text(body?.source, 'source', { max: 80 }) || 'Added by staff', byAdminId: staff._id },
    contactVerified: { email: false, phone: false }, consent: { contactConsent: false, privacyAccepted: false, at: null, version: '', text: {} },
    assignedEmployeeIds: assigned, statusHistory: [{ status: 'new', at: now, byAdminId: staff._id }], createdAt: now, updatedAt: now,
    createdByAdminId: staff._id, ...leadKeys(applicant),
  };
  // A new lead has no follow-up yet: store an explicit null (not a missing field), the same shape
  // refreshLead writes, so every reader sees "none" and never an epoch or "overdue" date.
  lead.crm = { priority: PRIORITIES.includes(body?.priority) ? body.priority : 'normal', tags: [], lastActivityAt: now, nextFollowUpAt: null, lastContactedAt: null };
  // crmUpdate returns a `$set` ('crm.score', ...); fold it into the new document's own crm block.
  lead.crm = { ...lead.crm, ...Object.fromEntries(Object.entries(crmUpdate(lead, now)).map(([key, value]) => [key.slice('crm.'.length), value])) };
  await leads.insertOne(lead);
  clearLeadCounts();
  await audit(staff, 'lead.create', { type: 'lead', id: lead._id, label: lead.ref });
  return lead;
}

export async function editLead(staff, lead, body) {
  const applicant = applicantFrom(body ?? {}, lead.applicant ?? {});
  if (body?.phone !== undefined && applicant.phone !== lead.applicant?.phone && !body?.force) {
    const duplicate = await (await applications()).findOne({ 'applicant.phone': applicant.phone, _id: { $ne: lead._id } }, { projection: { ref: 1 } });
    if (duplicate) throw new HttpError(409, `Another lead already uses this number (${duplicate.ref})`, { duplicateId: duplicate._id.toString(), duplicateRef: duplicate.ref });
  }
  const set = { applicant, ...leadKeys(applicant), updatedAt: new Date() };
  for (const field of ['courseName', 'institutionName', 'message']) if (body?.[field] !== undefined) set[`preference.${field}`] = text(body[field], field, { max: field === 'message' ? 500 : 160 });
  const updated = await (await applications()).findOneAndUpdate({ _id: lead._id, ...accessFilter(staff) }, { $set: set }, { returnDocument: 'after' });
  if (!updated) throw new HttpError(404, 'Lead not found');
  clearLeadCounts();
  return updated;
}

/** Deleting moves the lead (and its notes and tasks stay) to the bin, where an owner can restore or purge it. */
export async function deleteLead(staff, lead) {
  const trashColl = await trash();
  await trashColl.insertOne({ _id: lead._id, lead, deletedAt: new Date(), deletedById: staff._id, deletedByEmail: staff.email });
  await (await applications()).deleteOne({ _id: lead._id });
  clearLeadCounts();
  await audit(staff, 'lead.delete', { type: 'lead', id: lead._id, label: lead.ref }, { name: lead.applicant?.fullName ?? '' });
}

export async function listTrash(query = {}) {
  const { page, limit, skip } = pagination(query, { defaultLimit: 25, maxLimit: 100 });
  const coll = await trash();
  const [docs, total] = await Promise.all([coll.find({}).sort({ deletedAt: -1 }).skip(skip).limit(limit).toArray(), coll.countDocuments({})]);
  return {
    page, limit, total,
    items: docs.map((doc) => ({ id: doc._id.toString(), ref: doc.lead?.ref, name: doc.lead?.applicant?.fullName ?? '', phone: doc.lead?.applicant?.phone ?? '', channel: doc.lead?.channel ?? 'web-apply', deletedAt: doc.deletedAt, deletedBy: doc.deletedByEmail })),
  };
}

export async function restoreLead(staff, id) {
  const _id = toObjectId(id);
  const coll = await trash();
  const doc = _id && await coll.findOne({ _id });
  if (!doc) throw new HttpError(404, 'Deleted lead not found');
  await (await applications()).insertOne({ ...doc.lead, updatedAt: new Date() });
  await coll.deleteOne({ _id });
  clearLeadCounts();
  await audit(staff, 'lead.restore', { type: 'lead', id: _id, label: doc.lead?.ref ?? '' });
}

export async function purgeLead(staff, id) {
  const _id = toObjectId(id);
  const coll = await trash();
  const doc = _id && await coll.findOne({ _id });
  if (!doc) throw new HttpError(404, 'Deleted lead not found');
  await coll.deleteOne({ _id });
  await (await applicationNotes()).deleteMany({ applicationId: _id });
  await (await tasks()).deleteMany({ leadId: _id });
  await audit(staff, 'lead.purge', { type: 'lead', id: _id, label: doc.lead?.ref ?? '' });
}

// -----------------------------------------------------------------------------------------------
// Bulk

const BULK_PERMISSION = { status: 'leads.change_status', heat: 'crm.heat', priority: 'crm.heat', tag: 'crm.heat', assign: 'leads.assign', delete: 'leads.delete' };

export async function bulkAct(staff, body) {
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_BULK || ids.some((id) => !toObjectId(id)) || new Set(ids).size !== ids.length) {
    throw new HttpError(400, `Choose 1 to ${MAX_BULK} distinct leads`);
  }
  const action = body?.action;
  const permission = BULK_PERMISSION[action];
  if (!permission) throw new HttpError(400, 'Unknown bulk action', { fields: { action: 'Choose status, heat, priority, tag, assign or delete.' } });
  if (!can(staff, 'leads.bulk') || !can(staff, permission)) throw new HttpError(403, 'Your role does not include this bulk action');
  const objectIds = ids.map(toObjectId);
  const leads = await applications();
  const docs = await leads.find({ _id: { $in: objectIds }, ...accessFilter(staff) }).toArray();
  if (docs.length !== objectIds.length) throw new HttpError(404, 'One or more leads were not found');
  const now = new Date();
  let changed = 0;

  if (action === 'assign') {
    const employeeIds = await employeeAssignmentIds(body?.value, { includeOwners: true });
    const allowed = assignableIds(staff);
    if (!employeeIds.length) throw new HttpError(400, 'Choose at least one employee');
    if (allowed && employeeIds.some((id) => !allowed.some((member) => member.equals(id)))) throw new HttpError(403, 'You can only assign leads to yourself and your team');
    changed = (await leads.updateMany({ _id: { $in: objectIds } }, { $addToSet: { assignedEmployeeIds: { $each: employeeIds } }, $set: { updatedAt: now } })).modifiedCount;
  } else if (action === 'delete') {
    for (const doc of docs) { await deleteLead(staff, doc); changed += 1; }
  } else if (action === 'status') {
    if (!STATUSES.includes(body?.value)) throw new HttpError(400, 'Choose a valid status', { fields: { value: 'Choose a valid status.' } });
    for (const doc of docs) {
      if (doc.status === body.value) continue;
      await leads.updateOne({ _id: doc._id }, { $set: { status: body.value, updatedAt: now, ...crmUpdate({ ...doc, status: body.value }, now, { lastActivityAt: now }) }, $push: { statusHistory: { status: body.value, at: now, byAdminId: staff._id } } });
      changed += 1;
    }
  } else {
    const field = action === 'heat' ? 'heat' : action === 'priority' ? 'priority' : 'tags';
    for (const doc of docs) {
      let patch;
      if (action === 'tag') patch = { tags: [...new Set([...(doc.crm?.tags ?? []), tagOf(body?.value)].filter(Boolean))].slice(0, 8) };
      else patch = { [field]: body?.value };
      await setCrm(staff, doc, patch);
      changed += 1;
    }
  }
  clearLeadCounts();
  await audit(staff, `lead.bulk_${action}`, { type: 'lead', label: `${changed} leads` }, { count: changed, value: typeof body?.value === 'string' ? body.value : undefined });
  return { count: changed };
}
