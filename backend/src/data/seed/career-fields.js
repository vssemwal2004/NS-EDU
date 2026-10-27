// Starter career fields for /career-guidance. No counsellors are seeded: the admin adds real people.
const fields = [
  { slug: 'technology-engineering', name: 'Technology & Engineering', icon: 'laptop', description: 'Engineering branches, computer science, IT and applied sciences: entrance routes, specialisations and where they lead.' },
  { slug: 'medical-health-sciences', name: 'Medical & Health Sciences', icon: 'medical', description: 'Medicine, dentistry, nursing, pharmacy and allied health: NEET and other routes, and the many roles beyond MBBS.' },
  { slug: 'commerce-accounting', name: 'Commerce & Accounting', icon: 'commerce', description: 'B.Com, CA, CS, CMA, finance and business degrees: what each path involves and how long it takes.' },
  { slug: 'arts-design-humanities', name: 'Arts, Design & Humanities', icon: 'palette', description: 'Design, media, law, languages, social sciences and the liberal arts: portfolios, entrance tests and careers.' },
];

export const seedCareerFields = fields.map((item, order) => ({ ...item, order, active: true }));
