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
    // Legal & privacy pages. Written for the DPDP Act, 2023 and DPDP Rules, 2025 (G.S.R. 846(E)), the IT Act, 2000
    // with the SPDI Rules, 2011 and the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and
    // TRAI's TCCCPR, 2018. Every page in this group must also be linked from the "Legal & privacy" footer group, so
    // it gets the Legal breadcrumb and "More in" list. The grievance officer's details live ONLY on
    // `grievance-redressal`; the other pages link to it.
    legal: {
      title: 'Legal information',
      category: 'Legal & privacy',
      updated: '2026-11-24',
      description: 'Who runs Gyaan Vidhya, the policies that apply when you use it, and how to raise a question or complaint.',
      sections: [
        {
          title: 'Who operates Gyaan Vidhya',
          text: 'Gyaan Vidhya (this website and its student services) is operated by N.S. Education Society, which also runs Guidentra — our admission-guidance service — and The EduQuest education fairs. In these pages “we”, “us” and “our” mean N.S. Education Society, and “you” means anyone who uses the website, our fairs or our services. Our registered office and the contact details of our grievance officer are on the Grievance redressal page.',
          links: [{ label: 'About us', href: '/about' }, { label: 'Grievance redressal', href: '/grievance-redressal' }],
        },
        {
          title: 'Free for every student',
          text: 'Gyaan Vidhya, Guidentra counselling and registration at The EduQuest fairs are free for students and parents. We do not charge for counselling, for registering at a fair or for helping you apply. Our staff will never ask you for money, a one-time password (OTP), or bank, card or UPI details. Pay admission, tuition and hostel fees only to the institution itself, through its official website or office, and keep the official receipt. If anyone asks you for money in our name, do not pay: tell us, and report it to the National Cyber Crime Helpline 1930 or at cybercrime.gov.in.',
          links: [{ label: 'Report fraud in our name', href: '/grievance-redressal#report-fraud-in-our-name' }, { label: 'National Cyber Crime Reporting Portal', href: 'https://cybercrime.gov.in' }],
        },
        {
          title: 'Your data stays with us',
          text: 'Students and parents trust us with their details, and we treat those details as theirs. We never sell or rent personal data, and we never give it to other colleges, agents, coaching centres, marketers or data brokers. We share a student’s details with one institution only — the one the student asks us to help them apply to — and only what that application needs. The Privacy policy explains what we collect, why, for how long, and the rights you have under India’s Digital Personal Data Protection Act, 2023.',
          links: [{ label: 'Privacy policy', href: '/privacy-policy' }, { label: 'Privacy requests', href: '/privacy-request' }],
        },
        {
          title: 'Our policies',
          text: 'These policies apply together. The Terms & conditions explain how you may use Gyaan Vidhya and what we are and are not responsible for. The Privacy policy explains how we handle personal data, including the data of students under 18. The Cookies page lists every cookie and browser-storage item we use. The Disclaimer explains the limits of the information on the site. The Privacy requests page explains how to get a copy of your data, correct or delete it, or stop our calls, and the Grievance redressal page explains how to complain and how quickly we respond.',
          links: [
            { label: 'Terms & conditions', href: '/terms-and-conditions' },
            { label: 'Privacy policy', href: '/privacy-policy' },
            { label: 'Cookies & browser storage', href: '/cookie-policy' },
            { label: 'Disclaimer', href: '/disclaimer' },
            { label: 'Privacy requests', href: '/privacy-request' },
            { label: 'Grievance redressal', href: '/grievance-redressal' },
          ],
        },
        {
          title: 'Questions, complaints and grievances',
          text: 'Our grievance officer handles questions and complaints about your personal data, about content on the site such as student reviews, and about our services. We acknowledge complaints about content within 24 hours and resolve them within 7 days. We answer requests and complaints about personal data as quickly as we can, and within 90 days at the latest. If you are not satisfied with our answer, you can approach the Data Protection Board of India.',
          links: [{ label: 'Grievance redressal', href: '/grievance-redressal' }],
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
      updated: '2026-11-24',
      description: 'The rules for using Gyaan Vidhya, our free admission support and our education fairs.',
      sections: [
        {
          title: 'About these terms',
          text: 'These terms are an agreement between you and N.S. Education Society, the operator of Gyaan Vidhya. By using the website, creating an account, sending an application or call-back request, registering at The EduQuest or writing a review, you agree to them and to our Privacy policy. If you do not agree, please do not use the service. We may update these terms; the date at the top shows the latest version, and we will tell you about important changes on the website or by email before they apply.',
        },
        {
          title: 'Our services are free',
          text: 'Using Gyaan Vidhya, talking to a Guidentra counsellor, registering at The EduQuest and getting help with an application are all free for students and parents. Nobody from Gyaan Vidhya will ask you for money, an OTP, or bank, card or UPI details. Admission, tuition, hostel and entrance-exam fees are paid only to the institution or exam authority through its official channels — never to our staff. Because we charge students nothing, there is nothing to refund.',
          links: [{ label: 'Report fraud in our name', href: '/grievance-redressal#report-fraud-in-our-name' }],
        },
        {
          title: 'Who can use Gyaan Vidhya',
          text: 'Gyaan Vidhya is for students, parents and guardians exploring higher education in India. Our forms ask whether you are 18 or older. If you are under 18, a parent or guardian must agree to you using our services: we ask for their name, mobile number and consent before we accept an application, call-back request or fair registration, and we may contact them to confirm it. Parents and guardians are responsible for their child’s use of the service. Give accurate information, do not pretend to be anyone else, and use the service only for yourself or, as a parent or guardian, for your child.',
          links: [{ label: 'Students under 18', href: '/privacy-policy#students-under-18-and-their-parents' }],
        },
        {
          title: 'Your account',
          text: 'You sign in with a one-time code sent to your email or mobile number, or with Google. We do not use passwords for student accounts, and our staff will never ask you to read out a code. Keep access to that email, phone or Google account secure: anything done after signing in is treated as done by you. One person per account. You can download your data, correct it or delete your account at any time from My data in your account. We may suspend or close an account that gives false information, misuses the service or breaks these terms.',
          links: [{ label: 'My data', href: '/account/my-data' }],
        },
        {
          title: 'Information on the platform',
          text: 'The university directory, programmes, fees, placement figures and other details are compiled from official institution websites, public regulator lists and other sources we show where possible. Institutions change their programmes, fees and rules often, so information may be incomplete or out of date, and estimates are labelled as estimates. Gyaan Vidhya is a guidance service, not an admission authority: always confirm eligibility, fees, seats, deadlines and rules with the institution or official authority before you decide or pay.',
          links: [{ label: 'Disclaimer', href: '/disclaimer' }, { label: 'Sources & editorial approach', href: '/sources-and-editorial' }],
        },
        {
          title: 'Applications and counselling',
          text: 'Sending an application or call-back request on Gyaan Vidhya does not apply to the institution directly. It sends your details to our admissions team, who contact you in the ways you agreed to — phone, SMS, WhatsApp or email — and help you with the institution’s own admission process. When you ask us to help you apply to an institution, we share with that institution only the details its application needs, and nothing with any other institution. Admission, seat allocation and scholarships are decided only by the institution or admission authority; we do not guarantee any outcome.',
        },
        {
          title: 'The EduQuest fairs and school registrations',
          text: 'At The EduQuest and other school visits, students can register by scanning a QR code. We use those details only to follow up on the courses and institutions the student is interested in, as the Privacy policy describes, and students under 18 register with their parent’s or guardian’s consent. Institutions that take part in our fairs meet students at their stalls; they do not receive the list of students who registered with us. Their participation is not a recommendation by us, and any offer or claim they make is their own responsibility.',
        },
        {
          title: 'Reviews and content you share',
          text: 'You may write one review of Gyaan Vidhya from your account. It must be honest, about your own experience, and free of phone numbers, email addresses, links, advertising and other people’s personal information. Our team checks every review before it appears and declines or removes reviews that break these terms; we do not edit what you write, and we publish positive and critical reviews alike. Reviews show your first name, last initial, course and city. By submitting a review you allow us to display it on Gyaan Vidhya and in our own promotion of Gyaan Vidhya, without payment. You can edit or delete your review at any time from the reviews page.',
          links: [{ label: 'Student reviews', href: '/reviews' }],
        },
        {
          title: 'What you must not post',
          text: 'Do not post or share anything that: belongs to someone else and you have no right to share; is obscene or pornographic; invades anyone’s privacy; harasses or insults anyone, including because of gender, religion, caste, race or ethnicity; is harmful to children; infringes copyright, trademarks or other rights; is false or misleading, or pretends to come from someone else; promotes gambling, money laundering or violence; threatens the unity, security or public order of India; contains viruses or harmful code; or breaks any other law.',
        },
        {
          title: 'Acceptable use',
          text: 'Do not copy or scrape the directory or other content in bulk, use bots or automated tools against the service, try to get around sign-in limits or security, overload our systems, impersonate anyone, or submit false applications, enquiries or complaints. If you break these terms, we may remove the content, block access, or suspend or close your account. Posting unlawful content can lead to penalties under the law, and where the law requires an offence to be reported — for example under the Bharatiya Nyaya Sanhita, 2023 or the Protection of Children from Sexual Offences Act, 2012 — we will report it to the authorities.',
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
          text: 'The service is provided “as is”. To the fullest extent permitted by law, we are not liable for decisions you make based on information on the site, for actions or decisions of institutions or authorities, or for indirect or consequential loss. Nothing in these terms limits rights you have under Indian law that cannot be excluded.',
        },
        {
          title: 'Complaints, governing law and contact',
          text: 'If you have a concern, please tell our grievance officer first so we can try to put it right; the Grievance redressal page explains how, and how quickly we respond. These terms are governed by the laws of India, and disputes that cannot be resolved will be subject to the jurisdiction of the competent courts in India.',
          links: [{ label: 'Grievance redressal', href: '/grievance-redressal' }, { label: 'Privacy policy', href: '/privacy-policy' }],
        },
      ],
    },
    'privacy-policy': {
      title: 'Privacy policy',
      category: 'Legal & privacy',
      updated: '2026-11-24',
      description: 'What personal data Gyaan Vidhya collects, why, who sees it, how long we keep it and the rights you have.',
      sections: [
        {
          title: 'Our promise in short',
          text: 'We collect only what we need to guide you, use it only for what you asked us to do, and keep it safe. Our services are free. We never sell or rent your personal data, and we never give it to other colleges, agents, coaching centres, marketers or data brokers. We share your details with one institution only — the one you ask us to help you apply to — and only after you ask. You can see, download, correct or delete your data, and stop our calls, at any time from My data in your account or by making a privacy request.',
          links: [{ label: 'My data', href: '/account/my-data' }, { label: 'Privacy requests', href: '/privacy-request' }],
        },
        {
          title: 'Who we are and what this policy covers',
          text: 'N.S. Education Society operates Gyaan Vidhya and decides how the personal data described here is used; under India’s Digital Personal Data Protection Act, 2023 (the DPDP Act) we are the “data fiduciary”. This policy covers the Gyaan Vidhya website, student accounts, applications and counsellor call-backs, student reviews, and registrations at The EduQuest fairs and school visits. It follows the DPDP Act and the Digital Personal Data Protection Rules, 2025, which are coming into force in stages, and the Information Technology Act, 2000 and its rules. Our grievance officer answers questions about how we use your data; their contact details are on the Grievance redressal page.',
          links: [{ label: 'Grievance redressal', href: '/grievance-redressal' }],
        },
        {
          title: 'What we collect from you',
          text: 'Account: your email address or mobile number and the name you add; with Google sign-in, the name, email address and account id Google shares with us. Applications: your name, mobile, email, date of birth, gender (optional), city, state and PIN code, a parent’s or guardian’s name and mobile, your highest qualification, board, year and marks, entrance exams and scores, the institution, course, intake year and study mode you want, hostel and budget preferences, and any message you write. Call-backs: your name, mobile, the field you want to discuss, a convenient time and any message. Fair and school registrations: your name, mobile, class, stream, optional email and the other questions on that registration form. Students under 18: a parent’s or guardian’s name, mobile and consent. Reviews: your name, course, optional college and city, rating and text. And what you tell our team in messages, calls or at a fair.',
        },
        {
          title: 'What we never ask for',
          text: 'We do not ask for passwords, Aadhaar numbers, bank, card or UPI details, or health or biometric information, and you should not send them to us. Under the Information Technology Act, 2000, passwords, financial details, health and biometric information are “sensitive personal data”; we do not collect them.',
        },
        {
          title: 'What we collect automatically',
          text: 'When you send an application, call-back request, fair registration or review, we keep a record of your consent — the wording you agreed to, the time, your IP address and browser — so we can show what you agreed to. Essential cookies keep you signed in and remember your cookie choice. Only if you choose “Accept all” do we record, against a random id, what you search for, the filters you use and the universities you open, to recommend colleges to you; we do not store your IP address or browser details with this activity. To count free profile views for visitors who are not signed in, we keep a random id and the profiles opened. Our servers also keep technical and security logs.',
          links: [{ label: 'Cookies & browser storage', href: '/cookie-policy' }],
        },
        {
          title: 'Why we use it',
          text: 'To sign you in and keep your account secure; to handle the applications and call-back requests you send and contact you about them; to help with an institution’s admission process when you ask us to; to follow up on fair registrations about the courses you were interested in; to show recommendations, only if you accepted personalisation; to check and publish reviews; to answer your messages and requests; to prevent misuse and fraud; to understand, as totals, how the service is used; and to meet legal duties. Our team uses the details on an enquiry and its contact history to decide whom to call first; this never decides your admission. We rely on your consent, on the details you choose to give us for a specific purpose, and on legal requirements. We never use your data for advertising.',
        },
        {
          title: 'Who we share it with',
          text: 'Our admissions team and counsellors, to help you. The institution you ask us to help you apply to: only after you ask, only that institution, and only the details its application needs. Service providers that process data for us only on our instructions: MongoDB Atlas (database hosting), the servers that run the website, an email-delivery service, MSG91 (sign-in codes by SMS) and Google (only if you choose Google sign-in). If you agree to WhatsApp contact, those messages pass through WhatsApp under its own terms. Campus photos and site images are stored with Cloudflare R2 and Cloudinary; they do not receive student data. Authorities: only when the law requires it, such as a court order or a lawful request from a government agency. Your public review shows only your first name, last initial, course and city.',
        },
        {
          title: 'Who we never share it with',
          text: 'We never sell or rent personal data. We never give it to other colleges or universities, admission agents, coaching centres, marketers, advertisers or data brokers. Institutions that take part in our fairs do not receive the list of students who registered with us. If an institution asks for a student’s details without the student asking us to apply there, the answer is no.',
        },
        {
          title: 'How our team handles your data',
          text: 'Only staff who need student data to help students can see it, and what each person sees depends on their role. Every staff member accepts a written data-confidentiality undertaking before they can open student records: they may use a student’s details only to help that student, may not copy or forward them outside our system, and may never ask a student for money. Counsellors see full phone numbers only for the students assigned to them; revealing any other number is recorded. Exports, deletions and other sensitive actions are recorded in an activity log that can be reviewed.',
        },
        {
          title: 'Calls, SMS, WhatsApp and email',
          text: 'We contact only students who asked us to — by sending an application or call-back request, or by registering at a fair — and only through the channels they agreed to, about their own enquiry. You can stop this at any time: tell the caller, reply STOP to any message from us, or withdraw your consent from My data or with a privacy request, and we will stop promptly. We follow TRAI’s rules on commercial calls and SMS. You can also report unwanted commercial calls or SMS by calling or texting 1909 or through the TRAI DND app.',
          links: [{ label: 'My data', href: '/account/my-data' }, { label: 'Privacy requests', href: '/privacy-request' }],
        },
        {
          title: 'Students under 18 and their parents',
          text: 'Under Indian law anyone under 18 is a child, and many Class 11 and 12 students we meet are under 18. Our forms ask whether you are 18 or older. If you are not, we need your parent’s or guardian’s name, mobile number and consent, which we record with your registration, and we may contact them to confirm it. We do not track or monitor the behaviour of students under 18, and we never direct targeted advertising at them. Personalised recommendations are only for users aged 18 or over, so if you are under 18, choose “Essential only” in Cookie settings. A parent or guardian can ask to see, correct or delete their child’s data, or withdraw consent, through a privacy request. The same applies to a lawful guardian acting for a person with a disability.',
          links: [{ label: 'Privacy requests', href: '/privacy-request' }],
        },
        {
          title: 'How long we keep it',
          text: 'Account details: while your account is open. Applications, call-backs and fair registrations: until the admission cycle ends and the data is no longer needed — and at the latest 24 months after our last contact with you — unless the law requires us to keep them longer; then we delete or anonymise them. Personalisation activity: deleted automatically after 180 days. Anonymous cookie-choice records: 400 days. Free-preview records: 30 days after last use. Sign-in codes: 5 minutes. Reviews: until you delete them. When you delete your account or ask us to erase data, we stop using it; we keep only what the law requires — such as basic registration details for 180 days after an account is closed (IT Rules, 2021) and records of processing for one year (DPDP Rules, 2025) — locked away and used for nothing else, then deleted.',
        },
        {
          title: 'Your rights',
          text: 'You have the right to: get a summary of the personal data we hold about you, what we do with it and who we have shared it with; have it corrected, completed or updated; have it erased when it is no longer needed, unless the law requires us to keep it; withdraw your consent at any time, as easily as you gave it (this does not undo what was done before, and we may no longer be able to help with an application); nominate someone to use these rights for you if you die or become unable to; and have your grievances answered. Parents and guardians can use these rights for a child under 18. In return, the law asks you to give accurate information, not to impersonate anyone and not to make false or frivolous complaints.',
        },
        {
          title: 'How to use your rights',
          text: 'If you have an account, open My data to download a copy of your data, correct your details, stop calls, SMS and WhatsApp, or delete your account. Anyone — including parents, guardians and nominees — can use the Privacy requests page, and every request gets a reference number. We may first confirm it is you, for example with a code sent to the mobile or email we hold; never read such a code out to anyone. We answer as quickly as we can and within 90 days at the latest, and requests are free. If you would like this policy in Hindi or another language listed in the Eighth Schedule to the Constitution, ask us through a privacy request.',
          links: [{ label: 'My data', href: '/account/my-data' }, { label: 'Privacy requests', href: '/privacy-request' }],
        },
        {
          title: 'How we protect it',
          text: 'Pages are served over HTTPS, sessions use HTTP-only cookies, and staff access to student data is limited by role, protected by sign-in and recorded; we keep those access records for at least one year so misuse can be found and investigated. We choose service providers with strong security practices. No system is perfectly secure. If a breach affects your data, we will tell you without delay — what happened, what it may mean for you, what we are doing about it and what you can do — and report it to the Data Protection Board of India as the law requires.',
        },
        {
          title: 'Where your data is stored',
          text: 'Our database and service providers may store data in data centres in India or abroad. Wherever it is stored, this policy applies, and we follow any restriction the Government of India places on transferring personal data outside India.',
        },
        {
          title: 'Changes to this policy',
          text: 'We will update this policy when our services or the law change, show the date of the latest version at the top, and tell you about important changes on the website or by email before they apply. For any privacy question, request or complaint, contact our grievance officer.',
          links: [{ label: 'Grievance redressal', href: '/grievance-redressal' }, { label: 'Terms & conditions', href: '/terms-and-conditions' }],
        },
      ],
    },
    'cookie-policy': {
      title: 'Cookies & browser storage',
      category: 'Legal & privacy',
      updated: '2026-11-24',
      description: 'Every cookie and browser-storage item Gyaan Vidhya uses, why, and how to change your choice.',
      sections: [
        {
          title: 'Essential cookies (always on)',
          text: 'These are needed for the site to work and are set whatever you choose. nsedu_student keeps you signed in: it is HTTP-only, lasts up to 7 days and is cleared when you log out. nsedu_oauth is set for 10 minutes only while you sign in with Google, to keep that sign-in secure. gv_consent remembers your cookie choice for 180 days so we do not ask on every page. gv_preview is a random id (HTTP-only, 30 days) that counts free profile views if you open university profiles without signing in. Our staff console uses its own sign-in cookie (nsedu_admin, 8 hours), which students never receive.',
        },
        {
          title: 'Personalisation cookie (only if you accept)',
          text: 'If you choose “Accept all”, we set a random first-party id (gv_visitor, HTTP-only, 180 days) and record what you search for, the filters you use and the universities you open. We use this only to recommend colleges to you and to see, as totals, what students look for. We never store your IP address, browser details or full web addresses with this activity, and it is deleted automatically after 180 days. Personalisation is for users aged 18 or over: if you are under 18, please choose “Essential only”. If you choose “Essential only”, none of this is set or stored. We do not use advertising or third-party tracking cookies.',
        },
        {
          title: 'Storage on this device',
          text: 'Local storage stays in your browser and is not sent to us. We use it so your choices remain when you return in the same browser: saved stories (nsedu.education.saved.v1), course and city preferences (nsedu:preferences), college and university compare lists (nsedu:compare, nsedu:compare-unis), recent searches (nsedu:recent-searches), your last log-in method (nsedu:login-channel), guide checklist ticks (keys starting nsedu:guide-checklist:) and a daily count of pages explored, used to decide when to suggest logging in (gv_login_nudge). Session storage, cleared when you close the tab, holds one random number (gv:variant) that varies which colleges we feature; it identifies nobody.',
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
      updated: '2026-11-24',
      description: 'What the information on Gyaan Vidhya can and cannot tell you.',
      sections: [
        {
          title: 'Guidance, not an admission authority',
          text: 'Gyaan Vidhya, Guidentra and The EduQuest help students explore options and prepare for admission, free of charge. We are not a university, regulator or admission authority, and nothing on the site is an offer of admission, a guarantee of a seat, scholarship or placement, or official advice. No one can buy a guaranteed seat through us: anyone who offers one for a payment is not acting for Gyaan Vidhya.',
          links: [{ label: 'Report fraud in our name', href: '/grievance-redressal#report-fraud-in-our-name' }],
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
    'privacy-request': {
      // Fallback copy for /privacy-request. The request form is a separate frontend route at the same path
      // (a static route wins over [slug]), which can reuse these sections as its introduction.
      title: 'Privacy requests',
      category: 'Legal & privacy',
      updated: '2026-11-24',
      description: 'Get a copy of your data, correct or delete it, stop our calls or name a nominee — and what happens after you ask.',
      sections: [
        {
          title: 'What you can ask for',
          text: 'A summary or copy of the personal data we hold about you, what we do with it and who we have shared it with; a correction or update; erasure of your data or deletion of your account; withdrawal of your consent, including stopping our calls, SMS and WhatsApp; naming a nominee to use your rights if you die or become unable to; or a complaint about how we handled your data. Requests are free.',
        },
        {
          title: 'The quickest way: My data',
          text: 'If you have a Gyaan Vidhya account, sign in and open My data. There you can download a copy of your data, correct your details, stop calls, SMS and WhatsApp, and delete your account yourself.',
          links: [{ label: 'Open My data', href: '/account/my-data' }],
        },
        {
          title: 'Without an account, or for your child',
          text: 'Students who registered at a fair or asked for a call-back without an account, parents and guardians of students under 18, and nominees can send us a request. Tell us your name, the mobile number or email you gave us, where you gave it (for example the fair, school or university you applied to), what you would like us to do and, if you are asking for someone else, how you are related to them. The grievance officer’s contact details are on the Grievance redressal page.',
          links: [{ label: 'Grievance redressal', href: '/grievance-redressal' }],
        },
        {
          title: 'Confirming it is you',
          text: 'Before we share or delete anything, we check that the request comes from the right person — usually with a one-time code sent to the mobile number or email we already hold. Never read a code out to anyone, including someone who says they are from Gyaan Vidhya. For a student under 18, we confirm with the parent or guardian whose details are on the registration. Do not send identity documents unless we ask for a specific one.',
        },
        {
          title: 'What happens next',
          text: 'You get a reference number to quote in any follow-up. We answer as quickly as we can and within 90 days at the latest. If the law requires us to keep some data for a set period, we will tell you what we kept and why, and use it for nothing else. If you are not satisfied with our answer, the Grievance redressal page explains how to take it further.',
          links: [{ label: 'Privacy policy', href: '/privacy-policy' }],
        },
      ],
    },
    'grievance-redressal': {
      title: 'Grievance redressal',
      category: 'Legal & privacy',
      updated: '2026-11-24',
      description: 'Who handles complaints about your data, our content and our services, how to reach them, and how quickly we respond.',
      sections: [
        {
          // OWNER TO FILL IN: every [bracketed] item below. This is the only place on the site that names them.
          title: 'Grievance officer and data contact',
          text: 'Our grievance officer handles complaints about personal data, about content on Gyaan Vidhya such as student reviews, and about our services. They are also the person who answers your questions about how we process your personal data. Name: [Grievance officer name — to be added]. Designation: [Designation — to be added]. Email: [Grievance email address — to be added]. Phone: [Grievance phone number — to be added], [working days and hours — to be added]. Post: Grievance Officer, N.S. Education Society, [Registered office address — to be added].',
        },
        {
          title: 'What you can raise',
          text: 'A request about your personal data, such as a copy, a correction, erasure, stopping our calls or naming a nominee; a complaint about how we handled your data; a report of a review or other content that is unlawful, abusive, false or about you; a complaint about a counsellor, an event or our service; or a report of someone asking for money or OTPs in our name.',
          links: [{ label: 'Privacy requests', href: '/privacy-request' }],
        },
        {
          title: 'How to raise a grievance',
          text: 'Write to the grievance officer by email or post, or use the Privacy requests page for anything about your personal data. Include your name, the mobile number or email you used with us, what happened, the page or review concerned (with its link) and what you would like us to do. A parent or guardian can write for a child under 18. Do not send passwords, OTPs, bank details or identity documents; if we need to confirm who you are, we will tell you how.',
        },
        {
          title: 'How quickly we respond',
          text: 'Every grievance gets a reference number. Complaints about content on the site: we acknowledge within 24 hours and resolve within 7 days. Requests to remove content that is obscene, invades privacy, harasses, harms children, is false or misleading or impersonates someone: within 36 hours. Content that shows a person’s private areas, nudity or sexual acts, or impersonates them, including morphed images: we act to remove it within 2 hours of the complaint. Requests and complaints about personal data: as quickly as we can, and within 90 days at the latest. We will tell you what we decided and why.',
        },
        {
          title: 'If you are not satisfied',
          text: 'For a grievance about your personal data, you can complain to the Data Protection Board of India after using our grievance process; the law asks you to come to us first. For a decision about content on the site, you can appeal to the Grievance Appellate Committee set up by the Government of India under the Information Technology Rules, 2021. You can also approach the courts. Please do not make false or frivolous complaints: the Digital Personal Data Protection Act, 2023 lists that as a breach of a user’s duties.',
        },
        {
          title: 'Report fraud in our name',
          text: 'Gyaan Vidhya, Guidentra and The EduQuest are free for students. If anyone claiming to be from us asks you for money, an OTP, or bank, card or UPI details, or promises a guaranteed seat for a payment, do not pay or share anything. Tell our grievance officer, and report it to the National Cyber Crime Helpline 1930 or at cybercrime.gov.in.',
          links: [{ label: 'National Cyber Crime Reporting Portal', href: 'https://cybercrime.gov.in' }],
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
