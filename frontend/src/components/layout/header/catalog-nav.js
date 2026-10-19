import { fieldIcons } from '@/data/navigation';

// Pure navigation helpers derived from the catalogue. No 'use client' so the
// server-rendered footer can call them too. Every number shown in navigation
// comes from these counts; nothing is invented.

export const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;
export const streamId = (field) => field.toLowerCase().replace(/[^a-z0-9]+/g, '-');
export const withCourse = (href, courseId) => courseId ? `${href}?course=${encodeURIComponent(courseId)}` : href;
export const examHref = (examId) => `/exams/${encodeURIComponent(examId)}`;
export const courseHref = (courseId) => `/courses/${encodeURIComponent(courseId)}`;
export const collegesHref =(courseId, location = '') => `/colleges?course=${encodeURIComponent(courseId)}${location ? `&location=${encodeURIComponent(location)}` : ''}`;

// Deterministic (server and browser agree): ₹2.4L, ₹90K.
export function compactRupees(value) {
  if (value >= 1e5) return `₹${Number((value / 1e5).toFixed(1))}L`;
  return `₹${Math.round(value / 1e3)}K`;
}

function tally(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) || 0) + 1);
  return counts;
}
const range = (values) => values.length ? [Math.min(...values), Math.max(...values)] : null;

function citySummaries(rows, names) {
  const byCity = new Map();
  for (const row of rows) byCity.set(row.city, [...(byCity.get(row.city) || []), row]);
  const order = names?.length ? names : [...byCity.keys()];
  return order.filter((name) => byCity.has(name))
    .map((name) => {
      const cityRows = byCity.get(name);
      const perCourse = [...tally(cityRows, 'courseId')].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
      return { name, count: cityRows.length, courseId: perCourse[0][0], courseIds: perCourse.map(([id]) => id), state: cityRows[0].state || '' };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function buildCatalogNav({ courses = [], colleges = [], exams = [], cities = [] }) {
  const perCourse = tally(colleges, 'courseId');
  const cityNames = cities.map((city) => city.name);
  const rich = courses.map((course) => ({ ...course, count: perCourse.get(course.id) || 0 }));
  const fields = [...new Set(courses.map((course) => course.field))];

  const streams = fields.map((field) => {
    const streamCourses = rich.filter((course) => course.field === field).sort((a, b) => b.count - a.count || Number(b.popular) - Number(a.popular));
    const ids = new Set(streamCourses.map((course) => course.id));
    const rows = colleges.filter((row) => ids.has(row.courseId));
    return {
      field,
      id: streamId(field),
      icon: fieldIcons[field] || streamCourses[0].icon,
      count: rows.length,
      courses: streamCourses,
      topCourse: streamCourses[0].id,
      cities: citySummaries(rows, cityNames),
      exams: exams.filter((exam) => exam.field === field),
      programmes: rows.toSorted((a, b) => (b.demoRating ?? 0) - (a.demoRating ?? 0) || a.annualTuitionInr - b.annualTuitionInr),
      fees: range(rows.map((row) => row.annualTuitionInr)),
      salary: range(rows.map((row) => row.medianSalaryLpa).filter((value) => value != null)),
    };
  }).sort((a, b) => b.count - a.count || a.field.localeCompare(b.field));

  return {
    streams,
    courses: rich,
    popular: rich.filter((course) => course.popular),
    cities: citySummaries(colleges, cityNames),
    cityCount: (name) => colleges.filter((row) => row.city === name || row.state === name).length,
    total: colleges.length,
  };
}
