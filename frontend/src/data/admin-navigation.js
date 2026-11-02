// Admin information architecture. The sidebar lists sections; a section with `tabs` shows them as a
// tab bar in the page header, so related screens (e.g. Cities and States) share one sidebar entry.
// An entry or tab is shown only to staff holding at least one of its `permissions`
// (see backend/src/modules/access/permissions.js); the API enforces the same rules.
// `resource` tabs are managed by the generic resource screen at /admin/[resource].
const LEADS_VIEW = ['leads.view_own', 'leads.view_team', 'leads.view_all'];
const ANALYTICS = ['analytics.view_own', 'analytics.view_team', 'analytics.view_all'];
const STUDENTS = ['students.view_assigned', 'students.manage', 'students.create'];

export const adminNavigation = [
  { label: 'Workspace', items: [
    // Open to all staff: /api/admin/home gates each section by permission.
    { label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard', description: "Today's numbers, what needs attention and your follow-ups" },
    { label: 'My day', href: '/admin/my-day', icon: 'calendar', permissions: ['leads.notes'], badge: 'followUps', description: 'Follow-ups due, overdue and the hot leads waiting for a call' },
  ] },
  { label: 'Leads & CRM', items: [
    { label: 'Leads', href: '/admin/leads', icon: 'eligibility', permissions: LEADS_VIEW, description: 'Every lead you can see, with filters, temperature and follow-ups', tabs: [
      { label: 'All leads', href: '/admin/leads', icon: 'eligibility', permissions: LEADS_VIEW, description: 'Every lead you can see, with filters, temperature and follow-ups' },
      { label: 'Pipeline', href: '/admin/leads/board', icon: 'board', permissions: LEADS_VIEW, description: 'Leads by stage, best first; drag a card to move it' },
      { label: 'Bin', href: '/admin/leads/trash', icon: 'trash', permissions: ['leads.delete'], description: 'Deleted leads that can still be restored' },
    ] },
    { label: 'Analytics', href: '/admin/crm', icon: 'chart', permissions: [...ANALYTICS, 'analytics.search'], description: 'How leads, the team and the site are performing', tabs: [
      { label: 'CRM performance', href: '/admin/crm', icon: 'chart', permissions: ANALYTICS, description: 'Pipeline health, response time, team performance and lead temperature' },
      { label: 'Lead volume', href: '/admin/leads/dashboard', icon: 'bars', permissions: ANALYTICS, description: 'Daily lead volume, sources, places and funnel' },
      { label: 'Search insights', href: '/admin/insights', icon: 'trend', permissions: ['analytics.search'], description: 'What students search and view, and the gaps in the directory' },
    ] },
    { label: 'School drives', href: '/admin/drives', icon: 'building', permissions: ['drives.manage'], description: 'QR registration forms for school visits, grouped by state and district' },
  ] },
  { label: 'Students', items: [
    { label: 'Students', href: '/admin/reference-students', icon: 'people', permissions: STUDENTS, description: 'Reference students, follow-up notes and student accounts', tabs: [
      { label: 'Reference students', href: '/admin/reference-students', icon: 'people', permissions: ['students.view_assigned', 'students.manage'], description: 'Assigned students and follow-up notes' },
      { label: 'Add students', href: '/admin/reference-students/new', icon: 'userPlus', permissions: ['students.create'], description: 'Add one student or upload many' },
      { label: 'Student accounts', href: '/admin/students', icon: 'user', permissions: ['students.manage'], description: 'Student sign-in accounts and access' },
    ] },
  ] },
  { label: 'Catalogue', items: [
    { label: 'Universities & courses', href: '/admin/institutions', icon: 'building', permissions: ['catalogue.edit'], description: 'The public directory', tabs: [
      { label: 'Universities', href: '/admin/institutions', resource: 'institutions', icon: 'building', permissions: ['catalogue.edit'], description: 'Search, edit and publish 20k+ universities and colleges' },
      { label: 'Programmes', href: '/admin/programmes', resource: 'programmes', icon: 'layers', permissions: ['catalogue.edit'], description: 'Course offerings, fees and placements' },
      { label: 'Courses', href: '/admin/courses', resource: 'courses', icon: 'book', permissions: ['catalogue.edit'], description: 'Course directory and popular courses' },
      { label: 'Exams', href: '/admin/exams', resource: 'exams', icon: 'document', permissions: ['catalogue.edit'], description: 'Entrance exam guides' },
      { label: 'Scholarships', href: '/admin/scholarships', resource: 'scholarships', icon: 'cap', permissions: ['catalogue.edit'], description: 'Funding resources' },
    ] },
    { label: 'Locations', href: '/admin/cities', icon: 'location', permissions: ['locations.edit'], description: 'City and state destinations shown on the site', tabs: [
      { label: 'Cities', href: '/admin/cities', resource: 'cities', icon: 'location', permissions: ['locations.edit'], description: 'City destinations and featured tiles' },
      { label: 'States', href: '/admin/states', resource: 'states', icon: 'map', permissions: ['locations.edit'], description: 'State destinations and featured tiles' },
    ] },
    { label: 'Career guidance', href: '/admin/career_fields', icon: 'compass', permissions: ['career.manage'], description: 'Career fields and the counsellors students can call', tabs: [
      { label: 'Career fields', href: '/admin/career_fields', resource: 'career_fields', icon: 'compass', permissions: ['career.manage'], description: 'Fields students pick on the career guidance page' },
      { label: 'Counsellors', href: '/admin/counsellors', resource: 'counsellors', icon: 'support', permissions: ['career.manage'], description: 'Counsellors per field; logged-in students see their numbers' },
    ] },
    { label: 'Data pipeline', href: '/admin/data', icon: 'layers', permissions: ['data.manage'], description: 'Imports, the official-website crawler and the review queue', tabs: [
      { label: 'Overview', href: '/admin/data', icon: 'chart', permissions: ['data.manage'], description: 'Coverage, review backlog and scraper status' },
      { label: 'Review queue', href: '/admin/data/review', icon: 'collegesCheckCircle', permissions: ['data.manage'], description: 'Verify, publish or hide imported and scraped records' },
      { label: 'Scraper', href: '/admin/data/scraper', icon: 'guidesGlobe', permissions: ['data.manage'], description: 'Official-website crawl sources and job queue' },
      { label: 'Import', href: '/admin/data/import', icon: 'upload', permissions: ['data.manage'], description: 'Bulk CSV or JSON import with a dry run' },
    ] },
  ] },
  { label: 'Administration', items: [
    { label: 'Team & access', href: '/admin/access', icon: 'key', permissions: ['team.view', 'team.manage', 'roles.manage', 'audit.view'], description: 'Staff, roles, mentors and who can do what' },
    { label: 'Site content', href: '/admin/content', icon: 'edit', permissions: ['content.edit'], description: 'Page copy, homepage, tools and site images' },
    { label: 'Media library', href: '/admin/media', icon: 'archive', permissions: ['media.manage'], description: 'Images stored on Cloudinary' },
    { label: 'Settings', href: '/admin/settings', icon: 'settings', permissions: ['settings.manage'], description: 'Your session and platform status' },
  ] },
];

const holds = (admin, key) => Boolean(admin?.isOwner || admin?.permissions?.includes(key));
export const canOpen = (admin, page) => !page?.permissions || page.permissions.some((key) => holds(admin, key));

/** Every screen (sections without tabs, and each tab), with its section and group. */
export const adminPages = adminNavigation.flatMap((group) => group.items.flatMap((item) => (item.tabs
  ? item.tabs.map((tab) => ({ ...tab, group: group.label, section: item }))
  : [{ ...item, group: group.label, section: item }])));

/** The screen a path belongs to: an exact match, else the longest prefix (e.g. /admin/leads/GV-1 → All leads). */
export const findAdminPage = (pathname) => adminPages.find((item) => pathname === item.href)
  || adminPages.filter((item) => pathname.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];

/** Sidebar sections and their tabs, filtered to what this person may open. */
export function navigationFor(admin) {
  return adminNavigation.map((group) => ({
    ...group,
    items: group.items.map((item) => (item.tabs ? { ...item, tabs: item.tabs.filter((tab) => canOpen(admin, tab)) } : item))
      .filter((item) => canOpen(admin, item) && (!item.tabs || item.tabs.length))
      // A section opens on its first tab this person may see.
      .map((item) => (item.tabs ? { ...item, href: item.tabs[0].href } : item)),
  })).filter((group) => group.items.length);
}

/** Where a person lands after signing in: the first thing their role is actually for. */
export function homeFor(admin) {
  const order = ['/admin/dashboard', '/admin/my-day', '/admin/crm', '/admin/leads', '/admin/reference-students', '/admin/institutions', '/admin/access', '/admin/settings'];
  for (const href of order) if (canOpen(admin, adminPages.find((page) => page.href === href))) return href;
  return adminPages.find((page) => canOpen(admin, page))?.href ?? '/admin/change-password';
}
