// Pure helpers for the eligibility checker. `config` is the admin-edited `eligibility` content entry
// (stages, qualifications, subjects, years and FICTIONAL sample rules per course id).

export const initialEligibilityAnswers = {
  stage: '', qualification: '', completion: '', courseId: '', admissionYear: '',
  subjects: [], grading: 'percentage', marks: '', cgpaScale: '10',
  examStatus: '', examId: '', examName: '', scoreType: 'percentile', score: '',
};

// Sample rule for a course id, or null. Admin-edited rules may omit subjects.
export const profileFor = (config, id) => (config && Object.hasOwn(config.profiles, id) ? { subjects: [], ...config.profiles[id] } : null);

export function qualificationFor(answers) {
  if (answers.stage === 'school-studying') return { id: 'class12', completed: false };
  if (answers.stage === 'school-completed') return { id: 'class12', completed: true };
  return { id: answers.qualification, completed: answers.completion === 'completed' };
}

export function eligibilitySteps(answers, config) {
  const profile = profileFor(config, answers.courseId);
  return ['stage', ...(['college', 'other'].includes(answers.stage) ? ['qualification'] : []), 'course', 'year',
    ...(profile?.subjects.length ? ['subjects'] : []), 'marks', 'exam', ...(answers.examStatus === 'result' ? ['exam-details'] : []), 'review'];
}

export function validateEligibilityStep(step, answers) {
  if (step === 'stage' && !answers.stage) return 'Choose your study stage to continue.';
  if (step === 'qualification' && (!answers.qualification || !answers.completion)) return 'Choose your qualification and its completion status.';
  if (step === 'course' && !answers.courseId) return 'Choose a course to continue.';
  if (step === 'year' && !answers.admissionYear) return 'Choose the admission year you are planning for.';
  if (step === 'subjects' && !answers.subjects.length) return 'Choose your subjects, or select “I do not have these details yet”.';
  if (step === 'marks' && answers.grading !== 'pending') {
    const limit = answers.grading === 'cgpa' ? Number(answers.cgpaScale) : 100;
    if (!/^\d+(\.\d+)?$/.test(answers.marks.trim()) || Number(answers.marks) < 0 || Number(answers.marks) > limit) return `Enter a valid ${answers.grading === 'cgpa' ? 'CGPA' : 'percentage'} from 0 to ${limit}, or choose “Result / details awaited”.`;
  }
  if (step === 'exam' && !answers.examStatus) return 'Choose your entrance-exam status to continue.';
  if (step === 'exam-details') {
    if (!answers.examId || (answers.examId === 'other' && !answers.examName.trim())) return 'Choose your exam, or enter its name.';
    const score = Number(answers.score);
    if (!/^\d+(\.\d+)?$/.test(answers.score.trim()) || !Number.isFinite(score) || score < 0) return 'Enter a valid value from your scorecard.';
    if (answers.scoreType === 'percentile' && score > 100) return 'A percentile must be between 0 and 100.';
    if (['rank', 'category-rank'].includes(answers.scoreType) && (!Number.isInteger(score) || score < 1)) return 'A rank must be a whole number starting from 1.';
  }
  return '';
}

export function reviewEligibility(answers, config) {
  const profile = profileFor(config, answers.courseId);
  if (!profile || answers.admissionYear !== config.ruleYear) return { state: 'unverified', title: 'Your details are ready for review', description: 'Programme rules for your chosen admission year are needed before we can assess these details.', rows: [] };
  const qualification = qualificationFor(answers);
  const qualificationName = config.qualifications.find((item) => item.id === qualification.id)?.label || 'Not provided';
  const qualificationMatches = profile.qualification === 'degree'
    ? ['degree', 'engineering-degree', 'postgraduate'].includes(qualification.id)
    : qualification.id === profile.qualification;
  const nonstandard = ['diploma', 'other'].includes(qualification.id);
  const rows = [{ label: 'Qualification', requirement: profile.qualification === 'class12' ? 'Completed Class 12' : profile.qualification === 'engineering-degree' ? 'Completed engineering bachelor’s degree' : 'Completed bachelor’s degree', detail: `${qualificationName}${qualification.completed ? ' · completed' : ' · studying / awaiting completion'}`, state: nonstandard ? 'unverified' : !qualificationMatches ? 'not-met' : qualification.completed ? 'match' : 'pending' }];
  if (profile.subjects.length) {
    const pending = answers.subjects.includes('Unknown');
    const missing = profile.subjects.filter((name) => !answers.subjects.includes(name));
    rows.push({ label: 'Subjects', requirement: profile.subjects.join(', '), detail: pending ? 'Details not provided yet' : answers.subjects.join(', ') || 'Not provided', state: pending ? 'pending' : missing.length ? 'not-met' : 'match' });
  }
  rows.push({ label: profile.basis, requirement: `${profile.minimum}% minimum · fictional sample`, detail: answers.grading === 'pending' ? 'Result / details awaited' : answers.grading === 'cgpa' ? `${answers.marks} / ${answers.cgpaScale} CGPA · official conversion needed` : `${answers.marks}%`, state: answers.grading === 'pending' ? 'pending' : answers.grading === 'cgpa' ? 'unverified' : Number(answers.marks) >= profile.minimum ? 'match' : 'not-met' });
  const state = rows.some((row) => row.state === 'not-met') ? 'not-met' : rows.some((row) => row.state === 'unverified') ? 'unverified' : rows.some((row) => row.state === 'pending') ? 'pending' : 'match';
  const copy = {
    match: ['Sample academic criteria match', 'Your answers match this fictional programme’s sample academic criteria. Entrance-route requirements still need a separate check.'],
    'not-met': ['A sample requirement needs attention', 'At least one answer does not meet this fictional programme’s sample criteria. Review the details below before exploring your next route.'],
    pending: ['A few details are still needed', 'You can plan ahead now. Complete or update the pending academic details before assessing the sample requirements.'],
    unverified: ['A programme-specific review is needed', 'An official qualification, equivalence or CGPA conversion rule is needed to assess these answers.'],
  };
  return { state, title: copy[state][0], description: copy[state][1], rows };
}
