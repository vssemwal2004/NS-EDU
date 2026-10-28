import { collection, COLLECTIONS } from '../../db/collections.js';
import { slugify } from '../../lib/validation.js';
import { normalizeIdentifier } from '../student-auth/otp.js';
import { derivedFields } from '../universities/normalize.js';
import { IMPORTABLE_FIELDS, INSTITUTION_FIELDS, INSTITUTION_TYPES, LEGACY_INSTITUTION_FIELDS, PROGRAMME_LEVELS, VERIFICATION } from '../universities/schema.js';

export const ICONS = ['cap', 'chart', 'bars', 'people', 'document', 'book', 'science', 'medical', 'palette', 'scales', 'laptop', 'commerce', 'gear', 'building', 'compass'];

const slug = (help = 'Leave blank to generate it from the name.') => ({ name: 'slug', label: 'Slug', type: 'slug', generated: true, help });
const order = { name: 'order', label: 'Display order', type: 'integer', min: 0, max: 100_000, default: 0, help: 'Lower numbers are listed first.' };
const active = { name: 'active', label: 'Visible to students', type: 'boolean', default: true };
const icon = { name: 'icon', label: 'Icon', type: 'select', options: ICONS, required: true, default: 'cap' };
const level = { name: 'level', label: 'Level', type: 'select', options: ['UG', 'PG'], help: 'UG = undergraduate, PG = postgraduate. Leave empty if not classified.' };
const crop = { name: 'crop', label: 'Artwork crop', type: 'numberArray4', nullable: true, min: 0, max: 5000, help: 'x, y, width, height in the 1784 × 882 landmark artwork. Leave empty for no artwork.' };
// Same rule as normalizeIdentifier('phone'), so a value that passes is always normalized to +91XXXXXXXXXX.
const phoneField = { type: 'string', maxLength: 20, pattern: /^(?:\+91|91|0)?[\s-]?[6-9](?:[\s-]?\d){9}$/, patternMessage: 'Enter a 10-digit Indian mobile number' };
// Student pages order places by how many institutions each lists; these fields only dress the tile.
const byCountNote = 'Kept for reference only: places are listed by how many institutions they have.';
const placeFields = [
  { name: 'name', label: 'Name', type: 'string', required: true, maxLength: 60 },
  { name: 'landmark', label: 'Landmark', type: 'string', maxLength: 80 },
  { name: 'imageUrl', label: 'Tile image', type: 'image', usage: 'place', help: 'A landscape photo, at least 800 px wide. It replaces the artwork crop; without either, a designed tile is shown.' },
  { name: 'imageAlt', label: 'Image description', type: 'string', maxLength: 160, help: 'What the photo shows, for screen readers, e.g. "Gateway of India at sunset". Defaults to the place name.' },
  crop,
  { name: 'featured', label: 'Featured', type: 'boolean', default: false, help: byCountNote },
  { ...order, help: byCountNote }, active,
];

// One registry drives validation, list search, the admin form metadata and slug rules.
export const resources = {
  courses: {
    label: 'Courses', singular: 'course', titleField: 'name', uniqueField: 'slug', searchFields: ['name', 'fullName', 'field', 'slug', 'aliases'],
    referencedBy: 'courseSlug', slugFrom: (doc) => doc.name,
    fields: [
      { name: 'name', label: 'Short name', type: 'string', required: true, maxLength: 80 },
      slug(),
      { name: 'fullName', label: 'Full name', type: 'string', maxLength: 160 },
      { name: 'field', label: 'Field of study', type: 'string', required: true, maxLength: 60 },
      icon,
      { name: 'summary', label: 'Summary', type: 'text', maxLength: 400 },
      { ...level, options: PROGRAMME_LEVELS, help: 'UG, PG, Diploma or PhD. Integrated programmes entered after class 12 are UG.' },
      { name: 'aliases', label: 'Other spellings', type: 'stringList', maxItems: 30, maxLength: 120, help: 'Comma separated names institutions print for this course, e.g. "B.Sc Agri, B.Sc (Hons) Agriculture". Used to link institutions\' programmes to it.' },
      { name: 'popular', label: 'Popular course', type: 'boolean', default: false },
      order, active,
    ],
  },
  exams: {
    label: 'Exams', singular: 'exam', titleField: 'name', uniqueField: 'slug', searchFields: ['name', 'field', 'slug'],
    slugFrom: (doc) => doc.name,
    fields: [
      { name: 'name', label: 'Name', type: 'string', required: true, maxLength: 80 },
      slug(),
      { name: 'field', label: 'Field', type: 'string', required: true, maxLength: 60 },
      icon,
      { name: 'summary', label: 'Summary', type: 'text', maxLength: 400 },
      { name: 'href', label: 'Official website', type: 'url', required: true },
      { ...level, label: 'Admission level', help: 'UG or PG admissions. Used to suggest related courses when none are listed below.' },
      { name: 'courseSlugs', label: 'Related course slugs', type: 'stringList', maxItems: 30, maxLength: 100, help: 'Comma-separated course slugs this exam is commonly used for, e.g. btech. Leave empty to match courses in the same field and level.' },
      { name: 'note', label: 'Note for students', type: 'text', maxLength: 300, help: 'Optional caveat shown on the exam guide.' },
      order, active,
    ],
  },
  // Universities and colleges. Sized for 20k+ records: prefix-indexed search, equality filters,
  // derived search keys on every write, and admin-edited fields locked against importer/scraper overwrites.
  institutions: {
    label: 'Universities', singular: 'university', titleField: 'name', uniqueField: 'slug', searchFields: ['name', 'shortName', 'city', 'state', 'slug'],
    searchMode: 'prefixes', sortField: 'nameKey', listProjection: { searchPrefixes: 0 },
    filters: { verification: VERIFICATION, type: INSTITUTION_TYPES, state: 'string', active: 'boolean', 'source.kind': ['seed', 'admin', 'import', 'scrape'] },
    referencedBy: 'institutionSlug', slugFrom: (doc) => doc.name,
    fields: [...INSTITUTION_FIELDS, ...LEGACY_INSTITUTION_FIELDS],
    beforeWrite(data, existing) {
      const merged = { ...existing, ...data };
      const extra = derivedFields(merged);
      if (!existing) {
        const filled = IMPORTABLE_FIELDS.filter((key) => ![undefined, null, ''].includes(data[key]) && !(Array.isArray(data[key]) && !data[key].length));
        Object.assign(extra, { source: { kind: 'admin', name: 'Admin console', url: '', fetchedAt: new Date() }, lockedFields: filled });
      }
      return extra;
    },
    // Fields an administrator sets by hand are protected from later automated imports.
    lockOnEdit: IMPORTABLE_FIELDS,
  },
  programmes: {
    label: 'Programmes', singular: 'programme', titleField: 'slug', uniqueField: 'slug', searchFields: ['slug', 'institutionSlug', 'courseSlug'],
    slugFrom: (doc) => doc.institutionSlug && doc.courseSlug ? `${doc.institutionSlug}-${doc.courseSlug}` : '',
    // Institution names for the rows on this page only (the directory is too large to preload).
    async decorate(docs) {
      const slugs = [...new Set(docs.map((doc) => doc.institutionSlug))];
      const names = new Map((await (await collection(COLLECTIONS.institutions)).find({ slug: { $in: slugs } }, { projection: { slug: 1, name: 1 } }).toArray()).map((item) => [item.slug, item.name]));
      return docs.map((doc) => ({ ...doc, institutionName: names.get(doc.institutionSlug) ?? '' }));
    },
    fields: [
      { name: 'institutionSlug', label: 'Institution', type: 'reference', ref: 'institutions', required: true },
      { name: 'courseSlug', label: 'Course', type: 'reference', ref: 'courses', required: true },
      slug('Leave blank to generate it from the institution and course.'),
      { name: 'annualTuitionInr', label: 'Annual tuition (INR)', type: 'integer', required: true, min: 0, max: 100_000_000 },
      { name: 'medianSalaryLpa', label: 'Median salary (LPA)', type: 'number', nullable: true, min: 0, max: 1000 },
      { name: 'highestSalaryLpa', label: 'Highest salary (LPA)', type: 'number', nullable: true, min: 0, max: 1000 },
      { name: 'tuitionYear', label: 'Tuition year', type: 'string', required: true, maxLength: 20, default: '2026–27' },
      { name: 'placementYear', label: 'Placement year', type: 'string', required: true, maxLength: 20, default: '2024–25' },
      order, active,
    ],
  },
  cities: {
    label: 'Cities', singular: 'city', titleField: 'name', uniqueField: 'name', searchFields: ['name', 'landmark'],
    fields: placeFields,
  },
  states: {
    label: 'States', singular: 'state', titleField: 'name', uniqueField: 'name', searchFields: ['name', 'landmark'],
    fields: placeFields,
  },
  scholarships: {
    label: 'Scholarships', singular: 'scholarship', titleField: 'label', uniqueField: 'slug', searchFields: ['label', 'description', 'slug'],
    slugFrom: (doc) => doc.label,
    fields: [
      { name: 'label', label: 'Name', type: 'string', required: true, maxLength: 120 },
      slug('Leave blank to generate it from the name.'),
      { name: 'href', label: 'Official website', type: 'url', required: true },
      { name: 'description', label: 'Description', type: 'text', maxLength: 400 },
      order, active,
    ],
  },
  // Career guidance (/career-guidance). Counsellors and callback leads point at a field by slug,
  // so renaming a field is safe and its slug is frozen while counsellors use it.
  career_fields: {
    label: 'Career fields', singular: 'career field', titleField: 'name', uniqueField: 'slug', searchFields: ['name', 'slug', 'description'],
    slugFrom: (doc) => doc.name,
    references: [{ collection: COLLECTIONS.counsellors, field: 'fieldSlug', noun: 'counsellor' }],
    fields: [
      { name: 'name', label: 'Name', type: 'string', required: true, maxLength: 60 },
      slug('Leave blank to generate it from the name. It cannot change while counsellors belong to this field.'),
      { ...icon, default: 'compass' },
      { name: 'description', label: 'Description', type: 'text', maxLength: 300, help: 'One or two sentences shown above this field’s counsellors.' },
      order, active,
    ],
  },
  counsellors: {
    label: 'Counsellors', singular: 'counsellor', titleField: 'name', searchFields: ['name', 'title', 'fieldSlug', 'languages'],
    fields: [
      { name: 'name', label: 'Name', type: 'string', required: true, minLength: 2, maxLength: 80 },
      { name: 'title', label: 'Title', type: 'string', maxLength: 80, help: 'e.g. Engineering admissions counsellor' },
      { name: 'fieldSlug', label: 'Career field', type: 'reference', ref: 'career_fields', required: true },
      { name: 'isMaster', label: 'Lead counsellor for this field', type: 'boolean', default: false, help: 'Listed first with a “Lead counsellor” badge.' },
      { ...phoneField, name: 'phone', label: 'Mobile number', required: true, help: 'Use a work number only: every logged-in student can see and call it.' },
      { ...phoneField, name: 'whatsapp', label: 'WhatsApp number', help: 'Leave empty to hide the WhatsApp button.' },
      { name: 'photoUrl', label: 'Photo', type: 'image', usage: 'counsellor', help: 'A square head-and-shoulders photo. Leave empty to show their initials.' },
      { name: 'languages', label: 'Languages', type: 'stringList', maxItems: 8, maxLength: 30, help: 'Comma separated, e.g. Hindi, English' },
      { name: 'availability', label: 'Availability', type: 'string', maxLength: 80, help: 'e.g. Mon–Sat, 10 am–6 pm' },
      order, active,
    ],
    // Stored as +91XXXXXXXXXX (the pattern above guarantees it parses) so tel: and wa.me links are uniform.
    beforeWrite: (data) => Object.fromEntries(['phone', 'whatsapp'].filter((key) => data[key]).map((key) => [key, normalizeIdentifier('phone', data[key]).value])),
  },
};

export const generateSlug = (resource, doc) => slugify(resource.slugFrom?.(doc) ?? '');

const OPTIONAL_FIELD_KEYS = ['options', 'ref', 'min', 'max', 'maxLength', 'maxItems', 'nullable', 'default', 'help', 'usage'];

export function describeResources() {
  return Object.fromEntries(Object.entries(resources).map(([name, resource]) => [name, {
    label: resource.label,
    singular: resource.singular,
    searchFields: resource.searchFields,
    filters: resource.filters ?? {},
    fields: resource.fields.map((field) => ({
      name: field.name, label: field.label, type: field.type, required: Boolean(field.required),
      ...Object.fromEntries(OPTIONAL_FIELD_KEYS.filter((key) => field[key] !== undefined).map((key) => [key, field[key]])),
    })),
  }]));
}
