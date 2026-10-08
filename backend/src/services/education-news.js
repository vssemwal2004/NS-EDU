import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { educationFeeds } from '../data/education-feeds.js';

const MAX_BYTES = 2_000_000;
const FRESH_MS = 10 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, htmlEntities: true, processEntities: true });
const array = (value) => value === undefined ? [] : Array.isArray(value) ? value : [value];
const scalar = (value) => typeof value === 'string' ? value : value?.['#text'] || '';

export function plainText(value, limit = 220) {
  return scalar(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&(?:amp|#38);/gi, '&').replace(/&(?:nbsp|#160);/gi, ' ').replace(/&quot;/gi, '"').replace(/&#(?:39|x27);/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function trustedUrl(value, hosts, path) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname) || (path && !path.test(url.pathname))) return null;
    url.hash = '';
    // Canonicalize common tracking parameters for deduplication.
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    return url.href;
  } catch { return null; }
}

export function classifyStory(title, description, url) {
  const text = `${title} ${description}`.toLowerCase();
  let category = 'higher-education';
  if (/\b(?:admissions?|counselling|enrol\w*|allotments?|scholarships?|financial aid)\b|\bapplications?\s+(?:open|deadline|form|portal|process)\b/.test(text)) category = 'admissions';
  else if (/\b(?:exams?|examinations?|results?|scorecards?|cut[- ]?offs?|admit cards?|answer keys?|entrance|test dates?)\b/.test(text)) category = 'exams';
  else if (/school|board|class (?:\d|x)|secondary|textbook/.test(text)) category = 'schools';
  else if (/edtech|edu.?tech|learning|skill|course|curriculum|study tips|preparation|revision|artificial intelligence|ai[- ]/.test(text)) category = 'learning';
  else if (/policy|government|regulation|commission|ministry|reform/.test(text)) category = 'policy';
  const type = /\/features\/|\/explained\/|\/articles\//.test(url) || /\bhow to\b|\bguide\b|\bexplained\b|\bstudy tips\b|\bwhat .*should\b|\bstrategies\b/.test(title.toLowerCase()) ? 'article' : 'news';
  return { category, type };
}

export function parseEducationFeed(xml, source, now = Date.now()) {
  if (Buffer.byteLength(xml) > MAX_BYTES || /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('Unsupported feed document');
  const channel = parser.parse(xml, true)?.rss?.channel;
  if (!channel || typeof channel !== 'object') throw new Error('Invalid RSS feed');
  const records = [];
  for (const item of array(channel.item).slice(0, 100)) {
    const title = plainText(item.title, 240);
    const url = trustedUrl(scalar(item.link), [source.host], source.path);
    const timestamp = Date.parse(scalar(item.pubDate));
    if (!title || !url || !Number.isFinite(timestamp) || timestamp > now + 5 * 60 * 1000 || now - timestamp > MAX_AGE_MS) continue;
    const description = plainText(item.description, 180);
    // These are general national/sports/business roundups packaged for school
    // assemblies, not education reporting. Keep them out of this education feed.
    if (/(?:news\s+headlines?|current[- ]affairs).{0,45}(?:school|morning)\s+assembly|school\s+assembly.{0,45}(?:news|headlines?)/i.test(title)) continue;
    // Publisher education feeds sometimes include general hiring announcements.
    // Retain education-sector opportunities, exclude unrelated employment news.
    const hiring = /\/employment-news\/|\brecruitment\b|\bvacanc(?:y|ies)\b|\bjob openings?\b/i.test(`${url} ${title}`);
    if (hiring && !/\bteacher|\bteaching|\bprofessor|\bfaculty|\buniversity|\bcollege|\bschool|\beducation|\bedtech/i.test(`${title} ${description}`)) continue;
    const media = [...array(item['media:thumbnail']), ...array(item['media:content']), ...array(item.enclosure)];
    const imageUrl = media.map((entry) => trustedUrl(entry?.['@_url'], source.imageHosts)).find(Boolean) || null;
    records.push({ id: createHash('sha256').update(url).digest('hex').slice(0, 20), title, description, url, imageUrl, source: source.name, sourceId: source.id, publishedAt: new Date(timestamp).toISOString(), ...classifyStory(title, description, url) });
  }
  return records;
}

async function readBounded(response) {
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Feed too large');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('Feed too large');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks).toString('utf8');
}

// Bounded publisher fetching; shared cache and in-flight coalescing prevent a
// request per visitor. Partial/stale responses never masquerade as fresh news.
export function createEducationNewsService({ fetcher = fetch, clock = Date.now, sources = educationFeeds } = {}) {
  const cache = new Map();
  let snapshot = null;
  let nextAttempt = 0;
  let pending = null;
  async function refresh() {
    const now = clock();
    const sourceStates = await Promise.all(sources.map(async (source) => {
      try {
        const response = await fetcher(source.url, { signal: AbortSignal.timeout(7000), redirect: 'error', headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'NSEDU/0.1 (education RSS reader)' } });
        if (!response.ok) throw new Error('Publisher unavailable');
        const articles = parseEducationFeed(await readBounded(response), source, now);
        cache.set(source.id, { articles, updatedAt: now });
        return { id: source.id, name: source.name, state: 'fresh', updatedAt: new Date(now).toISOString() };
      } catch {
        const previous = cache.get(source.id);
        if (previous && now - previous.updatedAt < STALE_MS) return { id: source.id, name: source.name, state: 'stale', updatedAt: new Date(previous.updatedAt).toISOString() };
        cache.delete(source.id);
        return { id: source.id, name: source.name, state: 'unavailable', updatedAt: null };
      }
    }));
    const unique = new Map();
    for (const { articles } of cache.values()) for (const record of articles) if (now - Date.parse(record.publishedAt) <= MAX_AGE_MS) unique.set(record.url, record);
    const articles = [...unique.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 90);
    const allFresh = sourceStates.every((source) => source.state === 'fresh');
    const available = sourceStates.filter((source) => source.state !== 'unavailable');
    snapshot = { status: allFresh ? 'ready' : available.length ? 'partial' : 'unavailable', articles, sources: sourceStates, updatedAt: available.length ? new Date(Math.min(...available.map((source) => Date.parse(source.updatedAt)))).toISOString() : null, checkedAt: new Date(now).toISOString(), refreshAfterSeconds: 600 };
    nextAttempt = now + (allFresh ? FRESH_MS : 60_000);
    return snapshot;
  }
  return async function getEducationNews() {
    if (snapshot && clock() < nextAttempt) return snapshot;
    if (!pending) pending = refresh().finally(() => { pending = null; });
    return pending;
  };
}

export const getEducationNews = createEducationNewsService();
