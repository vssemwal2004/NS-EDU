import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { educationFeeds } from '../src/data/education-feeds.js';
import { classifyStory, createEducationNewsService, parseEducationFeed } from '../src/services/education-news.js';
import { createEducationNewsRouter } from '../src/routes/education-news.js';

const now = Date.parse('2026-10-07T12:00:00Z');
const source = educationFeeds[0];
const item = ({ title = 'New university admissions for students', url = 'https://indianexpress.com/article/education/admissions-123/', image = 'https://images.indianexpress.com/2026/10/admissions.jpg', date = now - 3600000 } = {}) => `<item><title><![CDATA[${title}]]></title><link>${url.replaceAll('&', '&amp;')}</link><pubDate>${new Date(date).toUTCString()}</pubDate><description><![CDATA[<b>Course choices</b><script>alert(1)</script> for students]]></description><media:thumbnail url="${image}"/></item>`;
const rss = (...items) => `<?xml version="1.0"?><rss xmlns:media="http://search.yahoo.com/mrss/"><channel>${items.join('')}</channel></rss>`;

test('topic classification distinguishes exam reporting from examine and AI applications', () => {
  assert.equal(classifyStory('University committee to examine campus operations', '', '').category, 'higher-education');
  assert.equal(classifyStory('Examples of artificial intelligence applications in learning', '', '').category, 'learning');
  assert.equal(classifyStory('Regional examination scorecards released', '', '').category, 'exams');
  assert.equal(classifyStory('Scholarship application deadline extended', '', '').category, 'admissions');
});

test('education RSS admits arbitrary education subjects and rejects non-education or unsafe stories', () => {
  const records = parseEducationFeed(rss(
    item({ title: 'New regional board exam result and scorecard' }),
    item({ url: 'https://indianexpress.com/article/sports/cricket-123/', title: 'Sports scores' }),
    item({ url: 'https://evil.example/article/education/bogus/' }),
    item({ url: 'javascript:alert(1)' }),
    item({ url: 'https://indianexpress.com/article/education/future/', date: now + 3600000 }),
    item({ url: 'https://indianexpress.com/article/education/old/', date: now - 46 * 86400000 }),
    item({ url: 'https://indianexpress.com/article/education/bank-jobs/', title: 'Bank recruitment for clerical vacancies' }),
    item({ url: 'https://indianexpress.com/article/education/assembly-roundup/', title: 'Today News Headlines for School Assembly: cricket scores and cabinet business funding' }),
  ), source, now);
  assert.equal(records.length, 1);
  assert.equal(records[0].category, 'exams');
  assert.equal(records[0].imageUrl, 'https://images.indianexpress.com/2026/10/admissions.jpg');
  assert.equal(records[0].description, 'Course choices for students');
  assert.match(records[0].id, /^[a-f0-9]{20}$/);
});

test('invalid thumbnails cannot escape the source allowlist and malformed/entity XML is rejected', () => {
  assert.equal(parseEducationFeed(rss(item({ image: 'http://127.0.0.1/private.png' })), source, now)[0].imageUrl, null);
  assert.throws(() => parseEducationFeed('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///secret">]><rss/>', source, now));
  assert.throws(() => parseEducationFeed('<html>not a feed</html>', source, now));
  assert.throws(() => parseEducationFeed('<rss><channel><item></channel></rss>', source, now));
});

test('feed fetches coalesce, deduplicate canonical links, cache and preserve dated stale data on outage', async () => {
  let time = now;
  let calls = 0;
  let failed = false;
  const loader = createEducationNewsService({ sources: [source], clock: () => time, fetcher: async () => {
    calls++;
    if (failed) throw new Error('offline');
    return new Response(rss(item(), item({ url: 'https://indianexpress.com/article/education/admissions-123/?utm_source=feed' })));
  } });
  const [first, duplicate] = await Promise.all([loader(), loader()]);
  assert.equal(calls, 1);
  assert.equal(first, duplicate);
  assert.equal(first.articles.length, 1);
  assert.equal(first.status, 'ready');
  time += 590000;
  await loader();
  assert.equal(calls, 1);
  time += 11000;
  failed = true;
  const stale = await loader();
  assert.equal(stale.status, 'partial');
  assert.equal(stale.updatedAt, first.updatedAt);
  assert.equal(stale.sources[0].state, 'stale');
  assert.equal(stale.articles.length, 1);
  time += 25 * 3600000;
  assert.deepEqual((await loader()).articles, []);
  assert.equal((await loader()).status, 'unavailable');
});

test('a failing source cannot remove fresh records from another publisher', async () => {
  const loader = createEducationNewsService({ sources: educationFeeds.slice(0, 2), clock: () => now, fetcher: async (url) => {
    if (url.includes('hindustantimes')) return new Response('unavailable', { status: 503 });
    return new Response(rss(item()));
  } });
  const result = await loader();
  assert.equal(result.status, 'partial');
  assert.equal(result.articles.length, 1);
  assert.equal(result.sources[1].state, 'unavailable');
});

test('RSS network bodies are bounded before parsing', async () => {
  const loader = createEducationNewsService({ sources: [source], clock: () => now, fetcher: async () => new Response('x'.repeat(2_000_001)) });
  assert.equal((await loader()).status, 'unavailable');
});

test('feed route returns explicit 503 for unavailable data without fixtures or unsafe URL fetching', async () => {
  const app = express();
  app.use('/api/education-news', createEducationNewsRouter(async () => ({ status: 'unavailable', articles: [], updatedAt: null })));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/education-news?url=http://127.0.0.1/private`);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await response.json()).articles, []);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
