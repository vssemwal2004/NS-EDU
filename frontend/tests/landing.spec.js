import { test, expect as baseExpect } from '@playwright/test';

// The dev server compiles routes on first visit, so client-side navigations get a generous wait.
const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000 });

// Waits for hydration: the header swaps its skeleton for "Log in" once the (mocked, signed-out) session check has run.
const open = async (page, path) => { await page.goto(path); await expect(page.getByRole('banner').getByRole('button', { name: 'Log in', exact: true })).toBeVisible(); };

const heroAlt = 'Three students exploring their next chapter together in a university library';
const hero = (page) => page.locator('section[aria-labelledby="hero-title"]');
const hrefs = (locator) => locator.getByRole('link').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
const params = (page) => Object.fromEntries(new URL(page.url()).searchParams);
const fitsWidth = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const courseStrip = (page) => page.getByRole('group', { name: 'Choose a course' });
const explorer = (page) => page.locator('#course-colleges');
// The homepage embeds the news section, which loads the feed when scrolled near: never use live news.
const feed = { status: 'ready', articles: [], sources: [{ id: 'indian-express', name: 'The Indian Express', state: 'fresh' }], updatedAt: '2026-10-07T12:00:00Z', refreshAfterSeconds: 600 };
// Homepage order: first screen, stats, 1 destinations, streams, 2 colleges, compare promo, 3 eligibility, exams, 4 budget, 5 news.
const sections = {
  firstScreen: '[data-first-screen]',
  stats: 'section[aria-labelledby="home-stats-title"]',
  destinations: '#study-destinations',
  streams: 'section[aria-labelledby="streams-title"]',
  colleges: '#course-colleges',
  comparePromo: 'section[aria-labelledby="compare-promo-title"]',
  eligibility: '#course-eligibility',
  exams: 'section[aria-labelledby="exams-title"]',
  budget: '#college-budget',
  news: '#education-news',
};

test.beforeEach(async ({ page }) => {
  page.browserErrors = [];
  page.on('pageerror', (error) => page.browserErrors.push(error.message));
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: { error: 'Sign in to continue.' } }));
  await page.route('**/api/education-news', (route) => route.fulfill({ json: feed }));
  await open(page, '/');
});
test.afterEach(async ({ page }) => {
  expect(page.browserErrors).toEqual([]);
});

test('the homepage shows its sections in the approved order with the extra bands between them', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find a college that fits your future.');
  const order = await page.evaluate((selectors) => {
    const all = [...document.querySelectorAll('main#main *')];
    return selectors.map((selector) => all.indexOf(document.querySelector(selector)));
  }, Object.values(sections));
  expect(order.every((position) => position >= 0)).toBe(true);
  expect(order).toEqual(order.toSorted((a, b) => a - b));
  for (const [selector, heading] of [
    [sections.destinations, 'Explore where you want to study'], [sections.colleges, 'Course-wise colleges in India'],
    [sections.eligibility, 'Your next step starts here.'], [sections.budget, 'Can this college fit your budget?'], [sections.news, 'Education, in focus.'],
    [sections.stats, 'At a glance'], [sections.streams, 'Explore by stream'], [sections.exams, 'Entrance exams to know'], [sections.comparePromo, 'Compare up to 3 colleges for the same course'],
  ]) await expect(page.locator(selector).getByRole('heading', { level: 2 }).first()).toHaveText(heading);
  for (const [name, href] of [['More course-wise colleges', '/colleges'], ['More eligibility check', '/eligibility'], ['More budget check', '/budget'], ['More education news', '/news']]) {
    await expect(page.getByRole('navigation', { name, exact: true }).getByRole('link').last()).toHaveAttribute('href', href);
  }
});

for (const [width, height] of [[1440, 900], [1366, 768], [1280, 720], [1920, 1080]]) {
  test(`desktop ${width}×${height} fits the first screen below the header with the next band underneath`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    const header = await page.getByRole('banner').boundingBox();
    const intro = await page.locator(sections.firstScreen).boundingBox();
    expect(Math.abs(intro.y - (header.y + header.height))).toBeLessThanOrEqual(1);
    expect(intro.y + intro.height).toBeLessThanOrEqual(height + 1);
    expect(intro.y + intro.height).toBeGreaterThanOrEqual(height - 1);
    const next = await page.locator(sections.stats).boundingBox();
    expect(next.y).toBeGreaterThanOrEqual(height - 1);
    for (const navigation of ['Explore by field', 'Popular courses', 'Tools for your college journey']) {
      const links = page.getByRole('navigation', { name: navigation, exact: true }).getByRole('link');
      expect(await links.count()).toBeGreaterThan(0);
      for (const link of await links.all()) {
        const bounds = await link.boundingBox();
        expect(bounds.y).toBeGreaterThanOrEqual(intro.y);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      }
    }
    const search = await hero(page).getByRole('button', { name: 'Search', exact: true }).boundingBox();
    expect(search.y + search.height).toBeLessThanOrEqual(height);
  });
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`the whole homepage fits a ${width}px screen without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find a college that fits your future.');
    await expect(page.getByRole('img', { name: heroAlt })).toBeVisible();
    expect(await fitsWidth(page)).toBe(true);
    // Scroll through every band so lazy sections (news) render before measuring again.
    for (const selector of Object.values(sections)) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      expect(await fitsWidth(page), `${selector} at ${width}px`).toBe(true);
    }
    await expect(page.locator(sections.news).locator('[data-feed-status="ready"]')).toBeVisible();
    expect(await page.evaluate(() => document.fonts.check('400 16px "Plus Jakarta Sans"') && document.fonts.check('16px "DM Serif Display"'))).toBe(true);
  });
}

test('the hero image is a small compressed webp shared by the artwork', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const photo = page.getByRole('img', { name: heroAlt });
    await expect(photo).toBeVisible();
    const source = await photo.locator('image').getAttribute('href');
    const response = await page.request.get(source, { headers: { Accept: 'image/webp' } });
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toBe('image/webp');
    expect((await response.body()).byteLength).toBeLessThan(150_000);
  }
});

test('search tabs work with keyboard navigation', async ({ page }) => {
  const colleges = hero(page).getByRole('tab', { name: 'Colleges', exact: true });
  await colleges.focus();
  await page.keyboard.press('ArrowRight');
  await expect(hero(page).getByRole('tab', { name: 'Courses', exact: true })).toBeFocused();
  await expect(hero(page).getByRole('tab', { name: 'Courses', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(hero(page).getByLabel('Search courses', { exact: true })).toBeVisible();
  await page.keyboard.press('End');
  await expect(hero(page).getByRole('tab', { name: 'Exams', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(colleges).toBeFocused();
  await expect(colleges).toHaveAttribute('aria-selected', 'true');
});

test('hero search tabs route to search, courses and exams with the query', async ({ page }) => {
  const submit = () => hero(page).getByRole('button', { name: 'Search', exact: true }).click();
  await hero(page).getByLabel('Search colleges', { exact: true }).fill('Pune');
  await submit();
  await expect(page).toHaveURL(/\/search\?q=Pune$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Results for “Pune”');
  await expect(page.locator('main').getByRole('status')).toHaveText('3 results for “Pune”');
  await open(page, '/');
  await hero(page).getByRole('tab', { name: 'Courses', exact: true }).click();
  await hero(page).getByLabel('Search courses', { exact: true }).fill('MBA');
  await submit();
  await expect(page).toHaveURL(/\/courses\?q=MBA$/);
  await expect(page.locator('main').getByRole('status')).toHaveText('1 course · “MBA”');
  await expect(page.getByRole('heading', { level: 2, name: 'MBA', exact: true })).toBeVisible();
  await open(page, '/');
  await hero(page).getByRole('tab', { name: 'Exams', exact: true }).click();
  await hero(page).getByLabel('Search exams', { exact: true }).fill('JEE');
  await submit();
  await expect(page).toHaveURL(/\/exams\?q=JEE$/);
  await expect(page.locator('main').getByRole('status')).toHaveText('1 exam guide · “JEE”');
  await expect(page.getByRole('link', { name: /Official website/ })).toHaveAttribute('href', 'https://jeemain.nta.nic.in/');
  await open(page, '/');
  await hero(page).getByRole('tab', { name: 'Courses', exact: true }).click();
  await submit();
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.locator('main').getByRole('status')).toHaveText('16 courses');
});

test('fields, popular courses, tool shortcuts and stats link to their routes', async ({ page }) => {
  expect(await hrefs(page.getByRole('navigation', { name: 'Explore by field', exact: true }))).toEqual(['Engineering', 'Management', 'Medical', 'Design', 'Law', 'Commerce'].map((field) => `/courses?field=${field}`));
  expect(await hrefs(page.getByRole('navigation', { name: 'Popular courses', exact: true }))).toEqual(['btech', 'mba', 'bcom', 'bca', 'mbbs', 'bdes'].map((id) => `/colleges?course=${id}`));
  expect(await hrefs(page.getByRole('navigation', { name: 'Tools for your college journey', exact: true }))).toEqual(['/compare', '/eligibility', '/scholarships', '/career-guidance']);
  const stats = page.locator(sections.stats).getByRole('list').getByRole('link');
  await expect(stats).toHaveCount(5);
  await expect(stats.first()).toHaveAccessibleName('16 courses — browse courses');
  expect(await hrefs(page.locator(sections.stats).getByRole('list'))).toEqual(['/courses', '/colleges', '/colleges', '/exams', '/locations']);
  await page.getByRole('navigation', { name: 'Tools for your college journey', exact: true }).getByRole('link', { name: /Check eligibility/ }).click();
  await expect(page).toHaveURL(/\/eligibility$/);
  await expect(page.locator('#course-eligibility')).toHaveAttribute('data-step', 'stage');
  await open(page, '/');
  await page.getByRole('navigation', { name: 'Explore by field', exact: true }).getByRole('link', { name: 'Medical' }).click();
  await expect(page).toHaveURL(/\/courses\?field=Medical$/);
  await expect(page.getByRole('group', { name: 'Filter by field' }).getByRole('button', { name: /^Medical\s*\d+$/ })).toHaveAttribute('aria-pressed', 'true');
});

test('stream, exam and compare bands are built from the catalogue and link onwards', async ({ page }) => {
  const streams = page.locator(sections.streams);
  await expect(streams.getByRole('link', { name: 'All 12 fields' })).toHaveAttribute('href', '/courses');
  await expect(streams.getByRole('heading', { level: 3 }).first()).toHaveText('Engineering');
  await expect(streams.getByRole('list', { name: 'Engineering courses' }).getByRole('link')).toHaveText(['B.Tech', 'M.Tech']);
  const exams = page.locator(sections.exams);
  await expect(exams.getByRole('heading', { level: 3 })).toHaveText(['JEE Main', 'NEET UG', 'CUET UG', 'CAT']);
  await expect(exams.getByRole('link', { name: 'Exam guide', exact: true }).first()).toHaveAttribute('href', '/exams#jee');
  await expect(exams.getByRole('link', { name: /Official site/ }).first()).toHaveAttribute('target', '_blank');
  const promo = page.locator(sections.comparePromo).getByRole('list', { name: 'Start a comparison for' });
  expect(await hrefs(promo)).toEqual(['btech', 'mba', 'bcom', 'bca', 'bdes', 'llb'].map((id) => `/compare?course=${id}`));
  await exams.getByRole('link', { name: 'Exam guide', exact: true }).last().click();
  await expect(page).toHaveURL(/\/exams#cat$/);
  await expect(page.locator('article#cat')).toBeInViewport();
});

test('a popular course chosen on the first screen carries into colleges and location discovery', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Popular courses', exact: true }).getByRole('link', { name: 'B.Des', exact: true }).click();
  await expect(page).toHaveURL(/\/colleges\?course=bdes$/);
  await expect(courseStrip(page).getByRole('button', { name: 'B.Des', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await open(page, '/');
  await expect(page.locator('#destination-course')).toHaveValue('bdes');
  const karnataka = page.locator('#study-destinations').getByRole('link', { name: /^Explore B\.Des colleges in Karnataka — 1 sample programme$/ });
  await karnataka.click();
  await expect(page).toHaveURL(/\/colleges\?/);
  expect(params(page)).toEqual({ location: 'Karnataka', course: 'bdes' });
  await expect(page.getByRole('heading', { level: 2, name: 'B.Des colleges in Karnataka' })).toBeVisible();
});

test('the course-wise college preview adds picks to compare and opens the comparison', async ({ page }) => {
  const section = explorer(page);
  await section.scrollIntoViewIfNeeded();
  const tab = (name) => section.getByRole('tab', { name, exact: true });
  await expect(tab('B.Tech')).toHaveAttribute('aria-selected', 'true');
  await expect(section.locator('tbody tr')).toHaveCount(5);
  await tab('B.Tech').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab('MBA')).toBeFocused();
  await expect(section.locator('tbody tr')).toHaveCount(2);
  await expect(page).toHaveURL(/\?course=mba$/);
  await page.keyboard.press('Home');
  await expect(tab('B.Tech')).toHaveAttribute('aria-selected', 'true');
  await section.getByLabel('Maximum annual tuition').selectOption('100000');
  await expect(section.getByRole('heading', { name: 'No sample colleges match these filters' })).toBeVisible();
  await section.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(section.locator('tbody tr')).toHaveCount(5);
  await section.getByRole('checkbox', { name: 'Compare Northfield Institute of Technology', exact: true }).check();
  await section.getByRole('checkbox', { name: 'Compare Central Institute of Technology', exact: true }).check();
  await expect(section.getByRole('status')).toHaveText('Central added to your B.Tech comparison.');
  await expect(section).toContainText('2 of 3 B.Tech colleges selected');
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('nsedu:compare')))).toEqual({ btech: ['northfield-tech-btech', 'central-tech-btech'] });
  await section.getByRole('link', { name: 'Compare colleges', exact: true }).click();
  await expect(page).toHaveURL(/\/compare\?course=btech/);
  await expect(page.getByRole('heading', { level: 3, name: 'Northfield Institute of Technology' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Central Institute of Technology' })).toBeVisible();
});

test('study destinations link to colleges and the full directory filters every place', async ({ page }) => {
  const destinations = page.locator('#study-destinations');
  await expect(destinations.getByRole('list', { name: 'Study destinations by city' }).getByRole('link')).toHaveCount(6);
  await expect(destinations.getByRole('list', { name: 'Study destinations by state' }).getByRole('link')).toHaveCount(6);
  await destinations.locator('#destination-course').selectOption('mba');
  await destinations.getByRole('link', { name: /^Explore MBA colleges in Pune — 1 sample programme$/ }).click();
  await expect(page).toHaveURL(/\/colleges\?/);
  expect(params(page)).toEqual({ location: 'Pune', course: 'mba' });
  await expect(page.getByRole('heading', { level: 2, name: 'MBA colleges in Pune' })).toBeVisible();
  await open(page, '/');
  await page.locator('#study-destinations').getByRole('link', { name: 'View all states' }).click();
  await expect(page).toHaveURL(/\/locations#states$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Where do you want to study?');
  const directory = page.locator('#all-destinations');
  await directory.getByRole('searchbox', { name: 'Search cities and states' }).fill('zzzz');
  await expect(directory.getByRole('heading', { name: 'No destinations match' })).toBeVisible();
  await directory.getByRole('searchbox', { name: 'Search cities and states' }).fill('Rajasthan');
  await expect(directory.getByRole('status')).toContainText('1 place');
  await directory.getByRole('link', { name: /Rajasthan/ }).click();
  await expect(page).toHaveURL(/\/colleges\?location=Rajasthan&course=mba$/);
  await expect(page.getByRole('heading', { level: 3, name: 'No listed colleges in Rajasthan yet' })).toBeVisible();
});

test('reduced motion disables the decorative reveal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.getByRole('img', { name: heroAlt }).evaluate((image) => window.getComputedStyle(image.parentElement).animationName)).toBe('none');
});

test('keyboard users can skip the header and reach the main content', async ({ page }) => {
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS('clip-path', 'none');
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});
