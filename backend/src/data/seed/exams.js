// Copied from frontend/src/data/landing.js. `courseSlugs` are the courses each exam is commonly used for
// (general knowledge — verify against each official bulletin); `level` is the admission level.
const exams = [
  { slug: 'jee', name: 'JEE Main', field: 'Engineering', icon: 'gear', summary: 'Start with the official eligibility, syllabus and admission information.', href: 'https://jeemain.nta.nic.in/', level: 'UG', courseSlugs: ['btech'] },
  { slug: 'neet', name: 'NEET UG', field: 'Medical', icon: 'medical', summary: 'Review the official bulletin and participating admission requirements.', href: 'https://neet.nta.nic.in/', level: 'UG', courseSlugs: ['mbbs', 'bds', 'bams', 'bhms'] },
  { slug: 'cuet', name: 'CUET UG', field: 'Undergraduate', icon: 'book', summary: 'Review subject choices alongside each university’s programme requirements.', href: 'https://cuet.nta.nic.in/', level: 'UG', courseSlugs: ['ba', 'bcom', 'bba', 'bca'], note: 'Participating universities decide which programmes use CUET UG scores — check each university.' },
  { slug: 'cat', name: 'CAT', field: 'Management', icon: 'chart', summary: 'Use the official exam information and individual programme requirements.', href: 'https://iimcat.ac.in/', level: 'PG', courseSlugs: ['mba'] },
];

export const seedExams = exams.map((exam, order) => ({ note: '', ...exam, order, active: true }));
