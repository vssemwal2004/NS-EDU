import { test, expect as baseExpect } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000 });

// Waits for hydration: the header swaps its skeleton for "Log in" once the (mocked, signed-out) session check has run.
const open = async (page, path) => { await page.goto(path); await expect(page.getByRole('banner').getByRole('button', { name: 'Log in', exact: true })).toBeVisible(); };

const slots = (page) => page.locator('#compare-slots');
const slotNames = (page) => slots(page).getByRole('heading', { level: 3 });
const stored = (page) => page.evaluate(() => JSON.parse(window.localStorage.getItem('nsedu:compare')));
const shared = '/compare?course=btech&c=northfield-tech-btech,central-tech-btech';

test.beforeEach(async ({ page }) => {
  page.browserErrors = [];
  page.on('pageerror', (error) => page.browserErrors.push(error.message));
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: { error: 'Sign in to continue.' } }));
  await page.setViewportSize({ width: 1440, height: 900 });
});
test.afterEach(async ({ page }) => { expect(page.browserErrors).toEqual([]); });

test('a first visit starts an empty comparison with quick-add choices and suggestions', async ({ page }) => {
  await open(page, '/compare');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compare colleges side by side');
  await expect(page.locator('#compare-course')).toHaveValue('btech');
  await expect(page.getByRole('heading', { level: 2, name: 'Start a B.Tech comparison' })).toBeVisible();
  await expect(slots(page)).toContainText('0 of 3 slots used');
  await page.getByRole('button', { name: /^Meadow/ }).click();
  await expect(slotNames(page)).toHaveText(['Meadow Engineering College']);
  await expect(page).toHaveURL(/\/compare\?course=btech&c=meadow-engineering-btech$/);
  await expect(page.getByText('Add one more college to compare.', { exact: false })).toBeVisible();
  const suggestions = page.getByRole('region', { name: 'Suggested comparisons' });
  await expect(suggestions.getByRole('listitem').first()).toBeVisible();
  await suggestions.getByRole('link', { name: /MBA/ }).first().click();
  await expect(page).toHaveURL(/\/compare\?course=mba&c=meadow-management-mba,riverside-university-mba#comparison$/);
  await expect(slotNames(page)).toHaveText(['Meadow School of Management', 'Riverside University']);
});

test('a shared link shows its selection, and colleges can be added, removed and highlighted', async ({ page }) => {
  await open(page, shared);
  await expect(slotNames(page)).toHaveText(['Northfield Institute of Technology', 'Central Institute of Technology']);
  await expect(slots(page)).toContainText('2 of 3 slots used');
  await expect.poll(() => stored(page)).toEqual({ btech: ['northfield-tech-btech', 'central-tech-btech'] });
  const table = page.getByRole('region', { name: 'B.Tech comparison table' });
  await expect(table).toContainText('₹2,40,000');
  await expect(table).toContainText('₹2,10,000');
  await expect(table.locator('[data-best]').filter({ hasText: 'Lowest' })).toContainText('₹2,10,000');
  await expect(table.locator('[data-best]').filter({ hasText: 'Highest' }).first()).toContainText('4.4 / 5');

  const highlight = page.getByRole('button', { name: 'Highlight differences' });
  await expect(highlight).toHaveAttribute('aria-pressed', 'false');
  await highlight.click();
  await expect(highlight).toHaveAttribute('aria-pressed', 'true');
  await expect(table.locator('table')).toHaveAttribute('data-highlight', 'true');
  await expect(table.locator('tr[data-diff="same"]').first()).toContainText('Same for all');
  await expect(table.locator('tr[data-diff="differs"]').first()).toBeVisible();

  const combo = page.getByRole('combobox', { name: 'Add a B.Tech college (slot 3 of 3)' });
  await combo.fill('hill');
  await expect(page.getByRole('listbox', { name: 'B.Tech colleges' }).getByRole('option')).toHaveCount(1);
  await combo.fill('zzzz');
  await expect(page.getByRole('status').filter({ hasText: 'No B.Tech colleges match “zzzz”' })).toBeVisible();
  await combo.fill('hill');
  await combo.press('Enter');
  await expect(slotNames(page)).toHaveText(['Northfield Institute of Technology', 'Central Institute of Technology', 'Hillside Engineering Institute']);
  await expect(page).toHaveURL(/\/compare\?course=btech&c=northfield-tech-btech,central-tech-btech,hillside-engineering-btech$/);
  await expect(page.getByRole('combobox', { name: /^Add a B\.Tech college/ })).toHaveCount(0);
  await expect(highlight).toBeFocused();

  await slots(page).getByRole('button', { name: 'Remove Central Institute of Technology from comparison' }).click();
  await expect(slotNames(page)).toHaveText(['Northfield Institute of Technology', 'Hillside Engineering Institute']);
  await expect(page).toHaveURL(/\/compare\?course=btech&c=northfield-tech-btech,hillside-engineering-btech$/);
  expect(await stored(page)).toEqual({ btech: ['northfield-tech-btech', 'hillside-engineering-btech'] });
  await expect(page.getByRole('combobox', { name: 'Add a B.Tech college (slot 3 of 3)' })).toBeFocused();
  await page.reload();
  await expect(slotNames(page)).toHaveText(['Northfield Institute of Technology', 'Hillside Engineering Institute']);
});

test('copy link shares the current selection and each course keeps its own picks', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
  await open(page, shared);
  await expect(slotNames(page)).toHaveCount(2);
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText('Link copied')).toBeVisible();
  expect(await page.evaluate(() => window.navigator.clipboard.readText())).toBe(`${baseURL}${shared}`);

  await page.locator('#compare-course').selectOption('mba');
  await expect(page).toHaveURL(/\/compare\?course=mba$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Start a MBA comparison' })).toBeVisible();
  await page.getByRole('button', { name: /^Riverside/ }).click();
  await expect(slotNames(page)).toHaveText(['Riverside University']);
  expect(await stored(page)).toEqual({ btech: ['northfield-tech-btech', 'central-tech-btech'], mba: ['riverside-university-mba'] });
  await page.locator('#compare-course').selectOption('btech');
  await expect(slotNames(page)).toHaveText(['Northfield Institute of Technology', 'Central Institute of Technology']);
  await expect(page).toHaveURL(/\/compare\?course=btech&c=northfield-tech-btech,central-tech-btech$/);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Start a B.Tech comparison' })).toBeVisible();
  expect(await stored(page)).toEqual({ mba: ['riverside-university-mba'] });

  await page.locator('#compare-course').selectOption('mbbs');
  await expect(page.getByRole('heading', { level: 2, name: 'Only one MBBS college is listed right now' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View college' })).toHaveAttribute('href', '/colleges/central-health');
});

test('links with unknown programmes report what was dropped', async ({ page }) => {
  await open(page, '/compare?course=btech&c=northfield-tech-btech,not-a-programme,central-tech-btech');
  await expect(slotNames(page)).toHaveText(['Northfield Institute of Technology', 'Central Institute of Technology']);
  await expect(page.getByText('1 college in this link is no longer listed for B.Tech.')).toBeVisible();
});

test('the comparison fits a phone screen without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, shared);
  await expect(slotNames(page)).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'B.Tech comparison table' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
