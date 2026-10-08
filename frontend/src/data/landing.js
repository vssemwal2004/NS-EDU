export const cities = ['Bengaluru', 'Pune', 'Delhi NCR', 'Mumbai', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Kolkata'];
export const fields = [
  { label: 'Engineering', icon: 'gear' }, { label: 'Management', icon: 'people' },
  { label: 'Medical', icon: 'medical' }, { label: 'Design', icon: 'palette' },
  { label: 'Law', icon: 'scales' }, { label: 'Commerce', icon: 'bars' },
];
export const courses = [
  { id: 'btech', name: 'B.Tech', icon: 'cap', field: 'Engineering', fullName: 'Bachelor of Technology', summary: 'Explore engineering branches, practical learning and technology-focused career paths.' },
  { id: 'mba', name: 'MBA', icon: 'chart', field: 'Management', fullName: 'Master of Business Administration', summary: 'Explore management specialisations, business skills and leadership-focused study.' },
  { id: 'bcom', name: 'B.Com', icon: 'document', field: 'Commerce', fullName: 'Bachelor of Commerce', summary: 'Explore accounting, commerce, finance and business-related study options.' },
  { id: 'bca', name: 'BCA', icon: 'laptop', field: 'Computing', fullName: 'Bachelor of Computer Applications', summary: 'Explore software, computing and application development as a study direction.' },
  { id: 'mbbs', name: 'MBBS', icon: 'medical', field: 'Medical', fullName: 'Bachelor of Medicine and Bachelor of Surgery', summary: 'Explore medical education and review the official admission requirements before applying.' },
  { id: 'bdes', name: 'B.Des', icon: 'palette', field: 'Design', fullName: 'Bachelor of Design', summary: 'Explore visual, product, communication and other design-related study areas.' },
  { id: 'llb', name: 'LL.B', icon: 'scales', field: 'Law', fullName: 'Bachelor of Laws', summary: 'Explore legal study and the different institution-specific routes into a law programme.' },
  { id: 'bba', name: 'BBA', icon: 'people', field: 'Management', fullName: 'Bachelor of Business Administration', summary: 'Explore business study options and compare individual programme details.' },
  { id: 'mtech', name: 'M.Tech', icon: 'gear', field: 'Engineering', fullName: 'Master of Technology', summary: 'Explore postgraduate engineering programmes and their institution-specific requirements.' },
  { id: 'bpharm', name: 'B.Pharm', icon: 'science', field: 'Pharmacy', fullName: 'Bachelor of Pharmacy', summary: 'Review pharmacy programmes, curricula and official admission information.' },
  { id: 'nursing', name: 'B.Sc Nursing', icon: 'medical', field: 'Healthcare', summary: 'Review nursing programmes and the official requirements of each institution.' },
  { id: 'ba', name: 'BA', icon: 'book', field: 'Arts', fullName: 'Bachelor of Arts', summary: 'Explore arts subjects and compare programme curricula.' },
  { id: 'bams', name: 'BAMS', icon: 'medical', field: 'Medical', summary: 'Review the official programme prospectus and admission requirements.' },
  { id: 'bhms', name: 'BHMS', icon: 'medical', field: 'Medical', summary: 'Review the official programme prospectus and admission requirements.' },
  { id: 'bds', name: 'BDS', icon: 'medical', field: 'Dentistry', summary: 'Explore dentistry programmes through official institution information.' },
  { id: 'bhm', name: 'BHM', icon: 'people', field: 'Hospitality', summary: 'Explore hospitality programmes and compare practical learning opportunities.' },
];
export const exams = [
  { id: 'jee', name: 'JEE Main', field: 'Engineering', icon: 'gear', summary: 'Start with the official eligibility, syllabus and admission information.', href: 'https://jeemain.nta.nic.in/' },
  { id: 'neet', name: 'NEET UG', field: 'Medical', icon: 'medical', summary: 'Review the official bulletin and participating admission requirements.', href: 'https://neet.nta.nic.in/' },
  { id: 'cuet', name: 'CUET UG', field: 'Undergraduate', icon: 'book', summary: 'Review subject choices alongside each university’s programme requirements.', href: 'https://cuet.nta.nic.in/' },
  { id: 'cat', name: 'CAT', field: 'Management', icon: 'chart', summary: 'Use the official exam information and individual programme requirements.', href: 'https://iimcat.ac.in/' },
];
export const navigation = [
  { label: 'Colleges', items: [{ label: 'Explore all colleges', type: 'Colleges' }, { label: 'Colleges by city', type: 'Colleges' }, { label: 'Colleges by field', type: 'Courses' }] },
  { label: 'Courses', items: [{ label: 'Explore all courses', type: 'Courses' }, { label: 'Engineering', type: 'Courses', query: 'Engineering' }, { label: 'Management', type: 'Courses', query: 'Management' }, { label: 'Design', type: 'Courses', query: 'Design' }] },
  { label: 'Exams', items: exams.map((exam) => ({ label: exam.name, type: 'Exams', query: exam.name })) },
  { label: 'Compare', tool: 'compare' },
  { label: 'Scholarships', tool: 'scholarships' },
  { label: 'Career guidance', tool: 'guidance' },
  { label: 'Resources', items: [{ label: 'Check eligibility', tool: 'eligibility' }, { label: 'Check college budget', tool: 'budget' }, { label: 'Admission checklist', tool: 'admissions' }, { label: 'Exam guides', type: 'Exams' }] },
];
export const shortcuts = [
  { id: 'compare', title: 'Compare colleges', description: 'Fees, courses and facilities', icon: 'scales' },
  { id: 'eligibility', title: 'Check eligibility', description: 'Understand admission requirements', icon: 'eligibility' },
  { id: 'scholarships', title: 'Explore scholarships', description: 'Find funding options', icon: 'cap' },
  { id: 'guidance', title: 'Career guidance', description: 'Explore suitable career paths', icon: 'compass' },
];
export const toolGuides = {
  compare: { title: 'Compare colleges', intro: 'Build a useful comparison around the details that matter to you.', items: ['Compare the same course and admission year.', 'Check tuition, hostel and other costs separately.', 'Review facilities and placement reports with their source and year.'], note: 'Try the sample comparison in the course-wise college section below. Verified college records will be added with the live directory.' },
  eligibility: { title: 'Check eligibility', intro: 'Start with your course, then confirm the requirements with the institution.', items: ['Check required subjects and qualifications.', 'Review entrance exam and admission-route requirements.', 'Read the official prospectus for the year you plan to apply.'], note: 'Final eligibility depends on the course, institution and admission cycle.' },
  scholarships: { title: 'Explore scholarships', intro: 'Keep these details together while you research funding options.', items: ['Look for institution, government and other scholarship programmes.', 'Check eligibility, required documents and the official deadline.', 'Confirm what costs the scholarship covers and any renewal conditions.'], note: 'A searchable scholarship directory will be added in a later release.' },
  guidance: { title: 'Explore your career direction', intro: 'A thoughtful choice starts with what you enjoy and how you want to learn.', items: ['Which subjects or activities hold your interest?', 'Do you prefer practical projects, research, people or creative work?', 'Explore course content and everyday work before choosing a path.'], note: 'Personalised counselling and AI guidance are planned for a later release.' },
  admissions: { title: 'Before you apply', intro: 'Prepare the essentials for a clear, organised application.', items: ['Confirm the course and your eligibility.', 'Review the complete fee structure and official admission notice.', 'Keep marksheets, identity documents and any exam results ready.'], note: 'Application submission and tracking will arrive with the admissions workflow.' },
};
