const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export const formatWhen = (value) => (value ? dateTime.format(new Date(value)) : '—');
export const formatSize = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);
export const pretty = (data) => JSON.stringify(data, null, 2);

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
