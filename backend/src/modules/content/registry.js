import { isPlainObject } from '../../lib/validation.js';
import site from './defaults/site.js';
import pages from './defaults/pages.js';
import landing from './defaults/landing.js';
import explorer from './defaults/explorer.js';
import eligibility from './defaults/eligibility.js';
import budget from './defaults/budget.js';
import news from './defaults/news.js';
import guides from './defaults/guides.js';
import media from './defaults/media.js';

export const MAX_CONTENT_BYTES = 256 * 1024;
const MAX_DEPTH = 12;

const kinds = {
  string: [(value) => typeof value === 'string', 'Must be text'],
  array: [Array.isArray, 'Must be a list'],
  object: [isPlainObject, 'Must be an object'],
  boolean: [(value) => typeof value === 'boolean', 'Must be true or false'],
};

const IMAGE_SLOTS = ['hero', 'campusArt', 'destinationsArt', 'eligibility.notebook', 'eligibility.certificate', 'eligibility.graduation', 'budgetDesk'];
const at = (data, path) => path.split('.').reduce((value, part) => value?.[part], data);
const validSrc = (src) => typeof src === 'string' && (/^\/(?!\/)[\w\-./%]+$/.test(src) || /^https:\/\/[^\s/@]+\/\S+$/.test(src));

function checkMedia(data) {
  const errors = {};
  for (const slot of IMAGE_SLOTS) {
    const image = at(data, slot);
    if (!isPlainObject(image)) errors[slot] = 'Add an image object { src, width, height }';
    else if (!validSrc(image.src)) errors[`${slot}.src`] = 'Use a site path such as /images/x.png or an https:// URL';
    else if (![image.width, image.height].every((value) => Number.isInteger(value) && value > 0 && value <= 10_000)) errors[slot] = 'width and height must be whole numbers of pixels';
  }
  return errors;
}

function checkBudget(data) {
  const errors = {};
  const ids = new Set(data.costFields.map((field) => field?.id));
  const missing = ['accommodation', 'meals', 'booksTravel', 'joiningFees', 'deposit'].filter((id) => !ids.has(id));
  if (missing.length) errors.costFields = `Keep the cost fields used by the calculator: ${missing.join(', ')}`;
  if (!Number.isSafeInteger(data.defaults.budgetInr) || data.defaults.budgetInr < 1) errors['defaults.budgetInr'] = 'Must be a whole number of rupees';
  if (!data.livingOptions.length || data.livingOptions.some((option) => typeof option?.id !== 'string' || typeof option.label !== 'string')) errors.livingOptions = 'Each option needs an id and a label';
  return errors;
}

function checkPages(data) {
  const errors = {};
  for (const [slug, page] of Object.entries(data.pages)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors[`pages.${slug}`] = 'Page keys are URL slugs: lowercase letters, numbers and hyphens';
    else if (!isPlainObject(page) || typeof page.title !== 'string' || !Array.isArray(page.sections)) errors[`pages.${slug}`] = 'Each page needs a title and a sections list';
  }
  return errors;
}

// Order is the admin list order. `required` lists top-level properties and their kind.
export const CONTENT_KEYS = {
  site: { label: 'Site identity & footer', description: 'Site name, tagline, support email (temporary flag), social profile links, footer copy and the footer link groups.', required: { name: 'string', tagline: 'string', supportEmail: 'string', contactIsTemporary: 'boolean', socials: 'array', footer: 'object', footerGroups: 'array' }, defaults: site },
  landing: { label: 'Homepage', description: 'Hero field links, tool shortcuts, the "View all" rows under homepage sections and the icon for each stream.', required: { fields: 'array', shortcuts: 'array', featureDirectory: 'array', fieldIcons: 'object' }, defaults: landing },
  media: { label: 'Site images', description: 'Hero photo, campus and destination artwork, eligibility illustrations and the budget desk. Each src is a site path or an https:// URL; keep width/height equal to the image’s real size because crops are measured against it.', required: { hero: 'object', campusArt: 'object', destinationsArt: 'object', eligibility: 'object', budgetDesk: 'object' }, check: checkMedia, defaults: media },
  pages: { label: 'Supporting pages', description: 'About, contact, help, blog, sources, corrections, accessibility and legal drafts at /<slug>, plus the help topics, about tools, contact cards and the student-guides menu. draft: true labels a page as a policy preview and noindexes it.', required: { pages: 'object', helpTopics: 'array', aboutTools: 'array', contactCards: 'array', guideLinks: 'object' }, check: checkPages, defaults: pages },
  guides: { label: 'Student guides', description: 'Scholarships, career guidance and admission checklist: page copy, steps, checklists (item ids keep students’ saved ticks), FAQs and related tool cards.', required: { scopeNote: 'string', tools: 'object', guides: 'object' }, defaults: guides },
  explorer: { label: 'College explorer', description: 'Course tabs shown in the homepage course-wise college table, short tab labels and the tuition/placement year labels.', required: { courseTabs: 'array', tabLabels: 'object', tuitionYear: 'string', placementYear: 'string' }, defaults: explorer },
  eligibility: { label: 'Eligibility checker', description: 'Study stages, qualifications, subjects, admission years and the fictional sample rules per course id. Rules are only applied for ruleYear.', required: { stages: 'array', qualifications: 'array', subjects: 'array', admissionYears: 'array', ruleYear: 'string', profiles: 'object' }, defaults: eligibility },
  budget: { label: 'Budget planner', description: 'Pre-selected programme, starting budget, living options with first-year estimates and the cost rows (ids are used by the calculator).', required: { defaults: 'object', livingOptions: 'array', costFields: 'array' }, check: checkBudget, defaults: budget },
  news: { label: 'Education news', description: 'News topic labels and icons (ids must match the feed classifier) and the cover-image policy: reviewed publisher photo URLs, or mode "publisher" to show all.', required: { topics: 'array', imagePolicy: 'object' }, defaults: news },
};

export const isContentKey = (key) => typeof key === 'string' && Object.hasOwn(CONTENT_KEYS, key);
export const contentSize = (data) => Buffer.byteLength(JSON.stringify(data));

// Mongo-unsafe or deeply nested keys are rejected before storage.
function badKey(value, depth = 0) {
  if (depth > MAX_DEPTH) return 'Content is nested too deeply';
  if (Array.isArray(value)) { for (const item of value) { const error = badKey(item, depth + 1); if (error) return error; } return null; }
  if (value === null || typeof value !== 'object') return null;
  for (const [key, item] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.') || key === '') return `Property names cannot be empty, start with "$" or contain "." (found "${key}")`;
    const error = badKey(item, depth + 1);
    if (error) return error;
  }
  return null;
}

// Light structural check: a plain object, required top-level properties, a size cap and key-specific rules.
export function validateContent(key, data) {
  const spec = CONTENT_KEYS[key];
  if (!isPlainObject(data)) return { _: 'Content must be a JSON object' };
  if (contentSize(data) > MAX_CONTENT_BYTES) return { _: `Content must be at most ${MAX_CONTENT_BYTES / 1024} KB` };
  const keyError = badKey(data);
  if (keyError) return { _: keyError };
  const errors = {};
  for (const [name, kind] of Object.entries(spec.required)) {
    if (!Object.hasOwn(data, name)) errors[name] = 'This property is required';
    else if (!kinds[kind][0](data[name])) errors[name] = kinds[kind][1];
  }
  if (Object.keys(errors).length || !spec.check) return errors;
  return spec.check(data);
}
