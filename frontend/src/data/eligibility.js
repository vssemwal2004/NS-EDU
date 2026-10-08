// Fictional academic profiles for the static eligibility preview.
// Replace these records with institution/programme/year-specific verified rules later.
// These are NOT general admission requirements for the named courses.
export const studyStages = [
  { id: 'school-studying', label: 'Studying in Class 12', titleLines: ['Studying in', 'Class 12'], description: 'I am currently in Class 12 and planning my next step.', art: 'notebook' },
  { id: 'school-completed', label: 'Class 12 completed', titleLines: ['Class 12', 'completed'], description: 'I have completed Class 12 through my school board.', art: 'certificate' },
  { id: 'college', label: 'College student / graduate', titleLines: ['College student /', 'graduate'], description: 'I am pursuing or have completed a degree.', art: 'graduation' },
];
export const qualificationOptions = [
  { id: 'class12', label: 'Class 12 / equivalent' },
  { id: 'diploma', label: 'Diploma' },
  { id: 'engineering-degree', label: 'Engineering bachelor’s degree' },
  { id: 'degree', label: 'Another bachelor’s degree' },
  { id: 'postgraduate', label: 'Postgraduate degree' },
  { id: 'other', label: 'Another qualification' },
];
export const subjectOptions = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'Commerce', 'Computer Science', 'Other'];
export const admissionYears = ['2026–27', '2027–28', '2028–29'];

const school = (minimum, subjects = [], basis = 'Class 12 aggregate (%)') => ({ qualification: 'class12', minimum, subjects, basis });
const degree = (minimum, qualification = 'degree') => ({ qualification, minimum, subjects: [], basis: 'Bachelor’s degree aggregate (%)' });
export const eligibilityDemoProfiles = {
  btech: school(50, ['Physics', 'Chemistry', 'Mathematics'], 'PCM aggregate (%)'),
  bcom: school(45),
  bba: school(45),
  ba: school(40),
  bca: school(50, ['Mathematics']),
  bdes: school(45),
  bhm: school(45),
  bpharm: school(50, ['Physics', 'Chemistry', 'Biology'], 'PCB aggregate (%)'),
  mba: degree(50),
  mtech: degree(55, 'engineering-degree'),
  llb: degree(45),
};
// Medical programme rules are deliberately absent: real notices and route-specific
// criteria are required. Those courses still support a profile/review workflow.
export const initialEligibilityAnswers = {
  stage: '', qualification: '', completion: '', courseId: '', admissionYear: '',
  subjects: [], grading: 'percentage', marks: '', cgpaScale: '10',
  examStatus: '', examId: '', examName: '', scoreType: 'percentile', score: '',
};
