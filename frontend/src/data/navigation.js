// Public site navigation. Groups with `panel` render catalogue-driven mega menus
// (components/layout/header); groups with `items` render the compact panel.
export const primaryNavigation = [
  { label: 'Colleges', href: '/colleges', match: ['/colleges', '/locations'], panel: 'colleges' },
  { label: 'Courses', href: '/courses', match: ['/courses'], panel: 'courses' },
  { label: 'Exams', href: '/exams', match: ['/exams'], panel: 'exams' },
  { label: 'Compare', href: '/compare', match: ['/compare'], badge: 'compare' },
  { label: 'Scholarships', href: '/scholarships', match: ['/scholarships'] },
  { label: 'Career guidance', href: '/career-guidance', match: ['/career-guidance'] },
  { label: 'Resources', href: '/eligibility', match: ['/eligibility', '/budget', '/admission-checklist', '/news', '/sources-and-editorial'], items: [
    { label: 'Check eligibility', href: '/eligibility', icon: 'eligibility', description: 'Match your academic profile' },
    { label: 'Check college budget', href: '/budget', icon: 'wallet', description: 'Tuition, stay and other costs' },
    { label: 'Admission checklist', href: '/admission-checklist', icon: 'document', description: 'Prepare before you apply' },
    { label: 'Scholarships & funding', href: '/scholarships', icon: 'spark', description: 'Official scholarship portals' },
    { label: 'Education news', href: '/news', icon: 'news', description: 'Latest updates and articles' },
    { label: 'Exam guides', href: '/exams', icon: 'compass', description: 'Official entrance exam links' },
    { label: 'Sources & editorial', href: '/sources-and-editorial', icon: 'book', description: 'How NSEDU uses its sources' },
  ], feature: { eyebrow: 'Plan ahead', title: 'Can you afford it?', text: 'See tuition, living and one-time costs together.', href: '/budget', action: 'Check budget' } },
];

export const utilityLinks = [
  { label: 'Education news', href: '/news', icon: 'news' },
  { label: 'Help centre', href: '/help', icon: 'support' },
];

// Course-aware tools; the header appends ?course=<id> for the active stream or preference.
export const courseTools = [
  { label: 'Compare colleges', href: '/compare', icon: 'scales', description: 'Up to three side by side' },
  { label: 'Check eligibility', href: '/eligibility', icon: 'eligibility', description: 'Marks and subject check' },
  { label: 'Plan your budget', href: '/budget', icon: 'wallet', description: 'Tuition, stay and extras' },
];

// Mobile drawer groups that are not catalogue-driven.
export const drawerGroups = [
  { title: 'Student tools', icon: 'compass', links: [
    { label: 'Compare colleges', href: '/compare', icon: 'scales', course: true },
    { label: 'Check eligibility', href: '/eligibility', icon: 'eligibility', course: true },
    { label: 'Plan your budget', href: '/budget', icon: 'wallet', course: true },
    { label: 'Admission checklist', href: '/admission-checklist', icon: 'document' },
    { label: 'Scholarships & funding', href: '/scholarships', icon: 'spark' },
    { label: 'Career guidance', href: '/career-guidance', icon: 'trend' },
  ] },
  { title: 'Resources', icon: 'book', links: [
    { label: 'Education news', href: '/news', icon: 'news' },
    { label: 'Help centre & FAQs', href: '/help', icon: 'support' },
    { label: 'Sources & editorial', href: '/sources-and-editorial', icon: 'book' },
  ] },
];

// Streams without a fitting course icon get a clearer one here.
export const fieldIcons = { Engineering: 'gear', Commerce: 'commerce', Healthcare: 'heart', Dentistry: 'medical', Hospitality: 'building' };

export const isActivePath = (pathname, item) => item.match?.some((path) => pathname === path || pathname.startsWith(`${path}/`));
