// Sample programme/institution counts per place. A row counts for its city and its
// state, matching filterCollegeRecords (row.city === name || row.state === name).
export function countByPlace(colleges, courseId = '') {
  const places = new Map();
  for (const row of colleges) {
    if (courseId && row.courseId !== courseId) continue;
    for (const name of new Set([row.city, row.state].filter(Boolean))) {
      const entry = places.get(name) || { programmes: 0, colleges: new Set(), courses: new Set() };
      entry.programmes += 1;
      entry.colleges.add(row.collegeId);
      entry.courses.add(row.courseId);
      places.set(name, entry);
    }
  }
  return new Map([...places].map(([name, entry]) => [name, { programmes: entry.programmes, institutions: entry.colleges.size, courseIds: [...entry.courses] }]));
}

export const emptyCount = { programmes: 0, institutions: 0, courseIds: [] };
export const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;
export const programmeLabel = ({ programmes }) => programmes ? `${plural(programmes, 'sample programme')}` : 'No sample colleges yet';

export function placeHref(name, course) {
  return `/colleges?${new URLSearchParams({ location: name, ...(course ? { course } : {}) })}`;
}
