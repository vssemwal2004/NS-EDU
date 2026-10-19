// Scholarships, career-guidance and admission-checklist guides: page copy, checklists (item ids key saved ticks), FAQs and tool cards.
export default {
  scopeNote: 'Gyaan Vidhya does not process applications, confirm eligibility or award scholarships.',
  tools: {
    budget: { href: '/budget', icon: 'wallet', title: 'Plan your budget', text: 'Add hostel, travel and one-time costs to the annual tuition.' },
    eligibility: { href: '/eligibility', icon: 'eligibility', title: 'Check eligibility', text: 'See which academic requirements to confirm for a course.' },
    compare: { href: '/compare', icon: 'compare', title: 'Compare colleges', text: 'Put up to three sample colleges side by side.' },
    colleges: { href: '/colleges', icon: 'building', title: 'Find colleges', text: 'Filter sample colleges by course, city and fee.' },
    courses: { href: '/courses', icon: 'book', title: 'Explore courses', text: 'Fields, levels, sample fees and linked exams.' },
    exams: { href: '/exams', icon: 'document', title: 'Exam guides', text: 'Official exam websites and the courses they lead to.' },
    scholarships: { href: '/scholarships', icon: 'cap', title: 'Scholarships & funding', text: 'Funding portals and what to check before applying.' },
    guidance: { href: '/career-guidance', icon: 'compass', title: 'Career guidance', text: 'Questions that help you choose a direction first.' },
    admissions: {
      href: '/admission-checklist',
      icon: 'guidesChecklist',
      title: 'Admission checklist',
      text: 'Documents and details to keep together before applying.',
    },
  },
  guides: {
    scholarships: {
      page: {
        title: 'Scholarships & funding',
        category: 'Plan your education',
        description: 'Explore funding without losing sight of the actual college cost.',
        sections: [
          {
            title: 'Check the right conditions',
            text: 'Look for the course, admission year, income criteria, academic requirements and location rules for each scheme. Note the deadline, required documents and whether renewal has separate conditions.',
            points: [
              'Course, year of study and admission year the scheme covers',
              'Income, category, domicile and academic rules',
              'The official deadline and any separate renewal conditions',
            ],
          },
          {
            title: 'Prepare documents early',
            text: 'Schemes commonly ask for documents such as mark sheets, identity proof, income, category or domicile certificates and bank account details. The exact list differs by scheme, so read each official notice and keep clear copies ready well before the deadline.',
            points: [
              'Keep income and category certificates current where a scheme asks for them',
              'Check the file format and size the portal accepts',
              'Save the application number and acknowledgement',
            ],
          },
          {
            title: 'Keep awards separate from estimated costs',
            text: 'A scholarship application is not an approved award. Plan the amount you need upfront and only adjust your funding plan when the provider confirms the award and payment timing.',
            points: [
              'Plan the full first-year cost before counting any award',
              'Note whether an award covers tuition only or other costs too',
              'Wait for the provider to confirm the award and payment timing',
            ],
            links: [{ label: 'Open the college budget planner', href: '/budget' }],
          },
          {
            title: 'Browse funding resources',
            text: 'Use the provider’s current listing to confirm eligibility and application details.',
            links: [
              { label: 'National Scholarship Portal', href: 'https://scholarships.gov.in/' },
              { label: 'Buddy4Study scholarship listings', href: 'https://www.buddy4study.com/' },
            ],
          },
        ],
      },
      checklist: {
        title: 'Funding checklist',
        intro: 'Tick each step as you research a scheme.',
        note: 'Saved only in this browser. Requirements vary — confirm with the official notice.',
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
        {
          q: 'Does Gyaan Vidhya award or process scholarships?',
          a: 'No. Gyaan Vidhya links to funding portals. Eligibility checks, applications, awards and payments are handled by each provider.',
        },
        {
          q: 'Why are there no amounts or deadlines here?',
          a: 'They change by scheme and year. Showing them without a verified, dated source could mislead you, so confirm them on the provider’s official notice.',
        },
        {
          q: 'Should I count a scholarship in my budget?',
          a: 'Plan with the full cost first and adjust only when the provider confirms the award and payment timing.',
          link: { href: '/budget', label: 'Open the budget planner' },
        },
      ],
      tools: ['budget', 'admissions', 'eligibility', 'colleges'],
      note: 'A searchable scholarship directory will be added in a later release.',
    },
    'career-guidance': {
      page: {
        title: 'Career guidance',
        category: 'Find your direction',
        description: 'Start with a few useful questions rather than a rushed college choice.',
        sections: [
          {
            title: 'What do you enjoy doing?',
            text: 'List the subjects, activities and problems that keep your attention. Think about the kind of everyday work you would enjoy: building, researching, designing, helping people or managing projects.',
            points: [
              'Subjects you enjoy and want to keep studying',
              'The kind of everyday work you like doing',
              'Activities outside class that hold your attention',
            ],
          },
          {
            title: 'Which course opens that path?',
            text: 'Compare programme content, practical learning and the qualifications needed for the roles you want to explore. Consider duration, entry requirements and the possibility of further study.',
            points: [
              'What the curriculum covers year by year',
              'How much practical work, project time or internship is included',
              'The qualification the roles you are curious about ask for',
            ],
            links: [{ label: 'Explore courses & colleges', href: '/colleges' }],
          },
          {
            title: 'What fits your circumstances?',
            text: 'Bring location, total cost and your academic background into the decision. A useful shortlist should explain why each option fits you. Personalised AI career guidance and counselling are planned; they are not active services yet.',
            points: [
              'Duration, total cost and location',
              'Your subjects and marks against the entry requirements',
              'Whether an entrance exam is part of the route',
            ],
            links: [{ label: 'Review academic requirements', href: '/eligibility' }, { label: 'Plan your budget', href: '/budget' }],
          },
        ],
      },
      catalogSection: {
        title: 'Explore courses by field',
        toc: 'Explore by field',
        text: 'Every course Gyaan Vidhya lists, grouped by field. Open a course for its sample colleges, fees and linked exams, or jump straight to the colleges that offer it.',
      },
      checklist: {
        title: 'Questions to ask yourself',
        intro: 'Work through these before you build a shortlist.',
        note: 'Saved only in this browser. Personalised counselling is planned, not active yet.',
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
        {
          q: 'Is there a personalised counselling service?',
          a: 'Not yet. Personalised AI guidance and counselling are planned. For now, use these questions with the course pages and planning tools.',
        },
        {
          q: 'How do I compare courses that lead to similar careers?',
          a: 'Open each course page for its sample colleges, fees and linked exams, then read the official curriculum on the institution’s website.',
          link: { href: '/courses', label: 'Explore courses' },
        },
        {
          q: 'Do I need an entrance exam?',
          a: 'It depends on the course and institution. Some use national exams, others their own tests or merit. Check each college’s official admission page.',
          link: { href: '/exams', label: 'See exam guides' },
        },
      ],
      tools: ['courses', 'eligibility', 'budget', 'colleges'],
      note: 'Personalised counselling and AI guidance are planned for a later release.',
    },
    'admission-checklist': {
      page: {
        title: 'Admission checklist',
        category: 'Prepare your next step',
        description: 'Keep the important details together before applying.',
        sections: [
          {
            title: 'Confirm the programme and admission year',
            text: 'Check the official programme name, campus, mode of study, qualification awarded and academic year. Verify subjects, marks, entrance requirements and relevant category rules.',
            points: [
              'Official programme name and campus',
              'Qualification awarded and course duration',
              'Subject, marks and category rules for your admission year',
            ],
            links: [{ label: 'Check course requirements', href: '/eligibility' }],
          },
          {
            title: 'Track dates and documents',
            text: 'Read the official application notice. Record the submission deadline, test or counselling dates and document requirements. Keep your academic records available and check whether certificates need a specific format or validity period.',
            points: ['Entrance exam and counselling route', 'Submission deadline and test or counselling dates', 'Document list, format and validity period'],
          },
          {
            title: 'Review costs and the application channel',
            text: 'Confirm tuition, living costs, deposits and refund conditions with the institution. Apply through the authorised channel, keep the acknowledgement and retain a copy of the information you submitted.',
            points: ['Fee, deposit and refund terms', 'Hostel, travel and other living costs', 'The authorised application channel'],
            links: [{ label: 'Estimate first-year costs', href: '/budget' }],
          },
        ],
      },
      catalogSection: {
        title: 'Go to the official exam website',
        toc: 'Official exam websites',
        text: 'If your route uses a national entrance exam, read its official information bulletin for eligibility, dates and the documents to bring. Gyaan Vidhya’s exam guides show which courses each exam leads to.',
        links: [{ label: 'All exam guides', href: '/exams' }],
      },
      checklist: {
        title: 'Documents to keep ready',
        intro: 'A general starting list — your institution’s notice is the final word.',
        note: 'Saved only in this browser. Requirements vary — confirm with the official notice.',
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
        {
          q: 'Can I apply through Gyaan Vidhya?',
          a: 'Not yet. Apply through the institution’s or admission authority’s official channel, and keep the acknowledgement.',
        },
        {
          q: 'Which documents do I need exactly?',
          a: 'It depends on the institution, programme and admission route. The official admission notice lists them, including any format or validity rules.',
        },
        {
          q: 'Where is my checklist saved?',
          a: 'Only in this browser. It is not sent to Gyaan Vidhya or synced to an account. Use Clear ticks or clear this site’s browser data to remove it.',
        },
      ],
      tools: ['eligibility', 'budget', 'exams', 'scholarships'],
      note: 'Application submission and tracking will arrive with the admissions workflow.',
    },
  },
};
