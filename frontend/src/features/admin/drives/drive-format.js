// School drive vocabularies; mirror backend/src/modules/drives (form-fields.js, drive-service.js).
export const DRIVE_STATUSES = [
  { value: 'active', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];
export const STATUS_FILTERS = [{ value: 'current', label: 'Open & closed' }, ...DRIVE_STATUSES, { value: 'all', label: 'All' }];
export const driveStatusLabel = (status) => DRIVE_STATUSES.find((item) => item.value === status)?.label ?? status;

export const FIELD_TYPES = [
  { value: 'text', label: 'Short answer', icon: 'edit' },
  { value: 'textarea', label: 'Paragraph', icon: 'document' },
  { value: 'number', label: 'Number', icon: 'bars' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'phone', label: 'Phone number', icon: 'phone' },
  { value: 'select', label: 'Dropdown', icon: 'chevron' },
  { value: 'radio', label: 'Single choice', icon: 'check' },
  { value: 'checkbox', label: 'Multiple choice', icon: 'layers' },
  { value: 'date', label: 'Date', icon: 'calendar' },
];
export const CHOICE_TYPES = ['select', 'radio', 'checkbox'];
export const fieldTypeLabel = (type) => FIELD_TYPES.find((item) => item.value === type)?.label ?? type;
export const MAX_FIELDS = 30;
export const MAX_OPTIONS = 50;
export const LOCKED_FIELDS = ['fullName', 'phone'];

let draftSeq = 0;
// New questions have no id until the server issues one; `key` keeps React and the editor stable meanwhile.
export const newField = (type = 'text') => ({
  key: `draft-${(draftSeq += 1)}`, id: '', label: '', type, required: false, enabled: true, builtIn: false, help: '',
  options: CHOICE_TYPES.includes(type) ? ['Option 1', 'Option 2'] : [],
});
export const withKeys = (fields) => fields.map((field) => ({ ...field, key: field.id }));
// The request body for PATCH /drives/:id { fields }.
export const fieldsPayload = (fields) => fields.map(({ id, label, type, required, enabled, help, options }) => ({
  ...(id ? { id } : {}), label, type, required, enabled, help, ...(CHOICE_TYPES.includes(type) ? { options } : {}),
}));
export const sameFields = (a, b) => JSON.stringify(fieldsPayload(a)) === JSON.stringify(fieldsPayload(b));

// What the public form shows for a builder field: built-in choices are fixed labels, so their values are labels too here.
export const previewField = (field) => ({
  id: field.key || field.id, label: field.label || 'Untitled question', type: field.type, required: field.required, help: field.help,
  options: CHOICE_TYPES.includes(field.type) ? field.options.filter((option) => option.trim()).map((option) => ({ value: option, label: option })) : [],
});

export const placeText = (school) => [school?.district, school?.state].filter(Boolean).join(', ');
export async function copyText(text) {
  try { await window.navigator.clipboard.writeText(text); return true; } catch { return false; }
}
