// Integration spec for the redesigned platform: access gating, email-OTP login,
// the signed-in directory/profile/apply path and the public guide pages.
// It never submits an application and never sends a real OTP.
import { test, expect } from '@playwright/test';
import { mintStudentSession, cleanupStudentSession, closeSessionDb, studentEvents, TEST_EMAIL } from './helpers/student-session.js';

const GATED = ['/universities', '/colleges', '/compare', '/search?q=delhi', '/apply', '/account'];
const PUBLIC = ['/', '/courses', '/exams', '/eligibility', '/budget', '/scholarships', '/career-guidance', '/news', '/locations', '/about', '/contact', '/login'];

const h1 = (page) => page.locator('main h1').first();

test.describe('public access', () => {
  for (const path of PUBLIC) {
    test(`${path} is reachable logged out`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `status for ${path}`).toBeLessThan(400);
      if (path !== '/login') expect(new URL(page.url()).pathname, `${path} must not be gated`).not.toBe('/login');
      await expect(page.locator('main#main').first()).toBeVisible();
      await expect(h1(page)).toBeVisible();
    });
  }

  test('no page-level horizontal overflow at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/', '/courses', '/eligibility', '/budget', '/news', '/login']) {
      await page.goto(path);
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      expect(fits, `horizontal overflow on ${path}`).toBe(true);
    }
  });

  test('every page carries the skip link, header search and footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#main');
    await expect(page.locator('header a[href="/"]').first()).toBeAttached();
    await expect(page.locator('footer').first()).toBeVisible();
  });
});

test.describe('access gating (logged out)', () => {
  for (const path of GATED) {
    test(`${path} redirects to /login with next=`, async ({ page }) => {
      await page.goto(path);
      const url = new URL(page.url());
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('next')).toBe(path);
    });
  }

  // Login is always the popup: /login shows the homepage with the dialog open over it.
  const loginDialog = (page) => page.locator('dialog[open]');

  test('login offers email only while no SMS provider is configured', async ({ page }) => {
    await page.goto('/login');
    await expect(loginDialog(page)).toBeVisible();
    await expect(loginDialog(page).getByRole('heading').first()).toContainText(/log in/i);
    await expect(loginDialog(page).locator('input[type="email"], input[inputmode="email"]').first()).toBeVisible();
    await expect(loginDialog(page).getByText(/mobile number/i)).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('login refuses an off-site next target', async ({ page }) => {
    await page.goto('/login?next=https://example.com/evil');
    expect(new URL(page.url()).hostname).toBe('127.0.0.1');
    await expect(loginDialog(page)).toBeVisible();
    // Nothing on the page may offer the off-site target as a destination.
    await expect(page.locator('[href*="example.com"], [value*="example.com"]')).toHaveCount(0);
  });

  test('closing the popup on /login leaves the student on the homepage', async ({ page }) => {
    await page.goto('/login?next=/universities');
    await expect(loginDialog(page)).toBeVisible();
    await page.getByRole('button', { name: 'Close login' }).click();
    await expect(loginDialog(page)).toHaveCount(0);
    await page.waitForURL((url) => url.pathname === '/');
  });

  test('the home hero search opens the login popup over the page', async ({ page }) => {
    await page.goto('/');
    const search = page.locator('main input[id$="-query"], main input[type="search"]').first();
    await search.fill('delhi');
    await search.press('Enter');
    await expect(loginDialog(page)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('a signed-out click on a gated link opens the popup instead of leaving the page', async ({ page }) => {
    await page.goto('/news');
    // Until the session check answers, links navigate normally (the proxy then shows the popup on
    // /login); interception starts once the page knows the visitor is signed out.
    await expect(page.locator('header button[aria-haspopup="dialog"]:not([data-pending])').first()).toBeVisible();
    await page.locator('header a[href="/universities"]').first().click();
    await expect(loginDialog(page)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/news');
  });
});

test.describe('signed in', () => {
  // Serial: all of these share one minted student, and the afterAll cleanup deletes it.
  test.describe.configure({ mode: 'serial' });
  let cookie;

  test.beforeAll(async () => {
    ({ cookie } = await mintStudentSession());
  });

  test.afterAll(async () => {
    await cleanupStudentSession();
    await closeSessionDb();
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([cookie]);
  });

  test('the directory lists universities and searches them', async ({ page }) => {
    await page.goto('/universities');
    expect(new URL(page.url()).pathname).toBe('/universities');
    await expect(h1(page)).toHaveText(/university/i);
    await expect(page.locator('#university-search')).toBeVisible();
    await expect(page.locator('main a[href^="/universities/"]').first()).toBeVisible();
  });

  test('a university profile shows its name and an apply CTA', async ({ page }) => {
    await page.goto('/universities');
    const href = await page.locator('main a[href^="/universities/"]').first().getAttribute('href');
    await page.goto(href);
    await expect(h1(page)).toBeVisible();
    expect((await h1(page).textContent())?.trim().length).toBeGreaterThan(2);
    const apply = page.locator(`a[href^="/apply?university=${href.split('/').pop()}"]`).first();
    await expect(apply).toBeAttached({ timeout: 15000 });
  });

  test('apply shows the one-screen quick form (at most eight fields)', async ({ page }) => {
    await page.goto('/universities');
    const href = await page.locator('main a[href^="/universities/"]').first().getAttribute('href');
    await page.goto(`/apply?university=${href.split('/').pop()}`);
    await expect(h1(page)).toBeVisible();
    // Wait for the form to leave its loading phase before counting fields.
    await expect(page.locator('main form input[id$="-consent"]')).toBeVisible();
    // One screen, eight questions: name, mobile, email, course, qualification, score,
    // intake year and consent. Radio options and the score's unit select are not extra questions.
    const keys = await page.locator('main form input:not([type="hidden"]), main form select, main form textarea')
      .evaluateAll((nodes) => [...new Set(nodes.map((n) => (n.name || n.id || '').replace(/^.*-/, '')))].filter(Boolean));
    const found = keys.join(' ');
    expect(keys.length, `quick apply grew extra fields: ${found}`).toBeLessThanOrEqual(9);
    for (const field of ['fullName', 'phone', 'consent']) {
      expect(found, `quick apply is missing ${field}; it has: ${found}`).toContain(field);
    }
    const emailLocked = await page.locator('main form input[id$="-email"]').first()
      .evaluate((node) => node.readOnly || node.disabled);
    expect(emailLocked, 'the verified email must not be editable').toBe(true);
  });

  test('compare, the fee ledger and search render for a signed-in student', async ({ page }) => {
    for (const path of ['/compare', '/colleges', '/search?q=engineering']) {
      const response = await page.goto(path);
      expect(response?.status(), `status for ${path}`).toBeLessThan(400);
      expect(new URL(page.url()).pathname, `${path} should not bounce to login`).not.toBe('/login');
      await expect(h1(page)).toBeVisible();
    }
  });

  test('the account dashboard shows a log out control', async ({ page }) => {
    await page.goto('/account');
    expect(new URL(page.url()).pathname).toBe('/account');
    await expect(h1(page)).toBeVisible();
    await expect(page.getByRole('button', { name: /log ?out/i }).first()).toBeVisible();
  });

  // --- depth phase -----------------------------------------------------------------------------

  test('shortlisting from a card builds the institution compare board', async ({ page }) => {
    await page.goto('/universities');
    const cards = page.locator('main article');
    const slugs = [];
    for (let index = 0; index < 2; index += 1) {
      const card = cards.nth(index);
      slugs.push((await card.locator('a[href^="/universities/"]').first().getAttribute('href')).split('/').pop());
      await card.getByRole('button', { name: /compare/i }).first().click();
    }
    await page.goto(`/compare?u=${slugs.join(',')}`);
    await expect(h1(page)).toBeVisible();
    // Both institutions appear as columns, and the board never invents a figure.
    for (const slug of slugs) await expect(page.locator(`main a[href="/universities/${slug}"]`).first()).toBeAttached();
    await expect(page.getByText(/not a Gyaan Vidhya rating or ranking/i)).toBeVisible();
  });

  test('a NIRF rank is always shown with the list it belongs to', async ({ page }) => {
    // NIRF publishes one table per subject, so a bare "#3" would read as an overall rank.
    await page.goto('/universities?sort=nirf');
    const badge = page.locator('main li', { hasText: /^NIRF / }).first();
    await expect(badge).toBeVisible();
    expect((await badge.textContent()).trim(), 'NIRF badge should name its category and year')
      .toMatch(/^NIRF [A-Za-z][\w &,'()-]*#\d+( · \d{4})?$/);
  });

  test('a profile states the snapshot date and does not claim a current approval', async ({ page }) => {
    await page.goto('/universities?sort=nirf');
    const href = await page.locator('main a[href^="/universities/"]').first().getAttribute('href');
    await page.goto(href);
    await expect(h1(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: /accreditation/i }).first()).toBeVisible();
    await expect(page.getByText(/source-reported, not verified|not individually verified/i).first()).toBeVisible();
  });

  test('searching the directory records a search event with its result count', async ({ page, context }) => {
    // Activity is only captured after "Accept all" in the cookie banner.
    await context.addCookies([{ name: 'gv_consent', value: 'all', domain: '127.0.0.1', path: '/' }]);
    // Batches leave on a 5s timer, so wait for the API to accept one rather than for a beacon.
    const accepted = page.waitForResponse((response) => response.url().includes('/api/insights/events') && response.status() === 202, { timeout: 30000 });
    await page.goto('/universities?q=delhi&state=Delhi');
    await expect(h1(page)).toBeVisible();
    await accepted;
    const [search] = await studentEvents(TEST_EMAIL, { type: 'search', query: 'delhi' });
    expect(search, 'no search event reached student_events').toBeTruthy();
    expect(search.state).toBe('Delhi');
    // The admin content-gap report is built from `results`, so it must always be recorded.
    expect(typeof search.results, 'results must be stored for the no-result gap list').toBe('number');
    // Only the route is kept, never the query string the student typed into the URL.
    expect(search.path).toBe('/universities');
  });
});

test.describe('guides and tools', () => {
  test('courses and exams indexes link to their guides', async ({ page }) => {
    await page.goto('/courses');
    await expect(h1(page)).toBeVisible();
    await expect(page.locator('main a[href^="/courses/"]').first()).toBeVisible();
    await page.goto('/exams');
    await expect(h1(page)).toBeVisible();
    await expect(page.locator('main a[href^="/exams/"]').first()).toBeVisible();
  });

  test('eligibility asks one question at a time', async ({ page }) => {
    await page.goto('/eligibility');
    await expect(h1(page)).toBeVisible();
    await expect(page.locator('main form').first()).toBeVisible();
    await expect(page.locator('main form input[type="radio"]').first()).toBeAttached();
  });

  test('budget estimates a first-year cost', async ({ page }) => {
    await page.goto('/budget');
    await expect(h1(page)).toBeVisible();
    await expect(page.locator('#budget-amount')).toBeVisible();
  });

  test('the news desk renders its feed and its own search', async ({ page }) => {
    await page.goto('/news');
    await expect(h1(page)).toBeVisible();
    await expect(page.getByPlaceholder('Search headlines')).toBeVisible();
  });
});

test.describe('cookie consent', () => {
  const card = (page) => page.getByRole('region', { name: 'We value your privacy' });

  test('a first visit asks once; "Essential only" is remembered and stops tracking', async ({ page, context }) => {
    await page.goto('/');
    await expect(card(page)).toBeVisible();
    await expect(card(page).getByRole('button', { name: /Accept all/ })).toBeVisible();
    await card(page).getByRole('button', { name: 'Essential only' }).click();
    await expect(card(page)).toHaveCount(0);
    const cookies = await context.cookies();
    expect(cookies.find((cookie) => cookie.name === 'gv_consent')?.value).toBe('essential');
    expect(cookies.find((cookie) => cookie.name === 'gv_visitor'), 'no personalisation id without consent').toBeUndefined();
    await page.reload();
    await expect(card(page)).toHaveCount(0);
  });

  test('"Cookie settings" in the footer brings the choice back', async ({ page, context }) => {
    await context.addCookies([{ name: 'gv_consent', value: 'all', domain: '127.0.0.1', path: '/' }]);
    await page.goto('/news');
    await expect(card(page)).toHaveCount(0);
    // The footer is server-rendered; its button only works once the page has hydrated, so retry.
    await expect(async () => {
      await page.getByRole('button', { name: 'Cookie settings' }).click();
      await expect(card(page)).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
  });
});

// The cover-image policy once listed three hand-picked URLs; the feeds rotated past them within days
// and every story silently lost its picture. Publisher mode must pass current-style feed URLs.
test.describe('news images', () => {
  const publisher = { topics: [], imagePolicy: { mode: 'publisher', reviewedUrls: [] } };
  const reviewed = { topics: [], imagePolicy: { mode: 'reviewed', reviewedUrls: [] } };
  const feedUrls = [
    'https://etimg.etb2bimg.com/thumb/img-size-120344/135167421.cms',
    'https://images.indianexpress.com/2026/10/jee-main.jpg',
    'https://www.hindustantimes.com/ht-img/img/2026/10/23/550x309/neet_1729660000000.jpg',
  ];

  test('publisher mode shows the publisher photo; other hosts and http stay blocked', async () => {
    const { displayNewsImage } = await import('../src/lib/education-news.js');
    for (const url of feedUrls) expect(displayNewsImage(url, publisher), url).toBe(url);
    for (const url of feedUrls) expect(displayNewsImage(url, reviewed), `${url} under reviewed`).toBeNull();
    expect(displayNewsImage('https://example.com/photo.jpg', publisher)).toBeNull();
    expect(displayNewsImage('http://images.indianexpress.com/2026/10/a.jpg', publisher)).toBeNull();
  });

  test('the stored news policy shows publisher photos', async ({ request }) => {
    const response = await request.get('/api/content?keys=news');
    expect(response.ok()).toBe(true);
    const content = await response.json();
    expect(content.news?.imagePolicy?.mode).toBe('publisher');
  });
});
