// Copied from frontend/src/data/landing.js. The first six (landing order) are popular.
const courses = [
  { slug: 'btech', name: 'B.Tech', icon: 'cap', field: 'Engineering', fullName: 'Bachelor of Technology', summary: 'Explore engineering branches, practical learning and technology-focused career paths.' },
  { slug: 'mba', name: 'MBA', icon: 'chart', field: 'Management', fullName: 'Master of Business Administration', summary: 'Explore management specialisations, business skills and leadership-focused study.' },
  { slug: 'bcom', name: 'B.Com', icon: 'document', field: 'Commerce', fullName: 'Bachelor of Commerce', summary: 'Explore accounting, commerce, finance and business-related study options.' },
  { slug: 'bca', name: 'BCA', icon: 'laptop', field: 'Computing', fullName: 'Bachelor of Computer Applications', summary: 'Explore software, computing and application development as a study direction.' },
  { slug: 'mbbs', name: 'MBBS', icon: 'medical', field: 'Medical', fullName: 'Bachelor of Medicine and Bachelor of Surgery', summary: 'Explore medical education and review the official admission requirements before applying.' },
  { slug: 'bdes', name: 'B.Des', icon: 'palette', field: 'Design', fullName: 'Bachelor of Design', summary: 'Explore visual, product, communication and other design-related study areas.' },
  { slug: 'llb', name: 'LL.B', icon: 'scales', field: 'Law', fullName: 'Bachelor of Laws', summary: 'Explore legal study and the different institution-specific routes into a law programme.' },
  { slug: 'bba', name: 'BBA', icon: 'people', field: 'Management', fullName: 'Bachelor of Business Administration', summary: 'Explore business study options and compare individual programme details.' },
  { slug: 'mtech', name: 'M.Tech', icon: 'gear', field: 'Engineering', fullName: 'Master of Technology', summary: 'Explore postgraduate engineering programmes and their institution-specific requirements.' },
  { slug: 'bpharm', name: 'B.Pharm', icon: 'science', field: 'Pharmacy', fullName: 'Bachelor of Pharmacy', summary: 'Review pharmacy programmes, curricula and official admission information.' },
  { slug: 'nursing', name: 'B.Sc Nursing', icon: 'medical', field: 'Healthcare', fullName: '', summary: 'Review nursing programmes and the official requirements of each institution.' },
  { slug: 'ba', name: 'BA', icon: 'book', field: 'Arts', fullName: 'Bachelor of Arts', summary: 'Explore arts subjects and compare programme curricula.' },
  { slug: 'bams', name: 'BAMS', icon: 'medical', field: 'Medical', fullName: '', summary: 'Review the official programme prospectus and admission requirements.' },
  { slug: 'bhms', name: 'BHMS', icon: 'medical', field: 'Medical', fullName: '', summary: 'Review the official programme prospectus and admission requirements.' },
  { slug: 'bds', name: 'BDS', icon: 'medical', field: 'Dentistry', fullName: '', summary: 'Explore dentistry programmes through official institution information.' },
  { slug: 'bhm', name: 'BHM', icon: 'people', field: 'Hospitality', fullName: '', summary: 'Explore hospitality programmes and compare practical learning opportunities.' },
];

// Degree level: general knowledge about Indian degrees, not institution data.
const PG = new Set(['mba', 'mtech']);

export const seedCourses = courses.map((course, order) => ({ ...course, level: PG.has(course.slug) ? 'PG' : 'UG', popular: order < 6, order, active: true }));
