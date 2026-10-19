// Shared vocabulary for institutions (the `institutions` collection, exposed publicly as /api/universities).
// The admin form, CSV/JSON import and the scraper all validate against INSTITUTION_FIELDS.
export const INSTITUTION_TYPES = ['university', 'college', 'institute', 'other'];
export const INSTITUTION_CATEGORIES = [
  'central-university', 'state-university', 'deemed-university', 'private-university',
  'institute-of-national-importance', 'autonomous-college', 'affiliated-college', 'standalone-institution', 'other',
];
export const OWNERSHIP = ['public', 'private', 'public-private', 'unknown'];
export const VERIFICATION = ['unverified', 'verified', 'rejected'];
export const NAAC_GRADES = ['A++', 'A+', 'A', 'B++', 'B+', 'B', 'C', 'D'];
export const STREAMS = [
  'Engineering', 'Management', 'Medical', 'Pharmacy', 'Nursing', 'Dental', 'Law', 'Design', 'Architecture',
  'Science', 'Commerce', 'Arts & Humanities', 'Computer Applications', 'Education', 'Agriculture',
  'Hospitality', 'Media & Journalism', 'Paramedical', 'Vocational',
];
export const APPROVAL_BODIES = ['UGC', 'AICTE', 'NMC', 'DCI', 'INC', 'PCI', 'BCI', 'NCTE', 'COA', 'ICAR', 'NCHM', 'AIU'];

const year = new Date().getFullYear();

export const INSTITUTION_FIELDS = [
  { name: 'name', label: 'Name', type: 'string', required: true, maxLength: 200 },
  { name: 'slug', label: 'Slug', type: 'slug', generated: true, help: 'Leave blank to generate it from the name.' },
  { name: 'shortName', label: 'Short name', type: 'string', maxLength: 80, help: 'Common short form, e.g. IIT Bombay.' },
  { name: 'aliases', label: 'Other names', type: 'stringList', maxItems: 10, maxLength: 200, help: 'Comma separated. Former names and common abbreviations improve search.' },
  { name: 'type', label: 'Type', type: 'select', options: INSTITUTION_TYPES, default: 'university' },
  { name: 'category', label: 'Category', type: 'select', options: INSTITUTION_CATEGORIES, default: 'other' },
  { name: 'ownership', label: 'Ownership', type: 'select', options: OWNERSHIP, default: 'unknown' },
  { name: 'establishedYear', label: 'Established', type: 'integer', nullable: true, min: 1800, max: year },
  { name: 'website', label: 'Official website', type: 'url' },
  { name: 'admissionUrl', label: 'Admissions page', type: 'url' },
  { name: 'email', label: 'Institutional email', type: 'string', maxLength: 254, help: 'General enquiries address only. Never store personal staff contacts.' },
  { name: 'phone', label: 'Institutional phone', type: 'string', maxLength: 40 },
  { name: 'address', label: 'Address', type: 'text', maxLength: 400 },
  { name: 'city', label: 'City', type: 'string', required: true, maxLength: 80 },
  { name: 'district', label: 'District', type: 'string', maxLength: 80 },
  { name: 'state', label: 'State / UT', type: 'string', nullable: true, maxLength: 60 },
  { name: 'pincode', label: 'PIN code', type: 'string', maxLength: 6, pattern: /^(\d{6})?$/, patternMessage: 'Use a 6-digit PIN code' },
  { name: 'affiliatedTo', label: 'Affiliated to', type: 'string', maxLength: 200 },
  { name: 'approvals', label: 'Approvals', type: 'stringList', maxItems: 12, maxLength: 20, help: `Comma separated, e.g. ${APPROVAL_BODIES.slice(0, 4).join(', ')}.` },
  { name: 'naacGrade', label: 'NAAC grade', type: 'select', options: ['', ...NAAC_GRADES], default: '' },
  { name: 'nirfRank', label: 'NIRF rank', type: 'integer', nullable: true, min: 1, max: 1000 },
  { name: 'nirfYear', label: 'NIRF year', type: 'integer', nullable: true, min: 2016, max: year },
  { name: 'streams', label: 'Streams', type: 'stringList', maxItems: 20, maxLength: 40, help: `Comma separated, e.g. ${STREAMS.slice(0, 4).join(', ')}.` },
  { name: 'courseSlugs', label: 'Catalogue courses', type: 'stringList', maxItems: 60, maxLength: 60, help: 'Slugs of courses in the catalogue (e.g. btech, mba).' },
  { name: 'coursesOffered', label: 'Programmes offered', type: 'stringList', maxItems: 200, maxLength: 160, help: 'Programme names as published by the institution.' },
  { name: 'about', label: 'About', type: 'text', maxLength: 1500 },
  { name: 'logoUrl', label: 'Logo URL', type: 'url', help: 'Upload to Cloudinary from the media screen and paste the URL.' },
  { name: 'coverUrl', label: 'Cover image URL', type: 'url' },
  { name: 'popularity', label: 'Popularity boost', type: 'integer', min: 0, max: 1_000_000, default: 0, help: 'Higher numbers rank first in default search order.' },
  { name: 'verification', label: 'Verification', type: 'select', options: VERIFICATION, default: 'unverified' },
  { name: 'isIllustrative', label: 'Illustrative (fictional) data', type: 'boolean', default: false },
  { name: 'active', label: 'Visible to students', type: 'boolean', default: true },
];

// Legacy fields kept for the illustrative seed colleges and their artwork.
export const LEGACY_INSTITUTION_FIELDS = [
  { name: 'demoRating', label: 'Demo rating', type: 'number', nullable: true, min: 0, max: 5 },
  { name: 'art', label: 'Campus art window', type: 'numberArray4', nullable: true, min: 0, max: 5000, help: 'x, y, width, height of the illustrative campus artwork.' },
  { name: 'order', label: 'Display order', type: 'integer', min: 0, max: 100_000, default: 0 },
];

// Fields an importer or scraper may write. Admin edits lock a field so automated runs never overwrite it.
export const IMPORTABLE_FIELDS = INSTITUTION_FIELDS.map((field) => field.name)
  .filter((name) => !['slug', 'popularity', 'verification', 'isIllustrative', 'active'].includes(name));
