const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export const formatWhen = (value) => (value ? dateTime.format(new Date(value)) : '—');
/** "31 Oct, 4:05 pm" (year added when it is not this year). */
export function formatShort(value, now = new Date()) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  return `${day}, ${date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
}
export const formatSize = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);
export const pretty = (data) => JSON.stringify(data, null, 2);
export const sameData = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Parses editor text; on failure returns a readable message with the line/column of the problem.
export function parseJson(text) {
  try {
    return { value: JSON.parse(text), error: null };
  } catch (error) {
    const message = error.message.replace(/^JSON\.parse: /, '');
    const position = Number(/position (\d+)/.exec(message)?.[1]);
    const lineMatch = /line (\d+) column (\d+)/.exec(message);
    let line = lineMatch ? Number(lineMatch[1]) : null;
    let column = lineMatch ? Number(lineMatch[2]) : null;
    if (!line && Number.isFinite(position)) {
      const before = text.slice(0, position).split('\n');
      line = before.length;
      column = before.at(-1).length + 1;
    }
    return { value: null, error: { message: message.replace(/\s*\(line \d+ column \d+\)/, ''), line, column } };
  }
}

// Every { src } object in the media entry, with its dotted path (hero, eligibility.notebook, ...).
export function mediaSlots(data, prefix = '') {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  if (typeof data.src === 'string') return [{ path: prefix, ...data }];
  return Object.entries(data).flatMap(([key, value]) => mediaSlots(value, prefix ? `${prefix}.${key}` : key));
}

// ---- Form editor helpers ----------------------------------------------------------------------------------------

const ACRONYMS = { id: 'ID', url: 'URL', href: 'Link', src: 'Image URL', inr: 'INR', faq: 'FAQ', faqs: 'FAQs', seo: 'SEO', alt: 'Alt text' };
/** "featureDirectory" → "Feature directory", "budgetInr" → "Budget INR", "src" → "Image URL". */
export function humanize(key) {
  const text = String(key);
  if (ACRONYMS[text.toLowerCase()]) return ACRONYMS[text.toLowerCase()];
  if (/^[A-Z]/.test(text) && !/[_-]/.test(text)) return text; // already a label (e.g. "Engineering")
  const words = text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().split(/\s+/)
    .map((word) => ACRONYMS[word.toLowerCase()] && word.length <= 4 ? ACRONYMS[word.toLowerCase()] : word.toLowerCase());
  const sentence = words.join(' ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export const kindOf = (value) => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);

/** Short description of a value for navigation and collapsed list items. */
export function describeValue(value) {
  const kind = kindOf(value);
  if (kind === 'array') return `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
  if (kind === 'object') return `${Object.keys(value).length} fields`;
  if (kind === 'boolean') return value ? 'Yes' : 'No';
  if (kind === 'string') return 'Text';
  if (kind === 'number') return 'Number';
  return 'Empty';
}

/** A readable title for a list item: its title/label/name/id, else "Item n". */
export function itemTitle(item, index) {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    for (const key of ['title', 'label', 'name', 'question', 'heading', 'id', 'slug']) if (typeof item[key] === 'string' && item[key].trim()) return item[key];
  }
  if (typeof item === 'string' && item.trim()) return item;
  return `Item ${index + 1}`;
}

/** An empty value with the same shape, used when adding a list item (copies the last item's structure). */
export function blankLike(value) {
  const kind = kindOf(value);
  if (kind === 'string') return '';
  if (kind === 'number') return 0;
  if (kind === 'boolean') return false;
  if (kind === 'array') return [];
  if (kind === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, blankLike(item)]));
  return '';
}

/** Immutable update of `data` at `path` (an array of keys / indexes). */
export function setIn(data, path, next) {
  if (!path.length) return next;
  const [head, ...rest] = path;
  if (Array.isArray(data)) return data.map((item, index) => (index === head ? setIn(item, rest, next) : item));
  return { ...data, [head]: setIn(data?.[head], rest, next) };
}
