// The permission catalogue and the built-in roles of the staff console.
//
// A permission is "<module>.<action>". A role is a named set of permissions; staff hold exactly one
// role. `risk` drives the colours on the access screen: low (green) is read/own-work, medium
// (amber) changes shared data, high (red) can destroy data or widen who sees what.
//
// Lead visibility is a ladder: `leads.view_all` ⊃ `leads.view_team` ⊃ `leads.view_own`. Holding a
// higher rung implies the lower ones, so the matrix never needs all three ticked.

export const PERMISSION_GROUPS = [
  { id: 'leads', label: 'Leads & CRM', icon: 'eligibility' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
  { id: 'students', label: 'Students', icon: 'people' },
  { id: 'catalogue', label: 'Catalogue & data', icon: 'building' },
  { id: 'content', label: 'Content & media', icon: 'edit' },
  { id: 'team', label: 'Team & access', icon: 'support' },
  { id: 'system', label: 'System', icon: 'settings' },
];

// Modules are the rows of the employee access matrix. Each permission sits in one module and one
// column: `view`, `create`, `edit`, `delete`, or `other` (special actions such as assign or export).
// A module with several `view` keys is a ladder (e.g. own → team → all), shown as one choice.
export const PERMISSION_MODULES = [
  { id: 'leads', group: 'leads', label: 'Leads', hint: 'Enquiries from every channel, and the CRM work on them.' },
  { id: 'drives', group: 'leads', label: 'School drives', hint: 'QR registration forms for school visits.' },
  { id: 'analytics', group: 'analytics', label: 'Analytics', hint: 'CRM numbers, the platform dashboard and search insights.' },
  { id: 'ref_students', group: 'students', label: 'Reference students', hint: 'Students added by staff, with follow-up notes.' },
  { id: 'accounts', group: 'students', label: 'Student accounts', hint: 'Students who signed up on the website.' },
  { id: 'catalogue', group: 'catalogue', label: 'Universities & courses', hint: 'Universities, programmes, courses, exams and scholarships.' },
  { id: 'locations', group: 'catalogue', label: 'Cities & states', hint: 'City and state destinations shown on the site.' },
  { id: 'career', group: 'catalogue', label: 'Career fields & counsellors', hint: 'The career guidance page and its counsellors.' },
  { id: 'data', group: 'catalogue', label: 'Data pipeline', hint: 'Imports, the review queue and the website crawler.' },
  { id: 'content', group: 'content', label: 'Site content', hint: 'Page copy, homepage sections and site images.' },
  { id: 'reviews', group: 'content', label: 'Student reviews', hint: 'Reviews written by students before they go live.' },
  { id: 'media', group: 'content', label: 'Media library', hint: 'Images used across the site.' },
  { id: 'privacy', group: 'system', label: 'Privacy requests', hint: 'Data requests and grievances from students and parents.' },
  { id: 'team', group: 'team', label: 'Team', hint: 'Employee accounts. Only the master admin changes what employees may do.' },
  { id: 'settings', group: 'system', label: 'Settings', hint: 'Lead distribution and platform settings.' },
  { id: 'audit', group: 'system', label: 'Activity log', hint: 'Who changed access, deleted or exported data.' },
];
const moduleGroup = new Map(PERMISSION_MODULES.map((module) => [module.id, module.group]));
export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'other'];

// `alias`: an older all-in-one key kept so stored grants, roles and older code keep working. It expands to the full
// set of new keys and is held automatically by anyone who holds that whole set. Aliases are never shown or stored.
const p = (key, module, action, label, hint, risk = 'low', implies = [], extra = {}) => ({
  key, module, action, group: moduleGroup.get(module), label, hint, risk, implies, ...extra,
});
const alias = (key, module, label, implies) => p(key, module, 'other', label, 'Older all-in-one permission.', 'high', implies, { alias: true });
const crud = (module, noun, { view, create, edit, remove }) => [
  p(`${module}.view`, module, 'view', `See ${noun}`, view, 'low'),
  p(`${module}.create`, module, 'create', `Add ${noun}`, create, 'medium', [`${module}.view`]),
  p(`${module}.edit`, module, 'edit', `Edit ${noun}`, edit, 'medium', [`${module}.view`]),
  p(`${module}.delete`, module, 'delete', `Delete ${noun}`, remove, 'high', [`${module}.view`]),
];

export const PERMISSIONS = [
  p('leads.view_own', 'leads', 'view', 'See leads assigned to them', 'Only leads where they are an assignee.'),
  p('leads.view_team', 'leads', 'view', 'See their team’s leads', 'Leads assigned to anyone who reports to them.', 'low', ['leads.view_own']),
  p('leads.view_all', 'leads', 'view', 'See every lead', 'All channels, all schools, all employees.', 'medium', ['leads.view_team', 'leads.view_own']),
  p('leads.create', 'leads', 'create', 'Add leads by hand', 'Create a lead from a call, walk-in or CSV upload.', 'medium', ['leads.view_own']),
  p('leads.edit', 'leads', 'edit', 'Edit lead details', 'Change name, phone, city, class and preferences of leads they can see.', 'medium', ['leads.view_own']),
  p('leads.delete', 'leads', 'delete', 'Delete leads', 'Move leads they can see to the bin (restorable). Only the master admin deletes for good.', 'high', ['leads.view_own']),
  p('leads.change_status', 'leads', 'other', 'Change stage', 'Move leads through the pipeline, e.g. Contacted → In progress.', 'medium'),
  p('leads.notes', 'leads', 'other', 'Log calls, notes and follow-ups', 'Add timeline entries and schedule follow-ups.'),
  p('crm.heat', 'leads', 'other', 'Set temperature and priority', 'Mark a lead Hot / Warm / Cold and set priority.'),
  p('leads.assign', 'leads', 'other', 'Assign leads', 'Give leads to employees.', 'medium'),
  p('leads.bulk', 'leads', 'other', 'Bulk actions', 'Act on up to 100 leads at once (each action still needs its own permission).', 'medium'),
  p('leads.export', 'leads', 'other', 'Download leads', 'CSV, Excel and PDF exports with personal data.', 'high'),
  p('leads.contact_reveal_all', 'leads', 'other', 'See every lead’s full phone and email', 'Without it, phone and email are masked on leads not assigned to them; each reveal is logged.', 'high'),
  p('tasks.manage_team', 'leads', 'other', 'Manage their team’s follow-ups', 'See, create and reassign follow-up tasks for the team.', 'medium'),

  ...crud('drives', 'school drives', {
    view: 'Drive list, QR codes and how many students registered.',
    create: 'Create a new drive and its QR registration form.',
    edit: 'Change drive details and open or close the form.',
    remove: 'Delete drives (their leads stay). Only the master admin deletes for good.',
  }),

  p('analytics.view_own', 'analytics', 'view', 'Own performance', 'Their own numbers on the CRM dashboard.'),
  p('analytics.view_team', 'analytics', 'view', 'Team performance', 'Numbers for everyone who reports to them.', 'low', ['analytics.view_own']),
  p('analytics.view_all', 'analytics', 'view', 'Company-wide analytics', 'Every channel, school and employee.', 'medium', ['analytics.view_team', 'analytics.view_own']),
  p('analytics.search', 'analytics', 'other', 'Student search insights', 'What students search and view on the site.', 'medium'),
  p('dashboard.view', 'analytics', 'other', 'Platform dashboard', 'Site-wide activity at a glance.', 'medium'),

  p('students.view_assigned', 'ref_students', 'view', 'Reference students assigned to them', 'Students assigned to them or added by them, and their follow-up notes.'),
  p('students.view_all', 'ref_students', 'view', 'Every reference student', 'All reference students, whoever added them.', 'medium', ['students.view_assigned']),
  p('students.create', 'ref_students', 'create', 'Add reference students', 'Add one or upload many.', 'medium', ['students.view_assigned']),
  p('students.edit', 'ref_students', 'edit', 'Edit reference students', 'Change name, email and phone of students they can see.', 'medium', ['students.view_assigned']),
  p('students.delete', 'ref_students', 'delete', 'Delete reference students', 'Removes the student and their follow-up notes for good.', 'high', ['students.view_assigned']),
  p('students.assign', 'ref_students', 'other', 'Assign reference students', 'Give reference students to employees.', 'medium', ['students.view_all']),

  p('accounts.view', 'accounts', 'view', 'See student accounts', 'Every student who signed up, with contact details.', 'medium'),
  p('accounts.edit', 'accounts', 'edit', 'Block or unblock student accounts', 'Stops or restores a student’s sign-in.', 'high', ['accounts.view']),
  p('accounts.assign', 'accounts', 'other', 'Assign student accounts', 'Give student accounts to employees for follow-up.', 'medium', ['accounts.view']),

  ...crud('catalogue', 'universities and courses', {
    view: 'Open the admin lists of universities, programmes, courses, exams and scholarships.',
    create: 'Add universities, programmes, courses, exams and scholarships.',
    edit: 'Change and publish directory records.',
    remove: 'Delete directory records from the website.',
  }),
  ...crud('locations', 'cities and states', {
    view: 'Open the admin lists of cities and states.',
    create: 'Add city and state destinations.',
    edit: 'Change featured places and their images.',
    remove: 'Delete city and state destinations.',
  }),
  ...crud('career', 'career fields and counsellors', {
    view: 'Open the admin lists of career fields and counsellors.',
    create: 'Add career fields and counsellors.',
    edit: 'Change career fields and counsellor details.',
    remove: 'Delete career fields and counsellors.',
  }),
  p('data.view', 'data', 'view', 'See the data pipeline', 'Coverage, review queue, crawler status and the universities CSV export.', 'low'),
  p('data.create', 'data', 'create', 'Import data', 'Bulk CSV/JSON imports and new crawl sources.', 'high', ['data.view']),
  p('data.edit', 'data', 'edit', 'Run the pipeline', 'Publish or hide records in the review queue, edit sources, start, retry or cancel crawls.', 'high', ['data.view']),
  p('data.delete', 'data', 'delete', 'Delete crawl sources', 'Removes a crawl source and stops it being crawled.', 'high', ['data.view']),

  p('content.view', 'content', 'view', 'See site content', 'Open the page copy editor without saving.'),
  p('content.edit', 'content', 'edit', 'Edit site content', 'Change page copy and homepage sections; restore older versions.', 'medium', ['content.view']),
  p('reviews.view', 'reviews', 'view', 'See student reviews', 'All reviews, including ones waiting for a check.'),
  p('reviews.moderate', 'reviews', 'edit', 'Publish or reject reviews', 'Approve, reject and feature reviews on the homepage.', 'medium', ['reviews.view']),
  p('reviews.delete', 'reviews', 'delete', 'Delete reviews', 'Removes a review for good.', 'high', ['reviews.view']),
  p('media.view', 'media', 'view', 'See the media library', 'Browse uploaded images.'),
  p('media.upload', 'media', 'create', 'Upload images', 'Add images to the library.', 'medium', ['media.view']),
  p('media.delete', 'media', 'delete', 'Delete images', 'Removes an image from storage; pages using it lose it.', 'high', ['media.view']),

  // Owners hold it automatically; give it to others deliberately.
  p('privacy.view', 'privacy', 'view', 'See privacy requests', 'Data requests and grievances, with the requester’s details.', 'medium'),
  p('privacy.manage', 'privacy', 'edit', 'Act on privacy requests', 'Data-subject requests and grievances: see requesters and matched leads, resolve, stop contact, anonymise.', 'high', ['privacy.view']),

  p('team.view', 'team', 'view', 'See the team', 'Names, contact details and status of employees (no passwords).'),
  p('team.manage', 'team', 'other', 'Create and manage staff', 'Add employees, edit their details, suspend, remove and reset passwords. Access changes stay with the master admin.', 'high', ['team.view']),
  p('roles.manage', 'team', 'other', 'Edit roles', 'Older role editor; roles no longer decide what employees can do.', 'high', [], { legacy: true }),

  p('settings.manage', 'settings', 'edit', 'Platform settings', 'Lead distribution rules and platform status.', 'medium'),
  p('audit.view', 'audit', 'view', 'Activity log', 'Who changed access, deleted or exported leads.', 'medium'),

  // Older all-in-one keys (see `alias` above).
  alias('drives.manage', 'drives', 'School drives (all)', ['drives.view', 'drives.create', 'drives.edit', 'drives.delete']),
  alias('career.manage', 'career', 'Career guidance (all)', ['career.view', 'career.create', 'career.edit', 'career.delete']),
  alias('data.manage', 'data', 'Data pipeline (all)', ['data.view', 'data.create', 'data.edit', 'data.delete']),
  alias('media.manage', 'media', 'Media library (all)', ['media.view', 'media.upload', 'media.delete']),
  alias('students.manage', 'accounts', 'Students (all)', ['students.view_all', 'students.create', 'students.edit', 'students.delete', 'students.assign', 'accounts.view', 'accounts.edit', 'accounts.assign']),
];

export const PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key);
const byKey = new Map(PERMISSIONS.map((permission) => [permission.key, permission]));
export const isPermission = (key) => byKey.has(key);
/** Keys an owner can hand to an employee (aliases and the retired role editor are not). */
export const GRANTABLE_KEYS = PERMISSIONS.filter((permission) => !permission.alias && !permission.legacy).map((permission) => permission.key);
const grantable = new Set(GRANTABLE_KEYS);
const ALIASES = PERMISSIONS.filter((permission) => permission.alias);

/**
 * Expands implied permissions: holding view_all also grants view_team and view_own, edit grants view,
 * an alias grants its whole set. An alias is also held by anyone who holds every key it stands for.
 */
export function expand(keys) {
  const out = new Set();
  const visit = (key) => {
    if (out.has(key) || !byKey.has(key)) return;
    out.add(key);
    byKey.get(key).implies.forEach(visit);
  };
  keys.forEach(visit);
  for (const item of ALIASES) if (!out.has(item.key) && item.implies.every((key) => out.has(key))) out.add(item.key);
  return out;
}

/** What gets stored on an employee: the expanded, grantable keys in catalogue order. Throws on unknown keys. */
export function normalizeGrants(keys) {
  if (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string' || !isPermission(key))) {
    throw Object.assign(new Error('Unknown permission in the list'), { unknownPermission: true });
  }
  const set = expand(keys);
  return GRANTABLE_KEYS.filter((key) => set.has(key));
}

/**
 * The grants after a bulk change. `add` merges; `remove` also drops anything that depends on a removed key
 * (removing "See school drives" removes "Edit school drives" too); `replace` sets the list as given.
 */
export function mergeGrants(current, mode, keys) {
  const asked = normalizeGrants(keys);
  if (mode === 'replace') return asked;
  const base = normalizeGrants(current ?? []);
  if (mode === 'add') return normalizeGrants([...base, ...asked]);
  if (mode === 'remove') {
    const removed = new Set(keys.flatMap((key) => (byKey.get(key)?.alias ? byKey.get(key).implies : [key])));
    return base.filter((key) => !removed.has(key) && ![...expand([key])].some((implied) => removed.has(implied)));
  }
  throw Object.assign(new Error('Mode must be add, remove or replace'), { badMode: true });
}

/** The before/after difference written to the activity log. */
export function grantDiff(before, after) {
  const was = new Set(before ?? []);
  const now = new Set(after ?? []);
  return { granted: [...now].filter((key) => !was.has(key)), revoked: [...was].filter((key) => !now.has(key)) };
}

export const isGrantable = (key) => grantable.has(key);

// Built-in roles. `owner` is locked: it always holds everything, including permissions added later.
export const SYSTEM_ROLES = [
  {
    slug: 'owner', name: 'Owner', color: 'wine', locked: true,
    description: 'Full control of the console, including roles and billing-style settings. Cannot be edited.',
    permissions: ['*'],
  },
  {
    slug: 'team-lead', name: 'Team lead (mentor)', color: 'blue', locked: false,
    description: 'Mentors a team of counsellors: sees and assigns their leads, follows up, and tracks team performance.',
    permissions: ['leads.view_team', 'leads.create', 'leads.edit', 'leads.change_status', 'leads.notes', 'crm.heat', 'leads.assign', 'leads.bulk',
      'tasks.manage_team', 'analytics.view_team', 'students.view_assigned', 'students.create', 'team.view'],
  },
  {
    slug: 'executive', name: 'Counsellor (executive)', color: 'green', locked: false,
    description: 'Works the leads assigned to them: calls, notes, follow-ups, status and temperature.',
    permissions: ['leads.view_own', 'leads.change_status', 'leads.notes', 'crm.heat', 'analytics.view_own', 'students.view_assigned', 'students.create'],
  },
  {
    slug: 'analyst', name: 'Analyst (read-only)', color: 'purple', locked: false,
    description: 'Sees every lead and every dashboard, can download reports, cannot change anything.',
    permissions: ['leads.view_all', 'leads.export', 'analytics.view_all', 'analytics.search', 'dashboard.view', 'team.view'],
  },
  {
    slug: 'data-editor', name: 'Content & data editor', color: 'amber', locked: false,
    description: 'Maintains the university directory, imports, drives and site content. No access to leads.',
    permissions: ['catalogue.edit', 'locations.edit', 'career.manage', 'drives.manage', 'data.manage', 'content.edit', 'media.manage', 'dashboard.view'],
  },
];

export const ROLE_COLORS = ['wine', 'blue', 'green', 'amber', 'red', 'purple', 'teal', 'slate'];
export const DEFAULT_STAFF_ROLE = 'executive';
export const OWNER_ROLE = 'owner';
// Employee access is chosen per person by the master admin (stored on the staff doc as `access.permissions`).
// Someone with no saved choice gets these day-to-day defaults: work their own leads, but no create, edit or
// delete anywhere. Create / edit / delete stay with the master admin until they hand them out.
export const DEFAULT_EMPLOYEE_PERMISSIONS = [
  'leads.view_own', 'leads.change_status', 'leads.notes', 'crm.heat', 'analytics.view_own', 'students.view_assigned',
];
/** @deprecated Older name; employees now hold their own grants or DEFAULT_EMPLOYEE_PERMISSIONS. */
export const EMPLOYEE_PERMISSIONS = DEFAULT_EMPLOYEE_PERMISSIONS;

// Starting points offered in the access editor. They only fill the matrix; nothing is linked to them afterwards.
export const ACCESS_PRESETS = [
  { id: 'counsellor', label: 'Counsellor default', hint: 'Works the leads assigned to them. No create, edit or delete.', permissions: DEFAULT_EMPLOYEE_PERMISSIONS },
  {
    id: 'lead-manager', label: 'Lead manager', hint: 'Sees every lead with full create, edit and delete, assigns and bulk-acts. No downloads.',
    permissions: ['leads.view_all', 'leads.create', 'leads.edit', 'leads.delete', 'leads.change_status', 'leads.notes', 'crm.heat', 'leads.assign',
      'leads.bulk', 'tasks.manage_team', 'analytics.view_all', 'students.view_assigned'],
  },
];
