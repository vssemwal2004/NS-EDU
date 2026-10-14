// Guide configuration: checklists (stable ids for saved ticks), FAQs and related tools.
// Copy stays general — no amounts, deadlines or named schemes beyond the catalogue links.

export const slugify = (text) => String(text).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const hostname = (href) => { try { return new URL(href).hostname.replace(/^www\./, ''); } catch { return ''; } };
export const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

export const tools = {
  budget: { href: '/budget', icon: 'wallet', title: 'Plan your budget', text: 'Add hostel, travel and one-time costs to the annual tuition.' },
  eligibility: { href: '/eligibility', icon: 'eligibility', title: 'Check eligibility', text: 'See which academic requirements to confirm for a course.' },
  compare: { href: '/compare', icon: 'compare', title: 'Compare colleges', text: 'Put up to three sample colleges side by side.' },
  colleges: { href: '/colleges', icon: 'building', title: 'Find colleges', text: 'Filter sample colleges by course, city and fee.' },
  courses: { href: '/courses', icon: 'book', title: 'Explore courses', text: 'Fields, levels, sample fees and linked exams.' },
  exams: { href: '/exams', icon: 'document', title: 'Exam guides', text: 'Official exam websites and the courses they lead to.' },
  scholarships: { href: '/scholarships', icon: 'cap', title: 'Scholarships & funding', text: 'Funding portals and what to check before applying.' },
  guidance: { href: '/career-guidance', icon: 'compass', title: 'Career guidance', text: 'Questions that help you choose a direction first.' },
  admissions: { href: '/admission-checklist', icon: 'guidesChecklist', title: 'Admission checklist', text: 'Documents and details to keep together before applying.' },
};

const savedNote = 'Saved only in this browser. Requirements vary — confirm with the official notice.';

export const guides = {
  scholarships: {
    checklist: {
      title: 'Funding checklist', intro: 'Tick each step as you research a scheme.', note: savedNote,
      items: [
        { id: 'find-schemes', label: 'Find schemes for your course and year', hint: 'Institution, government and other programmes' },
        { id: 'check-eligibility', label: 'Check income, category and academic rules' },
        { id: 'note-deadline', label: 'Note the official deadline' },
        { id: 'list-documents', label: 'List the documents each scheme asks for' },
        { id: 'check-coverage', label: 'Confirm what the award covers', hint: 'Tuition only, or other costs too' },
        { id: 'check-renewal', label: 'Read the renewal conditions' },
        { id: 'keep-acknowledgement', label: 'Save the application acknowledgement' },
      ],
    },
    faqs: [
      { q: 'Does NSEDU award or process scholarships?', a: 'No. NSEDU links to funding portals. Eligibility checks, applications, awards and payments are handled by each provider.' },
      { q: 'Why are there no amounts or deadlines here?', a: 'They change by scheme and year. Showing them without a verified, dated source could mislead you, so confirm them on the provider’s official notice.' },
      { q: 'Should I count a scholarship in my budget?', a: 'Plan with the full cost first and adjust only when the provider confirms the award and payment timing.', link: { href: '/budget', label: 'Open the budget planner' } },
    ],
    tools: ['budget', 'admissions', 'eligibility', 'colleges'],
  },
  'career-guidance': {
    checklist: {
      title: 'Questions to ask yourself', intro: 'Work through these before you build a shortlist.', note: 'Saved only in this browser. Personalised counselling is planned, not active yet.',
      items: [
        { id: 'subjects', label: 'Which subjects do I enjoy most?' },
        { id: 'everyday-work', label: 'What kind of everyday work suits me?', hint: 'Building, researching, designing, helping or managing' },
        { id: 'courses', label: 'Which two or three courses lead there?' },
        { id: 'curriculum', label: 'Have I read each course’s curriculum?' },
        { id: 'requirements', label: 'Do I meet the entry requirements?' },
        { id: 'cost-location', label: 'Do the duration, cost and location work for me?' },
        { id: 'talk', label: 'Have I talked it through with someone I trust?', hint: 'A teacher, a family member or someone working in the field' },
      ],
    },
    faqs: [
      { q: 'Is there a personalised counselling service?', a: 'Not yet. Personalised AI guidance and counselling are planned. For now, use these questions with the course pages and planning tools.' },
      { q: 'How do I compare courses that lead to similar careers?', a: 'Open each course page for its sample colleges, fees and linked exams, then read the official curriculum on the institution’s website.', link: { href: '/courses', label: 'Explore courses' } },
      { q: 'Do I need an entrance exam?', a: 'It depends on the course and institution. Some use national exams, others their own tests or merit. Check each college’s official admission page.', link: { href: '/exams', label: 'See exam guides' } },
    ],
    tools: ['courses', 'eligibility', 'budget', 'colleges'],
  },
  'admission-checklist': {
    checklist: {
      title: 'Documents to keep ready', intro: 'A general starting list — your institution’s notice is the final word.', note: savedNote,
      items: [
        { id: 'marksheets', label: 'Class 10 and 12 mark sheets and certificates' },
        { id: 'identity', label: 'Identity proof' },
        { id: 'photographs', label: 'Recent passport-size photographs' },
        { id: 'scorecard', label: 'Entrance exam scorecard', hint: 'If your admission route uses one' },
        { id: 'certificates', label: 'Category, income or domicile certificate', hint: 'If it applies to you' },
        { id: 'transfer', label: 'Transfer or migration certificate', hint: 'If the institution asks for it' },
        { id: 'acknowledgement', label: 'Copy of the submitted application and acknowledgement' },
      ],
    },
    faqs: [
      { q: 'Can I apply through NSEDU?', a: 'Not yet. Apply through the institution’s or admission authority’s official channel, and keep the acknowledgement.' },
      { q: 'Which documents do I need exactly?', a: 'It depends on the institution, programme and admission route. The official admission notice lists them, including any format or validity rules.' },
      { q: 'Where is my checklist saved?', a: 'Only in this browser. It is not sent to NSEDU or synced to an account. Use Clear ticks or clear this site’s browser data to remove it.' },
    ],
    tools: ['eligibility', 'budget', 'exams', 'scholarships'],
  },
};

export const scopeNote = 'NSEDU does not process applications, confirm eligibility or award scholarships.';
