import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { scraperConfig } from '../src/scraper/config.js';
import { crawlSource, missingForPublish, shouldPublish } from '../src/scraper/crawler.js';
import { CrawlError, createFetcher } from '../src/scraper/fetcher.js';
import { fakeWeb, fixtures, SITE } from './scraper-fixtures.js';

const config = scraperConfig({ userAgent: 'GyaanVidhyaBot/1.0 (+https://gyaan.test/bot)', hostDelayMs: 3000, maxPages: 8 });
const siteRoutes = (robots = 'User-agent: *\nDisallow: /naac\nCrawl-delay: 4\n') => ({
  [`${SITE}/robots.txt`]: { body: robots, headers: { 'content-type': 'text/plain' } },
  [`${SITE}/`]: { body: fixtures.home },
  [`${SITE}/about-us`]: { body: fixtures.about },
  [`${SITE}/contact`]: { body: fixtures.contact },
  [`${SITE}/academics/programmes`]: { body: fixtures.programmes },
  [`${SITE}/admissions`]: { status: 301, headers: { location: '/admissions/2026' } },
  [`${SITE}/admissions/2026`]: { body: '<html><body><h1>Admissions</h1><p>Apply for B.Tech and MBA.</p></body></html>' },
});

describe('polite crawler', () => {
  test('honours robots.txt, crawl-delay, the user agent and the page budget', async () => {
    const web = fakeWeb(siteRoutes());
    const fetcher = createFetcher({ config, fetchImpl: web.fetchImpl, wait: web.wait, now: web.now });
    const crawl = await crawlSource({ name: 'Doon Valley Institute of Technology', website: 'www.dvit-example.ac.in' }, { fetcher, config, courses: [{ slug: 'btech', name: 'B.Tech' }] });
    assert.equal(web.requests[0].url, `${SITE}/robots.txt`);
    assert.ok(web.requests.every((request) => request.userAgent === config.userAgent && request.redirect === 'manual'));
    assert.ok(!web.requests.some((request) => request.url.endsWith('/naac')), 'robots-disallowed page fetched');
    assert.ok(!web.requests.some((request) => /twitter|other-site|faculty-directory|\.pdf/.test(request.url)), 'off-site, private or binary link fetched');
    const gaps = web.requests.slice(1).map((request, index) => request.at - web.requests[index].at);
    assert.ok(gaps.every((gap) => gap >= 3000), `gaps ${gaps}`);
    assert.ok(gaps.slice(1).every((gap) => gap >= 4000), 'Crawl-delay of 4 s ignored');
    assert.deepEqual(crawl.pages.map((item) => [item.category, item.ok]), [['home', true], ['contact', true], ['about', true], ['admission', true], ['programmes', true], ['accreditation', false]]);
    assert.match(crawl.pages.at(-1).error, /robots\.txt disallows/);
    assert.equal(crawl.record.website, `${SITE}/`);
    assert.equal(crawl.record.sourceUrl, `${SITE}/`);
    assert.equal(crawl.record.state, 'Uttarakhand');
    assert.deepEqual(crawl.record.courseSlugs, ['btech']);
    assert.ok(crawl.record.fetchedAt instanceof Date);
    assert.equal(shouldPublish(crawl.record), true);

    const small = fakeWeb(siteRoutes(''));
    const limited = await crawlSource({ name: 'DVIT', website: SITE }, { fetcher: createFetcher({ config: { ...config, maxPages: 3 }, fetchImpl: small.fetchImpl, wait: small.wait, now: small.now }), config: { ...config, maxPages: 3 } });
    assert.equal(limited.pages.length, 3);
  });

  test('robots.txt that disallows everything skips the site; 5xx robots is retried later', async () => {
    const blocked = fakeWeb({ ...siteRoutes('User-agent: GyaanVidhyaBot\nDisallow: /\n') });
    await assert.rejects(crawlSource({ name: 'X', website: SITE }, { fetcher: createFetcher({ config, fetchImpl: blocked.fetchImpl, wait: blocked.wait, now: blocked.now }), config }),
      (error) => error instanceof CrawlError && error.code === 'robots' && error.permanent);
    assert.equal(blocked.requests.length, 1);
    const down = fakeWeb({ ...siteRoutes(), [`${SITE}/robots.txt`]: { status: 503, body: 'busy' } });
    await assert.rejects(crawlSource({ name: 'X', website: SITE }, { fetcher: createFetcher({ config, fetchImpl: down.fetchImpl, wait: down.wait, now: down.now }), config }),
      (error) => error.code === 'robots-unavailable' && !error.permanent);
    const missing = fakeWeb({ ...siteRoutes(), [`${SITE}/robots.txt`]: { status: 404, body: '' } });
    const crawl = await crawlSource({ name: 'X', website: SITE }, { fetcher: createFetcher({ config, fetchImpl: missing.fetchImpl, wait: missing.wait, now: missing.now }), config });
    assert.match(crawl.pages.find((item) => item.category === 'accreditation').error, /HTTP 404/, '404 robots.txt means no restrictions');
    assert.ok(missing.requests.some((request) => request.url.endsWith('/naac')));
  });

  test('never follows redirects off the institution domain and falls back to http', async () => {
    const moved = fakeWeb({ [`${SITE}/robots.txt`]: { body: '' }, [`${SITE}/`]: { status: 302, headers: { location: 'https://parked-domains.example.com/' } } });
    await assert.rejects(crawlSource({ name: 'X', website: SITE }, { fetcher: createFetcher({ config, fetchImpl: moved.fetchImpl, wait: moved.wait, now: moved.now }), config }),
      (error) => error.code === 'offsite' && error.permanent);
    assert.ok(!moved.requests.some((request) => request.url.includes('parked')));

    const plain = fakeWeb({
      'https://old-college.example.ac.in/robots.txt': { error: 'ECONNREFUSED' },
      'http://old-college.example.ac.in/robots.txt': { status: 404 },
      'http://old-college.example.ac.in/': { body: '<html><head><title>Old College, Patna</title></head><body><p>Old College, Ashok Rajpath, Patna - 800005, Bihar</p></body></html>' },
    });
    const crawl = await crawlSource({ name: 'Old College', website: 'https://old-college.example.ac.in/' }, { fetcher: createFetcher({ config, fetchImpl: plain.fetchImpl, wait: plain.wait, now: plain.now }), config });
    assert.equal(crawl.record.website, 'http://old-college.example.ac.in/');
    assert.deepEqual([crawl.record.state, crawl.record.city, crawl.record.pincode], ['Bihar', 'Patna', '800005']);
  });

  test('responses are capped in size and non-HTML pages are rejected', async () => {
    const big = `<html><body><p>${'x'.repeat(5000)}</p></body></html>`;
    const web = fakeWeb({ [`${SITE}/robots.txt`]: { status: 404 }, [`${SITE}/`]: { body: big }, [`${SITE}/file`]: { body: 'x', headers: { 'content-type': 'application/pdf' } } });
    const fetcher = createFetcher({ config: { ...config, maxBytes: 1000 }, fetchImpl: web.fetchImpl, wait: web.wait, now: web.now });
    const page = await fetcher.getPage(`${SITE}/`, { domain: 'dvit-example.ac.in' });
    assert.equal(page.truncated, true);
    assert.equal(Buffer.byteLength(page.html), 1000);
    await assert.rejects(fetcher.getPage(`${SITE}/file`, { domain: 'dvit-example.ac.in' }), (error) => error.code === 'not-html');
  });

  test('publish rule needs a name, a state and the official website', () => {
    assert.equal(shouldPublish({ name: 'A', state: 'Goa', website: 'https://a.ac.in/' }), true);
    assert.equal(shouldPublish({ name: 'A', website: 'https://a.ac.in/' }), false);
    assert.deepEqual(missingForPublish({ name: 'A', website: 'https://a.ac.in/' }), ['state', 'city']);
  });
});
