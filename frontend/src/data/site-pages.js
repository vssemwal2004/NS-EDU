// Starter copy for the footer's working destinations. Legal drafts remain
// clearly labeled and noindexed until the actual company policies are ready.
export const sitePages = {
  about: {
    title: 'About NSEDU', category: 'Our purpose', description: 'Clearer information for a thoughtful college choice.',
    sections: [
      { title: 'Start with what matters to you', text: 'Your course, location, academic background and budget belong in the same conversation. NSEDU brings discovery, comparison and planning together so you can understand your options before taking the next step.' },
      { title: 'Understand the details', text: 'Explore study destinations, compare course-level information, check academic requirements and work through a first-year budget. Our current college and planning examples are illustrative; confirm institution-specific facts before applying.' },
      { title: 'Stay informed', text: 'Education updates link back to their original publishers, with sources and dates visible. Our goal is to help you ask better questions and make your own informed choice.', links: [{ label: 'Explore the student platform', href: '/' }, { label: 'Our sources & editorial approach', href: '/sources-and-editorial' }] },
    ],
  },
  contact: {
    title: 'Contact & support', category: 'Here to help', description: 'Find the right next step for a question, correction or collaboration.',
    sections: [
      { title: 'Student questions', text: 'For help choosing a course, comparing colleges or using the planning tools, start with the help centre. Admission decisions, eligibility confirmation and application status must come from the institution or official admission authority.', links: [{ label: 'Open help centre & FAQs', href: '/help' }] },
      { title: 'Corrections & collaborations', text: 'Include the relevant page URL, the information you want to discuss and a supporting source. Do not include passwords, identity documents or payment details in an initial enquiry.', links: [{ label: 'What to include in a correction', href: '/report-correction' }] },
    ],
  },
  help: {
    title: 'Help centre & FAQs', category: 'Student support', description: 'Practical answers to help you explore NSEDU.',
    sections: [
      { title: 'How do I compare colleges?', text: 'Open the course-wise college section, choose a course and select Compare on the colleges you want to review. Compare information with the same fee period and academic year. The present college records are examples.', links: [{ label: 'Open college comparison', href: '/#course-colleges' }] },
      { title: 'Does the eligibility checker guarantee admission?', text: 'No. It helps you review academic requirements using the current sample profiles. Admission depends on official rules, entrance results, seat availability and other institution-specific conditions.', links: [{ label: 'Check course requirements', href: '/#course-eligibility' }] },
      { title: 'Can I save an education article?', text: 'Use its bookmark icon. Saved stories remain in this browser and can be removed in the Saved view. Clearing browser site data removes the reading list. Student account sign-in and account syncing are not available yet.', links: [{ label: 'Open education news & articles', href: '/#education-news' }] },
      { title: 'Can I apply through NSEDU?', text: 'Applications and student accounts are planned features. The current platform helps you explore and plan; use the institution’s official application channel when you are ready to apply.', links: [{ label: 'Prepare your admission checklist', href: '/admission-checklist' }] },
    ],
  },
  blog: {
    title: 'Blog & student guides', category: 'The NSEDU journal', description: 'Useful starting points for your college journey.',
    sections: [
      { title: 'Compare more than a headline fee', text: 'Check whether tuition is annual, semester-based or for the whole course. Add accommodation, meals, travel, books and joining charges. Keep refundable deposits visible because you still need that money upfront.', links: [{ label: 'Build your first-year budget', href: '/#college-budget' }] },
      { title: 'Choose a course before choosing a shortlist', text: 'Write down the subjects you enjoy, the work you want to explore and the qualification you need. Read the programme curriculum and admission requirements. Compare colleges for that same programme rather than relying only on institution-level claims.', links: [{ label: 'Explore course-wise colleges', href: '/#course-colleges' }, { label: 'Explore career questions', href: '/career-guidance' }] },
      { title: 'Read an update before acting on it', text: 'Look at the publication date, admission year and original source. A publisher article can explain a change, but the relevant official notice is the place to confirm a deadline or requirement.', links: [{ label: 'Read the latest education updates', href: '/#education-news' }] },
    ],
  },
  scholarships: {
    title: 'Scholarships & funding', category: 'Plan your education', description: 'Explore funding without losing sight of the actual college cost.',
    sections: [
      { title: 'Check the right conditions', text: 'Look for the course, admission year, income criteria, academic requirements and location rules for each scheme. Note the deadline, required documents and whether renewal has separate conditions.' },
      { title: 'Keep awards separate from estimated costs', text: 'A scholarship application is not an approved award. Plan the amount you need upfront and only adjust your funding plan when the provider confirms the award and payment timing.', links: [{ label: 'Open the college budget planner', href: '/#college-budget' }] },
      { title: 'Browse funding resources', text: 'Use the provider’s current listing to confirm eligibility and application details.', links: [{ label: 'National Scholarship Portal', href: 'https://scholarships.gov.in/' }, { label: 'Buddy4Study scholarship listings', href: 'https://www.buddy4study.com/' }] },
    ],
  },
  'career-guidance': {
    title: 'Career guidance', category: 'Find your direction', description: 'Start with a few useful questions rather than a rushed college choice.',
    sections: [
      { title: 'What do you enjoy doing?', text: 'List the subjects, activities and problems that keep your attention. Think about the kind of everyday work you would enjoy: building, researching, designing, helping people or managing projects.' },
      { title: 'Which course opens that path?', text: 'Compare programme content, practical learning and the qualifications needed for the roles you want to explore. Consider duration, entry requirements and the possibility of further study.', links: [{ label: 'Explore courses & colleges', href: '/#course-colleges' }] },
      { title: 'What fits your circumstances?', text: 'Bring location, total cost and your academic background into the decision. A useful shortlist should explain why each option fits you. Personalised AI career guidance and counselling are planned; they are not active services yet.', links: [{ label: 'Review academic requirements', href: '/#course-eligibility' }, { label: 'Plan your budget', href: '/#college-budget' }] },
    ],
  },
  'admission-checklist': {
    title: 'Admission checklist', category: 'Prepare your next step', description: 'Keep the important details together before applying.',
    sections: [
      { title: 'Confirm the programme and admission year', text: 'Check the official programme name, campus, mode of study, qualification awarded and academic year. Verify subjects, marks, entrance requirements and relevant category rules.' },
      { title: 'Track dates and documents', text: 'Read the official application notice. Record the submission deadline, test or counselling dates and document requirements. Keep your academic records available and check whether certificates need a specific format or validity period.' },
      { title: 'Review costs and the application channel', text: 'Confirm tuition, living costs, deposits and refund conditions with the institution. Apply through the authorised channel, keep the acknowledgement and retain a copy of the information you submitted.', links: [{ label: 'Estimate first-year costs', href: '/#college-budget' }] },
    ],
  },
  'sources-and-editorial': {
    title: 'Sources & editorial approach', category: 'Information you can assess', description: 'Understand where information comes from and what it can tell you.',
    sections: [
      { title: 'College and planning examples', text: 'The present directory, eligibility profiles and budget assumptions use illustrative records. They are not rankings or verified institution offers. Check the relevant institution’s current programme, fees and admission rules.' },
      { title: 'Education news & reading', text: 'The news section fetches public education RSS feeds from The Indian Express, Hindustan Times and ET Education. It shows short summaries, publisher links and publication dates. Coverage depends on the publishers; classification into topics and article types uses text cues.', links: [{ label: 'The Indian Express RSS directory', href: 'https://indianexpress.com/rss/' }, { label: 'Hindustan Times RSS directory', href: 'https://www.hindustantimes.com/rss' }, { label: 'ET Education RSS directory', href: 'https://education.economictimes.indiatimes.com/rss' }] },
      { title: 'Freshness, images and corrections', text: 'The feed checks periodically and reports delayed or unavailable sources. Original publish dates stay visible. Reviewed neutral publisher photos can appear; other covers use education graphics. If information needs correcting, provide the page and supporting source.', links: [{ label: 'Report a correction', href: '/report-correction' }] },
    ],
  },
  'report-correction': {
    title: 'Report a correction', category: 'Help improve the information', description: 'A clear source helps us understand a reported issue.',
    sections: [
      { title: 'Include the page and the specific information', text: 'Note the NSEDU page URL, the college/course or story title, and the statement you think needs correcting. Explain what should change without including unnecessary personal details.' },
      { title: 'Add the supporting source', text: 'Use an official programme page, dated admission notice, fee document or original publisher link where available. Identify the academic year and programme the source applies to.' },
      { title: 'Contact the team', text: 'The contact page shows the current support-channel status. Correction submissions are not available through a form yet.', links: [{ label: 'Open contact & support', href: '/contact' }] },
    ],
  },
  accessibility: {
    title: 'Accessibility', category: 'Explore with confidence', description: 'The current interface supports keyboard navigation and responsive layouts.',
    sections: [
      { title: 'Navigation and controls', text: 'The interface uses labeled controls, visible keyboard focus, semantic page sections and keyboard-operated dialogs. The main student tools are designed for desktop, tablet and mobile screens.' },
      { title: 'Motion and reading', text: 'Reduced-motion preferences are supported. Browser zoom and text-size controls can help you read the interface. This page describes the current design approach; it is not a certification of conformance.' },
      { title: 'Tell us about a barrier', text: 'Record the page, the action you were trying to complete and your browser or assistive technology. The contact page shows the current support-channel status.', links: [{ label: 'Contact & support', href: '/contact' }] },
    ],
  },
  legal: {
    title: 'Legal information', category: 'Legal & privacy', draft: true, description: 'Preview of the policy pages being prepared for NSEDU.',
    sections: [
      { title: 'Policy pages', text: 'These starter pages describe the current preview. Company identity, operating address, final support channels and service-specific policy terms will be added before public launch.', links: [{ label: 'Terms & conditions', href: '/terms-and-conditions' }, { label: 'Privacy policy', href: '/privacy-policy' }, { label: 'Cookies & browser storage', href: '/cookie-policy' }, { label: 'Disclaimer', href: '/disclaimer' }] },
      { title: 'Current platform scope', text: 'NSEDU currently supports discovery and planning with illustrative college data, plus source-linked education updates. Accounts, applications and payment services are not active.' },
    ],
  },
  'terms-and-conditions': {
    title: 'Terms & conditions', category: 'Legal & privacy', draft: true, description: 'Starter information about the current NSEDU preview.',
    sections: [
      { title: 'Using the preview', text: 'The current platform helps you explore college and course options. Planning and academic examples do not confirm admission, institutional fees or an official offer. Confirm important details with the appropriate institution or authority.' },
      { title: 'Publisher and external content', text: 'News stories and external resources open on their original websites. Those providers control their content and the terms for using their sites.' },
      { title: 'Future services', text: 'Account, application and transaction terms will be prepared when those services and the operating entity are established. This draft is not the final service agreement.', links: [{ label: 'View current legal information', href: '/legal' }] },
    ],
  },
  'privacy-policy': {
    title: 'Privacy policy', category: 'Legal & privacy', draft: true, description: 'What the current preview does with browser data.',
    sections: [
      { title: 'Saved stories on this device', text: 'When you bookmark an education story, its headline, link and source are stored in this browser’s local storage. You can remove stories in the Saved view or clear this site’s browser data. The reading list is not synced to a student account.' },
      { title: 'Browsing and external requests', text: 'The browser requests education updates from NSEDU. The server fetches configured publisher feeds; displayed publisher photos may be loaded through image optimisation. Original story links take you to the publisher’s website.' },
      { title: 'Before public launch', text: 'The final policy needs the operating entity, verified contact details, hosting/logging practices, retention arrangements and the details of any future account, form or analytics services. They are not represented as completed in this draft.', links: [{ label: 'Cookies & browser storage', href: '/cookie-policy' }, { label: 'Contact-channel status', href: '/contact' }] },
    ],
  },
  'cookie-policy': {
    title: 'Cookies & browser storage', category: 'Legal & privacy', draft: true, description: 'Understand the saved reading list in the current preview.',
    sections: [
      { title: 'Browser storage for saved stories', text: 'The current reading list uses local storage under the key nsedu.education.saved.v1. Local storage is different from a cookie. It lets your bookmarks remain available when you return using the same browser.' },
      { title: 'Removing saved information', text: 'Unsave a story in the news section or clear NSEDU’s site data in your browser settings. Clearing site data removes the saved reading list. The present app code does not set analytics or advertising cookies.' },
      { title: 'Future integrations', text: 'This draft will be updated when hosting, analytics, account authentication or other integrations are chosen. No consent-management or tracking choices are simulated in this preview.', links: [{ label: 'Privacy policy preview', href: '/privacy-policy' }] },
    ],
  },
  disclaimer: {
    title: 'Disclaimer', category: 'Legal & privacy', draft: true, description: 'Read the context behind college examples and education updates.',
    sections: [
      { title: 'Illustrative examples', text: 'Current college records, academic requirements and planning values are illustrative. They are not an official ranking, verified fee quote, admission guarantee or prediction.' },
      { title: 'Confirm the information that affects your decision', text: 'Check programme-specific fees, entrance requirements, deadlines and admission conditions with the relevant institution or official authority. News reporting is not a substitute for an official notice.', links: [{ label: 'Sources & editorial approach', href: '/sources-and-editorial' }] },
    ],
  },
};
