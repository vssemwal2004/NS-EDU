import { slugify } from '../../lib/validation.js';

export const ICONS = ['cap', 'chart', 'bars', 'people', 'document', 'book', 'science', 'medical', 'palette', 'scales', 'laptop', 'commerce', 'gear', 'building', 'compass'];

const slug = (help = 'Leave blank to generate it from the name.') => ({ name: 'slug', label: 'Slug', type: 'slug', generated: true, help });
const order = { name: 'order', label: 'Display order', type: 'integer', min: 0, max: 100_000, default: 0, help: 'Lower numbers are listed first.' };
const active = { name: 'active', label: 'Visible to students', type: 'boolean', default: true };
const icon = { name: 'icon', label: 'Icon', type: 'select', options: ICONS, required: true, default: 'cap' };
const crop = { name: 'crop', label: 'Artwork crop', type: 'numberArray4', nullable: true, min: 0, max: 5000, help: 'x, y, width, height in the 1784 × 882 landmark artwork. Leave empty for no artwork.' };

// One registry drives validation, list search, the admin form metadata and slug rules.
export const resources = {
  courses: {
    label: 'Courses', singular: 'course', titleField: 'name', uniqueField: 'slug', searchFields: ['name', 'fullName', 'field', 'slug'],
    referencedBy: 'courseSlug', slugFrom: (doc) => doc.name,
    fields: [
      { name: 'name', label: 'Short name', type: 'string', required: true, maxLength: 80 },
      slug(),
      { name: 'fullName', label: 'Full name', type: 'string', maxLength: 160 },
      { name: 'field', label: 'Field of study', type: 'string', required: true, maxLength: 60 },
      icon,
      { name: 'summary', label: 'Summary', type: 'text', maxLength: 400 },
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
      order, active,
    ],
  },
  institutions: {
    label: 'Institutions', singular: 'institution', titleField: 'name', uniqueField: 'slug', searchFields: ['name', 'shortName', 'city', 'state', 'slug'],
    referencedBy: 'institutionSlug', slugFrom: (doc) => doc.name,
    fields: [
      { name: 'name', label: 'Name', type: 'string', required: true, maxLength: 120 },
      slug(),
      { name: 'shortName', label: 'Short name', type: 'string', required: true, maxLength: 60 },
      { name: 'city', label: 'City', type: 'string', required: true, maxLength: 60 },
      { name: 'state', label: 'State', type: 'string', nullable: true, maxLength: 60, help: 'Leave empty when the city spans several states (e.g. Delhi NCR).' },
      { name: 'demoRating', label: 'Demo rating', type: 'number', required: true, min: 0, max: 5 },
      { name: 'art', label: 'Campus art window', type: 'numberArray4', required: true, min: 0, max: 5000, default: [130, 327, 130, 69], help: 'x, y, width, height of the illustrative campus artwork.' },
      { name: 'isIllustrative', label: 'Illustrative (fictional) data', type: 'boolean', default: true },
      order, active,
    ],
  },
  programmes: {
    label: 'Programmes', singular: 'programme', titleField: 'slug', uniqueField: 'slug', searchFields: ['slug', 'institutionSlug', 'courseSlug'],
    slugFrom: (doc) => doc.institutionSlug && doc.courseSlug ? `${doc.institutionSlug}-${doc.courseSlug}` : '',
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
    fields: [
      { name: 'name', label: 'Name', type: 'string', required: true, maxLength: 60 },
      { name: 'landmark', label: 'Landmark', type: 'string', maxLength: 80 },
      crop,
      { name: 'featured', label: 'Featured', type: 'boolean', default: false },
      order, active,
    ],
  },
  states: {
    label: 'States', singular: 'state', titleField: 'name', uniqueField: 'name', searchFields: ['name', 'landmark'],
    fields: [
      { name: 'name', label: 'Name', type: 'string', required: true, maxLength: 60 },
      { name: 'landmark', label: 'Landmark', type: 'string', maxLength: 80 },
      crop,
      { name: 'featured', label: 'Featured', type: 'boolean', default: false },
      order, active,
    ],
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
};

export const generateSlug = (resource, doc) => slugify(resource.slugFrom?.(doc) ?? '');

const OPTIONAL_FIELD_KEYS = ['options', 'ref', 'min', 'max', 'maxLength', 'nullable', 'default', 'help'];

export function describeResources() {
  return Object.fromEntries(Object.entries(resources).map(([name, resource]) => [name, {
    label: resource.label,
    singular: resource.singular,
    searchFields: resource.searchFields,
    fields: resource.fields.map((field) => ({
      name: field.name, label: field.label, type: field.type, required: Boolean(field.required),
      ...Object.fromEntries(OPTIONAL_FIELD_KEYS.filter((key) => field[key] !== undefined).map((key) => [key, field[key]])),
    })),
  }]));
}
