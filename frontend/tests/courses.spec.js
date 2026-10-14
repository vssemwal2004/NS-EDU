import { test, expect as baseExpect } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000 });

// Waits for hydration: the header swaps its skeleton for "Log in" once the (mocked, signed-out) session check has run.
const open = async (page, path) => { await page.goto(path); await expect(page.getByRole('banner').getByRole('button', { name: 'Log in', exact: true })).toBeVisible(); };

const params = (page) => Object.fromEntries(new URL(page.url()).searchParams);
const status = (page) => page.locator('main').getByRole('status');
const directory = (page, name) => page.locator(`section[aria-label="${name}"]`);
const fieldChip = (page, field) => page.getByRole('group', { name: 'Filter by field' }).getByRole('button', { name: new RegExp(`^${field}\\s*\\d+$`) });
const breadcrumbCurrent = (page) => page.getByRole('navigation', { name: 'Breadcrumb' }).locator('[aria-current="page"]');

test.beforeEach(async ({ page }) => {
  page.browserErrors = [];
  page.on('pageerror', (error) => page.browserErrors.push(error.message));
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: { error: 'Sign in to continue.' } }));
  await page.setViewportSize({ width: 1440, height: 900 });
});
test.afterEach(async ({ page }) => { expect(page.browserErrors).toEqual([]); });

test.describe('courses', () => {
  test('the directory filters by level, field and search, keeps the URL in sync and restores it', async ({ page }) => {
    await open(page, '/courses');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Explore courses by field & level');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).locator('[data-group="Courses"]')).toHaveAttribute('data-active', 'true');
    const courses = directory(page, 'Course directory');
    await expect(status(page)).toHaveText('16 courses');
    await expect(courses.getByRole('list', { name: 'Courses' }).getByRole('listitem')).toHaveCount(16);
    await courses.getByRole('group', { name: 'Degree level' }).getByRole('button', { name: /^Postgraduate/ }).click();
    await expect(status(page)).toHaveText('2 courses · Postgraduate');
    expect(params(page)).toEqual({ level: 'PG' });
    await expect(fieldChip(page, 'Design')).toHaveAttribute('aria-disabled', 'true');
    await fieldChip(page, 'Engineering').click();
    await expect(status(page)).toHaveText('1 course · Postgraduate · Engineering');
    expect(params(page)).toEqual({ level: 'PG', field: 'Engineering' });
    await expect(courses.getByRole('heading', { level: 2 })).toHaveText(['M.Tech']);
    await page.reload();
    await expect(status(page)).toHaveText('1 course · Postgraduate · Engineering');
    await expect(fieldChip(page, 'Engineering')).toHaveAttribute('aria-pressed', 'true');
    await courses.getByRole('button', { name: 'Clear all' }).click();
    await expect(status(page)).toHaveText('16 courses');
    expect(params(page)).toEqual({});
    await courses.getByRole('searchbox', { name: 'Search courses' }).fill('design');
    await expect(status(page)).toHaveText('1 course · “design”');
    expect(params(page)).toEqual({ q: 'design' });
    await courses.getByLabel('Sort by').selectOption('colleges');
    expect(params(page)).toEqual({ q: 'design', sort: 'colleges' });
    await courses.getByRole('searchbox', { name: 'Search courses' }).fill('no-such-course');
    await expect(courses.getByRole('heading', { name: 'No courses match these filters' })).toBeVisible();
    await courses.getByRole('button', { name: 'Clear filters' }).click();
    await expect(courses.getByRole('heading', { level: 2 }).first()).toHaveText('B.Tech');
    await courses.getByRole('link', { name: 'View course' }).first().click();
    await expect(page).toHaveURL(/\/courses\/btech$/);
    expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('nsedu:preferences')).course)).toBe('btech');
  });

  test('a course page shows facts, sample colleges, related exams and next steps', async ({ page }) => {
    await open(page, '/courses/btech');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('B.Tech');
    await expect(breadcrumbCurrent(page)).toHaveText('B.Tech');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).locator('[data-group="Courses"]')).toHaveAttribute('data-active', 'true');
    await expect(page.locator('main')).toContainText('Bachelor of Technology');
    await expect(page.locator('main')).toContainText('5 programmes');
    const colleges = page.locator('#colleges');
    await expect(colleges.getByRole('heading', { level: 2 })).toHaveText('Sample colleges offering B.Tech');
    await expect(colleges).toContainText('Northfield Institute of Technology');
    await expect(colleges.getByRole('link', { name: 'Compare side by side' })).toHaveAttribute('href', '/compare?course=btech');
    await expect(page.locator('#exams').getByRole('heading', { level: 3 })).toHaveText(['JEE Main']);
    await page.locator('#exams').getByRole('link', { name: /^Exam guide\s*:\s*JEE Main$/ }).click();
    await expect(page).toHaveURL(/\/exams\/jee$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('JEE Main');
  });

  test('an unknown course id returns the 404 page', async ({ page }) => {
    const response = await page.goto('/courses/not-a-course');
    expect(response.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Let’s get you back on course.');
  });
});

test.describe('exams', () => {
  test('the exam directory filters by field and search, and exam anchors land on their card', async ({ page }) => {
    await open(page, '/exams');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrance exam guides');
    const exams = directory(page, 'Entrance exam guides');
    await expect(status(page)).toHaveText('4 exam guides');
    await expect(exams.getByRole('article')).toHaveCount(4);
    await expect(exams.locator('article#jee').getByRole('link', { name: /^Official website/ })).toHaveAttribute('href', 'https://jeemain.nta.nic.in/');
    await fieldChip(page, 'Medical').click();
    await expect(status(page)).toHaveText('1 exam guide · Medical');
    expect(params(page)).toEqual({ field: 'Medical' });
    await expect(exams.getByRole('article')).toHaveText([/NEET UG/]);
    await exams.getByRole('button', { name: 'Clear all' }).click();
    await exams.getByRole('searchbox', { name: 'Search exams' }).fill('MBA');
    await expect(status(page)).toHaveText('1 exam guide · “MBA”');
    await expect(exams.getByRole('article')).toHaveText([/CAT/]);
    await open(page, '/exams#neet');
    await expect(page.locator('article#neet')).toBeInViewport();
    await page.locator('article#neet').getByRole('link', { name: /^Exam guide\s*:\s*NEET UG$/ }).click();
    await expect(page).toHaveURL(/\/exams\/neet$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('NEET UG');
  });

  test('an exam page links to the official source and its related courses', async ({ page }) => {
    await open(page, '/exams/cat');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('CAT');
    await expect(breadcrumbCurrent(page)).toHaveText('CAT');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).locator('[data-group="Exams"]')).toHaveAttribute('data-active', 'true');
    const official = page.getByRole('link', { name: 'Visit official website (opens in a new tab)' });
    await expect(official).toHaveAttribute('href', 'https://iimcat.ac.in/');
    await expect(official).toHaveAttribute('target', '_blank');
    await expect(page.locator('#courses')).toContainText('MBA');
    const response = await page.goto('/exams/not-an-exam');
    expect(response.status()).toBe(404);
  });
});

test.describe('search', () => {
  test('result tabs filter by type with counts and a best match', async ({ page }) => {
    await open(page, '/search?q=MBA');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Results for “MBA”');
    const tabs = page.getByRole('navigation', { name: 'Result types' }).getByRole('link');
    await expect(tabs).toHaveText([/^All\s*1$/, /^Courses\s*1$/, /^Colleges\s*0$/, /^Exams\s*0$/]);
    await expect(tabs.first()).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('main')).toContainText('Best match · Course');
    await expect(page.getByRole('heading', { level: 2, name: 'Sample colleges offering MBA' })).toBeVisible();
    await tabs.filter({ hasText: 'Colleges' }).click();
    await expect(page).toHaveURL(/\/search\?q=MBA&tab=colleges$/);
    await expect(page.locator('main')).toContainText('No colleges match “MBA”.');
    await expect(tabs.nth(2)).toHaveAttribute('aria-current', 'page');
    await tabs.filter({ hasText: 'Courses' }).click();
    await expect(page).toHaveURL(/\/search\?q=MBA&tab=courses$/);
    await expect(status(page)).toHaveText('1 result for “MBA” in courses');

    await open(page, '/search?q=Pune&tab=colleges');
    await expect(status(page)).toHaveText('3 results for “Pune” in colleges');
    await expect(page.locator('main').getByRole('article').getByRole('heading', { level: 3 })).toHaveText(['Meadow Engineering College', 'Meadow School of Management', 'Meadow Institute of Pharmacy']);
    await page.locator('main').getByRole('link', { name: 'Meadow School of Management', exact: true }).click();
    await expect(page).toHaveURL(/\/colleges\/meadow-management$/);

    await open(page, '/search?q=zzzz');
    await expect(page.getByRole('heading', { level: 2, name: 'No matches for “zzzz”' })).toBeVisible();
    await page.locator('main').getByRole('searchbox', { name: 'Search courses, colleges, exams and cities' }).fill('JEE');
    await page.locator('main').getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/\/search\?q=JEE$/);
    await expect(status(page)).toHaveText('1 result for “JEE”');
  });
});

test.describe('guides and information pages', () => {
  test('a guide checklist tick persists after reload and stays separate per guide', async ({ page }) => {
    await open(page, '/admission-checklist');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Before you apply');
    const checklist = page.locator('#checklist');
    await expect(checklist.getByRole('heading', { level: 2 })).toHaveText('Documents to keep ready');
    await expect(checklist.getByRole('status')).toHaveText('0 of 7 ready');
    await checklist.getByRole('checkbox', { name: 'Identity proof' }).check();
    await expect(checklist.getByRole('status')).toHaveText('1 of 7 ready');
    expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('nsedu:guide-checklist:admission-checklist')))).toEqual(['identity']);
    await page.reload();
    await expect(checklist.getByRole('checkbox', { name: 'Identity proof' })).toBeChecked();
    await expect(checklist.getByRole('status')).toHaveText('1 of 7 ready');
    await expect(page.getByRole('navigation', { name: 'On this page' }).first().getByRole('link', { name: /Official exam websites/ })).toHaveAttribute('href', '#go-to-the-official-exam-website');
    await open(page, '/scholarships');
    await expect(page.locator('#checklist').getByRole('status')).toHaveText('0 of 7 ready');
    await open(page, '/admission-checklist');
    await checklist.getByRole('button', { name: 'Clear ticks' }).click();
    await expect(checklist.getByRole('status')).toHaveText('0 of 7 ready');
    await expect(checklist.getByRole('checkbox', { name: 'Identity proof' })).not.toBeChecked();
    await expect(checklist.getByRole('button', { name: 'Clear ticks' })).toBeDisabled();
  });

  test('information pages render from the site copy and unknown slugs return 404', async ({ page }) => {
    await open(page, '/help');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Help centre & FAQs');
    await expect(breadcrumbCurrent(page)).toHaveText('Help centre & FAQs');
    await open(page, '/privacy-policy');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
    await expect(page.locator('main')).toContainText('Policy preview');
    const response = await page.goto('/not-a-real-page');
    expect(response.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Let’s get you back on course.');
  });
});
