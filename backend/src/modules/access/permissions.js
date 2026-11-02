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

const p = (key, group, label, hint, risk = 'low', implies = []) => ({ key, group, label, hint, risk, implies });

export const PERMISSIONS = [
  p('leads.view_own', 'leads', 'See leads assigned to them', 'Only leads where they are an assignee.'),
  p('leads.view_team', 'leads', 'See their team’s leads', 'Leads assigned to anyone who reports to them.', 'low', ['leads.view_own']),
  p('leads.view_all', 'leads', 'See every lead', 'All channels, all schools, all employees.', 'medium', ['leads.view_team', 'leads.view_own']),
  p('leads.create', 'leads', 'Add leads by hand', 'Create a lead from a call, walk-in or list.', 'medium'),
  p('leads.edit', 'leads', 'Edit lead details', 'Change name, phone, city, preferences.', 'medium'),
  p('leads.change_status', 'leads', 'Move leads through the pipeline', 'Change status, e.g. Contacted → In progress.', 'medium'),
  p('leads.notes', 'leads', 'Log calls, notes and follow-ups', 'Add timeline entries and schedule follow-ups.'),
  p('crm.heat', 'leads', 'Set lead temperature and priority', 'Mark a lead Hot / Warm / Cold and set priority.'),
  p('leads.assign', 'leads', 'Assign leads', 'Give leads to employees (team leads: only their team).', 'medium'),
  p('leads.bulk', 'leads', 'Bulk actions', 'Act on up to 100 leads at once.', 'medium'),
  p('leads.export', 'leads', 'Download leads', 'CSV, Excel and PDF exports with personal data.', 'high'),
  p('leads.delete', 'leads', 'Delete leads', 'Move leads to the bin; owners can purge them.', 'high'),
  p('tasks.manage_team', 'leads', 'Manage their team’s follow-ups', 'See, create and reassign follow-up tasks for the team.', 'medium'),

  p('analytics.view_own', 'analytics', 'Own performance', 'Their own numbers on the CRM dashboard.'),
  p('analytics.view_team', 'analytics', 'Team performance', 'Numbers for everyone who reports to them.', 'low', ['analytics.view_own']),
  p('analytics.view_all', 'analytics', 'Company-wide analytics', 'Every channel, school and employee.', 'medium', ['analytics.view_team', 'analytics.view_own']),
  p('analytics.search', 'analytics', 'Student search insights', 'What students search and view on the site.', 'medium'),
  p('dashboard.view', 'analytics', 'Platform dashboard', 'Site-wide activity at a glance.', 'medium'),

  p('students.view_assigned', 'students', 'Reference students assigned to them', 'Their own list and follow-up notes.'),
  p('students.create', 'students', 'Add reference students', 'Add one or upload many.', 'medium'),
  p('students.manage', 'students', 'Student accounts', 'Block, unblock and assign student accounts.', 'high'),

  p('catalogue.edit', 'catalogue', 'Universities, programmes, courses, exams', 'Edit the public directory.', 'medium'),
  p('locations.edit', 'catalogue', 'Cities and states', 'Featured places and their images.', 'medium'),
  p('career.manage', 'catalogue', 'Career fields and counsellors', 'The counsellor directory shown to students.', 'medium'),
  p('drives.manage', 'catalogue', 'School drives and QR forms', 'Create, edit and delete drive forms.', 'medium'),
  p('data.manage', 'catalogue', 'Import, scraper and review queue', 'Bulk imports and the crawler.', 'high'),

  p('content.edit', 'content', 'Site content', 'Page copy and homepage sections.', 'medium'),
  p('media.manage', 'content', 'Media library', 'Upload and delete images.', 'medium'),

  p('team.view', 'team', 'See the team', 'Names, roles and mentors (no passwords).'),
  p('team.manage', 'team', 'Create and manage staff', 'Add staff, assign roles and mentors, suspend, reset passwords.', 'high'),
  p('roles.manage', 'team', 'Edit roles and permissions', 'Change what every role can do.', 'high'),

  p('settings.manage', 'system', 'Platform settings', 'Session and platform status.', 'medium'),
  p('audit.view', 'system', 'Activity log', 'Who changed access, deleted or exported leads.', 'medium'),
];

export const PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key);
const byKey = new Map(PERMISSIONS.map((permission) => [permission.key, permission]));
export const isPermission = (key) => byKey.has(key);

/** Expands implied permissions: holding view_all also grants view_team and view_own. */
export function expand(keys) {
  const out = new Set();
  const visit = (key) => {
    if (out.has(key) || !byKey.has(key)) return;
    out.add(key);
    byKey.get(key).implies.forEach(visit);
  };
  keys.forEach(visit);
  return out;
}

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
