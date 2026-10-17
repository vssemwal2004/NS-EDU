// Admin sidebar. `resource` entries are managed by the generic resource screen at /admin/[resource].
export const adminNavigation = [
  { label: 'Overview', items: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard', adminOnly: true, description: 'Platform activity at a glance' },
  ] },
  { label: 'Catalogue', items: [
    { label: 'Colleges', href: '/admin/institutions', icon: 'building', resource: 'institutions', adminOnly: true, description: 'Institutions shown to students' },
    { label: 'Programmes', href: '/admin/programmes', icon: 'layers', resource: 'programmes', adminOnly: true, description: 'Course offerings, fees and placements' },
    { label: 'Courses', href: '/admin/courses', icon: 'book', resource: 'courses', adminOnly: true, description: 'Course directory and popular courses' },
    { label: 'Exams', href: '/admin/exams', icon: 'document', resource: 'exams', adminOnly: true, description: 'Entrance exam guides' },
  ] },
  { label: 'Locations', items: [
    { label: 'Cities', href: '/admin/cities', icon: 'location', resource: 'cities', adminOnly: true, description: 'City destinations and featured tiles' },
    { label: 'States', href: '/admin/states', icon: 'map', resource: 'states', adminOnly: true, description: 'State destinations and featured tiles' },
  ] },
  { label: 'Students & funding', items: [
    { label: 'Student accounts', href: '/admin/students', icon: 'people', adminOnly: true, description: 'Student accounts and access' },
    { label: 'Add student', href: '/admin/reference-students/new', icon: 'people', description: 'Add or upload reference students' },
    { label: 'View students', href: '/admin/reference-students', icon: 'people', description: 'Assigned students and follow-up notes' },
    { label: 'Scholarships', href: '/admin/scholarships', icon: 'cap', resource: 'scholarships', adminOnly: true, description: 'Funding resources' },
  ] },
  { label: 'System', items: [
    { label: 'Add employee', href: '/admin/employees', icon: 'people', adminOnly: true, description: 'Create employee accounts' },
    { label: 'Settings', href: '/admin/settings', icon: 'settings', adminOnly: true, description: 'Your session and platform status' },
  ] },
];

export const adminPages = adminNavigation.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
export const findAdminPage = (pathname) => adminPages.find((item) => pathname === item.href)
  || adminPages.find((item) => pathname.startsWith(`${item.href}/`));
