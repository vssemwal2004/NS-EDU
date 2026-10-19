// Integration spec for the redesigned platform: access gating, email-OTP login,
// the signed-in directory/profile/apply path and the public guide pages.
// It never submits an application and never sends a real OTP.
import { test, expect } from '@playwright/test';
import { mintStudentSession, cleanupStudentSession, closeSessionDb } from './helpers/student-session.js';

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

  test('login offers email only while no SMS provider is configured', async ({ page }) => {
    await page.goto('/login');
    await expect(h1(page)).toContainText(/log in/i);
    await expect(page.locator('main input[type="email"], main input[inputmode="email"]').first()).toBeVisible();
    await expect(page.locator('main').getByText(/mobile number/i)).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('login refuses an off-site next target', async ({ page }) => {
    await page.goto('/login?next=https://example.com/evil');
    expect(new URL(page.url()).hostname).toBe('127.0.0.1');
    await expect(h1(page)).toBeVisible();
    // Nothing on the page may offer the off-site target as a destination.
    await expect(page.locator('[href*="example.com"], [value*="example.com"]')).toHaveCount(0);
  });

  test('the home hero search leads to the gated directory, i.e. to login', async ({ page }) => {
    await page.goto('/');
    const search = page.locator('main input[id$="-query"], main input[type="search"]').first();
    await search.fill('delhi');
    await search.press('Enter');
    await page.waitForURL(/\/login|\/universities|\/search/);
    expect(new URL(page.url()).pathname).toBe('/login');
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
