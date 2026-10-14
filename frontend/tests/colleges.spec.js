import { test, expect as baseExpect } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000 });

// Waits for hydration: the header swaps its skeleton for "Log in" once the (mocked, signed-out) session check has run.
const open = async (page, path) => { await page.goto(path); await expect(page.getByRole('banner').getByRole('button', { name: 'Log in', exact: true })).toBeVisible(); };

const params = (page) => Object.fromEntries(new URL(page.url()).searchParams);
const strip = (page) => page.getByRole('group', { name: 'Choose a course' });
const sidebar = (page) => page.getByRole('complementary', { name: 'Filters' });
const filter = (page, legend, option) => sidebar(page).getByRole('group', { name: legend }).getByRole('radio', { name: option });
const results = (page) => page.locator('#main section[aria-labelledby="results-title"]');
const cards = (page) => results(page).getByRole('article');
const count = (page) => results(page).locator('p[role="status"]');
const heading = (page) => page.locator('#results-title');
const fitsWidth = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.beforeEach(async ({ page }) => {
  page.browserErrors = [];
  page.on('pageerror', (error) => page.browserErrors.push(error.message));
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: { error: 'Sign in to continue.' } }));
  await page.setViewportSize({ width: 1440, height: 900 });
});
test.afterEach(async ({ page }) => { expect(page.browserErrors).toEqual([]); });

test.describe('college listing', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/colleges'); });

  test('the colleges route has its intro, active navigation, honest labels and paged institution cards', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find colleges for your course');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).locator('[aria-current="page"]')).toHaveText('Colleges');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).locator('[data-group="Colleges"]')).toHaveAttribute('data-active', 'true');
    await expect(heading(page)).toHaveText('All colleges in India');
    await expect(count(page)).toHaveText('11 colleges · 29 programmes · All courses · All India');
    await expect(strip(page).getByRole('button', { name: 'All courses' })).toHaveAttribute('aria-pressed', 'true');
    await expect(results(page)).toContainText('Illustrative data');
    await expect(results(page).getByRole('definition').first()).toHaveText('₹0.7–6.5 L');
    await expect(cards(page)).toHaveCount(8);
    const first = cards(page).first();
    await expect(first.getByRole('heading', { level: 3 })).toHaveText('Northfield Institute of Technology');
    await expect(first).toContainText('4.3/ 5 demo rating');
    await expect(first.getByRole('link', { name: /^View college\s*:\s*Northfield Institute of Technology$/ })).toHaveAttribute('href', '/colleges/northfield-tech');
    await results(page).getByRole('button', { name: 'Show 3 more colleges' }).click();
    await expect(cards(page)).toHaveCount(11);
    await expect(page.locator('#card-northfield-design')).toBeFocused();
  });

  test('course, location, fee, search and sort filters stay in sync with the URL', async ({ page }) => {
    await strip(page).getByRole('button', { name: 'MBA', exact: true }).click();
    await expect(page).toHaveURL(/\/colleges\?course=mba$/);
    await expect(heading(page)).toHaveText('MBA colleges in India');
    await expect(count(page)).toHaveText('2 colleges · 2 programmes · MBA · All India');
    expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('nsedu:preferences')).course)).toBe('mba');
    await expect(filter(page, /^Course/, /^MBA/)).toBeChecked();
    await filter(page, 'Location', /^Pune/).check();
    expect(params(page)).toEqual({ course: 'mba', location: 'Pune' });
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page)).toContainText('Meadow School of Management');
    await expect(results(page).getByRole('list', { name: 'Active filters' }).getByRole('button')).toHaveText(['MBA', 'Pune']);
    await results(page).getByRole('button', { name: 'Remove filter: Pune' }).click();
    await expect(heading(page)).toBeFocused();
    expect(params(page)).toEqual({ course: 'mba' });
    await filter(page, 'Annual tuition', 'Up to ₹2 L / year').check();
    expect(params(page)).toEqual({ course: 'mba', fee: '200000' });
    await expect(results(page).getByRole('heading', { name: 'No colleges match all of these filters' })).toBeVisible();
    await results(page).getByRole('button', { name: /^Remove the tuition limit/ }).click();
    await expect(cards(page)).toHaveCount(2);
    expect(params(page)).toEqual({ course: 'mba' });

    await strip(page).getByRole('button', { name: 'All courses' }).click();
    await filter(page, 'Stream / field', /^Engineering/).check();
    expect(params(page)).toEqual({ field: 'Engineering' });
    await expect(heading(page)).toHaveText('Engineering colleges in India');
    await expect(count(page)).toHaveText('5 colleges · 7 programmes · Engineering · All India');
    await page.getByRole('searchbox', { name: 'Search within results' }).fill('riverside');
    await expect(page).toHaveURL(/[?&]q=riverside\b/);
    await expect(cards(page)).toHaveCount(1);
    await page.getByRole('searchbox', { name: 'Search within results' }).fill('');
    await expect(cards(page)).toHaveCount(5);
    await results(page).getByRole('combobox').selectOption('fee-asc');
    expect(params(page)).toEqual({ field: 'Engineering', sort: 'fee-asc' });
    await expect(cards(page).first()).toContainText('Central Institute of Technology');
    await page.reload();
    await expect(filter(page, 'Stream / field', /^Engineering/)).toBeChecked();
    await expect(results(page).getByRole('combobox')).toHaveValue('fee-asc');
    await expect(cards(page).first()).toContainText('Central Institute of Technology');
    await results(page).getByRole('button', { name: 'Clear all' }).click();
    expect(params(page)).toEqual({ sort: 'fee-asc' });
    await expect(count(page)).toContainText('11 colleges');
  });

  test('a URL course and location are applied on arrival, and unknown places explain themselves', async ({ page }) => {
    await open(page, '/colleges?course=mba&location=pune');
    await expect(strip(page).getByRole('button', { name: 'MBA', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(filter(page, 'Location', /^Pune/)).toBeChecked();
    await expect(cards(page)).toHaveCount(1);
    await expect(heading(page)).toHaveText('MBA colleges in Pune');
    await open(page, '/colleges?location=Goa');
    await expect(results(page).getByRole('heading', { name: 'No listed colleges in Goa yet' })).toBeVisible();
    await results(page).getByRole('button', { name: /^Search all India/ }).click();
    await expect(count(page)).toContainText('11 colleges');
  });

  test('add to compare keeps per-course picks in the tray and opens them on /compare', async ({ page }) => {
    await strip(page).getByRole('button', { name: 'MBA', exact: true }).click();
    await expect(cards(page)).toHaveCount(2);
    const meadow = results(page).getByRole('button', { name: 'Add to compare Meadow Management MBA' });
    await meadow.click();
    await expect(results(page).getByRole('button', { name: 'Added to compare Meadow Management MBA' })).toHaveAttribute('aria-pressed', 'true');
    await expect(cards(page).first()).toContainText('Meadow Management (MBA) added to compare · 1/3.');
    await results(page).getByRole('button', { name: 'Add to compare Riverside MBA' }).click();
    const tray = page.getByRole('complementary', { name: 'Compare tray' });
    await expect(tray).toContainText('2 colleges selected');
    await expect(tray.getByRole('region', { name: 'MBA comparison' })).toContainText('2/3');
    expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('nsedu:compare')))).toEqual({ mba: ['meadow-management-mba', 'riverside-university-mba'] });
    // A multi-programme college offers a course picker; picks for another course are kept separately.
    await strip(page).getByRole('button', { name: 'All courses' }).click();
    const riverside = page.locator('#card-riverside-university');
    await riverside.getByRole('button', { name: /Comparing 1/ }).click();
    await riverside.getByRole('button', { name: 'BCA add to compare' }).click();
    await expect(tray.getByRole('region', { name: 'BCA comparison' })).toContainText('1/3');
    await expect(tray).toContainText('Add one more BCA college for a side-by-side table.');
    await tray.getByRole('button', { name: 'Remove Riverside (BCA) from compare' }).click();
    await expect(tray.getByRole('region', { name: 'BCA comparison' })).toHaveCount(0);
    await tray.getByRole('link', { name: 'Compare now MBA colleges' }).click();
    await expect(page).toHaveURL(/\/compare\?course=mba&c=meadow-management-mba,riverside-university-mba$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Comparing MBA' })).toBeVisible();
    await expect(page.locator('#compare-slots').getByRole('heading', { level: 3 })).toHaveText(['Meadow School of Management', 'Riverside University']);
    await expect(page.getByRole('region', { name: 'MBA comparison table' })).toContainText('₹2,60,000');
  });

  for (const width of [390, 768]) {
    test(`small screens use the filter drawer and dock without page overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await expect(sidebar(page)).toBeHidden();
      const dock = page.getByRole('navigation', { name: 'Filter, sort and compare' });
      await dock.getByRole('button', { name: /^Filters/ }).click();
      const drawer = page.getByRole('dialog', { name: 'Filters' });
      await expect(drawer).toBeVisible();
      await drawer.getByRole('tab', { name: /^Course/ }).click();
      await drawer.getByRole('radio', { name: /^BCA/ }).check();
      await expect(drawer.getByRole('button', { name: 'Show 3 colleges' })).toBeVisible();
      expect(params(page)).toEqual({});
      await drawer.getByRole('button', { name: 'Show 3 colleges' }).click();
      await expect(drawer).toBeHidden();
      expect(params(page)).toEqual({ course: 'bca' });
      await expect(heading(page)).toHaveText('BCA colleges in India');
      expect(await fitsWidth(page)).toBe(true);
    });
  }
});

test.describe('college profile', () => {
  test('a profile renders its facts, course table and compare toggles', async ({ page }) => {
    await open(page, '/colleges/northfield-tech');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Northfield Institute of Technology');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).locator('[aria-current="page"]')).toHaveText('Northfield');
    await expect(page.locator('#profile-hero')).toContainText('Illustrative data');
    await expect(page.locator('#profile-hero')).toContainText('Bengaluru, Karnataka');
    const table = page.locator('#courses table');
    await expect(table.locator('tbody tr')).toHaveCount(3);
    await expect(table.locator('tbody th')).toContainText(['B.Tech', 'BCA', 'M.Tech']);
    await expect(table.locator('#course-btech')).toContainText('₹2,40,000');
    const toggle = table.getByRole('button', { name: 'Compare Northfield B.Tech' });
    await toggle.click();
    await expect(table.getByRole('button', { name: 'Added Northfield B.Tech' })).toHaveAttribute('aria-pressed', 'true');
    await expect(table.locator('#course-btech')).toContainText('1/3 B.Tech picked');
    expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('nsedu:compare')))).toEqual({ btech: ['northfield-tech-btech'] });
    await expect(page.locator('#similar').getByRole('heading', { level: 3 }).first()).toBeVisible();
    await page.locator('#similar').getByRole('link', { name: /^View college\s*:\s*Central Institute of Technology$/ }).click();
    await expect(page).toHaveURL(/\/colleges\/central-tech$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Central Institute of Technology');
  });

  test('an unknown college id returns the 404 page', async ({ page }) => {
    const response = await page.goto('/colleges/not-a-real-college');
    expect(response.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Let’s get you back on course.');
    await expect(page.getByRole('link', { name: 'Back to NSEDU' })).toHaveAttribute('href', '/');
  });
});
