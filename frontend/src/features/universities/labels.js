// Display labels for the directory vocabulary (values come from the API schema).
export const TYPE_LABELS = { university: 'University', college: 'College', institute: 'Institute', other: 'Other' };
export const CATEGORY_LABELS = {
  'central-university': 'Central university', 'state-university': 'State university', 'deemed-university': 'Deemed university',
  'private-university': 'Private university', 'institute-of-national-importance': 'Institute of National Importance',
  'autonomous-college': 'Autonomous college', 'affiliated-college': 'Affiliated college', 'standalone-institution': 'Standalone institution', other: 'Other',
};
export const OWNERSHIP_LABELS = { public: 'Public / government', private: 'Private', 'public-private': 'Public–private', unknown: 'Not specified' };
export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Best match' },
  { value: 'name', label: 'Name: A to Z' },
  { value: '-name', label: 'Name: Z to A' },
  { value: 'nirf', label: 'NIRF rank (ranked only)' },
  { value: 'established', label: 'Oldest first' },
];

export const labelOf = (map, value) => map[value] || value;
export const placeOf = (item) => [item.city, item.state].filter(Boolean).join(', ');
// Category when it is specific ("State university"), otherwise the broad type ("College").
export const kindOf = (item) => (item.category && item.category !== 'other' ? labelOf(CATEGORY_LABELS, item.category) : labelOf(TYPE_LABELS, item.type));
export const ownershipOf = (item) => (item.ownership && item.ownership !== 'unknown' ? labelOf(OWNERSHIP_LABELS, item.ownership) : '');
export const nirfOf = (item) => (item.nirfRank ? `#${item.nirfRank}${item.nirfYear ? ` · ${item.nirfYear}` : ''}` : '');

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const formatInr = (value) => rupees.format(value);
export const formatCount = (value) => new Intl.NumberFormat('en-IN').format(value);
const lakh = (value) => Number((value / 100000).toFixed(2));
// ₹1.2 L, or ₹1.1–6.5 L for a range.
export const lakhRange = (min, max) => (min == null ? '' : min === max || max == null ? `₹${lakh(min)} L` : `₹${lakh(min)}–${lakh(max)} L`);
export const formatLpa = (value) => (value == null ? '' : `₹${value} LPA`);
export const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
export const shortDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// Initials for institutions without a logo, e.g. "Indian Institute of Technology Bombay" -> "IB".
export function monogram(name = '') {
  const words = name.replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !/^(of|and|the|for)$/i.test(word));
  return ((words[0]?.[0] || name[0] || 'U') + (words.at(-1)?.[0] || '')).toUpperCase();
}

export function sourceNote(item) {
  if (item.isIllustrative) return 'Illustrative profile';
  if (item.verification === 'verified') return 'Verified by Gyaan Vidhya';
  if (item.source?.kind === 'scrape') return `From the official website${item.source.fetchedAt ? ` · ${new Date(item.source.fetchedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}`;
  return 'Not yet verified';
}
