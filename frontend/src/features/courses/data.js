// Shared, pure helpers for the course and exam pages (used by server pages and client components).

// Degree level by course id. General knowledge about Indian degrees, not catalogue data:
// courses an admin adds later get level null (no badge, listed only under "All").
export const COURSE_LEVELS = {
  btech: 'UG', bcom: 'UG', bca: 'UG', mbbs: 'UG', bdes: 'UG', llb: 'UG', bba: 'UG', bpharm: 'UG',
  nursing: 'UG', ba: 'UG', bams: 'UG', bhms: 'UG', bds: 'UG', bhm: 'UG',
  mba: 'PG', mtech: 'PG',
};
export const LEVEL_LABEL = { UG: 'Undergraduate', PG: 'Postgraduate' };

// Which courses an exam is commonly used for. General knowledge — verify against each official bulletin.
// Exams missing here fall back to same field (and same level when known).
export const EXAM_COURSES = {
  jee: ['btech'],
  neet: ['mbbs', 'bds', 'bams', 'bhms'],
  cuet: ['ba', 'bcom', 'bba', 'bca'],
  cat: ['mba'],
};
export const EXAM_LEVELS = { jee: 'UG', neet: 'UG', cuet: 'UG', cat: 'PG' };

export const EXAM_NOTES = {
  cuet: 'Participating universities decide which programmes use CUET UG scores — check each university.',
};

export const courseLevel = (id) => COURSE_LEVELS[id] || null;
export const examLevel = (id) => EXAM_LEVELS[id] || null;

export function median(values) {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function spread(values) {
  return values.length ? { min: Math.min(...values), max: Math.max(...values), median: median(values) } : null;
}

export function courseStats(courseId, colleges) {
  const rows = colleges.filter((row) => row.courseId === courseId);
  const tuition = rows.map((row) => row.annualTuitionInr).filter((value) => typeof value === 'number');
  const salary = rows.map((row) => row.medianSalaryLpa).filter((value) => typeof value === 'number');
  return {
    rows,
    programmes: rows.length,
    institutions: new Set(rows.map((row) => row.collegeId)).size,
    cities: new Set(rows.map((row) => row.city).filter(Boolean)).size,
    tuition: spread(tuition),
    salary: salary.length ? { ...spread(salary), reported: salary.length } : null,
    tuitionYear: rows.find((row) => row.tuitionYear)?.tuitionYear || '',
    placementYear: rows.find((row) => row.placementYear)?.placementYear || '',
  };
}

export function relatedCourses(exam, courses) {
  const ids = EXAM_COURSES[exam.id];
  if (ids) return ids.map((id) => courses.find((course) => course.id === id)).filter(Boolean);
  const level = examLevel(exam.id);
  return courses.filter((course) => course.field === exam.field && (!level || courseLevel(course.id) === level));
}

export function relatedExams(course, exams) {
  return exams.filter((exam) => {
    const ids = EXAM_COURSES[exam.id];
    if (ids) return ids.includes(course.id);
    const level = examLevel(exam.id);
    return exam.field === course.field && (!level || level === courseLevel(course.id));
  });
}

// ₹70,000 → '₹0.7L', ₹1,60,000 → '₹1.6L'. Written by hand: Intl compact en-IN prints '₹70.0K'.
export function formatLakh(value) {
  if (value == null) return '—';
  if (value >= 1e7) return `₹${trim(value / 1e7)}Cr`;
  return `₹${trim(value / 1e5)}L`;
}
const trim = (value) => (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');
export const formatLpa = (value) => (value == null ? 'Not reported' : `₹${trim(value)} LPA`);

export function formatRange(min, max, format) {
  return min === max ? format(min) : `${format(min)}–${format(max)}`;
}
export const lpaRange = (salary) => (salary.min === salary.max ? formatLpa(salary.min) : `₹${trim(salary.min)}–${trim(salary.max)} LPA`);

export function hostname(href) {
  try { return new URL(href).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;
