// Shared, pure helpers for the course and exam pages (used by server pages and client components).

// Course `level` and exam `level` / `courseSlugs` / `note` are catalogue fields edited in the admin console.
export const LEVEL_LABEL = { UG: 'Undergraduate', PG: 'Postgraduate' };

export const courseLevel = (course) => (LEVEL_LABEL[course?.level] ? course.level : null);
export const examLevel = (exam) => (LEVEL_LABEL[exam?.level] ? exam.level : null);

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

// Exams with `courseSlugs` list their courses explicitly; others match courses in the same field (and level when known).
export function relatedCourses(exam, courses) {
  const ids = exam.courseSlugs;
  if (ids?.length) return ids.map((id) => courses.find((course) => course.id === id)).filter(Boolean);
  const level = examLevel(exam);
  return courses.filter((course) => course.field === exam.field && (!level || courseLevel(course) === level));
}

export function relatedExams(course, exams) {
  return exams.filter((exam) => {
    const ids = exam.courseSlugs;
    if (ids?.length) return ids.includes(course.id);
    const level = examLevel(exam);
    return exam.field === course.field && (!level || level === courseLevel(course));
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
