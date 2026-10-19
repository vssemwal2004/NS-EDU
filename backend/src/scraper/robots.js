// robots.txt (RFC 9309): user-agent groups, Allow/Disallow with longest-match (Allow wins ties),
// `*` and `$` wildcards, plus the widely used non-standard Crawl-delay.
const MAX_ROBOTS_BYTES = 500 * 1024;

export function parseRobots(text) {
  const groups = [];
  let current = null;
  let collectingAgents = false;
  for (const rawLine of String(text ?? '').slice(0, MAX_ROBOTS_BYTES).split(/\r\n|\r|\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === 'user-agent') {
      if (!collectingAgents) { current = { agents: [], rules: [], crawlDelay: null }; groups.push(current); collectingAgents = true; }
      current.agents.push(value.toLowerCase().split('/')[0].trim());
      continue;
    }
    if (!current) continue;
    collectingAgents = false;
    if (key === 'allow' || key === 'disallow') {
      if (value) current.rules.push({ allow: key === 'allow', pattern: value.replace(/[^\x21-\x7e]/g, (char) => encodeURIComponent(char)) });
    } else if (key === 'crawl-delay') {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelay = Math.max(current.crawlDelay ?? 0, seconds);
    }
  }
  return { groups };
}

const patternCache = new Map();
function toRegex(pattern) {
  let regex = patternCache.get(pattern);
  if (!regex) {
    const anchored = pattern.endsWith('$');
    const body = (anchored ? pattern.slice(0, -1) : pattern).split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    regex = new RegExp(`^${body}${anchored ? '$' : ''}`);
    if (patternCache.size > 5000) patternCache.clear();
    patternCache.set(pattern, regex);
  }
  return regex;
}

// Rules for one crawler: groups naming its product token, otherwise the `*` groups.
export function robotsPolicy(parsed, token) {
  const name = token.toLowerCase();
  const named = parsed.groups.filter((group) => group.agents.includes(name));
  const groups = named.length ? named : parsed.groups.filter((group) => group.agents.includes('*'));
  const rules = groups.flatMap((group) => group.rules);
  const delays = groups.map((group) => group.crawlDelay).filter((value) => value !== null);
  return {
    crawlDelayMs: delays.length ? Math.max(...delays) * 1000 : 0,
    isAllowed(pathAndQuery) {
      const path = pathAndQuery || '/';
      if (path === '/robots.txt') return true;
      let best = null;
      for (const rule of rules) {
        if (!toRegex(rule.pattern).test(path)) continue;
        const length = rule.pattern.length;
        if (!best || length > best.length || (length === best.length && rule.allow && !best.allow)) best = { length, allow: rule.allow };
      }
      return best ? best.allow : true;
    },
  };
}

export const ALLOW_ALL = Object.freeze({ crawlDelayMs: 0, isAllowed: () => true });
export const DISALLOW_ALL = Object.freeze({ crawlDelayMs: 0, isAllowed: (path) => path === '/robots.txt' });
