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

export const PROGRAMME_LEVELS = ['UG', 'PG', 'Diploma', 'PhD'];

const year = new Date().getFullYear();

// Sub-schemas for the structured fields the deep scraper fills. Every value is optional and every
// row carries the page it was read from, so a reviewer can check it. `credit` exists because the
// photographs belong to the institution, not to us: see src/scraper/README.md.
const text = (name, label, maxLength = 160) => ({ name, label, type: 'string', maxLength });
const DIRECTORY_FIELDS = [
  text('aisheCode', 'AISHE code', 20),
  text('managementLabel', 'Management (source)', 80),
  text('institutionType', 'Institution type (source)', 80),
  text('area', 'Rural / urban', 20),
  text('affiliatingAishe', 'Affiliating AISHE code', 20),
  text('selectionBasis', 'Selection basis', 160),
  text('nirfCategories', 'NIRF categories', 200),
  text('nirfRanks', 'NIRF category ranks', 200),
  text('naacCgpa', 'NAAC CGPA', 10),
  text('naacDeclaredOn', 'NAAC declared on', 10),
  text('naacCycle', 'NAAC cycle', 10),
  text('naacNote', 'NAAC note', 200),
  text('aicteId', 'AICTE ID', 40),
  text('aicteNote', 'AICTE note', 200),
  text('ugcNote', 'UGC note', 200),
  text('nbaNote', 'NBA note', 200),
  text('compiledOn', 'Compiled on', 10),
  { name: 'sources', label: 'Source links', type: 'stringList', maxItems: 6, maxLength: 300 },
];

const AWARD_FIELDS = [
  { name: 'title', label: 'Award or recognition', type: 'string', required: true, maxLength: 220 },
  { name: 'year', label: 'Year', type: 'integer', nullable: true, min: 1800, max: new Date().getFullYear() },
];

const GALLERY_FIELDS = [
  { name: 'url', label: 'Image URL', type: 'url', required: true },
  { name: 'caption', label: 'Caption', type: 'string', maxLength: 160 },
  { name: 'credit', label: 'Credit', type: 'string', maxLength: 80, default: 'official website' },
  { name: 'sourcePage', label: 'Source page', type: 'url' },
  { name: 'width', label: 'Width', type: 'integer', nullable: true, min: 1, max: 10_000 },
  { name: 'height', label: 'Height', type: 'integer', nullable: true, min: 1, max: 10_000 },
];

const PROGRAMME_ROW_FIELDS = [
  { name: 'name', label: 'Programme', type: 'string', required: true, maxLength: 160 },
  { name: 'level', label: 'Level', type: 'select', options: ['', ...PROGRAMME_LEVELS], default: '' },
  { name: 'durationYears', label: 'Duration (years)', type: 'number', nullable: true, min: 0.5, max: 10 },
  // Only ever set when the page prints a per-year rupee amount for this programme; never estimated.
  { name: 'annualFeeInr', label: 'Annual fee (INR)', type: 'integer', nullable: true, min: 0, max: 10_000_000 },
  { name: 'feeNote', label: 'Fee note', type: 'string', maxLength: 160 },
  { name: 'sourcePage', label: 'Source page', type: 'url' },
];

const PLACEMENT_FIELDS = [
  { name: 'year', label: 'Placement year', type: 'integer', nullable: true, min: 2000, max: year },
  { name: 'averagePackageLpa', label: 'Average package (LPA)', type: 'number', nullable: true, min: 0, max: 1000 },
  { name: 'highestPackageLpa', label: 'Highest package (LPA)', type: 'number', nullable: true, min: 0, max: 1000 },
  { name: 'medianPackageLpa', label: 'Median package (LPA)', type: 'number', nullable: true, min: 0, max: 1000 },
  { name: 'placedPercent', label: 'Students placed (%)', type: 'number', nullable: true, min: 0, max: 100 },
  { name: 'recruiters', label: 'Recruiters', type: 'stringList', maxItems: 20, maxLength: 80 },
  { name: 'sourcePage', label: 'Source page', type: 'url' },
];

const CAMPUS_FIELDS = [
  { name: 'sizeAcres', label: 'Campus size (acres)', type: 'number', nullable: true, min: 0.1, max: 50_000 },
  { name: 'hostelAvailable', label: 'Hostel available', type: 'boolean', nullable: true },
  { name: 'coEd', label: 'Co-educational', type: 'boolean', nullable: true },
  { name: 'sourcePage', label: 'Source page', type: 'url' },
];

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
  { name: 'aboutSource', label: 'About source page', type: 'url', help: 'The page the summary was read from.' },
  { name: 'logoUrl', label: 'Logo URL', type: 'url', help: 'Upload to Cloudinary from the media screen and paste the URL.' },
  { name: 'coverUrl', label: 'Cover image URL', type: 'url' },
  // --- Deep-scrape detail. All optional; absent means "we have not found it", never "none".
  { name: 'gallery', label: 'Campus photos', type: 'objectList', maxItems: 12, fields: GALLERY_FIELDS, machine: true,
    help: 'Photographs from the institution\'s own site, re-hosted on Cloudinary. Each row keeps its credit and source page.' },
  { name: 'programmesOffered', label: 'Programme details', type: 'objectList', maxItems: 60, fields: PROGRAMME_ROW_FIELDS, machine: true,
    help: 'Structured programme rows. The plain name list stays in "Programmes offered".' },
  { name: 'placements', label: 'Placements', type: 'object', fields: PLACEMENT_FIELDS, machine: true,
    help: 'Only figures printed on the official placement page, with the year they belong to.' },
  { name: 'facilities', label: 'Facilities', type: 'stringList', maxItems: 20, maxLength: 60, help: 'Hostel, library, labs, sports … only when the site names them.' },
  { name: 'activities', label: 'Student activities', type: 'stringList', maxItems: 20, maxLength: 80, help: 'Clubs, NSS/NCC, fests … only when the site names them.' },
  { name: 'awards', label: 'Awards & recognitions', type: 'objectList', maxItems: 12, fields: AWARD_FIELDS, machine: true,
    help: 'Stated by the institution on its own site, quoted as printed with its year.' },
  { name: 'campus', label: 'Campus', type: 'object', fields: CAMPUS_FIELDS, machine: true },
  // Verbatim directory snapshot (AISHE/NAAC/AICTE/NIRF). These are historical source records, not
  // current approvals, so each value keeps its own snapshot date, note and source link.
  { name: 'directory', label: 'Directory snapshot', type: 'object', fields: DIRECTORY_FIELDS, machine: true,
    help: 'Imported source values. Shown to students with their snapshot date and source, never as a current approval.' },
  { name: 'admissionNote', label: 'Admission note', type: 'text', maxLength: 400, help: 'Factual extract from the admissions page.' },
  { name: 'entranceExams', label: 'Entrance exams', type: 'stringList', maxItems: 12, maxLength: 60 },
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

// Structured fields no plain text input can edit. An admin form should render a purpose-built
// editor for these or leave them out; posting a string for one is ignored, never saved.
export const MACHINE_FIELDS = INSTITUTION_FIELDS.filter((field) => field.machine).map((field) => field.name);
