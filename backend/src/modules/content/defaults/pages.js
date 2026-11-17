// Supporting pages served at /<slug> (about, contact, help, legal drafts...) plus their card lists.
export default {
  pages: {
    about: {
      title: 'About Gyaan Vidhya',
      category: 'Our story',
      description: 'From school campuses to your screen: honest admission guidance from the team behind Guidentra and The EduQuest education fairs.',
      // Shown as a band of brand cards under the masthead (title + text; no links).
      pillars: [
        { icon: 'building', title: 'N.S. Education Society', text: 'The education society that runs Gyaan Vidhya, Guidentra and The EduQuest.' },
        { icon: 'compass', title: 'Guidentra', text: 'Smart guidance for every admission: our counselling and admission-support service.' },
        { icon: 'people', title: 'The EduQuest', text: 'Education fairs that bring university admission teams to school campuses.' },
        { icon: 'laptop', title: 'Gyaan Vidhya', text: 'The online platform: discover, compare, plan and apply in one place.' },
      ],
      sections: [
        {
          title: 'Who we are',
          text: 'Gyaan Vidhya is the online student-guidance platform of N.S. Education Society, the team behind Guidentra — “Smart Guidance for Every Admission” — and The EduQuest education fairs. Our work begins where admission decisions really begin: in school classrooms and halls, talking with Class 11 and 12 students, their parents and their teachers. Gyaan Vidhya takes that same, face-to-face guidance online, so every student can explore their options with clear information and a real person to talk to.',
        },
        {
          title: 'The EduQuest: universities on your school campus',
          text: 'The EduQuest — “Empowering Students, Connecting Futures” — is our interactive education fair. Instead of asking students to travel to admission offices, we bring university admission teams to the school. Students walk from stall to stall, ask about courses, eligibility, fees, scholarships and campus life, collect brochures and speak with counsellors, while school leaders and teachers join the conversation. Schools that have hosted our fairs include S.M. Public School in Sitarganj, Army Public School, Baldev Singh Inter College and Nosegay Public School in Khatima, and admission teams from universities such as Shri Guru Ram Rai University, Dev Bhoomi Uttarakhand University, DBS Global University, UPES, Bennett University, Chitkara University, GNIOT, IILM University and the Graphic Era Group of Institutions have met students at our events.',
          links: [{ label: 'See moments from our fairs', href: '#moments-from-the-field' }],
        },
        {
          title: 'Gyaan Vidhya: the same guidance, online',
          text: 'On Gyaan Vidhya you can search a directory of universities and colleges compiled from official institution websites and public regulator lists, compare programmes, fees and placements side by side, check what a course asks for, plan a first-year budget and apply with help from our admissions team. Students who meet us at a fair can register with a QR code and continue online, and anyone can ask a counsellor for a call back about their field.',
          links: [{ label: 'Explore universities', href: '/universities' }, { label: 'Talk to a counsellor', href: '/career-guidance' }],
        },
        {
          title: 'How we work',
          text: 'We start from official sources and show where information comes from, and we label estimates as estimates. We do not promise admission, seats or scholarships — those decisions belong to institutions and admission authorities. We use your details only to help with what you asked for, we do not sell personal data, and every student review on the site comes from a verified account and is published as written.',
          links: [{ label: 'Sources & editorial approach', href: '/sources-and-editorial' }, { label: 'Privacy policy', href: '/privacy-policy' }, { label: 'Student reviews', href: '/reviews' }],
        },
        {
          title: 'Host The EduQuest or partner with us',
          text: 'Schools that would like to host The EduQuest for their students, and universities that would like to take part in our fairs or work with our admission-support team, are welcome to get in touch. Tell us your institution, city and the students you would like to reach.',
          links: [{ label: 'Contact & support', href: '/contact' }],
        },
      ],
      // Photographs from The EduQuest fairs and partner visits (frontend/public/company). Captions describe
      // the occasion; people are not named. `category` must be one of the ids in `categories`.
      gallery: {
        title: 'Moments from the field',
        intro: 'Education fairs, school visits and partner meetings from The EduQuest and Guidentra.',
        categories: [
          { id: 'fairs', label: 'Education fairs' },
          { id: 'felicitations', label: 'Felicitations' },
          { id: 'guests', label: 'Inaugurations & guests' },
          { id: 'partners', label: 'University partners' },
        ],
        photos: [
          { src: '/company/eduquest-12.webp', width: 1600, height: 1200, category: 'fairs', caption: 'Students with the university brochures they collected at The EduQuest.', alt: 'Students in school sports uniforms hold university brochures on stage with The EduQuest standee and the organising team.' },
          { src: '/company/eduquest-15.webp', width: 1600, height: 900, category: 'fairs', caption: 'The EduQuest at Baldev Singh Inter College.', alt: 'School staff, university representatives and the organising team outside Baldev Singh Inter College beside the Guidentra standee.' },
          { src: '/company/eduquest-17.webp', width: 960, height: 1280, category: 'fairs', caption: 'Students at the Shri Guru Ram Rai University stall.', alt: 'Students gather at the SGRRU Dehradun stall under a green-and-white tent.' },
          { src: '/company/eduquest-18.webp', width: 960, height: 1280, category: 'fairs', caption: 'Questions about programmes, answered at the stall.', alt: 'An SGRRU representative explains programmes to a group of students.' },
          { src: '/company/eduquest-19.webp', width: 960, height: 1280, category: 'fairs', caption: 'Meeting the DBS Global University admission team.', alt: 'Two students speak with DBS Global University representatives at their stall.' },
          { src: '/company/eduquest-20.webp', width: 960, height: 1280, category: 'fairs', caption: 'A university representative answering students’ questions.', alt: 'A university representative talks with a group of schoolgirls in uniform at a tented stall.' },
          { src: '/company/eduquest-23.webp', width: 1600, height: 717, category: 'fairs', caption: 'One-to-one guidance at the GNIOT stall.', alt: 'A GNIOT representative leans in to talk with a student beside a NAAC A+ banner.' },
          { src: '/company/eduquest-25.webp', width: 1280, height: 960, category: 'fairs', caption: 'Students meet the UPES admission team.', alt: 'A UPES representative speaks with students in red school blazers at an open-air table.' },
          { src: '/company/eduquest-26.webp', width: 1280, height: 960, category: 'fairs', caption: 'At the Bennett University table.', alt: 'A Bennett University representative talks with two students in red blazers in a school courtyard.' },
          { src: '/company/eduquest-28.webp', width: 1280, height: 960, category: 'fairs', caption: 'Brochures and enquiry forms at the Chitkara University table.', alt: 'Students in red blazers and turbans collect brochures and fill in forms at the Chitkara University table.' },
          { src: '/company/eduquest-29.webp', width: 1280, height: 960, category: 'fairs', caption: 'A school elder visits the university tables as students queue.', alt: 'A Bennett University representative greets a senior guest while students line up behind.' },
          { src: '/company/eduquest-30.webp', width: 960, height: 1280, category: 'fairs', caption: 'A busy Graphic Era stall in the school hall.', alt: 'Students crowd around the Graphic Era Group of Institutions stall in a school hall.' },
          { src: '/company/eduquest-11.webp', width: 1200, height: 1600, category: 'fairs', caption: 'Students and the organising team after the session.', alt: 'Group photo of students holding brochures with teachers and the organising team in a school auditorium.' },
          { src: '/company/eduquest-03.webp', width: 720, height: 1280, category: 'felicitations', caption: 'Felicitation at The EduQuest, S.M. Public School, Sitarganj.', alt: 'A school representative receives a memento from a member of the organising team at S.M. Public School, Sitarganj.' },
          { src: '/company/eduquest-05.webp', width: 720, height: 1280, category: 'felicitations', caption: 'With school leadership at S.M. Public School, Sitarganj.', alt: 'Four men hold a memento in front of The EduQuest standee at S.M. Public School.' },
          { src: '/company/eduquest-04.webp', width: 940, height: 1445, category: 'felicitations', caption: 'Thanking the leadership of Army Public School for hosting The EduQuest.', alt: 'An Army officer and a member of the organising team hold a “Special Thanks” memento inside a school building.' },
          { src: '/company/eduquest-06.webp', width: 900, height: 1600, category: 'felicitations', caption: 'A memento of thanks at Army Public School.', alt: 'A school leader in a sari presents a memento to a member of the organising team.' },
          { src: '/company/eduquest-10.webp', width: 900, height: 1600, category: 'felicitations', caption: 'A “Special Thanks” memento for the guest of honour.', alt: 'The organiser presents a memento to the guest of honour in a school auditorium.' },
          { src: '/company/eduquest-09.webp', width: 1200, height: 1600, category: 'felicitations', caption: 'A thank-you from N.S. Educational Society to the host school.', alt: 'A team member presents an N.S. Educational Society gift bag to a school coordinator on stage.' },
          { src: '/company/eduquest-14.webp', width: 960, height: 1280, category: 'felicitations', caption: 'Recognising a host school’s leadership beside the Guidentra standee.', alt: 'A school leader receives a memento in front of the Guidentra standee for The EduQuest.' },
          { src: '/company/eduquest-21.webp', width: 960, height: 1280, category: 'felicitations', caption: 'The Future Hunt Education Fair, organised by The EduQuest.', alt: 'Five women hold a gift between two EduQuest banners for The Future Hunt Education Fair.' },
          { src: '/company/eduquest-22.webp', width: 1280, height: 960, category: 'felicitations', caption: 'Educational Mega Fair at Nosegay Public School, Khatima.', alt: 'The organiser receives a memento on stage beneath the Nosegay Public School banner, with school leaders alongside.' },
          { src: '/company/eduquest-07.webp', width: 900, height: 1600, category: 'guests', caption: 'Ribbon-cutting to open The EduQuest.', alt: 'A guest cuts a red ribbon at the hall entrance as the organising team looks on.' },
          { src: '/company/eduquest-27.webp', width: 1280, height: 960, category: 'guests', caption: 'Inauguration of a school education fair.', alt: 'A senior guest cuts the ribbon at the school entrance with students and staff gathered around.' },
          { src: '/company/eduquest-08.webp', width: 900, height: 1600, category: 'guests', caption: 'In conversation with the guest of honour.', alt: 'The guest of honour and the organiser talk on a sofa beside The EduQuest standee.' },
          { src: '/company/eduquest-13.webp', width: 900, height: 1600, category: 'guests', caption: 'Talking about how students choose their course.', alt: 'Two men in conversation on stage beside The EduQuest standee, microphones on the table.' },
          { src: '/company/eduquest-01.webp', width: 1280, height: 1134, category: 'partners', caption: 'A courtesy meeting with university leadership.', alt: 'Two men exchange a bouquet of gerberas in front of a large campus photograph.' },
          { src: '/company/eduquest-02.webp', width: 1262, height: 1280, category: 'partners', caption: 'Building relationships with the universities at our fairs.', alt: 'A bouquet is presented during a courtesy meeting, with a campus photograph behind.' },
          { src: '/company/eduquest-16.webp', width: 1200, height: 1600, category: 'partners', caption: 'A memento from IILM University during a partnership visit.', alt: 'Two men hold a framed IILM University print in an office.' },
          { src: '/company/eduquest-24.webp', width: 1280, height: 960, category: 'partners', caption: 'With the Graphic Era Group of Institutions team.', alt: 'Graphic Era representatives present a tote bag to the organiser on a school sports ground.' },
        ],
      },
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
          text: 'Yes. Choose Apply on a university profile and send the short form. It does not apply to the institution directly: our admissions team receives your details, contacts you and helps you through the institution’s own application process. Admission decisions are made only by the institution, and Gyaan Vidhya never collects fees on the website.',
          links: [{ label: 'Find a university', href: '/universities' }, { label: 'Prepare your admission checklist', href: '/admission-checklist' }],
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
          text: 'The feed checks periodically and reports delayed or unavailable sources. Original publish dates stay visible. Each story shows the photo its publisher supplies in the feed; a story without one uses an education graphic. If information needs correcting, provide the page and supporting source.',
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
      updated: '2026-11-17',
      description: 'Who runs Gyaan Vidhya, the policies that apply when you use it, and how to reach us about them.',
      sections: [
        {
          title: 'Who operates Gyaan Vidhya',
          text: 'Gyaan Vidhya (this website and its student services) is operated by N.S. Education Society, which also runs Guidentra — our admission-guidance service — and The EduQuest education fairs. In these pages “we”, “us” and “our” mean N.S. Education Society, and “you” means anyone who uses the website, our fairs or our services.',
          links: [{ label: 'About us', href: '/about' }],
        },
        {
          title: 'Our policies',
          text: 'These policies apply together. The Terms & conditions explain how you may use Gyaan Vidhya and what we are and are not responsible for. The Privacy policy explains what personal data we collect, why, who we share it with and your rights under India’s Digital Personal Data Protection Act, 2023. The Cookies page lists every cookie and browser-storage item we use. The Disclaimer explains the limits of the information on the site.',
          links: [
            { label: 'Terms & conditions', href: '/terms-and-conditions' },
            { label: 'Privacy policy', href: '/privacy-policy' },
            { label: 'Cookies & browser storage', href: '/cookie-policy' },
            { label: 'Disclaimer', href: '/disclaimer' },
          ],
        },
        {
          title: 'Questions, complaints and grievances',
          text: 'For any question or complaint about these policies, your personal data or content on the site, write to us through the contact page with a short description and the page concerned. Complaints about personal data are handled by our grievance officer. If a problem is not resolved, you may approach the Data Protection Board of India.',
          links: [{ label: 'Contact & support', href: '/contact' }, { label: 'Report a correction', href: '/report-correction' }],
        },
        {
          title: 'Names and logos of institutions',
          text: 'University and college names, logos and photographs belong to their owners. We show them only to identify institutions and the programmes they offer; showing an institution, or its presence at one of our fairs, does not mean it endorses Gyaan Vidhya or that we endorse it. An institution that wants information about itself corrected or removed can contact us.',
          links: [{ label: 'For university websites', href: '/bot' }],
        },
      ],
    },
    'terms-and-conditions': {
      title: 'Terms & conditions',
      category: 'Legal & privacy',
      updated: '2026-11-17',
      description: 'The rules for using Gyaan Vidhya, our admission support and our education fairs.',
      sections: [
        {
          title: 'About these terms',
          text: 'These terms are an agreement between you and N.S. Education Society, the operator of Gyaan Vidhya. By using the website, creating an account, submitting an application or enquiry, registering at The EduQuest or writing a review, you agree to them and to our Privacy policy. If you do not agree, please do not use the service. We may update these terms; the date at the top shows the latest version, and continuing to use the service after a change means you accept it.',
        },
        {
          title: 'Who can use Gyaan Vidhya',
          text: 'Gyaan Vidhya is for students, parents and guardians exploring higher education in India. If you are under 18, use the service with the knowledge and consent of your parent or guardian, who is responsible for your use of it. You must give accurate information and use the service only for yourself or, as a parent or guardian, for your child.',
        },
        {
          title: 'Your account',
          text: 'You sign in with a one-time code sent to your email or mobile number, or with Google. Keep access to that email, phone or Google account secure: anything done after signing in is treated as done by you. One person per account. We may suspend or close an account that gives false information, is used to misuse the service or breaks these terms. You can ask us to close your account at any time.',
        },
        {
          title: 'Information on the platform',
          text: 'The university directory, programmes, fees, placement figures and other details are compiled from official institution websites, public regulator lists and other sources we show where possible. Institutions change their programmes, fees and rules often, so information may be incomplete or out of date, and estimates are labelled as estimates. Gyaan Vidhya is a guidance service, not an admission authority: always confirm eligibility, fees, seats, deadlines and rules with the institution or official authority before you decide or pay.',
          links: [{ label: 'Disclaimer', href: '/disclaimer' }, { label: 'Sources & editorial approach', href: '/sources-and-editorial' }],
        },
        {
          title: 'Applications and counselling',
          text: 'Submitting an application or call-back request on Gyaan Vidhya does not apply to the institution directly. It sends your details to our admissions team, who will contact you by phone, SMS, WhatsApp or email and help you with the institution’s own admission process, which may include sharing the details you provided with the institution you chose. Admission, seat allocation and scholarships are decided only by the institution or admission authority; we do not guarantee any outcome. Gyaan Vidhya does not collect admission or tuition fees on this website — pay institutions only through their official channels and ask for an official receipt.',
        },
        {
          title: 'The EduQuest fairs and school registrations',
          text: 'At The EduQuest and other school visits, students may register by scanning a QR code. The details you enter are used to follow up on the courses and institutions you are interested in, as described in the Privacy policy. Institutions take part in our fairs to meet students; their participation is not a recommendation by us, and any offer or claim they make is their responsibility.',
        },
        {
          title: 'Reviews and content you share',
          text: 'You may write one review of Gyaan Vidhya from your account. It must be honest, about your own experience, and free of phone numbers, email addresses, links, advertising, abuse, hate, personal attacks and other people’s personal information. Our team checks every review before it appears and may decline or remove reviews that break these rules; we do not edit what you write, and we publish positive and critical reviews alike. Reviews show your first name, last initial, course and city. By submitting a review you allow us to display it on Gyaan Vidhya and in our own promotion of Gyaan Vidhya, without payment. You can edit or delete your review at any time from the reviews page.',
          links: [{ label: 'Student reviews', href: '/reviews' }],
        },
        {
          title: 'Acceptable use',
          text: 'Do not copy or scrape the directory or other content in bulk, use bots or automated tools against the service, try to get around sign-in limits or security, overload our systems, impersonate anyone, submit false applications or enquiries, or use the service for anything unlawful. We may block access that does any of this.',
        },
        {
          title: 'Intellectual property',
          text: 'The Gyaan Vidhya, Guidentra and The EduQuest names and logos, the design of the website and the text, guides and tools we create belong to N.S. Education Society. You may use them for your own, non-commercial study and planning. Names, logos, photographs and documents of institutions and news publishers belong to their owners; news stories open on the publisher’s own website.',
        },
        {
          title: 'Third-party websites',
          text: 'Links to institution, exam, scholarship and publisher websites are provided for convenience. Those websites are run by others under their own terms and privacy policies, and we are not responsible for their content or practices.',
        },
        {
          title: 'Limitation of liability',
          text: 'The service is provided “as is”. To the fullest extent permitted by law, we are not liable for decisions you make based on information on the site, for actions or decisions of institutions or authorities, or for indirect or consequential loss. Nothing in these terms limits rights you have under Indian consumer law that cannot be excluded.',
        },
        {
          title: 'Governing law and contact',
          text: 'These terms are governed by the laws of India. If you have a concern, please contact us first so we can try to resolve it; disputes that cannot be resolved will be subject to the jurisdiction of the competent courts in India.',
          links: [{ label: 'Contact & support', href: '/contact' }, { label: 'Privacy policy', href: '/privacy-policy' }],
        },
      ],
    },
    'privacy-policy': {
      title: 'Privacy policy',
      category: 'Legal & privacy',
      updated: '2026-11-17',
      description: 'What personal data Gyaan Vidhya collects, why we use it, who sees it and the choices you have.',
      sections: [
        {
          title: 'Who we are and what this covers',
          text: 'N.S. Education Society operates Gyaan Vidhya and decides how the personal data described here is used; under India’s Digital Personal Data Protection Act, 2023 we are the “data fiduciary”. This policy covers the Gyaan Vidhya website, student accounts, applications and counsellor call-backs, student reviews, and registrations made at The EduQuest fairs and school visits.',
        },
        {
          title: 'Information you give us',
          text: 'Account: your email address or mobile number (and, with Google sign-in, the name, email address and Google account id Google shares with us) and the name you add. Applications and call-backs: your name, phone, email, state and city, academic details such as class, board, marks and entrance-exam scores, the course and institution you are interested in, and a record of the consent you gave (with the time, IP address and browser). Fair and school registrations: the details on the QR form, such as your name, mobile number, class, stream, school and interests. Reviews: your name, course, optional college and city, rating and review text. Messages you send us.',
        },
        {
          title: 'Information collected automatically',
          text: 'Essential cookies keep you signed in and remember your cookie choice. Only if you choose “Accept all” do we record, against a random id, what you search for, the filters you use and the universities you open, to recommend colleges to you — we do not store your IP address or browser details with this activity. To count free profile views for visitors who are not signed in, we keep a random id and the profiles opened. Our servers also keep short technical logs (such as request time, address and errors) to keep the service secure and working.',
          links: [{ label: 'Cookies & browser storage', href: '/cookie-policy' }],
        },
        {
          title: 'How we use it',
          text: 'To sign you in and secure your account; to process your applications and call-back requests and contact you about them by phone, SMS, WhatsApp or email, as you agreed when submitting; to help you with an institution’s admission process; to follow up on fair registrations; to show recommendations if you accepted personalisation; to check and publish reviews; to answer your messages; to prevent misuse and fraud; to understand, in aggregate, how the service is used; and to meet legal obligations. We do not sell your personal data and we do not use it for third-party advertising.',
        },
        {
          title: 'Who we share it with',
          text: 'Our admissions team and counsellors see the leads assigned to them; access is limited by role, and sensitive actions such as exports and deletions are recorded in an activity log. When our team helps you apply, the details needed for that application may be shared with the institution you chose. We use service providers that process data for us under our instructions: cloud database hosting (MongoDB Atlas), email delivery, SMS one-time codes (MSG91), Google sign-in (Google), and image storage and delivery (Cloudflare and Cloudinary). We disclose data to authorities only when the law requires it. Your public review shows only your first name, last initial, course and city.',
        },
        {
          title: 'How long we keep it',
          text: 'Account details are kept while your account is open. Applications, call-backs and fair registrations are kept as long as needed to help you through the admission cycle and to keep a record of your consent, and are then deleted or anonymised. Personalisation activity is deleted automatically after 180 days, anonymous cookie-choice records after 400 days, free-preview records 30 days after last use, and one-time sign-in codes as soon as they expire. You can delete your review at any time.',
        },
        {
          title: 'Your rights and choices',
          text: 'You can ask for a summary of the personal data we hold about you and how it is used, ask us to correct, complete or update it, ask us to erase it where we no longer need it, withdraw consent you gave (this does not affect what was done before), nominate a person to exercise your rights if you die or become unable to, and raise a grievance. Use the contact page; we may need to verify your identity first. You can change your cookie choice at any time from “Cookie settings” at the bottom of every page. If you are not satisfied with our answer, you may complain to the Data Protection Board of India.',
          links: [{ label: 'Contact & support', href: '/contact' }],
        },
        {
          title: 'Students under 18',
          text: 'Many of the students we meet are in Class 11 or 12 and may be under 18. If you are under 18, please use Gyaan Vidhya, apply or register at a fair with the knowledge and consent of your parent or guardian. A parent or guardian can contact us to review, correct or erase their child’s data. We do not use children’s data for tracking, behavioural monitoring or targeted advertising.',
        },
        {
          title: 'How we protect it',
          text: 'Pages are served over HTTPS, sessions use HTTP-only cookies, staff access to student data is limited by role with sensitive actions logged, and service providers are chosen for their security practices. No system is perfectly secure; if a breach affecting your data occurs, we will inform you and the authorities as the law requires.',
        },
        {
          title: 'Changes and contact',
          text: 'We will update this policy when our services or the law change, and show the date of the latest version at the top. For any privacy question, request or grievance, contact our grievance officer through the contact page.',
          links: [{ label: 'Contact & support', href: '/contact' }, { label: 'Terms & conditions', href: '/terms-and-conditions' }],
        },
      ],
    },
    'cookie-policy': {
      title: 'Cookies & browser storage',
      category: 'Legal & privacy',
      updated: '2026-11-17',
      description: 'Every cookie and browser-storage item Gyaan Vidhya uses, why, and how to change your choice.',
      sections: [
        {
          title: 'Essential cookies (always on)',
          text: 'Logging in sets one HTTP-only cookie (nsedu_student) that keeps your session; it is cleared when you log out and stops working when the session ends. A second cookie (gv_consent) remembers your cookie choice for 180 days so we do not ask again on every page. If you are not signed in and open university profiles, a random id (gv_preview, HTTP-only, 30 days) counts your free profile views.',
        },
        {
          title: 'Personalisation cookie (only if you accept)',
          text: 'If you choose “Accept all”, we set a random first-party id (gv_visitor, HTTP-only, 180 days) and record what you search for, the filters you use and the universities you open. We use this only to recommend colleges to you and to see, in aggregate, what students look for. We never store your IP address, browser details or full web addresses with this activity, and it is deleted automatically after 180 days. If you choose “Essential only”, none of this is set or stored. We do not use advertising cookies or sell your data.',
        },
        {
          title: 'Local storage on this device',
          text: 'Local storage is different from a cookie: it stays in your browser and is not sent to us. We use it so your choices remain when you return in the same browser: saved stories (nsedu.education.saved.v1), course and city preferences (nsedu:preferences), compare shortlists (nsedu:compare), recent searches (nsedu:recent-searches), your last log-in method (nsedu:login-channel) and guide checklist ticks (keys starting nsedu:guide-checklist:).',
        },
        {
          title: 'Changing your choice',
          text: 'Use “Cookie settings” at the bottom of any page to change your choice at any time. Choosing “Essential only” removes the personalisation id from your browser straight away.',
        },
        {
          title: 'Removing saved information',
          text: 'Unsave a story in the news section, use Clear ticks on a guide checklist or clear Gyaan Vidhya’s site data in your browser settings. Clearing site data removes everything listed above from this browser and signs you out.',
        },
        {
          title: 'Changes to this page',
          text: 'We will update this page before adding any new cookie, analytics or third-party service.',
          links: [{ label: 'Privacy policy', href: '/privacy-policy' }],
        },
      ],
    },
    disclaimer: {
      title: 'Disclaimer',
      category: 'Legal & privacy',
      updated: '2026-11-17',
      description: 'What the information on Gyaan Vidhya can and cannot tell you.',
      sections: [
        {
          title: 'Guidance, not an admission authority',
          text: 'Gyaan Vidhya, Guidentra and The EduQuest help students explore options and prepare for admission. We are not a university, regulator or admission authority, and nothing on the site is an offer of admission, a guarantee of a seat, scholarship or placement, or official advice.',
        },
        {
          title: 'Information can change',
          text: 'Directory details, fees, placement figures, rankings and eligibility rules are compiled from official institution websites, public lists and other sources, and may be incomplete, out of date or contain errors. Fee and budget estimates are labelled as estimates. Always confirm programme-specific fees, entrance requirements, deadlines and admission conditions with the institution or official authority before deciding or paying.',
          links: [{ label: 'Sources & editorial approach', href: '/sources-and-editorial' }, { label: 'Report a correction', href: '/report-correction' }],
        },
        {
          title: 'Institutions and fairs',
          text: 'Showing an institution in the directory or at one of our fairs is not a ranking or recommendation, and does not mean the institution endorses Gyaan Vidhya. Claims made by institutions in their brochures, banners or conversations at our events are their own responsibility.',
        },
        {
          title: 'Student reviews and news',
          text: 'Student reviews describe the personal experience of the people who wrote them and are not our views. News stories are summaries that link to the original publisher; the official notice is the place to confirm a deadline or requirement.',
          links: [{ label: 'Student reviews', href: '/reviews' }],
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
