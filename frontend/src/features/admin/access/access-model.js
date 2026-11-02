// Pure helpers for the Team & access screens: permission maths, plain-language wording, the activity
// log sentences and the temporary-password generator. No React in here.
import { displayName } from '@/features/admin/crm/format';

export const RISK = {
  low: { label: 'Low', tone: 'good', icon: 'check', words: 'Everyday work on their own data' },
  medium: { label: 'Medium', tone: 'warn', icon: 'alert', words: 'Changes shared data or widens what they can see' },
  high: { label: 'High', tone: 'bad', icon: 'alert', words: 'Can destroy data, export personal data or change who has access' },
};
export const RISK_ORDER = { low: 0, medium: 1, high: 2 };

// Lead and analytics visibility are ladders: a higher rung includes the lower ones.
export const LADDERS = {
  leads: {
    id: 'leads', title: 'Lead visibility', question: 'Which leads can this role open?',
    keys: ['leads.view_own', 'leads.view_team', 'leads.view_all'],
    steps: [
      { value: 0, label: 'None', words: 'No access to leads at all.' },
      { value: 1, label: 'Own', words: 'Only leads assigned to the person.' },
      { value: 2, label: 'Team', words: 'Their own leads and the leads of everyone who reports to them.' },
      { value: 3, label: 'All', words: 'Every lead from every channel, school and employee.' },
    ],
  },
  analytics: {
    id: 'analytics', title: 'Analytics visibility', question: 'Whose numbers can this role see?',
    keys: ['analytics.view_own', 'analytics.view_team', 'analytics.view_all'],
    steps: [
      { value: 0, label: 'None', words: 'No CRM dashboard.' },
      { value: 1, label: 'Own', words: 'Only their own performance numbers.' },
      { value: 2, label: 'Team', words: 'Their own numbers and their team’s.' },
      { value: 3, label: 'All', words: 'Company-wide numbers for every channel, school and employee.' },
    ],
  },
};
export const LADDER_KEYS = new Set([...LADDERS.leads.keys, ...LADDERS.analytics.keys]);

export const LEAD_SCOPE_WORDS = { all: 'Every lead in the company', team: 'Your own leads and your team’s', own: 'Only leads assigned to you', none: 'No leads' };
export const ANALYTICS_SCOPE_WORDS = { all: 'Company-wide numbers', team: 'Your own numbers and your team’s', own: 'Only your own numbers', none: 'No CRM analytics' };

// What a set of permissions lets someone change, in plain words, biggest first.
const MANAGES = [
  ['team.manage', 'staff accounts'], ['roles.manage', 'roles'], ['leads.assign', 'lead assignment'], ['tasks.manage_team', 'team follow-ups'],
  ['students.manage', 'student accounts'], ['catalogue.edit', 'the university directory'], ['drives.manage', 'school drives'], ['data.manage', 'imports'],
  ['content.edit', 'site content'], ['media.manage', 'media'], ['settings.manage', 'settings'],
];
export function managesWords(set) {
  const items = MANAGES.filter(([key]) => set.has(key)).map(([, words]) => words);
  if (!items.length) return set.has('leads.edit') || set.has('leads.change_status') || set.has('leads.notes') ? 'Your own lead work only' : 'Nothing: your access is view-only';
  const text = items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
  return text[0].toUpperCase() + text.slice(1);
}

/** "31 Oct, 4:05 pm" (year added when it is not this year); '' for no date. */
export function shortDateTime(value, now = new Date()) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  return `${day}, ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
}

export const catalogueIndex =(catalogue) => new Map((catalogue?.permissions ?? []).map((permission) => [permission.key, permission]));

/** Every permission a list of keys really grants: ladders expand downwards and "*" means everything. */
export function effectiveKeys(keys, catalogue) {
  const index = catalogueIndex(catalogue);
  const out = new Set();
  const visit = (key) => {
    if (out.has(key) || !index.has(key)) return;
    out.add(key);
    index.get(key).implies.forEach(visit);
  };
  if (keys?.includes('*')) index.forEach((_, key) => out.add(key));
  else (keys ?? []).forEach(visit);
  return out;
}

/** The signed-in person's permission set (owners hold everything). */
export const adminKeys = (admin, catalogue) => effectiveKeys(admin?.isOwner ? ['*'] : admin?.permissions ?? [], catalogue);

/** 0 none, 1 own, 2 team, 3 all: the highest rung of a ladder in a permission set. */
export function ladderLevel(keys, ladder) {
  const set = keys instanceof Set ? keys : new Set(keys);
  for (let level = 3; level >= 1; level -= 1) if (set.has(LADDERS[ladder].keys[level - 1])) return level;
  return 0;
}

/** Stores a ladder as its single highest rung; the server expands the rungs below it. */
export function withLadder(keys, ladder, level) {
  const next = new Set(keys);
  LADDERS[ladder].keys.forEach((key) => next.delete(key));
  if (level > 0) next.add(LADDERS[ladder].keys[level - 1]);
  return next;
}
export const normaliseKeys = (keys) => {
  let next = new Set(keys);
  for (const ladder of Object.keys(LADDERS)) next = withLadder(next, ladder, ladderLevel(next, ladder));
  return next;
};
export const sameKeys = (a, b) => a.size === b.size && [...a].every((key) => b.has(key));

export function groupPermissions(catalogue) {
  return (catalogue?.groups ?? []).map((group) => ({ ...group, permissions: catalogue.permissions.filter((permission) => permission.group === group.id) })).filter((group) => group.permissions.length);
}

export const scopeOf = (level) => ['none', 'own', 'team', 'all'][level];

/** Lower ladder rungs are implied by the top one; lists show only the top rung. */
export function withoutLowerRungs(keys) {
  const set = keys instanceof Set ? keys : new Set(keys);
  const hidden = new Set();
  for (const ladder of Object.values(LADDERS)) {
    const level = ladderLevel(set, ladder.id);
    ladder.keys.forEach((key, index) => { if (index + 1 < level) hidden.add(key); });
  }
  return (permission) => !hidden.has(permission.key);
}

/** One-line description of a role's reach, used in the role list and drawers. */
export function reachWords(keys) {
  const set = keys instanceof Set ? keys : new Set(keys);
  const leads = ['No leads', 'Own leads', 'Team’s leads', 'All leads'][ladderLevel(set, 'leads')];
  const analytics = ['no analytics', 'own numbers', 'team numbers', 'company numbers'][ladderLevel(set, 'analytics')];
  return `${leads} · ${analytics}`;
}

// ---- Staff guards (mirror the server's rules so menus can explain, not just fail) ----------------------------------

const plural2 = (count, one, many) => `${count} ${count === 1 ? one : many}`;
export const activeOwners = (staff) => staff.filter((person) => person.roleId === 'owner' && person.status === 'active').length;

/** Why an action on `person` is not possible for `admin` right now ('' = allowed). */
export function staffBlocks(admin, person, staff) {
  const self = person.id === admin.id;
  const owner = person.roleId === 'owner';
  const lastOwner = owner && person.status === 'active' && activeOwners(staff) <= 1 ? 'This is the last active owner. Make someone else an owner first.' : '';
  return {
    role: self ? 'You cannot change your own role.' : lastOwner,
    password: owner && !admin.isOwner ? 'Only an owner can reset an owner’s password.' : '',
    suspend: self ? 'You cannot suspend yourself.' : lastOwner,
    remove: self ? 'You cannot remove yourself.' : owner && !admin.isOwner ? 'Only an owner can remove an owner.' : lastOwner
      || (person.directReports ? `${plural2(person.directReports, 'person reports', 'people report')} to them. Give them another mentor first.` : ''),
  };
}

/** Roles this admin may hand out: never the Owner role unless they are an owner, never above their own level. */
export function assignableRole(admin, role, catalogue) {
  if (admin.isOwner) return '';
  if (role.slug === 'owner') return 'Only an owner can make someone an owner.';
  const held = new Set(admin.permissions ?? []);
  return [...effectiveKeys(role.permissions, catalogue)].every((key) => held.has(key)) ? '' : 'Above your own level.';
}

// ---- Temporary passwords -----------------------------------------------------------------------------------------

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SPECIAL = '@#$%&*!?';
const pick = (pool, random) => pool[random % pool.length];

/** 12 characters, always with an upper-case letter, a lower-case letter, a digit and a special character. */
export function generatePassword(length = 12) {
  const bytes = new Uint32Array(length + 4);
  window.crypto.getRandomValues(bytes);
  const all = UPPER + LOWER + DIGITS + SPECIAL;
  const chars = [pick(UPPER, bytes[0]), pick(LOWER, bytes[1]), pick(DIGITS, bytes[2]), pick(SPECIAL, bytes[3])];
  for (let index = 4; index < length + 4; index += 1) chars.push(pick(all, bytes[index]));
  // Shuffle with a second round of randomness so the guaranteed characters are not always first.
  const order = new Uint32Array(chars.length);
  window.crypto.getRandomValues(order);
  return chars.map((char, index) => [order[index], char]).sort((a, b) => a[0] - b[0]).map(([, char]) => char).slice(0, length).join('');
}
export const passwordProblem = (value) => (typeof value !== 'string' || value.length < 8 ? 'Use at least 8 characters.'
  : value.length > 200 ? 'Use at most 200 characters.'
    : !/[A-Z]/.test(value) ? 'Add an upper-case letter.'
      : !/[a-z]/.test(value) ? 'Add a lower-case letter.'
        : !/[^A-Za-z0-9\s]/.test(value) ? 'Add a special character such as @ or #.' : '');

export async function copyText(text) {
  try { await window.navigator.clipboard.writeText(text); return true; } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.append(area); area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch { return false; }
  }
}

// ---- Activity log wording ----------------------------------------------------------------------------------------

// Action filter: the value is a prefix the server matches (`role.` = every role change).
export const AUDIT_ACTIONS = [
  { label: 'Roles', options: [['role.', 'Any role change'], ['role.create', 'Role created'], ['role.update', 'Role edited'], ['role.delete', 'Role deleted']] },
  { label: 'Staff', options: [['staff.', 'Any staff change'], ['staff.create', 'Staff added'], ['staff.update', 'Staff updated'], ['staff.password_reset', 'Password reset'], ['staff.delete', 'Staff removed']] },
  { label: 'Leads', options: [['lead.', 'Any lead change'], ['lead.create', 'Lead added'], ['lead.delete', 'Lead moved to bin'], ['lead.restore', 'Lead restored'], ['lead.purge', 'Lead deleted for good'], ['lead.bulk_', 'Bulk lead action']] },
];

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * Turns one audit row into { icon, tone, text, detail }.
 * `names` = { role: slug → name, staff: id → name } resolve ids the API only stores as ids or slugs.
 */
export function describeAudit(row, { catalogue, roleName = () => '', staffName = () => '' } = {}) {
  const { action, targetLabel: target = '', meta = {} } = row;
  const label = (key) => catalogueIndex(catalogue).get(key)?.label ?? key;
  const role = (slug) => roleName(slug) || slug;
  switch (action) {
    case 'role.create': return { icon: 'plus', tone: 'good', text: `Created the role ${target}`, detail: typeof meta.permissions === 'number' ? `Starts with ${plural(meta.permissions, 'permission')}.` : '' };
    case 'role.update': {
      const granted = meta.granted ?? [];
      const revoked = meta.revoked ?? [];
      const parts = [];
      if (granted.length) parts.push(`Granted ${plural(granted.length, 'permission')} to ${target}`);
      if (revoked.length) parts.push(`${granted.length ? 'revoked' : 'Revoked'} ${plural(revoked.length, 'permission')}${granted.length ? '' : ` from ${target}`}`);
      const detail = [granted.length ? `Granted: ${granted.map(label).join(', ')}` : '', revoked.length ? `Revoked: ${revoked.map(label).join(', ')}` : ''].filter(Boolean).join(' · ');
      const high = [...granted, ...revoked].some((key) => catalogueIndex(catalogue).get(key)?.risk === 'high');
      return { icon: 'key', tone: high ? 'bad' : 'warn', text: parts.length ? parts.join(', ') : `Edited the name, colour or description of ${target}`, detail };
    }
    case 'role.delete': return { icon: 'trash', tone: 'bad', text: `Deleted the role ${target}`, detail: '' };
    case 'staff.create': return { icon: 'plus', tone: 'good', text: `Added ${target} as ${role(meta.roleId)}`, detail: '' };
    case 'staff.delete': return { icon: 'trash', tone: 'bad', text: `Removed ${target}`, detail: meta.roleId ? `Was ${role(meta.roleId)}.` : '' };
    case 'staff.password_reset': return { icon: 'lock', tone: 'warn', text: `Reset the password of ${target}`, detail: 'They must choose a new one at their next sign-in.' };
    case 'staff.update': {
      const parts = [];
      let tone = 'info';
      let icon = 'edit';
      if (meta.status === 'suspended') { parts.push(`Suspended ${target}`); tone = 'bad'; icon = 'lock'; }
      if (meta.status === 'active') { parts.push(`Restored ${target}`); tone = 'good'; icon = 'check'; }
      if (meta.role) { parts.push(`Changed role of ${target} from ${role(meta.role.from)} to ${role(meta.role.to)}`); if (tone === 'info') { tone = 'warn'; icon = 'key'; } }
      if (meta.manager) parts.push(meta.manager.to ? `Set the mentor of ${target} to ${staffName(meta.manager.to) || 'a team lead'}` : `Removed the mentor of ${target}`);
      return { icon, tone, text: parts.join('; ') || `Updated ${target}`, detail: '' };
    }
    case 'lead.create': return { icon: 'plus', tone: 'good', text: `Added lead ${target}`, detail: '' };
    case 'lead.delete': return { icon: 'trash', tone: 'bad', text: `Moved lead ${target} to the bin`, detail: meta.name ? `Applicant: ${meta.name}` : '' };
    case 'lead.restore': return { icon: 'refresh', tone: 'good', text: `Restored lead ${target || ''} from the bin`.replace('  ', ' '), detail: '' };
    case 'lead.purge': return { icon: 'trash', tone: 'bad', text: `Permanently deleted lead ${target}`, detail: 'This cannot be undone.' };
    default:
      if (action?.startsWith('lead.bulk_')) {
        const what = action.slice('lead.bulk_'.length);
        const delet = what === 'delete';
        return { icon: delet ? 'trash' : 'layers', tone: delet ? 'bad' : 'warn', text: `Bulk ${what} on ${plural(meta.count ?? 0, 'lead')}${meta.value && !delet ? ` (${meta.value})` : ''}`, detail: '' };
      }
      return { icon: 'history', tone: 'neutral', text: action || 'Unknown action', detail: target };
  }
}

export const whoLabel = (email) => (email === 'system' ? 'System' : displayName(email));
