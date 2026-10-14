import { formatTuition } from '@/lib/college-catalog';

// Pure helpers for /compare. Everything here is derived from the catalogue only:
// no rankings, popularity or invented figures.
export const MAX = 3;
export const STORAGE_KEY = 'nsedu:compare';

export function groupByCourse(colleges) {
  const groups = new Map();
  for (const row of colleges) {
    if (!groups.has(row.courseId)) groups.set(row.courseId, []);
    groups.get(row.courseId).push(row);
  }
  return groups;
}

export function parseStore(raw) {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

// Keep only known programmes of this course, once each, at most MAX.
export function sanitizeIds(ids, rows) {
  const known = new Set(rows.map((row) => row.id));
  return [...new Set(Array.isArray(ids) ? ids : [])].filter((id) => known.has(id)).slice(0, MAX);
}

export function compareHref(courseId, ids = []) {
  return `/compare?course=${encodeURIComponent(courseId)}${ids.length ? `&c=${ids.map(encodeURIComponent).join(',')}` : ''}`;
}

export function shortFee(value) {
  return `₹${Number((value / 100000).toFixed(2))} L`;
}

export function feeRange(rows) {
  const fees = rows.map((row) => row.annualTuitionInr);
  const min = Math.min(...fees);
  const max = Math.max(...fees);
  return min === max ? formatTuition(min) : `${formatTuition(min)} – ${formatTuition(max)}`;
}

function maxOf(rows, key) {
  const values = rows.map((row) => row[key]).filter((value) => value != null);
  return values.length ? Math.max(...values) : null;
}

// Course-wide scale so bars never exaggerate small gaps inside a selection.
export function courseStats(rows) {
  const fees = rows.map((row) => row.annualTuitionInr);
  return {
    count: rows.length,
    feeMin: Math.min(...fees),
    feeMax: Math.max(...fees),
    medianMax: maxOf(rows, 'medianSalaryLpa'),
    highestMax: maxOf(rows, 'highestSalaryLpa'),
  };
}

// Ids holding the lowest/highest value, only when at least two values exist and they differ.
export function bestIds(selected, key, mode) {
  const present = selected.filter((row) => row[key] != null);
  if (present.length < 2) return null;
  const values = present.map((row) => row[key]);
  const target = mode === 'min' ? Math.min(...values) : Math.max(...values);
  if (values.every((value) => value === target)) return null;
  return { target, ids: new Set(present.filter((row) => row[key] === target).map((row) => row.id)) };
}

// One-click "add similar": the unselected programme whose fee is closest to the selection's mean.
export function similarPick(rows, selected) {
  const candidates = rows.filter((row) => !selected.some((item) => item.id === row.id));
  if (!candidates.length) return null;
  if (!selected.length) {
    return { row: candidates.toSorted((a, b) => a.annualTuitionInr - b.annualTuitionInr)[0], reason: 'lowest fee' };
  }
  const mean = selected.reduce((sum, row) => sum + row.annualTuitionInr, 0) / selected.length;
  const row = candidates.toSorted((a, b) => Math.abs(a.annualTuitionInr - mean) - Math.abs(b.annualTuitionInr - mean))[0];
  return { row, reason: 'closest fee' };
}

export function joinNames(rows) {
  const names = rows.map((row) => row.shortName || row.name);
  return names.length > 2 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names.join(' vs ');
}

// Ready-made comparisons generated from the catalogue (not from popularity or traffic).
export function buildSuggestions(courses, groups) {
  const cards = [];
  for (const course of courses) {
    const rows = groups.get(course.id) || [];
    if (rows.length < 2) continue;
    const add = (items, reason) => {
      const ids = items.map((row) => row.id);
      const key = `${course.id}:${ids.toSorted().join(',')}`;
      if (!cards.some((card) => card.key === key)) cards.push({ key, course, rows: items, ids, reason, href: compareHref(course.id, ids) });
    };
    const sameCity = rows.every((row) => row.city === rows[0].city);
    if (rows.length <= MAX) {
      add(rows, sameCity ? `Same city · ${rows[0].city}` : rows.length === 2 ? 'Both listed colleges' : 'Every listed college');
      continue;
    }
    const byCity = groupBy(rows, 'city');
    for (const [city, items] of byCity) if (items.length > 1) add(items.slice(0, MAX), `Same city · ${city}`);
    const byFee = rows.toSorted((a, b) => a.annualTuitionInr - b.annualTuitionInr);
    let closest = null;
    for (let index = 1; index < byFee.length; index += 1) {
      const gap = byFee[index].annualTuitionInr - byFee[index - 1].annualTuitionInr;
      if (!closest || gap < closest.gap) closest = { gap, items: [byFee[index - 1], byFee[index]] };
    }
    if (closest) add(closest.items, 'Similar fees');
    add([byFee[0], byFee.at(-1)], 'Fee range');
    const salaried = rows.filter((row) => row.medianSalaryLpa != null).toSorted((a, b) => b.medianSalaryLpa - a.medianSalaryLpa);
    if (salaried.length > 1) add(salaried.slice(0, 2), 'Highest median salaries');
  }
  return cards;
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) map.set(row[key], [...(map.get(row[key]) || []), row]);
  return map;
}
