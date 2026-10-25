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
// NIRF ranks are published per subject list, so the category is part of the fact: "Pharmacy #13"
// is honest where a bare "#13" would read as an overall rank. The category is omitted only when
// the source did not record which list the rank came from.
export const nirfOf = (item) => (item.nirfRank
  ? `${item.nirfCategory ? `${item.nirfCategory} ` : ''}#${item.nirfRank}${item.nirfYear ? ` · ${item.nirfYear}` : ''}`
  : '');

// Every NIRF list an institution appears in, as "University #2". The directory stores these either
// as parallel arrays or as text ("University: 2; Overall: 9"); both forms are read here, for the
// profile and the comparison board alike.
export function nirfPairs(directory = {}) {
  const ranks = Array.isArray(directory.nirfRanks) ? directory.nirfRanks : [];
  const categories = Array.isArray(directory.nirfCategories) ? directory.nirfCategories
    : String(directory.nirfCategories ?? '').split(/[;,]/).map((part) => part.trim()).filter(Boolean);
  if (ranks.length && ranks.length === categories.length) return categories.map((category, index) => `${category} #${ranks[index]}`);
  return [...String(typeof directory.nirfRanks === 'string' ? directory.nirfRanks : '').matchAll(/([^;:]+):\s*([\d–-]+)/g)]
    .map((match) => `${match[1].trim()} #${match[2].trim()}`);
}

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const formatInr = (value) => rupees.format(value);
export const formatCount = (value) => new Intl.NumberFormat('en-IN').format(value);
const lakh = (value) => Number((value / 100000).toFixed(2));
// ₹1.2 L, or ₹1.1–6.5 L for a range.
export const lakhRange = (min, max) => (min == null ? '' : min === max || max == null ? `₹${lakh(min)} L` : `₹${lakh(min)}–${lakh(max)} L`);
export const formatLpa = (value) => (value == null ? '' : `₹${value} LPA`);
// Scraped single amounts: lakhs once they are big enough to read that way, plain rupees below.
export const shortInr = (value) => (value == null ? '' : value >= 100000 ? `₹${lakh(value)} L` : `₹${formatCount(Math.round(value))}`);
export const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
export const shortDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// Initials for institutions without a logo, e.g. "Indian Institute of Technology Bombay" -> "IB".
export function monogram(name = '') {
  const words = name.replace(/[^A-Za-z\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !/^(of|and|the|for)$/i.test(word));
  return ((words[0]?.[0] || name[0] || 'U') + (words.at(-1)?.[0] || '')).toUpperCase();
}

// The two figures every student asks for first. Curated programme rows win over scraped ones; when
// neither exists the caller prints "Not published" rather than an estimate.
export function feeOf(item) {
  const curated = item.programmes;
  if (curated?.feeMin != null) return { value: lakhRange(curated.feeMin, curated.feeMax), note: curated.tuitionYear ? `tuition · ${curated.tuitionYear}` : 'annual tuition' };
  const scraped = item.preview?.feeFromInr;
  return scraped != null ? { value: shortInr(scraped), note: 'lowest published fee' } : null;
}

export function packageOf(preview) {
  if (!preview) return null;
  const year = preview.placementYear ? ` · ${preview.placementYear}` : '';
  if (preview.averagePackageLpa != null) return { value: `₹${preview.averagePackageLpa} LPA`, note: `average package${year}` };
  if (preview.highestPackageLpa != null) return { value: `₹${preview.highestPackageLpa} LPA`, note: `highest package${year}` };
  if (preview.placedPercent != null) return { value: `${preview.placedPercent}%`, note: `students placed${year}` };
  return null;
}

// The second figure in a listing row. Placement is what students ask for, but most institutions do
// not publish it, and two "Not published" lines make a real record look empty — so the slot falls
// back to the next fact the institution does state about itself.
export function secondStatOf(item) {
  const placement = packageOf(item.preview);
  if (placement) return { label: 'Placement', fact: placement, empty: '' };
  if (item.naacGrade) return { label: 'Accreditation', fact: { value: `NAAC ${item.naacGrade}`, note: 'graded by NAAC' }, empty: '' };
  const programmes = item.preview?.programmeCount ?? 0;
  if (programmes > 0) return { label: 'Programmes', fact: { value: formatCount(programmes), note: 'listed on its site' }, empty: '' };
  const acres = item.preview?.campusAcres;
  if (acres) return { label: 'Campus', fact: { value: `${acres} acres`, note: 'stated by the institution' }, empty: '' };
  return { label: 'Placement', fact: null, empty: 'Not published' };
}

// Website chrome the scraper sometimes takes for a description, such as "Note: Contents on this
// website are published and managed by…" (kept in step with backend/src/scraper/deep.js).
const ABOUT_BOILERPLATE = /contents? (on|of) this (web)?site|website (is )?(published|managed|maintained)|(published|managed|maintained) (and managed )?by (the )?(web|it) (team|cell)|all rights reserved|best viewed (in|with)/i;
/** The scraped description when it really describes the institution, otherwise ''. */
export const usableAbout = (value) => {
  const about = typeof value === 'string' ? value.trim() : '';
  return about.length >= 80 && !ABOUT_BOILERPLATE.test(about) ? about : '';
};

export function sourceNote(item) {
  if (item.isIllustrative) return 'Illustrative profile';
  if (item.verification === 'verified') return 'Verified by Gyaan Vidhya';
  if (item.source?.kind === 'scrape') return `From the official website${item.source.fetchedAt ? ` · ${new Date(item.source.fetchedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}`;
  return 'Not yet verified';
}
