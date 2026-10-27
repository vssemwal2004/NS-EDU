import UniversityCombobox from '@/features/apply/UniversityCombobox';
import { splitList } from '@/features/admin/table/FilterDrawer';
import {
  CLASS_LEVELS, DATE_RANGES, FILTER_KEYS, formatDay, LEAD_CHANNELS, LEAD_MODES, LEAD_PAGE_SIZES, LEAD_STATUSES, rangeLabel, SCHOOL_STREAMS,
} from './lead-format';

// Filters the drawer edits (everything except search, paging and sort).
export const DRAWER_KEYS = ['status', 'channel', 'range', 'from', 'to', 'form', 'district', 'class', 'stream', 'state', 'city', 'institution', 'institutionName', 'course', 'careerField', 'mode', 'assignee'];
const PAGING_KEYS = ['page', 'cursor', 'dir'];
const LIST_KEYS = { status: LEAD_STATUSES, channel: LEAD_CHANNELS, class: CLASS_LEVELS, stream: SCHOOL_STREAMS };
export const EMPTY_FILTERS = Object.fromEntries(DRAWER_KEYS.map((key) => [key, '']));

/** URL/search params → a complete, validated filter object. */
export function readFilters(source = {}) {
  const value = (key) => String((Array.isArray(source[key]) ? source[key][0] : source[key]) ?? '').trim().slice(0, key === 'state' ? 600 : 160);
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, value(key)]));
  for (const [key, options] of Object.entries(LIST_KEYS)) filters[key] = splitList(filters[key]).filter((item) => options.some((option) => option.value === item)).join(',');
  if (filters.mode && !LEAD_MODES.some((item) => item.value === filters.mode)) filters.mode = '';
  if (filters.range && !DATE_RANGES.some((item) => item.value === filters.range)) filters.range = '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.from)) filters.from = '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.to)) filters.to = '';
  filters.page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
  filters.limit = LEAD_PAGE_SIZES.includes(Number(filters.limit)) ? Number(filters.limit) : LEAD_PAGE_SIZES[0];
  filters.sort = filters.sort === 'oldest' ? 'oldest' : 'newest';
  if (!filters.cursor || !['after', 'before'].includes(filters.dir)) { filters.cursor = ''; filters.dir = ''; }
  return filters;
}

/** The URL form: defaults left out so a plain list keeps a clean /admin/leads. */
export function urlParams(filters) {
  return { ...filters, page: filters.page > 1 ? filters.page : '', limit: filters.limit !== LEAD_PAGE_SIZES[0] ? filters.limit : '', sort: filters.sort !== 'newest' ? filters.sort : '' };
}
/** The API form: no display-only names; fixed filters (e.g. one school drive) always win. */
const NOT_FILTERS = new Set(['institutionName', 'page', 'limit', 'cursor', 'dir', 'sort']);
export function apiFilterParams(filters, fixed = {}) {
  return { ...Object.fromEntries(Object.entries(filters).filter(([key]) => !NOT_FILTERS.has(key))), ...fixed };
}
export const withoutPaging = (filters) => ({ ...filters, ...Object.fromEntries(PAGING_KEYS.map((key) => [key, ''])), page: 1 });

const toOptions = (list) => (list ?? []).map((item) => (typeof item === 'string' ? { value: item, label: item } : item));
const labels = (options, value) => splitList(value).map((item) => options.find((option) => option.value === item)?.label ?? item).join(', ');
// District values are "District|State" so same-named districts in two states stay apart.
const districtOptions = (options) => (options?.districts ?? []).map((item) => ({ value: item.value, label: item.state ? `${item.label ?? item.value} (${item.state})` : item.label ?? item.value }));
const districtLabel = (options, value) => districtOptions(options).find((option) => option.value === value)?.label ?? value.split('|').filter(Boolean).join(', ');

/** Drawer sections from GET /leads/filter-options; keys in `hidden` (fixed filters) are left out. */
export function leadFilterSections({ options, employees, isAdmin, hidden = [] }) {
  const forms = (options?.forms ?? []).map((form) => ({
    value: form.id, label: form.school || form.title,
    hint: [form.title !== form.school ? form.title : '', [form.district, form.state].filter(Boolean).join(', '), `${form.submissions.toLocaleString('en-IN')} leads`, form.status === 'active' ? '' : form.status].filter(Boolean).join(' · '),
  }));
  const sections = [
    { key: 'status', label: 'Status', type: 'checks', options: toOptions(options?.statuses ?? LEAD_STATUSES) },
    { key: 'channel', label: 'Source', type: 'checks', options: toOptions(options?.channels ?? LEAD_CHANNELS) },
    { key: 'range', label: 'Submitted', type: 'date', keys: { range: 'range', from: 'from', to: 'to' }, options: DATE_RANGES },
    { key: 'form', label: 'School drive', type: 'choice', searchable: forms.length > 6, options: forms, anyLabel: 'Any school drive', emptyText: 'No school drives yet.' },
    { key: 'district', label: 'School district', type: 'select', anyLabel: 'Any district', options: districtOptions(options) },
    { key: 'class', label: 'Class', type: 'checks', options: toOptions(options?.classes ?? CLASS_LEVELS) },
    { key: 'stream', label: 'Stream', type: 'checks', options: toOptions(options?.streams ?? SCHOOL_STREAMS) },
    { key: 'state', label: 'Applicant’s state', type: 'checks', searchable: true, options: toOptions(options?.states) },
    { key: 'city', label: 'Applicant’s city', type: 'text', placeholder: 'Exact city name, e.g. Pune' },
    {
      key: 'institution', label: 'University', type: 'custom',
      render: ({ id, draft, patch }) => <UniversityCombobox id={id} size="small" placeholder="Any university"
        value={draft.institution ? { id: draft.institution, name: draft.institutionName || draft.institution } : null}
        onSelect={(university) => patch({ institution: university?.id ?? '', institutionName: university?.name ?? '' })} />,
    },
    { key: 'course', label: 'Course', type: 'select', anyLabel: 'Any course', options: toOptions(options?.courses) },
    { key: 'careerField', label: 'Career field (callbacks)', type: 'select', anyLabel: 'Any career field', options: toOptions(options?.careerFields) },
    { key: 'mode', label: 'Website form', type: 'select', anyLabel: 'Quick or detailed', options: LEAD_MODES },
    ...(isAdmin ? [{ key: 'assignee', label: 'Assigned to', type: 'select', anyLabel: 'Anyone', options: [{ value: 'unassigned', label: 'Unassigned' }, ...employees.map((employee) => ({ value: employee.id, label: employee.email }))] }] : []),
  ];
  return sections.filter((section) => !hidden.includes(section.key));
}

/** One chip per active drawer filter (status has its own chip row, search its own box). */
export function leadFilterChips({ filters, options, employees, hidden = [], onChange }) {
  const chip = (key, label, patch) => ({ key, label, onRemove: () => onChange(patch ?? { [key]: '' }) });
  const chips = [];
  const has = (key) => filters[key] && !hidden.includes(key);
  if (has('channel')) chips.push(chip('channel', `Source: ${labels(LEAD_CHANNELS, filters.channel)}`));
  if (filters.range) chips.push(chip('range', `Submitted: ${rangeLabel(filters.range)}`));
  else if (filters.from || filters.to) chips.push(chip('dates', `Submitted: ${filters.from ? formatDay(filters.from) : 'start'} – ${filters.to ? formatDay(filters.to) : 'today'}`, { from: '', to: '' }));
  if (has('form')) {
    const form = options?.forms?.find((item) => item.id === filters.form);
    chips.push(chip('form', `School drive: ${form ? form.school || form.title : 'selected drive'}`));
  }
  if (has('district')) chips.push(chip('district', `District: ${districtLabel(options, filters.district)}`));
  if (has('class')) chips.push(chip('class', labels(CLASS_LEVELS, filters.class)));
  if (has('stream')) chips.push(chip('stream', `Stream: ${labels(SCHOOL_STREAMS, filters.stream)}`));
  if (has('state')) {
    const states = splitList(filters.state);
    chips.push(chip('state', `State: ${states.length > 2 ? `${states.slice(0, 2).join(', ')} +${states.length - 2}` : states.join(', ')}`));
  }
  if (has('city')) chips.push(chip('city', `City: ${filters.city}`));
  if (has('institution')) chips.push(chip('institution', `University: ${filters.institutionName || filters.institution}`, { institution: '', institutionName: '' }));
  if (has('course')) chips.push(chip('course', `Course: ${labels(toOptions(options?.courses), filters.course)}`));
  if (has('careerField')) chips.push(chip('careerField', `Career field: ${labels(toOptions(options?.careerFields), filters.careerField)}`));
  if (has('mode')) chips.push(chip('mode', labels(LEAD_MODES, filters.mode)));
  if (has('assignee')) chips.push(chip('assignee', filters.assignee === 'unassigned' ? 'Unassigned' : `Assigned to ${employees.find((item) => item.id === filters.assignee)?.email ?? 'an employee'}`));
  return chips;
}

/** How many drawer filters are set (the badge on the Filters button). */
export const activeFilterCount = (filters, hidden = []) => DRAWER_KEYS.filter((key) => key !== 'institutionName' && key !== 'from' && key !== 'to' && filters[key] && !hidden.includes(key)).length
  + (!filters.range && (filters.from || filters.to) ? 1 : 0);
