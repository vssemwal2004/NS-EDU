import { randomInt } from 'node:crypto';
import { HttpError } from '../../lib/http-error.js';
import { isPlainObject, validate } from '../../lib/validation.js';
import { CLASS_LEVELS, SCHOOL_STREAMS } from '../applications/schema.js';
import { normalizeIdentifier } from '../student-auth/otp.js';

// Field engine for school drive forms: the admin builder's definitions and the public answers.
export const FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'phone', 'select', 'radio', 'checkbox', 'date'];
export const CHOICE_TYPES = ['select', 'radio', 'checkbox'];
export const MAX_FIELDS = 30;
export const MAX_OPTIONS = 50;
const OPTION_MAX_LENGTH = 80;
const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

// Built-in fields map onto lead columns (applicant.*, academics.*), so their ids, types and options are fixed.
// `locked` ones are always on and required: a lead without a name and mobile cannot be followed up.
const BUILT_INS = [
  { id: 'fullName', label: 'Full name', type: 'text', required: true, locked: true },
  { id: 'phone', label: 'Mobile number', type: 'phone', required: true, locked: true, help: 'We will call or WhatsApp you on this number.' },
  { id: 'email', label: 'Email', type: 'email', required: false },
  { id: 'classLevel', label: 'Class', type: 'select', required: true, choices: CLASS_LEVELS },
  { id: 'schoolStream', label: 'Stream', type: 'select', required: false, choices: SCHOOL_STREAMS },
];
const builtInById = new Map(BUILT_INS.map((field) => [field.id, field]));

const randomId = () => Array.from({ length: 8 }, () => ID_ALPHABET[randomInt(ID_ALPHABET.length)]).join('');
const builtInField = (definition, overrides = {}) => ({
  id: definition.id, label: definition.label, type: definition.type, required: definition.required, options: [], help: definition.help ?? '',
  enabled: true, builtIn: true, ...overrides,
});

export const defaultFields = () => BUILT_INS.map((definition) => builtInField(definition));

// Options as the form renders them: built-ins carry stored values with labels, custom options are their own text.
export const choicesOf = (field) => builtInById.get(field.id)?.choices && field.builtIn
  ? builtInById.get(field.id).choices
  : (field.options ?? []).map((option) => ({ value: option, label: option }));

const textFields = [
  { name: 'label', type: 'string', required: true, maxLength: 120 },
  { name: 'help', type: 'string', maxLength: 200 },
  { name: 'required', type: 'boolean', default: false },
  { name: 'enabled', type: 'boolean', default: true },
];

function parseOptions(raw, errors, path) {
  if (!Array.isArray(raw)) { errors[path] = 'Add the answer choices'; return []; }
  const options = [];
  const seen = new Set();
  for (const item of raw) {
    if (typeof item !== 'string') { errors[path] = 'Each choice must be text'; return []; }
    const option = item.trim().replace(/\s+/g, ' ');
    if (!option) continue;
    if (option.length > OPTION_MAX_LENGTH) { errors[path] = `Each choice must be at most ${OPTION_MAX_LENGTH} characters`; return []; }
    if (seen.has(option.toLowerCase())) { errors[path] = `“${option}” is listed twice`; return []; }
    seen.add(option.toLowerCase());
    options.push(option);
  }
  if (!options.length) errors[path] = 'Add at least one choice';
  else if (options.length > MAX_OPTIONS) errors[path] = `Use at most ${MAX_OPTIONS} choices`;
  return options;
}

/**
 * Validates the builder's field list against the stored one. Custom fields without an id are new and
 * get a server-issued id; an id that is not a built-in or an existing field is rejected, so ids never
 * change and old answers keep pointing at the right question. Errors are keyed "fields.<index>.<prop>".
 */
export function parseFields(input, { existing = [], hasSubmissions = false } = {}) {
  if (!Array.isArray(input)) throw new HttpError(400, 'Please correct the highlighted fields.', { fields: { fields: 'Must be a list of questions' } });
  const errors = {};
  const stored = new Map(existing.map((field) => [field.id, field]));
  const seen = new Set();
  const fields = [];
  input.forEach((raw, index) => {
    const path = `fields.${index}`;
    if (!isPlainObject(raw)) { errors[path] = 'Invalid question'; return; }
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (id && seen.has(id)) { errors[`${path}.id`] = 'This question appears twice'; return; }
    if (id) seen.add(id);
    const { value, errors: fieldErrors } = validate(textFields, raw);
    for (const [key, message] of Object.entries(fieldErrors)) errors[`${path}.${key}`] = message;
    const definition = builtInById.get(id);
    if (definition) {
      const locked = definition.locked === true;
      const enabled = locked || value.enabled !== false;
      fields.push(builtInField(definition, { label: value.label ?? definition.label, help: value.help ?? '', enabled, required: locked || (enabled && value.required === true) }));
      return;
    }
    const previous = id ? stored.get(id) : null;
    if (id && (!previous || previous.builtIn)) { errors[`${path}.id`] = 'Unknown question. Reload the builder and try again.'; return; }
    const type = typeof raw.type === 'string' ? raw.type : '';
    if (!FIELD_TYPES.includes(type)) { errors[`${path}.type`] = 'Choose a question type'; return; }
    // Answers already collected were checked against the old type; a new question keeps exports honest.
    if (previous && hasSubmissions && previous.type !== type) { errors[`${path}.type`] = 'Students have already answered this question. Add a new question instead of changing its type.'; return; }
    const options = CHOICE_TYPES.includes(type) ? parseOptions(raw.options, errors, `${path}.options`) : [];
    const enabled = value.enabled !== false;
    fields.push({ id: previous?.id ?? randomId(), label: value.label ?? '', type, required: enabled && value.required === true, options, help: value.help ?? '', enabled, builtIn: false });
  });
  for (const definition of BUILT_INS) {
    if (!fields.some((field) => field.id === definition.id)) fields.push(builtInField(definition, definition.locked ? {} : { enabled: false, required: false }));
  }
  if (fields.length > MAX_FIELDS) errors.fields = `A form can have at most ${MAX_FIELDS} questions`;
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', { fields: errors });
  return fields;
}

export const isRealDate = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

// One lib/validation.js definition per enabled question; choice, phone and date checks follow below.
function ruleFor(field) {
  const base = { name: field.id, required: field.required === true };
  if (field.id === 'fullName') return { ...base, type: 'string', minLength: 2, maxLength: 100 };
  switch (field.type) {
    case 'textarea': return { ...base, type: 'text', maxLength: 2000 };
    case 'number': return { ...base, type: 'number', min: -1e12, max: 1e12, nullable: !field.required };
    case 'email': return { ...base, type: 'email' };
    case 'phone': return { ...base, type: 'string', maxLength: 20 };
    case 'checkbox': return { ...base, type: 'stringList', maxItems: MAX_OPTIONS, maxLength: OPTION_MAX_LENGTH };
    case 'date': return { ...base, type: 'string', maxLength: 10, pattern: /^\d{4}-\d{2}-\d{2}$/, patternMessage: 'Enter a valid date' };
    case 'select': case 'radio': return { ...base, type: 'string', maxLength: OPTION_MAX_LENGTH };
    default: return { ...base, type: 'string', maxLength: 200 };
  }
}

/** Checks submitted answers against the form's enabled questions; returns { fieldId: value } or throws a 400 keyed "answers.<id>". */
export function parseAnswers(fields, input, errors = {}) {
  const enabled = fields.filter((field) => field.enabled !== false);
  const { value, errors: answerErrors } = validate(enabled.map(ruleFor), isPlainObject(input) ? input : {});
  for (const [key, message] of Object.entries(answerErrors)) errors[`answers.${key}`] = message;
  for (const field of enabled) {
    const answer = value[field.id];
    if (answer === undefined || answer === null || answer === '' || (Array.isArray(answer) && !answer.length) || errors[`answers.${field.id}`]) continue;
    const key = `answers.${field.id}`;
    if (field.type === 'phone') {
      const phone = normalizeIdentifier('phone', answer);
      if (phone.error) errors[key] = phone.error; else value[field.id] = phone.value;
    } else if (field.type === 'date' && !isRealDate(answer)) errors[key] = 'Enter a valid date';
    else if (CHOICE_TYPES.includes(field.type)) {
      const allowed = new Set(choicesOf(field).map((choice) => choice.value));
      if ((Array.isArray(answer) ? answer : [answer]).some((item) => !allowed.has(item))) errors[key] = 'Choose an option from the list';
    }
  }
  return value;
}

// Public shape of a question: no internal flags, options as { value, label }.
export const publicField = (field) => ({
  id: field.id, label: field.label, type: field.type, required: field.required === true, help: field.help ?? '',
  options: CHOICE_TYPES.includes(field.type) ? choicesOf(field) : [],
});
