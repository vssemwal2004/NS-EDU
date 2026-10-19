// Public information architecture, shared by the header, the mobile menu sheet and the search panel.
// `menu` items open a light dropdown on desktop; everything else is a plain link.
// `match` lists the path prefixes that mark an item as the current section.

export const toolLinks = [
  { label: 'Check eligibility', href: '/eligibility', icon: 'eligibility', description: 'Match your marks and subjects' },
  { label: 'Plan your budget', href: '/budget', icon: 'wallet', description: 'Tuition, stay and one-time costs' },
  { label: 'Admission checklist', href: '/admission-checklist', icon: 'document', description: 'Documents to prepare early' },
  { label: 'Career guidance', href: '/career-guidance', icon: 'trend', description: 'Courses, careers and next steps' },
];

export const primaryNavigation = [
  { id: 'universities', label: 'Universities', href: '/universities', icon: 'building', match: ['/universities', '/colleges', '/apply', '/search', '/locations'] },
  { id: 'courses', label: 'Courses', href: '/courses', icon: 'layers', match: ['/courses'], menu: 'courses' },
  { id: 'exams', label: 'Exams', href: '/exams', icon: 'document', match: ['/exams'], menu: 'exams' },
  { id: 'compare', label: 'Compare', href: '/compare', icon: 'scales', match: ['/compare'], badge: 'compare' },
  { id: 'tools', label: 'Tools', href: '/eligibility', icon: 'compass', match: toolLinks.map((link) => link.href), menu: 'tools' },
  { id: 'scholarships', label: 'Scholarships', href: '/scholarships', icon: 'spark', match: ['/scholarships'] },
  { id: 'news', label: 'News', href: '/news', icon: 'news', match: ['/news'] },
];

// Quiet links at the foot of the mobile menu sheet.
export const supportLinks = [
  { label: 'Help centre', href: '/help' },
  { label: 'About us', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export const isActivePath = (pathname, item) => item.match?.some((path) => pathname === path || pathname.startsWith(`${path}/`));
