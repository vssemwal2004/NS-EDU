import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { scraperConfig } from '../src/scraper/config.js';
import { crawlSource, missingForPublish, shouldPublish } from '../src/scraper/crawler.js';
import { CrawlError, createFetcher } from '../src/scraper/fetcher.js';
import { looksClientRendered } from '../src/scraper/renderer.js';
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

    const apexOnly = fakeWeb({
      'https://www.apex-only.example.ac.in/robots.txt': { error: 'ENOTFOUND' },
      'https://apex-only.example.ac.in/robots.txt': { status: 404 },
      'https://apex-only.example.ac.in/': { body: '<html><head><title>Apex University</title></head><body><p>Apex University official campus website.</p></body></html>' },
    });
    const apexCrawl = await crawlSource(
      { name: 'Apex University', website: 'https://www.apex-only.example.ac.in/' },
      { fetcher: createFetcher({ config, fetchImpl: apexOnly.fetchImpl, wait: apexOnly.wait, now: apexOnly.now }), config },
    );
    assert.equal(apexCrawl.record.website, 'https://apex-only.example.ac.in/');
    assert.deepEqual(apexOnly.requests.slice(0, 3).map((request) => request.url), [
      'https://www.apex-only.example.ac.in/robots.txt',
      'https://apex-only.example.ac.in/robots.txt',
      'https://apex-only.example.ac.in/',
    ]);
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

  test('a crawl deadline preserves the home page and stops scheduling secondary pages', async () => {
    const web = fakeWeb(siteRoutes('User-agent: *\nAllow: /\n'));
    const crawl = await crawlSource(
      { name: 'Deadline University', website: SITE, state: 'Uttarakhand' },
      { fetcher: createFetcher({ config, fetchImpl: web.fetchImpl, wait: web.wait, now: web.now }), config, deadlineAt: Date.now() },
    );
    assert.deepEqual(crawl.pages.map((item) => item.category), ['home']);
    assert.equal(web.requests.filter((item) => !item.url.endsWith('/robots.txt')).length, 1);
  });

  test('renders recognisable JavaScript app shells with a bounded injected renderer', async () => {
    const shell = '<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>';
    assert.equal(looksClientRendered(shell), true);
    assert.equal(looksClientRendered('<html><head><script type="module" src="/main.js"></script></head><body><app-root></app-root></body></html>'), true);
    assert.equal(looksClientRendered('<html><head><meta http-equiv="refresh" content="0; url=/home"><script>window.location.replace("/home")</script></head><body>Redirecting</body></html>'), true);
    assert.equal(looksClientRendered('<html><body><script>window.location.href = "kuvempu/index.php";</script></body></html>'), true);
    assert.equal(looksClientRendered('<html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"><div class="splash"><span>Loading</span></div></div></body></html>'), true);
    assert.equal(looksClientRendered('<html><body><main><p>Server rendered university page.</p></main><script src="/app.js"></script></body></html>'), false);
    const web = fakeWeb({
      [`${SITE}/robots.txt`]: { status: 404 }, [`${SITE}/`]: { body: shell },
      [`${SITE}/about`]: { body: shell }, [`${SITE}/programmes`]: { body: shell },
    });
    const rendered = {
      [`${SITE}/`]: '<html><head><title>Shell University</title></head><body><a href="/about">About</a><a href="/programmes">Programmes</a></body></html>',
      [`${SITE}/about`]: '<html><body><h1>About Shell University</h1><p>Shell University was established to provide higher education and research in Kerala.</p></body></html>',
      [`${SITE}/programmes`]: '<html><body><h1>Programmes</h1><ul><li>Bachelor of Technology in Computer Science</li><li>Master of Business Administration</li></ul></body></html>',
    };
    const calls = [];
    const renderer = { render: async (url) => { calls.push(url); return rendered[url] ?? null; } };
    const jsConfig = { ...config, maxPages: 3 };
    const crawl = await crawlSource(
      { name: 'Shell University', website: SITE, state: 'Kerala' },
      { fetcher: createFetcher({ config: jsConfig, fetchImpl: web.fetchImpl, wait: web.wait, now: web.now }), config: jsConfig, renderer },
    );
    assert.deepEqual(calls, [`${SITE}/`, `${SITE}/about`, `${SITE}/programmes`]);
    assert.ok(crawl.pages.every((page) => page.rendered));
    assert.match(crawl.record.about, /established to provide higher education/i);
    assert.ok(crawl.record.programmesOffered.some((row) => /Bachelor of Technology/i.test(row.name)));

    const redirectedSite = 'https://redirect-example.ac.in';
    const redirectedWeb = fakeWeb({
      [`${redirectedSite}/robots.txt`]: { status: 404 },
      [`${redirectedSite}/`]: { body: '<html><body><script>window.location.href = "kuvempu/index.php";</script></body></html>' },
      [`${redirectedSite}/kuvempu/courses`]: { body: '<html><body><h1>Courses</h1><p>Master of Business Administration</p></body></html>' },
    });
    const redirectedRenderer = { render: async () => ({
      url: `${redirectedSite}/kuvempu/index.php`,
      html: '<html><body><a href="courses">Courses</a><p>Redirected University in Kerala.</p></body></html>',
    }) };
    const redirected = await crawlSource(
      { name: 'Redirected University', website: redirectedSite, state: 'Kerala' },
      { fetcher: createFetcher({ config: jsConfig, fetchImpl: redirectedWeb.fetchImpl, wait: redirectedWeb.wait, now: redirectedWeb.now }), config: jsConfig, renderer: redirectedRenderer },
    );
    assert.ok(redirected.pages.some((item) => item.url === `${redirectedSite}/kuvempu/courses` && item.ok), JSON.stringify(redirected.pages));
    assert.ok(redirected.record.programmesOffered.some((row) => /Master of Business Administration/i.test(row.name)));
  });

  test('publish rule needs a name, a state and the official website', () => {
    assert.equal(shouldPublish({ name: 'A', state: 'Goa', website: 'https://a.ac.in/' }), true);
    assert.equal(shouldPublish({ name: 'A', website: 'https://a.ac.in/' }), false);
    assert.deepEqual(missingForPublish({ name: 'A', website: 'https://a.ac.in/' }), ['state', 'city']);
  });
});
