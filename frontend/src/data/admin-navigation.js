// Admin sidebar. `resource` entries are managed by the generic resource screen at /admin/[resource].
export const adminNavigation = [
  { label: 'Overview', items: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard', adminOnly: true, description: 'Platform activity at a glance' },
    { label: 'Search insights', href: '/admin/insights', icon: 'trend', adminOnly: true, description: 'What students search and view, and the gaps in the directory' },
  ] },
  { label: 'Catalogue', items: [
    { label: 'Universities', href: '/admin/institutions', icon: 'building', resource: 'institutions', adminOnly: true, description: 'Search, edit and publish 20k+ universities and colleges' },
    { label: 'Programmes', href: '/admin/programmes', icon: 'layers', resource: 'programmes', adminOnly: true, description: 'Course offerings, fees and placements' },
    { label: 'Courses', href: '/admin/courses', icon: 'book', resource: 'courses', adminOnly: true, description: 'Course directory and popular courses' },
    { label: 'Exams', href: '/admin/exams', icon: 'document', resource: 'exams', adminOnly: true, description: 'Entrance exam guides' },
  ] },
  { label: 'Data', items: [
    { label: 'Data overview', href: '/admin/data', icon: 'chart', adminOnly: true, description: 'Coverage, review backlog and scraper status' },
    { label: 'Import universities', href: '/admin/data/import', icon: 'document', adminOnly: true, description: 'Bulk CSV or JSON import with a dry run' },
    { label: 'Scraper', href: '/admin/data/scraper', icon: 'guidesGlobe', adminOnly: true, description: 'Official-website crawl sources and job queue' },
    { label: 'Review queue', href: '/admin/data/review', icon: 'collegesCheckCircle', adminOnly: true, description: 'Verify, publish or hide imported and scraped records' },
  ] },
  { label: 'Locations', items: [
    { label: 'Cities', href: '/admin/cities', icon: 'location', resource: 'cities', adminOnly: true, description: 'City destinations and featured tiles' },
    { label: 'States', href: '/admin/states', icon: 'map', resource: 'states', adminOnly: true, description: 'State destinations and featured tiles' },
  ] },
  { label: 'Admissions', items: [
    { label: 'Leads', href: '/admin/leads', icon: 'eligibility', description: 'Applications submitted through the Apply flow' },
    { label: 'Leads dashboard', href: '/admin/leads/dashboard', icon: 'chart', description: 'Daily lead volume, sources, funnel and team workload' },
    { label: 'School drives', href: '/admin/drives', icon: 'building', adminOnly: true, description: 'QR registration forms for school visits, grouped by state and district' },
  ] },
  { label: 'Career guidance', items: [
    { label: 'Career fields', href: '/admin/career_fields', icon: 'compass', resource: 'career_fields', adminOnly: true, description: 'Fields students pick on the career guidance page' },
    { label: 'Counsellors', href: '/admin/counsellors', icon: 'support', resource: 'counsellors', adminOnly: true, description: 'Counsellors per field; logged-in students see their numbers' },
  ] },
  { label: 'Students & funding', items: [
    { label: 'Student accounts', href: '/admin/students', icon: 'people', adminOnly: true, description: 'Student accounts and access' },
    { label: 'Add student', href: '/admin/reference-students/new', icon: 'people', description: 'Add or upload reference students' },
    { label: 'View students', href: '/admin/reference-students', icon: 'people', description: 'Assigned students and follow-up notes' },
    { label: 'Scholarships', href: '/admin/scholarships', icon: 'cap', resource: 'scholarships', adminOnly: true, description: 'Funding resources' },
  ] },
  { label: 'System', items: [
    { label: 'Add employee', href: '/admin/employees', icon: 'people', adminOnly: true, description: 'Create employee accounts' },
    { label: 'Site content', href: '/admin/content', icon: 'edit', adminOnly: true, description: 'Page copy, homepage, tools and site images' },
    { label: 'Media library', href: '/admin/media', icon: 'layers', adminOnly: true, description: 'Images stored on Cloudinary' },
    { label: 'Settings', href: '/admin/settings', icon: 'settings', adminOnly: true, description: 'Your session and platform status' },
  ] },
];

export const adminPages = adminNavigation.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
export const findAdminPage = (pathname) => adminPages.find((item) => pathname === item.href)
  || adminPages.find((item) => pathname.startsWith(`${item.href}/`));
