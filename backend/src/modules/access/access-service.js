// Roles, staff accounts, mentor teams and the activity log behind the staff console.
import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { hashPassword } from '../../lib/password.js';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { slugify } from '../../lib/validation.js';
import { assertEmployeePassword } from '../admin-auth/password-policy.js';
import { DEFAULT_STAFF_ROLE, OWNER_ROLE, PERMISSION_KEYS, ROLE_COLORS, SYSTEM_ROLES, expand, isPermission } from './permissions.js';

const roles = () => collection(COLLECTIONS.roles);
const admins = () => collection(COLLECTIONS.admins);
const MAX_TEAM_DEPTH = 4;
const roleCache = createTtlCache({ ttlMs: 15_000, maxEntries: 2 });
export const clearRoleCache = () => roleCache.clear();

/** Every role keyed by slug. System roles are created on first use and never overwritten once edited. */
export const roleMap = () => roleCache.wrap('roles', async () => {
  const coll = await roles();
  const found = await coll.find({}).toArray();
  const have = new Set(found.map((role) => role.slug));
  const missing = SYSTEM_ROLES.filter((role) => !have.has(role.slug));
  if (missing.length) {
    const now = new Date();
    await coll.insertMany(missing.map((role) => ({ ...role, system: true, createdAt: now, updatedAt: now })), { ordered: false }).catch((error) => { if (error.code !== 11000) throw error; });
    return new Map((await coll.find({}).toArray()).map((role) => [role.slug, role]));
  }
  return new Map(found.map((role) => [role.slug, role]));
});

export const roleIdOf = (admin) => admin.roleId || (admin.role === 'admin' ? OWNER_ROLE : DEFAULT_STAFF_ROLE);

/** The people who report to `adminId`, directly or through other mentors (a few levels deep). */
export async function teamMemberIds(adminId, { includeSelf = false } = {}) {
  const coll = await admins();
  const seen = new Set();
  let frontier = [adminId];
  for (let depth = 0; depth < MAX_TEAM_DEPTH && frontier.length; depth += 1) {
    const reports = await coll.find({ managerId: { $in: frontier } }, { projection: { _id: 1 } }).toArray();
    frontier = reports.map((doc) => doc._id).filter((id) => !seen.has(id.toString()));
    frontier.forEach((id) => seen.add(id.toString()));
  }
  const ids = [...seen].map(toObjectId);
  return includeSelf ? [adminId, ...ids] : ids;
}

const ladder = (permissions, prefix) => (permissions.has(`${prefix}.view_all`) ? 'all' : permissions.has(`${prefix}.view_team`) ? 'team' : permissions.has(`${prefix}.view_own`) ? 'own' : 'none');

/**
 * Adds what the role allows to the loaded staff document: `permissions`, `leadScope` and
 * `analyticsScope` ('all' | 'team' | 'own' | 'none') and, for team scopes, `teamIds`.
 */
export async function attachAccess(admin) {
  const map = await roleMap();
  const slug = roleIdOf(admin);
  const role = map.get(slug) ?? map.get(DEFAULT_STAFF_ROLE);
  const owner = role.slug === OWNER_ROLE || role.permissions.includes('*');
  const permissions = owner ? new Set(PERMISSION_KEYS) : expand(role.permissions);
  admin.roleId = role.slug;
  admin.roleName = role.name;
  admin.roleColor = role.color ?? 'slate';
  admin.isOwner = owner;
  admin.permissions = [...permissions];
  admin.leadScope = ladder(permissions, 'leads');
  admin.analyticsScope = ladder(permissions, 'analytics');
  const needsTeam = admin.leadScope === 'team' || admin.analyticsScope === 'team' || permissions.has('tasks.manage_team') || permissions.has('leads.assign');
  admin.teamIds = needsTeam && !owner ? await teamMemberIds(admin._id) : [];
  return admin;
}

export const can = (admin, key) => Boolean(admin?.isOwner || admin?.permissions?.includes(key));

/** Who may a staff member assign leads to? Everyone for scope 'all'; their team (and themselves) otherwise. */
export const assignableIds = (admin) => (admin.leadScope === 'all' || admin.isOwner ? null : [admin._id, ...(admin.teamIds ?? [])]);

// -----------------------------------------------------------------------------------------------
// Activity log

export async function audit(admin, action, target = {}, meta = {}) {
  await (await collection(COLLECTIONS.auditLogs)).insertOne({
    at: new Date(), actorId: admin?._id ?? null, actorEmail: admin?.email ?? 'system', action,
    targetType: target.type ?? '', targetId: target.id ? String(target.id) : '', targetLabel: target.label ?? '', meta,
  });
}

export async function listAudit(query = {}) {
  const { page, limit, skip } = pagination(query, { defaultLimit: 50, maxLimit: 100 });
  const filter = {};
  const action = queryString(query.action, 60);
  const actor = queryString(query.actor, 120);
  if (action) filter.action = { $regex: `^${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` };
  if (actor) filter.actorEmail = actor;
  // Date range: `from` / `to` are calendar days (YYYY-MM-DD, India time); `to` includes the whole day.
  const day = (value, endOfDay) => {
    const text = queryString(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const at = new Date(`${text}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+05:30`);
    return Number.isNaN(at.getTime()) ? null : at;
  };
  const from = day(query.from, false);
  const to = day(query.to, true);
  if (from || to) filter.at = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  const coll = await collection(COLLECTIONS.auditLogs);
  const [items, total] = await Promise.all([coll.find(filter).sort({ at: -1, _id: -1 }).skip(skip).limit(limit).toArray(), coll.countDocuments(filter)]);
  return {
    page, limit, total,
    items: items.map((row) => ({ id: row._id.toString(), at: row.at, actor: row.actorEmail, action: row.action, targetType: row.targetType, targetId: row.targetId, targetLabel: row.targetLabel, meta: row.meta ?? {} })),
  };
}

// -----------------------------------------------------------------------------------------------
// Roles

const serializeRole = (role, members = 0) => ({
  slug: role.slug, name: role.name, description: role.description ?? '', color: role.color ?? 'slate',
  system: Boolean(role.system), locked: Boolean(role.locked), permissions: role.permissions ?? [], members,
  updatedAt: role.updatedAt ?? null,
});

export async function listRoles() {
  const [map, counts] = await Promise.all([roleMap(), (await admins()).aggregate([{ $group: { _id: { $ifNull: ['$roleId', null] }, role: { $first: '$role' }, n: { $sum: 1 } } }]).toArray()]);
  const members = new Map();
  for (const row of counts) {
    const slug = row._id ?? (row.role === 'admin' ? OWNER_ROLE : DEFAULT_STAFF_ROLE);
    members.set(slug, (members.get(slug) ?? 0) + row.n);
  }
  return [...map.values()].sort((a, b) => (b.system - a.system) || (a.slug === OWNER_ROLE ? -1 : 0) || a.name.localeCompare(b.name)).map((role) => serializeRole(role, members.get(role.slug) ?? 0));
}

function cleanRole(body, { actor, existing }) {
  const name = typeof body?.name === 'string' ? body.name.trim() : existing?.name;
  if (!name || name.length < 2 || name.length > 40) throw new HttpError(400, 'Give the role a name of 2 to 40 characters', { fields: { name: 'Use 2 to 40 characters.' } });
  const color = body?.color ?? existing?.color ?? 'slate';
  if (!ROLE_COLORS.includes(color)) throw new HttpError(400, 'Choose one of the listed colours', { fields: { color: 'Unknown colour.' } });
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 240) : existing?.description ?? '';
  const asked = body?.permissions ?? existing?.permissions ?? [];
  if (!Array.isArray(asked) || asked.some((key) => typeof key !== 'string' || !isPermission(key))) throw new HttpError(400, 'Unknown permission in the list', { fields: { permissions: 'Choose permissions from the catalogue.' } });
  const permissions = [...new Set(asked)];
  // Nobody can hand out more than they hold: a role editor cannot mint a role stronger than their own.
  if (!actor.isOwner) {
    const held = new Set(actor.permissions);
    const beyond = [...expand(permissions)].filter((key) => !held.has(key));
    if (beyond.length) throw new HttpError(403, `You cannot grant permissions you do not hold: ${beyond.slice(0, 3).join(', ')}`, { fields: { permissions: 'Includes permissions above your own level.' } });
  }
  return { name, color, description, permissions };
}

export async function createRole(actor, body) {
  const data = cleanRole(body, { actor });
  const slug = slugify(data.name);
  if (!slug) throw new HttpError(400, 'Give the role a name with letters or numbers', { fields: { name: 'Use letters or numbers.' } });
  const now = new Date();
  const role = { slug, ...data, system: false, locked: false, createdAt: now, updatedAt: now };
  try { await (await roles()).insertOne(role); }
  catch (error) {
    if (error.code === 11000) throw new HttpError(409, 'A role with that name already exists', { fields: { name: 'Already in use.' } });
    throw error;
  }
  clearRoleCache();
  await audit(actor, 'role.create', { type: 'role', id: slug, label: data.name }, { permissions: data.permissions.length });
  return serializeRole(role);
}

export async function updateRole(actor, slug, body) {
  const coll = await roles();
  const existing = (await roleMap()).get(slug);
  if (!existing) throw new HttpError(404, 'Role not found');
  if (existing.locked) throw new HttpError(403, 'The Owner role is locked and always holds every permission');
  const data = cleanRole(body, { actor, existing });
  const before = new Set(existing.permissions);
  const after = new Set(data.permissions);
  await coll.updateOne({ slug }, { $set: { ...data, updatedAt: new Date() } });
  clearRoleCache();
  await audit(actor, 'role.update', { type: 'role', id: slug, label: data.name }, {
    granted: data.permissions.filter((key) => !before.has(key)), revoked: [...before].filter((key) => !after.has(key)),
  });
  return serializeRole({ ...existing, ...data, updatedAt: new Date() }, (await listRoles()).find((role) => role.slug === slug)?.members ?? 0);
}

export async function deleteRole(actor, slug) {
  const existing = (await roleMap()).get(slug);
  if (!existing) throw new HttpError(404, 'Role not found');
  if (existing.system) throw new HttpError(403, 'Built-in roles cannot be deleted; edit their permissions instead');
  if (await (await admins()).countDocuments({ roleId: slug })) throw new HttpError(409, 'Move the staff in this role to another role first');
  await (await roles()).deleteOne({ slug });
  clearRoleCache();
  await audit(actor, 'role.delete', { type: 'role', id: slug, label: existing.name });
}

// -----------------------------------------------------------------------------------------------
// Staff

const PHONE = /^\+?[0-9]{10,15}$/;
const STATUSES = ['active', 'suspended'];

export async function serializeStaff(docs) {
  const map = await roleMap();
  const byId = new Map(docs.map((doc) => [doc._id.toString(), doc]));
  const managerIds = [...new Set(docs.map((doc) => doc.managerId?.toString()).filter((id) => id && !byId.has(id)))];
  const extra = managerIds.length ? await (await admins()).find({ _id: { $in: managerIds.map(toObjectId) } }, { projection: { email: 1, name: 1 } }).toArray() : [];
  for (const doc of extra) byId.set(doc._id.toString(), doc);
  const reports = new Map();
  for (const doc of docs) if (doc.managerId) reports.set(doc.managerId.toString(), (reports.get(doc.managerId.toString()) ?? 0) + 1);
  return docs.map((doc) => {
    const role = map.get(roleIdOf(doc)) ?? map.get(DEFAULT_STAFF_ROLE);
    const manager = doc.managerId ? byId.get(doc.managerId.toString()) : null;
    return {
      id: doc._id.toString(), email: doc.email, name: doc.name ?? '', title: doc.title ?? '', phone: doc.phone ?? '',
      roleId: role.slug, roleName: role.name, roleColor: role.color ?? 'slate',
      managerId: doc.managerId ? doc.managerId.toString() : null, managerName: manager ? (manager.name || manager.email) : '',
      directReports: reports.get(doc._id.toString()) ?? 0,
      status: doc.status === 'suspended' ? 'suspended' : 'active', mustChangePassword: Boolean(doc.mustChangePassword),
      lastLoginAt: doc.lastLoginAt ?? null, createdAt: doc.createdAt ?? null,
    };
  });
}

// Only what the staff table, org chart and drawer show.
const STAFF_FIELDS = { email: 1, name: 1, title: 1, phone: 1, role: 1, roleId: 1, managerId: 1, status: 1, mustChangePassword: 1, lastLoginAt: 1, createdAt: 1 };

export async function listStaff() {
  const docs = await (await admins()).find({ role: { $in: ['admin', 'employee'] } }, { projection: STAFF_FIELDS }).sort({ createdAt: 1 }).toArray();
  return serializeStaff(docs);
}

const isActiveOwner = { $or: [{ roleId: OWNER_ROLE }, { role: 'admin', roleId: { $exists: false } }], status: { $ne: 'suspended' } };

/**
 * Deletes a staff sign-in for good. Refused while anything still points at the person (reports,
 * assigned leads or students, open follow-ups), so nothing is orphaned; suspend is the soft option.
 * Their past actions stay in the activity log, which records the email, not the account.
 */
export async function removeStaff(actor, id) {
  const _id = toObjectId(id);
  const coll = await admins();
  const doc = _id && await coll.findOne({ _id, role: { $in: ['admin', 'employee'] } }, { projection: { email: 1, role: 1, roleId: 1, status: 1 } });
  if (!doc) throw new HttpError(404, 'Staff member not found');
  if (_id.equals(actor._id)) throw new HttpError(403, 'You cannot remove yourself');
  const owner = roleIdOf(doc) === OWNER_ROLE;
  if (owner && !actor.isOwner) throw new HttpError(403, 'Only an owner can remove an owner');
  if (owner && doc.status !== 'suspended' && await coll.countDocuments(isActiveOwner) <= 1) throw new HttpError(409, 'This is the last active owner. Make someone else an owner first.');
  const [reports, leads, students, tasks] = await Promise.all([
    coll.countDocuments({ managerId: _id }),
    (await collection(COLLECTIONS.applications)).countDocuments({ assignedEmployeeIds: _id }, { limit: 10_000 }),
    (await collection(COLLECTIONS.referenceStudents)).countDocuments({ assignedEmployeeIds: _id }, { limit: 10_000 }),
    (await collection(COLLECTIONS.leadTasks)).countDocuments({ assigneeId: _id, doneAt: null }, { limit: 10_000 }),
  ]);
  const plural = (count, one, many) => `${count.toLocaleString('en-IN')} ${count === 1 ? one : many}`;
  const assigned = [leads && plural(leads, 'lead', 'leads'), students && plural(students, 'reference student', 'reference students'), tasks && plural(tasks, 'open follow-up', 'open follow-ups')].filter(Boolean);
  const blockers = [reports && `${plural(reports, 'person reports', 'people report')} to them`, assigned.length && `${assigned.join(', ')} still assigned to them`].filter(Boolean);
  if (blockers.length) throw new HttpError(409, `Cannot remove yet: ${blockers.join('; ')}. Reassign these first, or suspend the account instead.`);
  await coll.deleteOne({ _id });
  await audit(actor, 'staff.delete', { type: 'staff', id: _id, label: doc.email }, { roleId: roleIdOf(doc) });
}

async function assertManager(managerId, { selfId = null } = {}) {
  if (managerId === null || managerId === undefined || managerId === '') return null;
  const id = toObjectId(managerId);
  if (!id) throw new HttpError(400, 'Choose a valid mentor', { fields: { managerId: 'Unknown mentor.' } });
  const manager = await (await admins()).findOne({ _id: id }, { projection: { status: 1 } });
  if (!manager || manager.status === 'suspended') throw new HttpError(400, 'Choose an active mentor', { fields: { managerId: 'Mentor not found or suspended.' } });
  if (selfId) {
    if (id.equals(selfId)) throw new HttpError(400, 'Nobody can mentor themselves', { fields: { managerId: 'Choose someone else.' } });
    if ((await teamMemberIds(selfId)).some((member) => member.equals(id))) throw new HttpError(400, 'That person already reports to them, which would make a loop', { fields: { managerId: 'Would create a loop.' } });
  }
  return id;
}

async function assertAssignableRole(actor, roleId) {
  const role = (await roleMap()).get(roleId);
  if (!role) throw new HttpError(400, 'Choose a valid role', { fields: { roleId: 'Unknown role.' } });
  if (role.slug === OWNER_ROLE && !actor.isOwner) throw new HttpError(403, 'Only an owner can create another owner');
  if (!actor.isOwner) {
    const held = new Set(actor.permissions);
    if ([...expand(role.permissions)].some((key) => !held.has(key))) throw new HttpError(403, 'You cannot assign a role stronger than your own', { fields: { roleId: 'Above your own level.' } });
  }
  return role;
}

export async function createStaff(actor, body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new HttpError(400, 'Enter a valid email address', { fields: { email: 'Enter a valid email address.' } });
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
  if (!PHONE.test(phone)) throw new HttpError(400, 'Enter a valid mobile number', { fields: { phone: 'Use 10 to 15 digits, optionally starting with +.' } });
  assertEmployeePassword(body?.password);
  const role = await assertAssignableRole(actor, body?.roleId || DEFAULT_STAFF_ROLE);
  const managerId = await assertManager(body?.managerId);
  const doc = {
    email, phone, name: String(body?.name ?? '').trim().slice(0, 80), title: String(body?.title ?? '').trim().slice(0, 80),
    role: role.slug === OWNER_ROLE ? 'admin' : 'employee', roleId: role.slug, managerId, status: 'active',
    passwordHash: await hashPassword(body.password), mustChangePassword: true, createdAt: new Date(), lastLoginAt: null,
  };
  try { await (await admins()).insertOne(doc); }
  catch (error) {
    if (error.code === 11000) throw new HttpError(409, 'An account with this email already exists', { fields: { email: 'This email is already in use.' } });
    throw error;
  }
  await audit(actor, 'staff.create', { type: 'staff', id: doc._id, label: email }, { roleId: role.slug });
  return (await serializeStaff([doc]))[0];
}

export async function updateStaff(actor, id, body) {
  const _id = toObjectId(id);
  const coll = await admins();
  const doc = _id && await coll.findOne({ _id }, { projection: { passwordHash: 0 } });
  if (!doc) throw new HttpError(404, 'Staff member not found');
  const isSelf = _id.equals(actor._id);
  const set = {};
  const changes = {};
  if (body?.name !== undefined) set.name = String(body.name).trim().slice(0, 80);
  if (body?.title !== undefined) set.title = String(body.title).trim().slice(0, 80);
  if (body?.phone !== undefined) {
    const phone = String(body.phone).trim();
    if (phone && !PHONE.test(phone)) throw new HttpError(400, 'Enter a valid mobile number', { fields: { phone: 'Use 10 to 15 digits, optionally starting with +.' } });
    set.phone = phone;
  }
  if (body?.roleId !== undefined && body.roleId !== roleIdOf(doc)) {
    if (isSelf) throw new HttpError(403, 'You cannot change your own role');
    const role = await assertAssignableRole(actor, body.roleId);
    if (roleIdOf(doc) === OWNER_ROLE && await coll.countDocuments({ $or: [{ roleId: OWNER_ROLE }, { role: 'admin', roleId: { $exists: false } }], status: { $ne: 'suspended' } }) <= 1) {
      throw new HttpError(409, 'This is the last active owner. Make someone else an owner first.');
    }
    set.roleId = role.slug;
    set.role = role.slug === OWNER_ROLE ? 'admin' : 'employee';
    changes.role = { from: roleIdOf(doc), to: role.slug };
  }
  if (body?.managerId !== undefined) {
    set.managerId = await assertManager(body.managerId, { selfId: _id });
    changes.manager = { to: set.managerId ? String(set.managerId) : null };
  }
  if (body?.status !== undefined && body.status !== (doc.status ?? 'active')) {
    if (!STATUSES.includes(body.status)) throw new HttpError(400, 'Status must be active or suspended');
    if (isSelf) throw new HttpError(403, 'You cannot suspend yourself');
    if (body.status === 'suspended' && roleIdOf(doc) === OWNER_ROLE && await coll.countDocuments({ roleId: OWNER_ROLE, status: { $ne: 'suspended' } }) <= 1) throw new HttpError(409, 'This is the last active owner');
    set.status = body.status;
    changes.status = body.status;
  }
  if (!Object.keys(set).length) return (await serializeStaff([doc]))[0];
  const updated = await coll.findOneAndUpdate({ _id }, { $set: { ...set, updatedAt: new Date() } }, { returnDocument: 'after', projection: { passwordHash: 0 } });
  if (Object.keys(changes).length) await audit(actor, 'staff.update', { type: 'staff', id: _id, label: doc.email }, changes);
  return (await serializeStaff([updated]))[0];
}

export async function resetStaffPassword(actor, id, password) {
  const _id = toObjectId(id);
  assertEmployeePassword(password);
  const coll = await admins();
  const doc = _id && await coll.findOne({ _id }, { projection: { email: 1, roleId: 1, role: 1 } });
  if (!doc) throw new HttpError(404, 'Staff member not found');
  if (roleIdOf(doc) === OWNER_ROLE && !actor.isOwner) throw new HttpError(403, 'Only an owner can reset an owner’s password');
  await coll.updateOne({ _id }, { $set: { passwordHash: await hashPassword(password), mustChangePassword: true, passwordChangedAt: new Date() } });
  await audit(actor, 'staff.password_reset', { type: 'staff', id: _id, label: doc.email });
}
