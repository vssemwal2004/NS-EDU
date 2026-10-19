import { HttpError } from './http-error.js';

const TEXT_TYPES = new Set(['string', 'text', 'slug', 'url', 'select', 'reference', 'email']);
const DEFAULT_MAX_LENGTH = { string: 200, text: 2000, slug: 100, url: 500, select: 100, reference: 100, email: 254 };
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@"<>()[\]\\,;:]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const isEmail = (value) => value.length <= 254 && EMAIL_PATTERN.test(value);
export const slugify = (value) => String(value ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100).replace(/-+$/, '');

const isEmpty = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
  || (Array.isArray(value) && value.length === 0);
const toNumber = (value) => typeof value === 'string' && value.trim() !== '' ? Number(value.trim()) : value;

function coerce(field, raw) {
  if (TEXT_TYPES.has(field.type)) {
    if (typeof raw !== 'string') return { error: 'Must be text' };
    let value = field.type === 'text' ? raw.trim() : raw.trim().replace(/\s+/g, ' ');
    const maxLength = field.maxLength ?? DEFAULT_MAX_LENGTH[field.type];
    if (value.length > maxLength) return { error: `Must be at most ${maxLength} characters` };
    if (field.minLength && value.length < field.minLength) return { error: `Must be at least ${field.minLength} characters` };
    if (['slug', 'reference', 'email'].includes(field.type)) value = value.toLowerCase();
    if ((field.type === 'slug' || field.type === 'reference') && !SLUG_PATTERN.test(value)) {
      return { error: 'Use lowercase letters, numbers and single hyphens' };
    }
    if (field.type === 'email' && !isEmail(value)) return { error: 'Enter a valid email address' };
    if (field.pattern && !field.pattern.test(value)) return { error: field.patternMessage ?? 'Invalid format' };
    if (field.type === 'select' && !field.options.includes(value)) return { error: `Choose one of: ${field.options.join(', ')}` };
    if (field.type === 'url') {
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      } catch { return { error: 'Enter a valid http(s) URL' }; }
    }
    return { value };
  }
  if (field.type === 'number' || field.type === 'integer') {
    const value = toNumber(raw);
    if (typeof value !== 'number' || !Number.isFinite(value)) return { error: 'Must be a number' };
    if (field.type === 'integer' && !Number.isInteger(value)) return { error: 'Must be a whole number' };
    if (field.min !== undefined && value < field.min) return { error: `Must be at least ${field.min}` };
    if (field.max !== undefined && value > field.max) return { error: `Must be at most ${field.max}` };
    return { value };
  }
  if (field.type === 'boolean') {
    if (typeof raw === 'boolean') return { value: raw };
    if (raw === 'true' || raw === 'false') return { value: raw === 'true' };
    return { error: 'Must be true or false' };
  }
  // A list of short texts: a JSON array, or one comma-separated string from a form or CSV cell.
  if (field.type === 'stringList') {
    const parts = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : null;
    if (!parts || parts.some((part) => typeof part !== 'string')) return { error: 'Must be a list of text values' };
    const maxLength = field.maxLength ?? 100;
    const values = [...new Set(parts.map((part) => part.trim().replace(/\s+/g, ' ')).filter(Boolean))];
    if (values.length > (field.maxItems ?? 50)) return { error: `Use at most ${field.maxItems ?? 50} values` };
    if (values.some((part) => part.length > maxLength)) return { error: `Each value must be at most ${maxLength} characters` };
    return { value: values };
  }
  if (field.type === 'numberArray4') {
    const values = Array.isArray(raw) ? raw.map(toNumber) : [];
    if (values.length !== 4 || !values.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      return { error: 'Must be a list of 4 numbers' };
    }
    const min = field.min ?? -100_000;
    const max = field.max ?? 100_000;
    if (values.some((value) => value < min || value > max)) return { error: `Each number must be between ${min} and ${max}` };
    return { value: values };
  }
  // Structured values; `field.fields` declares the sub-fields (see universities/schema.js).
  // Accepts an object/array, or the JSON text a CSV export round-trips. Anything else — a plain
  // form posting "[object Object]" for a control it cannot render — is skipped, not rejected, so
  // an editor that does not understand the field can never blank it out.
  if (field.type === 'object' || field.type === 'objectList') {
    let input = raw;
    if (typeof input === 'string') {
      try { input = JSON.parse(input); } catch { return { skip: true }; }
    }
    if (field.type === 'object') {
      if (!isPlainObject(input)) return { skip: true };
      const kept = withoutEmpty(validate(field.fields, input, { partial: true }).value);
      return Object.keys(kept).length ? { value: kept } : { skip: true };
    }
    if (!Array.isArray(input)) return { skip: true };
    const items = [];
    for (const entry of input) {
      if (!isPlainObject(entry)) continue;
      const { value, errors } = validate(field.fields, entry);
      if (Object.keys(errors).length) continue; // keep the rows that are fine; drop the broken one
      items.push(withoutEmpty(value));
      if (items.length >= (field.maxItems ?? 50)) break;
    }
    return items.length ? { value: items } : { skip: true };
  }
  throw new Error(`Unsupported field type: ${field.type}`);
}

const withoutEmpty = (value) => Object.fromEntries(Object.entries(value).filter(([, item]) => !isEmpty(item)));

const fallback = (field) => {
  if (field.default !== undefined) return { value: structuredClone(field.default) };
  if (field.nullable) return { value: null };
  if ((field.type === 'object' || field.type === 'objectList') && !field.required) return { skip: true };
  if (TEXT_TYPES.has(field.type) && !field.required) return { value: '' };
  if (field.type === 'stringList' && !field.required) return { value: [] };
  return { error: 'This field is required' };
};

// Validates known fields only; unknown keys are dropped. `partial` skips absent fields (PATCH).
export function validate(fields, input, { partial = false } = {}) {
  if (!isPlainObject(input)) throw new HttpError(400, 'Request body must be a JSON object');
  const value = {};
  const errors = {};
  for (const field of fields) {
    if (field.readOnly) continue;
    const present = Object.hasOwn(input, field.name);
    if (!present && partial) continue;
    const raw = input[field.name];
    let result;
    if (isEmpty(raw)) {
      const useFallback = !field.required || field.generated || (!present && field.default !== undefined);
      result = useFallback ? fallback(field) : { error: 'This field is required' };
    }
    else result = coerce(field, raw);
    if (result.skip) continue; // the input carried nothing usable for this field; leave it untouched
    if (result.error) errors[field.name] = result.error;
    else value[field.name] = result.value;
  }
  return { value, errors };
}

export function assertValid(fields, input, options) {
  const { value, errors } = validate(fields, input ?? {}, options);
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', { fields: errors });
  return value;
}
