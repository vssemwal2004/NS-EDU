// Copied from frontend/src/data/budget.js.
const scholarships = [
  { slug: 'national-scholarship-portal', label: 'National Scholarship Portal', href: 'https://scholarships.gov.in/', description: 'Browse government schemes and their official requirements.' },
  { slug: 'buddy4study', label: 'Buddy4Study', href: 'https://www.buddy4study.com/', description: 'Discover scholarship listings; confirm terms with the provider.' },
];

export const seedScholarships = scholarships.map((item, order) => ({ ...item, order, active: true }));
