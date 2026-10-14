export function filterCollegeRecords(records, { courseId, location = '', maxFee = '', sort = 'default', query = '' }) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = records.filter((row) => {
    const search = `${row.name} ${row.city} ${row.state || ''}`.toLocaleLowerCase();
    return (!courseId || row.courseId === courseId)
      && (!location || row.city === location || row.state === location)
      && (!maxFee || row.annualTuitionInr <= Number(maxFee))
      && terms.every((term) => search.includes(term));
  });
  const comparators = {
    'fee-asc': (a, b) => a.annualTuitionInr - b.annualTuitionInr,
    'fee-desc': (a, b) => b.annualTuitionInr - a.annualTuitionInr,
    salary: (a, b) => (b.medianSalaryLpa ?? -1) - (a.medianSalaryLpa ?? -1),
    rating: (a, b) => b.demoRating - a.demoRating,
  };
  return comparators[sort] ? matches.toSorted(comparators[sort]) : matches;
}

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export function formatTuition(value) { return rupees.format(value); }
export function formatSalary(value) { return value == null ? 'Not provided' : `₹${value} LPA`; }

// ---------------------------------------------------------------------------
// Institution-level helpers for /colleges and /colleges/[id]. Every figure is
// derived from catalogue records: no rankings, popularity or invented values.

export const FEE_LIMITS = [100000, 150000, 200000, 300000];
export const RATING_FLOORS = ['4.0', '4.2', '4.3'];
export const SORT_OPTIONS = [
  { value: 'default', label: 'Default order' },
  { value: 'fee-asc', label: 'Fee: low to high' },
  { value: 'fee-desc', label: 'Fee: high to low' },
  { value: 'salary', label: 'Median package' },
  { value: 'rating', label: 'Demo rating' },
];

const lower = (value) => String(value ?? '').trim().toLocaleLowerCase();
export const placeName = (row) => [row.city, row.state].filter(Boolean).join(', ');
export function formatLakh(value) { return `₹${Number((value / 100000).toFixed(2))} L`; }
export function rangeLabel(min, max, format) {
  if (min == null) return 'Not provided';
  return min === max ? format(min) : `${format(min)} – ${format(max)}`;
}
export const lakhRange = (min, max) => (min == null ? 'Not provided' : min === max ? formatLakh(min) : `₹${Number((min / 100000).toFixed(2))}–${Number((max / 100000).toFixed(2))} L`);
export const lpaRange = (min, max) => (min == null ? 'Not provided' : min === max ? `₹${min} LPA` : `₹${min}–${max} LPA`);

export function median(values) {
  const sorted = values.filter((value) => value != null).toSorted((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2));
}

// City first, then state (case-insensitive). Unknown names stay as typed so old links can explain themselves.
export function resolveLocation(records, value) {
  const wanted = lower(value);
  if (!wanted) return null;
  const city = records.find((row) => lower(row.city) === wanted);
  if (city) return { type: 'city', name: city.city, state: city.state };
  const state = records.find((row) => lower(row.state) === wanted);
  if (state) return { type: 'state', name: state.state };
  return { type: 'unknown', name: String(value).trim() };
}

export function filterPrograms(records, { field = '', courseId = '', location = '', maxFee = '', minRating = '', query = '' } = {}, courses = []) {
  const byId = new Map(courses.map((course) => [course.id, course]));
  const place = lower(location);
  const terms = lower(query).split(/\s+/).filter(Boolean);
  return records.filter((row) => {
    const course = byId.get(row.courseId);
    if (field && course?.field !== field) return false;
    if (courseId && row.courseId !== courseId) return false;
    if (place && lower(row.city) !== place && lower(row.state) !== place) return false;
    if (maxFee && row.annualTuitionInr > Number(maxFee)) return false;
    if (minRating && row.demoRating < Number(minRating)) return false;
    if (!terms.length) return true;
    const text = lower([row.name, row.shortName, row.city, row.state, row.courseId, course?.name, course?.fullName].join(' '));
    return terms.every((term) => text.includes(term));
  });
}

// One entry per institution, in first-seen (catalogue) order, holding its matching programmes.
export function groupByInstitution(rows) {
  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row.collegeId);
    if (group) group.rows.push(row);
    else groups.set(row.collegeId, { id: row.collegeId, name: row.name, shortName: row.shortName, city: row.city, state: row.state, demoRating: row.demoRating, art: row.art, rows: [row] });
  }
  return [...groups.values()];
}

// Institution counts per option of each filter group, with that group's own filter removed.
// Field counts also ignore the course, so another field can always be chosen. 'any' = the group's total.
export function facetCounts(records, criteria, courses) {
  const byId = new Map(courses.map((course) => [course.id, course]));
  const count = (omit, keysOf) => {
    const rest = { ...criteria };
    for (const key of omit) rest[key] = '';
    const sets = new Map();
    for (const row of filterPrograms(records, rest, courses)) {
      for (const key of ['any', ...keysOf(row)]) {
        if (!sets.has(key)) sets.set(key, new Set());
        sets.get(key).add(row.collegeId);
      }
    }
    return new Map([...sets].map(([key, set]) => [key, set.size]));
  };
  return {
    field: count(['field', 'courseId'], (row) => [byId.get(row.courseId)?.field].filter(Boolean)),
    courseId: count(['courseId'], (row) => [row.courseId]),
    location: count(['location'], (row) => [...new Set([row.city, row.state].filter(Boolean))]),
    maxFee: count(['maxFee'], (row) => FEE_LIMITS.filter((fee) => row.annualTuitionInr <= fee).map(String)),
    minRating: count(['minRating'], (row) => RATING_FLOORS.filter((floor) => row.demoRating >= Number(floor))),
  };
}

const minFee = (group) => Math.min(...group.rows.map((row) => row.annualTuitionInr));
const maxFee = (group) => Math.max(...group.rows.map((row) => row.annualTuitionInr));
const bestMedian = (group) => Math.max(-1, ...group.rows.map((row) => row.medianSalaryLpa ?? -1));
const groupComparators = {
  'fee-asc': (a, b) => minFee(a) - minFee(b),
  'fee-desc': (a, b) => maxFee(b) - maxFee(a),
  salary: (a, b) => bestMedian(b) - bestMedian(a),
  rating: (a, b) => b.demoRating - a.demoRating,
};
const rowComparators = {
  'fee-asc': (a, b) => a.annualTuitionInr - b.annualTuitionInr,
  'fee-desc': (a, b) => b.annualTuitionInr - a.annualTuitionInr,
  salary: (a, b) => (b.medianSalaryLpa ?? -1) - (a.medianSalaryLpa ?? -1),
};
// Default keeps catalogue order; programmes inside a card follow the same sort.
export function sortGroups(groups, sort) {
  const compare = groupComparators[sort];
  const sorted = compare ? groups.toSorted(compare) : groups;
  return rowComparators[sort] ? sorted.map((group) => ({ ...group, rows: group.rows.toSorted(rowComparators[sort]) })) : sorted;
}

export function summarize(rows) {
  const fees = rows.map((row) => row.annualTuitionInr).filter(Number.isFinite);
  const medians = rows.map((row) => row.medianSalaryLpa).filter((value) => value != null);
  const highest = rows.map((row) => row.highestSalaryLpa).filter((value) => value != null);
  return {
    programmes: rows.length,
    institutions: new Set(rows.map((row) => row.collegeId)).size,
    feeMin: fees.length ? Math.min(...fees) : null,
    feeMax: fees.length ? Math.max(...fees) : null,
    medianMin: medians.length ? Math.min(...medians) : null,
    medianMax: medians.length ? Math.max(...medians) : null,
    highestMax: highest.length ? Math.max(...highest) : null,
    withPlacements: medians.length,
    tuitionYear: rows.find((row) => row.tuitionYear)?.tuitionYear || '',
    placementYear: rows.find((row) => row.placementYear)?.placementYear || '',
  };
}

// Median of the listed median packages per course, only where at least two programmes report one.
export function courseBenchmarks(records) {
  const values = new Map();
  for (const row of records) if (row.medianSalaryLpa != null) values.set(row.courseId, [...(values.get(row.courseId) || []), row.medianSalaryLpa]);
  return new Map([...values].filter(([, list]) => list.length >= 2).map(([courseId, list]) => [courseId, { value: median(list), count: list.length }]));
}

export function getInstitution(records, collegeId) {
  return groupByInstitution(records.filter((row) => row.collegeId === collegeId))[0] || null;
}

// Score = 2 × shared courses + 2 for the same city + 1 for the same state.
export function similarInstitutions(records, collegeId, limit = 4) {
  const self = getInstitution(records, collegeId);
  if (!self) return [];
  const courseIds = new Set(self.rows.map((row) => row.courseId));
  return groupByInstitution(records.filter((row) => row.collegeId !== collegeId))
    .map((group) => {
      const shared = group.rows.filter((row) => courseIds.has(row.courseId));
      const score = 2 * shared.length + (group.city === self.city ? 2 : 0) + (group.state && group.state === self.state ? 1 : 0);
      return { ...group, shared, score };
    })
    .filter((group) => group.score > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, limit);
}
