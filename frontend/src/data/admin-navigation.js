// Admin sidebar. `resource` entries are managed by the generic resource screen at /admin/[resource].
export const adminNavigation = [
  { label: 'Overview', items: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard', description: 'Platform activity at a glance' },
  ] },
  { label: 'Catalogue', items: [
    { label: 'Colleges', href: '/admin/institutions', icon: 'building', resource: 'institutions', description: 'Institutions shown to students' },
    { label: 'Programmes', href: '/admin/programmes', icon: 'layers', resource: 'programmes', description: 'Course offerings, fees and placements' },
    { label: 'Courses', href: '/admin/courses', icon: 'book', resource: 'courses', description: 'Course directory and popular courses' },
    { label: 'Exams', href: '/admin/exams', icon: 'document', resource: 'exams', description: 'Entrance exam guides' },
  ] },
  { label: 'Locations', items: [
    { label: 'Cities', href: '/admin/cities', icon: 'location', resource: 'cities', description: 'City destinations and featured tiles' },
    { label: 'States', href: '/admin/states', icon: 'map', resource: 'states', description: 'State destinations and featured tiles' },
  ] },
  { label: 'Students & funding', items: [
    { label: 'Students', href: '/admin/students', icon: 'people', description: 'Student accounts and access' },
    { label: 'Scholarships', href: '/admin/scholarships', icon: 'cap', resource: 'scholarships', description: 'Funding resources' },
  ] },
  { label: 'System', items: [
    { label: 'Settings', href: '/admin/settings', icon: 'settings', description: 'Your session and platform status' },
  ] },
];

export const adminPages = adminNavigation.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
export const findAdminPage = (pathname) => adminPages.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
