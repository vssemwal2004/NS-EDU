// Catalogue screens (/admin/[resource]): table columns, toolbar filters and summary-strip styling per resource.
// Plain data and string formatters only; ResourceManager renders them. Forms come from the backend field metadata.
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const place = (item) => [item.city, item.state].filter(Boolean).join(', ');
const credit = (value) => (value ? value.replace(/^Photo:\s*/, '') : '');
const updated = { key: 'updatedAt', label: 'Updated', kind: 'text', format: (value) => (value ? day.format(new Date(value)) : ''), width: 130 };
const visible = { key: 'active', label: 'Visibility', kind: 'visibility', width: 120 };
const order = { key: 'order', label: 'Order', kind: 'number', width: 80 };

/**
 * Column kinds: primary (title button + sub line), visibility, verification, image, text, number, link.
 * `format(value, item, refs)` returns a string; `sub(item, refs)` is the primary cell's second line.
 */
export const resourceColumns = {
  institutions: [
    { key: 'name', label: 'University', kind: 'primary', sub: (item) => [item.shortName, item.type].filter(Boolean).join(' · ') },
    { key: 'city', label: 'Location', kind: 'text', format: (_, item) => place(item) },
    { key: 'verification', label: 'Status', kind: 'verification', width: 130 },
    { key: 'source', label: 'Source', kind: 'text', format: (value) => SOURCE_LABELS[value?.kind] ?? 'Seed data', width: 140 },
    visible,
  ],
  programmes: [
    { key: 'institutionSlug', label: 'Programme', kind: 'primary', title: (item, refs) => item.institutionName || refs.institutions?.[item.institutionSlug] || item.institutionSlug, sub: (item, refs) => refs.courses?.[item.courseSlug] || item.courseSlug },
    { key: 'annualTuitionInr', label: 'Tuition / year', kind: 'number', format: (value) => (typeof value === 'number' ? inr.format(value) : '') },
    { key: 'medianSalaryLpa', label: 'Median salary', kind: 'number', format: (value) => (typeof value === 'number' ? `${value} LPA` : '') },
    { key: 'tuitionYear', label: 'Session', kind: 'text', width: 110 },
    visible,
  ],
  courses: [
    { key: 'name', label: 'Course', kind: 'primary', sub: (item) => item.fullName },
    { key: 'field', label: 'Field', kind: 'text' },
    { key: 'level', label: 'Level', kind: 'text', width: 90 },
    { key: 'popular', label: 'Popular', kind: 'text', format: (value) => (value ? 'Popular' : ''), width: 100 },
    order, visible,
  ],
  exams: [
    { key: 'name', label: 'Exam', kind: 'primary', sub: (item) => item.level && `${item.level} admissions` },
    { key: 'field', label: 'Field', kind: 'text' },
    { key: 'href', label: 'Website', kind: 'link', width: 200 },
    order, visible,
  ],
  cities: [
    { key: 'imageUrl', label: 'Photo', kind: 'image', width: 90 },
    { key: 'name', label: 'City', kind: 'primary', sub: (item) => item.landmark },
    { key: 'imageCredit', label: 'Photo credit', kind: 'text', format: credit },
    updated, visible,
  ],
  states: [
    { key: 'imageUrl', label: 'Photo', kind: 'image', width: 90 },
    { key: 'name', label: 'State / UT', kind: 'primary', sub: (item) => item.landmark },
    { key: 'imageCredit', label: 'Photo credit', kind: 'text', format: credit },
    updated, visible,
  ],
  scholarships: [
    { key: 'label', label: 'Scholarship', kind: 'primary', sub: (item) => item.description },
    { key: 'href', label: 'Website', kind: 'link', width: 220 },
    order, visible,
  ],
  career_fields: [
    { key: 'name', label: 'Career field', kind: 'primary', sub: (item) => item.description },
    { key: 'slug', label: 'Slug', kind: 'text', width: 180 },
    order, visible,
  ],
  counsellors: [
    { key: 'name', label: 'Counsellor', kind: 'primary', sub: (item) => item.title },
    { key: 'fieldSlug', label: 'Career field', kind: 'text', format: (value, _, refs) => refs.career_fields?.[value] || value },
    { key: 'isMaster', label: 'Role', kind: 'text', format: (value) => (value ? 'Lead counsellor' : ''), width: 150 },
    { key: 'phone', label: 'Mobile', kind: 'text', width: 150 },
    visible,
  ],
};

export const SOURCE_LABELS = { seed: 'Seed data', admin: 'Admin console', import: 'File import', scrape: 'Official website' };
const VISIBILITY_OPTIONS = [{ value: 'true', label: 'Visible' }, { value: 'false', label: 'Hidden' }];
const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ');
const fromMeta = (key) => (meta) => (Array.isArray(meta?.filters?.[key]) ? meta.filters[key].filter(Boolean).map((value) => ({ value, label: titleCase(value) })) : []);
const fromFacet = (key, labels) => (_, stats, refs) => (stats?.options?.[key] ?? []).map((value) => ({ value, label: labels?.(value, refs) ?? value }));
const visibilityFilter = { key: 'active', label: 'Visibility', options: () => VISIBILITY_OPTIONS };

/** Toolbar filters: `options(meta, stats, refLabels)` → [{ value, label }]. Keys match the API's query parameters. */
export const resourceFilters = {
  institutions: [
    { key: 'state', label: 'State', options: fromFacet('state') },
    { key: 'type', label: 'Type', options: fromMeta('type') },
    { key: 'verification', label: 'Status', options: fromMeta('verification') },
    { key: 'active', label: 'Visibility', options: () => [{ value: 'true', label: 'Published' }, { value: 'false', label: 'Hidden' }] },
  ],
  programmes: [visibilityFilter],
  courses: [
    { key: 'field', label: 'Field', options: fromFacet('field') },
    { key: 'level', label: 'Level', options: (meta) => (meta?.filters?.level ?? []).map((value) => ({ value, label: value })) },
    visibilityFilter,
  ],
  exams: [
    { key: 'field', label: 'Field', options: fromFacet('field') },
    { key: 'level', label: 'Level', options: () => [{ value: 'UG', label: 'UG' }, { value: 'PG', label: 'PG' }] },
    visibilityFilter,
  ],
  cities: [visibilityFilter, { key: 'imageUrl', label: 'Photo', options: () => [{ value: 'yes', label: 'With photo' }, { value: 'no', label: 'Without photo' }] }],
  states: [visibilityFilter, { key: 'imageUrl', label: 'Photo', options: () => [{ value: 'yes', label: 'With photo' }, { value: 'no', label: 'Without photo' }] }],
  scholarships: [visibilityFilter],
  career_fields: [visibilityFilter],
  counsellors: [
    { key: 'fieldSlug', label: 'Career field', options: fromFacet('fieldSlug', (value, refs) => refs?.career_fields?.[value]) },
    visibilityFilter,
  ],
};

/** Labels for filters that can arrive by link or from the summary strip but have no select of their own. */
export const extraFilterLabels = {
  'source.kind': ['Source', (value) => SOURCE_LABELS[value] ?? value],
  website: ['Website', (value) => (value === 'no' ? 'missing' : 'present')],
  fees: ['Fees', (value) => (value === 'yes' ? 'published' : 'missing')],
  imageUrl: ['Photo', (value) => (value === 'no' ? 'missing' : 'present')],
  popular: ['Popular', (value) => (value === 'true' ? 'yes' : 'no')],
  isMaster: ['Lead counsellor', (value) => (value === 'true' ? 'yes' : 'no')],
  verification: ['Status', (value) => value],
};

/** Icon and status tone for each summary-strip count (keys come from the API's stats). */
export const statStyle = {
  total: { icon: null, tone: 'neutral' },
  published: { icon: 'eye', tone: 'good' },
  visible: { icon: 'eye', tone: 'good' },
  hidden: { icon: 'eyeOff', tone: 'neutral' },
  held: { icon: 'clock', tone: 'warn' },
  fees: { icon: 'wallet', tone: 'info' },
  noWebsite: { icon: 'link', tone: 'warn' },
  noPhoto: { icon: 'alert', tone: 'warn' },
  popular: { icon: 'star', tone: 'info' },
  leads: { icon: 'crown', tone: 'info' },
};

// Where students see a record, and which kinds make sense to copy.
export const sitePath = { institutions: (item) => `/universities/${item.slug}`, courses: (item) => `/courses/${item.slug}` };
export const duplicable = new Set(['programmes', 'courses', 'exams', 'scholarships', 'career_fields', 'counsellors']);
export const resourceIcons = { institutions: 'building', programmes: 'layers', courses: 'book', exams: 'document', cities: 'location', states: 'map', scholarships: 'cap', career_fields: 'compass', counsellors: 'support' };
export const manageableResources = Object.keys(resourceColumns);
