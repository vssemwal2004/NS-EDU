import { test, expect as baseExpect } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000 });

const results = (page) => page.locator('section[aria-labelledby="uni-results-title"]');
const cards = (page) => results(page).getByRole('article');
const params = (page) => Object.fromEntries(new URL(page.url()).searchParams);

test.beforeEach(async ({ page }) => {
  page.browserErrors = [];
  page.on('pageerror', (error) => page.browserErrors.push(error.message));
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: { error: 'Sign in to continue.' } }));
  await page.setViewportSize({ width: 1440, height: 900 });
});
test.afterEach(async ({ page }) => { expect(page.browserErrors).toEqual([]); });

test('the directory searches and filters on the server, keeping state in the URL', async ({ page }) => {
  await page.goto('/universities');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find your university');
  await expect(page.locator('#uni-results-title')).toHaveText('Universities in India');
  await expect(cards(page).first()).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search universities' }).fill('north beng');
  await expect(page).toHaveURL(/[?&]q=north\+beng/);
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).first().getByRole('heading', { level: 3 })).toContainText('Northfield');

  await page.getByRole('complementary', { name: 'Filters' }).getByLabel('Stream').selectOption('Engineering');
  await expect(page).toHaveURL(/stream=Engineering/);
  await expect(cards(page)).toHaveCount(1);
  expect(params(page)).toEqual({ q: 'north beng', stream: 'Engineering' });
  await results(page).getByRole('button', { name: 'Remove filter: Engineering' }).click();
  await expect(cards(page)).toHaveCount(2);

  await cards(page).first().getByRole('link', { name: /^Apply/ }).click();
  await expect(page).toHaveURL(/\/apply\?university=northfield-/);
});

test('a state filter lists its cities and an unknown search explains itself', async ({ page }) => {
  await page.goto('/universities?state=Maharashtra');
  await expect(page.locator('#uni-results-title')).toHaveText('Universities in Maharashtra');
  await expect(page.getByRole('complementary', { name: 'Filters' }).getByLabel('City')).toBeVisible();
  await page.goto('/universities?q=zzqqxx');
  await expect(results(page).getByRole('heading', { name: 'No universities found' })).toBeVisible();
});

test('profiles without fee data still show facts, contact and an apply rail; unknown slugs 404', async ({ page }) => {
  await page.goto('/universities/riverside-university');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Riverside University');
  await expect(page.locator('#admissions')).toContainText('Admissions & contact');
  const missing = await page.goto('/universities/not-a-real-university');
  expect(missing.status()).toBe(404);
});

for (const width of [390, 768]) {
  test(`the directory fits a ${width}px screen with collapsible filters`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/universities');
    await expect(page.getByRole('complementary', { name: 'Filters' })).toBeHidden();
    await page.locator('summary', { hasText: 'Filters' }).click();
    await expect(page.locator('details').getByLabel('State / UT')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
