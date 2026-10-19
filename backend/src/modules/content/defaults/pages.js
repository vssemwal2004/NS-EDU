// Supporting pages served at /<slug> (about, contact, help, legal drafts...) plus their card lists.
export default {
  pages: {
    about: {
      title: 'About Gyaan Vidhya',
      category: 'Our purpose',
      description: 'Clearer information for a thoughtful college choice.',
      sections: [
        {
          title: 'Start with what matters to you',
          text: 'Your course, location, academic background and budget belong in the same conversation. Gyaan Vidhya brings discovery, comparison and planning together so you can understand your options before taking the next step.',
        },
        {
          title: 'Understand the details',
          text: 'Explore study destinations, compare course-level information, check academic requirements and work through a first-year budget. Our current college and planning examples are illustrative; confirm institution-specific facts before applying.',
        },
        {
          title: 'Stay informed',
          text: 'Education updates link back to their original publishers, with sources and dates visible. Our goal is to help you ask better questions and make your own informed choice.',
          links: [{ label: 'Explore the student platform', href: '/' }, { label: 'Our sources & editorial approach', href: '/sources-and-editorial' }],
        },
      ],
    },
    contact: {
      title: 'Contact & support',
      category: 'Here to help',
      description: 'Find the right next step for a question, correction or collaboration.',
      sections: [
        {
          title: 'Student questions',
          text: 'For help choosing a course, comparing colleges or using the planning tools, start with the help centre. Admission decisions, eligibility confirmation and application status must come from the institution or official admission authority.',
          links: [{ label: 'Open help centre & FAQs', href: '/help' }],
        },
        {
          title: 'Corrections & collaborations',
          text: 'Include the relevant page URL, the information you want to discuss and a supporting source. Do not include passwords, identity documents or payment details in an initial enquiry.',
          links: [{ label: 'What to include in a correction', href: '/report-correction' }],
        },
      ],
    },
    help: {
      title: 'Help centre & FAQs',
      category: 'Student support',
      description: 'Practical answers to help you explore Gyaan Vidhya.',
      sections: [
        {
          title: 'How do I compare colleges?',
          text: 'Open the course-wise college section, choose a course and select Compare on the colleges you want to review. Compare information with the same fee period and academic year. The present college records are examples.',
          links: [{ label: 'Open college comparison', href: '/colleges' }],
        },
        {
          title: 'Does the eligibility checker guarantee admission?',
          text: 'No. It helps you review academic requirements using the current sample profiles. Admission depends on official rules, entrance results, seat availability and other institution-specific conditions.',
          links: [{ label: 'Check course requirements', href: '/eligibility' }],
        },
        {
          title: 'Are the colleges on Gyaan Vidhya real?',
          text: 'No. The college directory uses fictional sample institutions with illustrative fees, salaries and demo ratings to show how the tools work. They are not a ranking, a verified fee quote or an offer.',
          links: [{ label: 'Our sources & editorial approach', href: '/sources-and-editorial' }],
        },
        {
          title: 'Can I save an education article?',
          text: 'Use its bookmark icon. Saved stories stay in this browser and can be removed in the Saved view. Clearing browser site data removes the reading list. Logging in does not sync saved stories to other devices yet.',
          links: [{ label: 'Open education news & articles', href: '/news' }],
        },
        {
          title: 'Where are my checklist ticks kept?',
          text: 'The checklists on the scholarships, career guidance and admission checklist guides save your ticks in this browser only. Use Clear ticks on a checklist, or clear this site’s browser data, to remove them.',
          links: [{ label: 'Open the admission checklist', href: '/admission-checklist' }],
        },
        {
          title: 'Can I apply through Gyaan Vidhya?',
          text: 'Not yet. Applications are a planned feature. The current platform helps you explore and plan; use the institution’s official application channel when you are ready to apply.',
          links: [{ label: 'Prepare your admission checklist', href: '/admission-checklist' }],
        },
      ],
    },
    blog: {
      title: 'Blog & student guides',
      category: 'The Gyaan Vidhya journal',
      description: 'Useful starting points for your college journey.',
      sections: [
        {
          title: 'Compare more than a headline fee',
          text: 'Check whether tuition is annual, semester-based or for the whole course. Add accommodation, meals, travel, books and joining charges. Keep refundable deposits visible because you still need that money upfront.',
          links: [{ label: 'Build your first-year budget', href: '/budget' }],
        },
        {
          title: 'Choose a course before choosing a shortlist',
          text: 'Write down the subjects you enjoy, the work you want to explore and the qualification you need. Read the programme curriculum and admission requirements. Compare colleges for that same programme rather than relying only on institution-level claims.',
          links: [{ label: 'Explore course-wise colleges', href: '/colleges' }, { label: 'Explore career questions', href: '/career-guidance' }],
        },
        {
          title: 'Read an update before acting on it',
          text: 'Look at the publication date, admission year and original source. A publisher article can explain a change, but the relevant official notice is the place to confirm a deadline or requirement.',
          links: [{ label: 'Read the latest education updates', href: '/news' }],
        },
      ],
    },
    'sources-and-editorial': {
      title: 'Sources & editorial approach',
      category: 'Information you can assess',
      description: 'Understand where information comes from and what it can tell you.',
      sections: [
        {
          title: 'College and planning examples',
          text: 'The present directory, eligibility profiles and budget assumptions use illustrative records. They are not rankings or verified institution offers. Check the relevant institution’s current programme, fees and admission rules.',
        },
        {
          title: 'Education news & reading',
          text: 'The news section fetches public education RSS feeds from The Indian Express, Hindustan Times and ET Education. It shows short summaries, publisher links and publication dates. Coverage depends on the publishers; classification into topics and article types uses text cues.',
          links: [
            { label: 'The Indian Express RSS directory', href: 'https://indianexpress.com/rss/' },
            { label: 'Hindustan Times RSS directory', href: 'https://www.hindustantimes.com/rss' },
            { label: 'ET Education RSS directory', href: 'https://education.economictimes.indiatimes.com/rss' },
          ],
        },
        {
          title: 'Freshness, images and corrections',
          text: 'The feed checks periodically and reports delayed or unavailable sources. Original publish dates stay visible. Reviewed neutral publisher photos can appear; other covers use education graphics. If information needs correcting, provide the page and supporting source.',
          links: [{ label: 'Report a correction', href: '/report-correction' }],
        },
      ],
    },
    'report-correction': {
      title: 'Report a correction',
      category: 'Help improve the information',
      description: 'A clear source helps us understand a reported issue.',
      sections: [
        {
          title: 'Include the page and the specific information',
          text: 'Note the Gyaan Vidhya page URL, the college/course or story title, and the statement you think needs correcting. Explain what should change without including unnecessary personal details.',
        },
        {
          title: 'Add the supporting source',
          text: 'Use an official programme page, dated admission notice, fee document or original publisher link where available. Identify the academic year and programme the source applies to.',
        },
        {
          title: 'Contact the team',
          text: 'The contact page shows the current support-channel status. Correction submissions are not available through a form yet.',
          links: [{ label: 'Open contact & support', href: '/contact' }],
        },
      ],
    },
    accessibility: {
      title: 'Accessibility',
      category: 'Explore with confidence',
      description: 'The current interface supports keyboard navigation and responsive layouts.',
      sections: [
        {
          title: 'Navigation and controls',
          text: 'The interface uses labeled controls, visible keyboard focus, semantic page sections and keyboard-operated dialogs. The main student tools are designed for desktop, tablet and mobile screens.',
        },
        {
          title: 'Motion and reading',
          text: 'Reduced-motion preferences are supported. Browser zoom and text-size controls can help you read the interface. This page describes the current design approach; it is not a certification of conformance.',
        },
        {
          title: 'Tell us about a barrier',
          text: 'Record the page, the action you were trying to complete and your browser or assistive technology. The contact page shows the current support-channel status.',
          links: [{ label: 'Contact & support', href: '/contact' }],
        },
      ],
    },
    legal: {
      title: 'Legal information',
      category: 'Legal & privacy',
      draft: true,
      description: 'Preview of the policy pages being prepared for Gyaan Vidhya.',
      sections: [
        {
          title: 'Policy pages',
          text: 'These starter pages describe the current preview. Company identity, operating address, final support channels and service-specific policy terms will be added before public launch.',
          links: [
            { label: 'Terms & conditions', href: '/terms-and-conditions' },
            { label: 'Privacy policy', href: '/privacy-policy' },
            { label: 'Cookies & browser storage', href: '/cookie-policy' },
            { label: 'Disclaimer', href: '/disclaimer' },
          ],
        },
        {
          title: 'Current platform scope',
          text: 'Gyaan Vidhya currently supports discovery and planning with illustrative college data, plus source-linked education updates. Student log-in is an early preview. Applications and payment services are not active.',
        },
      ],
    },
    'terms-and-conditions': {
      title: 'Terms & conditions',
      category: 'Legal & privacy',
      draft: true,
      description: 'Starter information about the current Gyaan Vidhya preview.',
      sections: [
        {
          title: 'Using the preview',
          text: 'The current platform helps you explore college and course options. Planning and academic examples do not confirm admission, institutional fees or an official offer. Confirm important details with the appropriate institution or authority.',
        },
        {
          title: 'Publisher and external content',
          text: 'News stories and external resources open on their original websites. Those providers control their content and the terms for using their sites.',
        },
        {
          title: 'Future services',
          text: 'Final account, application and transaction terms will be prepared when those services and the operating entity are established. This draft is not the final service agreement.',
          links: [{ label: 'View current legal information', href: '/legal' }],
        },
      ],
    },
    'privacy-policy': {
      title: 'Privacy policy',
      category: 'Legal & privacy',
      draft: true,
      description: 'What the current preview does with browser data.',
      sections: [
        {
          title: 'Stored in this browser',
          text: 'Some choices are kept in this browser’s local storage so they are there when you return: saved stories (headline, link and source), course and city preferences, compare shortlists, recent searches and guide checklist ticks. These lists are not synced to a student account. Clearing this site’s browser data removes them.',
        },
        {
          title: 'Student log-in preview',
          text: 'If you log in, Gyaan Vidhya stores the phone number or email address you used, any name you add and basic sign-in records such as when the account was created. An HTTP-only session cookie keeps you logged in until you log out or the session ends.',
        },
        {
          title: 'Browsing and external requests',
          text: 'The browser requests education updates from Gyaan Vidhya. The server fetches configured publisher feeds; displayed publisher photos may be loaded through image optimisation. Original story links take you to the publisher’s website.',
        },
        {
          title: 'Before public launch',
          text: 'The final policy needs the operating entity, verified contact details, hosting/logging practices, retention arrangements and the details of the account service and any future form or analytics services. They are not represented as completed in this draft.',
          links: [{ label: 'Cookies & browser storage', href: '/cookie-policy' }, { label: 'Contact-channel status', href: '/contact' }],
        },
      ],
    },
    'cookie-policy': {
      title: 'Cookies & browser storage',
      category: 'Legal & privacy',
      draft: true,
      description: 'Understand what the current preview keeps in your browser.',
      sections: [
        {
          title: 'Local storage on this device',
          text: 'Local storage is different from a cookie. The preview uses it so your choices remain when you return in the same browser: saved stories (nsedu.education.saved.v1), course and city preferences (nsedu:preferences), compare shortlists (nsedu:compare), recent searches (nsedu:recent-searches), your last log-in method (nsedu:login-channel) and guide checklist ticks (keys starting nsedu:guide-checklist:).',
        },
        {
          title: 'Session cookie for log-in',
          text: 'Logging in sets one essential, HTTP-only cookie (nsedu_student) that keeps your session. It is cleared when you log out and stops working when the session ends.',
        },
        {
          title: 'Removing saved information',
          text: 'Unsave a story in the news section, use Clear ticks on a guide checklist or clear Gyaan Vidhya’s site data in your browser settings. Clearing site data removes everything listed above from this browser. The present app code does not set analytics or advertising cookies.',
        },
        {
          title: 'Future integrations',
          text: 'This draft will be updated when hosting, analytics, account authentication or other integrations are chosen. No consent-management or tracking choices are simulated in this preview.',
          links: [{ label: 'Privacy policy preview', href: '/privacy-policy' }],
        },
      ],
    },
    disclaimer: {
      title: 'Disclaimer',
      category: 'Legal & privacy',
      draft: true,
      description: 'Read the context behind college examples and education updates.',
      sections: [
        {
          title: 'Illustrative examples',
          text: 'Current college records, academic requirements and planning values are illustrative. They are not an official ranking, verified fee quote, admission guarantee or prediction.',
        },
        {
          title: 'Confirm the information that affects your decision',
          text: 'Check programme-specific fees, entrance requirements, deadlines and admission conditions with the relevant institution or official authority. News reporting is not a substitute for an official notice.',
          links: [{ label: 'Sources & editorial approach', href: '/sources-and-editorial' }],
        },
      ],
    },
  },
  helpTopics: [
    { href: '/colleges', icon: 'building', title: 'Finding colleges', text: 'Filter sample colleges by course, city and fee.' },
    { href: '/courses', icon: 'book', title: 'Courses', text: 'Fields, levels, sample fees and linked exams.' },
    { href: '/compare', icon: 'compare', title: 'Comparing', text: 'Put up to three colleges side by side.' },
    { href: '/eligibility', icon: 'eligibility', title: 'Eligibility', text: 'What to confirm before applying.' },
    { href: '/budget', icon: 'wallet', title: 'Budget planning', text: 'Tuition plus living and one-time costs.' },
    { href: '/exams', icon: 'document', title: 'Entrance exams', text: 'Official sites and the courses they lead to.' },
    { href: '/scholarships', icon: 'cap', title: 'Scholarships', text: 'Funding portals and what to check.' },
    { href: '/news', icon: 'news', title: 'Saved news', text: 'Bookmark stories to read later on this device.' },
  ],
  aboutTools: [
    { href: '/colleges', icon: 'building', title: 'Discover', text: 'Courses, colleges and study destinations.' },
    { href: '/compare', icon: 'compare', title: 'Compare', text: 'Fees and placements side by side, with data years.' },
    { href: '/eligibility', icon: 'eligibility', title: 'Check', text: 'Academic requirements to confirm.' },
    { href: '/budget', icon: 'wallet', title: 'Plan', text: 'A first-year budget beyond tuition.' },
  ],
  contactCards: [
    { href: '/help', icon: 'guidesLifebuoy', title: 'Help centre & FAQs', text: 'Answers about using the tools and the sample data.' },
    { href: '/report-correction', icon: 'edit', title: 'Report a correction', text: 'What to include so an issue can be checked.' },
    { href: '/sources-and-editorial', icon: 'book', title: 'Sources & editorial', text: 'Where information comes from and how it is labelled.' },
    { href: '/accessibility', icon: 'guidesAccess', title: 'Accessibility barrier', text: 'How to describe a problem using the site.' },
  ],
  guideLinks: {
    title: 'Student guides',
    links: [
      { label: 'Blog & student guides', href: '/blog' },
      { label: 'Scholarships & funding', href: '/scholarships' },
      { label: 'Career guidance', href: '/career-guidance' },
      { label: 'Admission checklist', href: '/admission-checklist' },
      { label: 'Education news', href: '/news' },
    ],
  },
};
