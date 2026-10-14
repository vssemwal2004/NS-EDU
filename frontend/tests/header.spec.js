import { test, expect as baseExpect } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000 });

// Waits for hydration: the header swaps its skeleton for "Log in" once the (mocked, signed-out) session check has run.
const open = async (page, path) => { await page.goto(path); await expect(page.getByRole('banner').getByRole('button', { name: 'Log in', exact: true })).toBeVisible(); };

const mainNav = (page) => page.getByRole('navigation', { name: 'Main navigation', exact: true });
const group = (page, name) => mainNav(page).locator(`[data-group="${name}"]`);
const searchTrigger = (page) => page.getByRole('banner').locator('[aria-controls="header-search"]');
const fitsWidth = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const drawer = (page) => page.getByRole('dialog', { name: 'NSEDU', exact: true });
// Parks the pointer on the utility bar, outside every mega-menu item, so hover-intent menus close.
const parkPointer = (page) => page.mouse.move(8, 6);
const signUpControls = /create account|sign ?up|register/i;

test.beforeEach(async ({ page }) => {
  page.browserErrors = [];
  page.on('pageerror', (error) => page.browserErrors.push(error.message));
  // Signed-out visitor; no real student session is ever created.
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: { error: 'Sign in to continue.' } }));
  await page.route('**/api/education-news', (route) => route.fulfill({ json: { status: 'ready', articles: [], sources: [], updatedAt: '2026-10-07T12:00:00Z' } }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, '/');
});
test.afterEach(async ({ page }) => { expect(page.browserErrors).toEqual([]); });

test('header links route to their pages and mark only the active one', async ({ page }) => {
  const nav = mainNav(page);
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
  await expect(nav.locator('[data-active="true"]')).toHaveCount(0);
  for (const [name, path, heading] of [['Compare', '/compare', 'Compare colleges side by side'], ['Scholarships', '/scholarships', 'Scholarships & funding'], ['Career guidance', '/career-guidance', 'Find your direction']]) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.locator('[data-active="true"]')).toHaveCount(0);
  }
  for (const [path, active] of [['/colleges', 'Colleges'], ['/locations', 'Colleges'], ['/courses/btech', 'Courses'], ['/exams/jee', 'Exams'], ['/budget', 'Resources'], ['/news', 'Resources']]) {
    await open(page, path);
    await expect(group(page, active)).toHaveAttribute('data-active', 'true');
    await expect(nav.locator('[data-active="true"]')).toHaveCount(1);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
  }
  await page.getByRole('banner').getByRole('link', { name: 'NSEDU home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
  await expect(nav.locator('[data-active="true"]')).toHaveCount(0);
});

test('mega menus open on click and hover, close on Escape and route from their links', async ({ page }) => {
  const courses = group(page, 'Courses');
  const coursesPanel = page.locator('#menu-courses');
  await expect(coursesPanel).toBeHidden();
  await courses.click();
  await expect(courses).toHaveAttribute('aria-expanded', 'true');
  await expect(coursesPanel).toBeVisible();
  await expect(coursesPanel.getByRole('link', { name: /^Engineering/ })).toHaveAttribute('href', '/courses?field=Engineering');
  await expect(coursesPanel.getByRole('link', { name: /^MBA/ })).toHaveAttribute('href', '/courses/mba');
  await page.keyboard.press('Escape');
  await expect(courses).toHaveAttribute('aria-expanded', 'false');
  await expect(coursesPanel).toBeHidden();
  await expect(courses).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(coursesPanel).toBeVisible();
  await courses.click();
  await expect(coursesPanel).toBeHidden();

  const exams = group(page, 'Exams');
  await exams.hover();
  await expect(exams).toHaveAttribute('aria-expanded', 'true');
  const examsPanel = page.locator('#menu-exams');
  await expect(examsPanel.getByRole('link', { name: 'JEE Main', exact: true })).toHaveAttribute('href', '/exams/jee');
  await expect(examsPanel.getByRole('link', { name: /Official site for JEE Main/ })).toHaveAttribute('href', 'https://jeemain.nta.nic.in/');
  await parkPointer(page);
  await expect(examsPanel).toBeHidden();
  await expect(exams).toHaveAttribute('aria-expanded', 'false');

  // Opening one menu closes another; an outside press closes it.
  await group(page, 'Resources').click();
  await expect(page.locator('#menu-resources')).toBeVisible();
  await group(page, 'Colleges').click();
  await expect(page.locator('#menu-resources')).toBeHidden();
  const colleges = page.locator('#menu-colleges');
  await expect(colleges).toBeVisible();
  const streams = colleges.getByRole('tablist');
  await expect(streams.getByRole('tab', { selected: true })).toContainText('Engineering');
  await streams.getByRole('tab', { selected: true }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(streams.getByRole('tab', { selected: true })).toContainText('Management');
  await expect(colleges.getByRole('tabpanel')).toContainText('Management colleges');
  await expect(colleges.getByRole('link', { name: /^MBA colleges/ })).toHaveAttribute('href', '/colleges?course=mba');
  await page.mouse.click(8, 6);
  await expect(colleges).toBeHidden();

  await exams.click();
  await examsPanel.getByRole('link', { name: /^All exam guides/ }).click();
  await expect(page).toHaveURL(/\/exams$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrance exam guides');
  await expect(exams).toHaveAttribute('data-active', 'true');
  await expect(examsPanel).toBeHidden();
  await parkPointer(page);

  await group(page, 'Resources').click();
  await page.locator('#menu-resources').getByRole('link', { name: /^Admission checklist/ }).click();
  await expect(page).toHaveURL(/\/admission-checklist$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Before you apply');
  await expect(group(page, 'Resources')).toHaveAttribute('data-active', 'true');
  await expect(exams).toHaveAttribute('data-active', 'false');
});

test('header search shows live results, supports the keyboard and Enter opens the full search page', async ({ page }) => {
  const trigger = searchTrigger(page);
  await expect(trigger).toHaveAccessibleName('Search');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const panel = page.getByRole('dialog', { name: 'Search NSEDU' });
  const input = panel.getByRole('combobox', { name: 'Search colleges, courses, exams and cities' });
  await expect(input).toBeFocused();
  await expect(panel.getByRole('link', { name: /^B\.Tech/ }).first()).toHaveAttribute('href', '/colleges?course=btech');
  await input.fill('Pune');
  const suggestions = panel.getByRole('listbox', { name: 'Search suggestions' });
  await expect(suggestions.getByRole('option', { name: /Meadow/ })).toHaveCount(3);
  await expect(suggestions.getByRole('option', { name: /Meadow School of Management/ })).toHaveAttribute('href', '/colleges?course=mba&location=Pune');
  await expect(suggestions.getByRole('option', { name: /^B\.Tech colleges in Pune/ })).toHaveAttribute('href', '/colleges?course=btech&location=Pune');
  await input.fill('zzzz');
  await expect(panel).toContainText('No matches for “zzzz”.');
  await input.fill('MBA');
  await expect(suggestions.getByRole('option', { name: /^MBA\s*Master of Business Administration/ })).toHaveAttribute('href', '/colleges?course=mba');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=MBA$/);
  await expect(panel).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Results for “MBA”');
  await expect(page.locator('main').getByRole('heading', { level: 2, name: /^MBA/ })).toBeVisible();

  // "/" opens the panel; arrow keys move through the options and Enter opens the highlighted one.
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('/');
  await expect(panel).toBeVisible();
  await expect(input).toBeFocused();
  await expect(panel.getByRole('link', { name: 'MBA', exact: true })).toHaveAttribute('href', '/search?q=MBA');
  await input.fill('MBA');
  const first = suggestions.getByRole('option').first();
  await expect(first).toHaveAttribute('href', '/colleges?course=mba&location=Pune');
  await input.press('ArrowDown');
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await expect(input).toHaveAttribute('aria-activedescendant', await first.getAttribute('id'));
  await input.press('ArrowUp');
  await expect(suggestions.getByRole('option').last()).toHaveAttribute('aria-selected', 'true');
  await input.press('Home');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/colleges\?course=mba&location=Pune$/);
  await expect(panel).toBeHidden();
  await searchTrigger(page).click();
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(searchTrigger(page)).toBeFocused();
});

test('the study preference chip filters with a live count and follows the student across pages', async ({ page }) => {
  const chip = page.locator('[aria-controls="header-preference"]');
  await expect(chip).toHaveAccessibleName('Study preference: Set course & city');
  await chip.click();
  const popover = page.getByRole('dialog', { name: 'Your study preference' });
  await popover.locator('#header-preference-course').selectOption('mba');
  await popover.locator('#header-preference-city').selectOption('Pune');
  await expect(popover.locator('p[aria-live="polite"]')).toContainText('1 MBA programme in Pune');
  await expect(chip).toHaveAccessibleName('Study preference: MBA · Pune');
  await popover.getByRole('link', { name: 'Show colleges' }).click();
  await expect(page).toHaveURL(/\/colleges\?course=mba&location=Pune$/);
  await expect(page.getByRole('heading', { level: 2, name: 'MBA colleges in Pune' })).toBeVisible();
  await page.reload();
  await expect(chip).toHaveAccessibleName('Study preference: MBA · Pune');
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('nsedu:preferences')))).toEqual({ course: 'mba', city: 'Pune' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(drawer(page).locator('#drawer-preference-course')).toHaveValue('mba');
  await expect(drawer(page).locator('#drawer-preference-city')).toHaveValue('Pune');
});

test('mobile drawer offers search, preference, grouped navigation and login, and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(mainNav(page)).toBeHidden();
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  await trigger.click();
  await expect(drawer(page)).toBeVisible();
  await expect(drawer(page).getByRole('button', { name: 'Log in to NSEDU' })).toBeVisible();
  const streams = drawer(page).locator('details').filter({ has: page.locator('summary', { hasText: 'Design' }) });
  await streams.locator('summary').click();
  await streams.getByRole('link', { name: /^B\.Des colleges/ }).click();
  await expect(page).toHaveURL(/\/colleges\?course=bdes$/);
  await expect(drawer(page)).toBeHidden();
  await expect(page.getByRole('group', { name: 'Choose a course' }).getByRole('button', { name: 'B.Des', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await trigger.click();
  const exams = drawer(page).locator('details').filter({ has: page.locator('summary', { hasText: 'Entrance exams' }) });
  await exams.locator('summary').click();
  await exams.getByRole('link', { name: /^JEE Main/ }).click();
  await expect(page).toHaveURL(/\/exams\/jee$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('JEE Main');
  await trigger.click();
  await expect(drawer(page).locator('details').filter({ has: page.locator('summary', { hasText: 'Entrance exams' }) })).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(drawer(page)).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await fitsWidth(page)).toBe(true);
  await trigger.click();
  await drawer(page).getByRole('searchbox', { name: 'Search NSEDU' }).fill('MBA');
  await drawer(page).getByRole('searchbox', { name: 'Search NSEDU' }).press('Enter');
  await expect(page).toHaveURL(/\/search\?q=MBA$/);
  await expect(drawer(page)).toBeHidden();
  await trigger.click();
  const tools = drawer(page).locator('details').filter({ has: page.locator('summary', { hasText: 'Student tools' }) });
  await tools.locator('summary').click();
  await tools.getByRole('link', { name: 'Compare colleges', exact: true }).click();
  await expect(page).toHaveURL(/\/compare$/);
  await trigger.click();
  await expect(drawer(page).getByRole('link', { name: 'Compare colleges', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('accounts start from Log in; there is no Create account or sign-up control anywhere', async ({ page }) => {
  const banner = page.getByRole('banner');
  await expect(banner.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.getByText(/create account/i)).toHaveCount(0);
  for (const role of ['button', 'link', 'menuitem', 'tab']) await expect(page.getByRole(role, { name: signUpControls })).toHaveCount(0);
  await banner.getByRole('button', { name: 'Log in', exact: true }).click();
  const login = page.getByRole('dialog', { name: 'Log in to your student space' });
  await expect(login).toBeVisible();
  await expect(login).not.toContainText(/create account/i);
  for (const role of ['button', 'link', 'radio']) await expect(login.getByRole(role, { name: signUpControls })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await open(page, '/account');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your student space');
  await expect(page.getByText(/create account/i)).toHaveCount(0);
  for (const role of ['button', 'link']) await expect(page.getByRole(role, { name: signUpControls })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(drawer(page).getByRole('button', { name: 'Log in to NSEDU' })).toBeVisible();
  for (const role of ['button', 'link']) await expect(drawer(page).getByRole(role, { name: signUpControls })).toHaveCount(0);
});

test('icon-only header controls keep an accessible name at narrower widths', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(searchTrigger(page)).toHaveAccessibleName('Search');
  await page.setViewportSize({ width: 340, height: 800 });
  await expect(page.getByRole('banner').getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  expect(await fitsWidth(page)).toBe(true);
});
