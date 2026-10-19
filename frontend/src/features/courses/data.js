// Shared, pure helpers for the course and exam pages (server and client).

// Course `level` and exam `level` / `courseSlugs` / `note` are catalogue fields edited in the admin console.
export const LEVEL_LABEL = { UG: 'Undergraduate', PG: 'Postgraduate' };

export const courseLevel = (course) => (LEVEL_LABEL[course?.level] ? course.level : null);
export const examLevel = (exam) => (LEVEL_LABEL[exam?.level] ? exam.level : null);

// Each stream keeps one palette tint everywhere (mosaic tile, course cards, detail header).
const TONES = ['oxblood', 'blush', 'champagne', 'wine', 'sand', 'rose'];
const STREAM_TONES = {
  Medical: 'wine', Engineering: 'oxblood', Management: 'champagne', Computing: 'blush', Commerce: 'sand', Design: 'rose',
  Law: 'sand', Pharmacy: 'blush', Healthcare: 'champagne', Arts: 'rose', Dentistry: 'blush', Hospitality: 'champagne', Undergraduate: 'sand',
};
export function streamTone(field = '') {
  if (STREAM_TONES[field]) return STREAM_TONES[field];
  let hash = 0;
  for (const char of field) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}
export const isDarkTone = (tone) => tone === 'oxblood' || tone === 'wine';

// Streams ordered by course count, then name.
export function streamsOf(courses) {
  const map = new Map();
  for (const course of courses) {
    if (!map.has(course.field)) map.set(course.field, []);
    map.get(course.field).push(course);
  }
  return [...map].map(([name, items]) => ({ name, courses: items, tone: streamTone(name), icon: items[0].icon }))
    .sort((a, b) => b.courses.length - a.courses.length || a.name.localeCompare(b.name));
}

export function median(values) {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function spread(values) {
  return values.length ? { min: Math.min(...values), max: Math.max(...values), median: median(values) } : null;
}

// Figures come only from the curated (illustrative) programme rows of /api/catalog/colleges.
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
export const formatRange = (min, max, format) => (min === max ? format(min) : `${format(min)}–${format(max)}`);
export const lpaRange = (salary) => (salary.min === salary.max ? formatLpa(salary.min) : `₹${trim(salary.min)}–${trim(salary.max)} LPA`);

export function hostname(href) {
  try { return new URL(href).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

export const firstParam = (value) => String((Array.isArray(value) ? value[0] : value) ?? '').trim().slice(0, 80);

export function matchesTerms(text, query) {
  const haystack = text.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}
