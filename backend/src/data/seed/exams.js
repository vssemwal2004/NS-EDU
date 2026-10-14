// Copied from frontend/src/data/landing.js.
const exams = [
  { slug: 'jee', name: 'JEE Main', field: 'Engineering', icon: 'gear', summary: 'Start with the official eligibility, syllabus and admission information.', href: 'https://jeemain.nta.nic.in/' },
  { slug: 'neet', name: 'NEET UG', field: 'Medical', icon: 'medical', summary: 'Review the official bulletin and participating admission requirements.', href: 'https://neet.nta.nic.in/' },
  { slug: 'cuet', name: 'CUET UG', field: 'Undergraduate', icon: 'book', summary: 'Review subject choices alongside each university’s programme requirements.', href: 'https://cuet.nta.nic.in/' },
  { slug: 'cat', name: 'CAT', field: 'Management', icon: 'chart', summary: 'Use the official exam information and individual programme requirements.', href: 'https://iimcat.ac.in/' },
];

export const seedExams = exams.map((exam, order) => ({ ...exam, order, active: true }));
