import { test, expect } from '@playwright/test';

const explorer = (page) => page.locator('#course-colleges');
const rows = (page) => explorer(page).locator('tbody tr');
const northfield = 'Northfield Institute of Technology';
const central = 'Central Institute of Technology';

test.beforeEach(async ({ page }) => {
  page.browserErrors = [];
  page.on('pageerror', (error) => page.browserErrors.push(error.message));
  await page.goto('/');
  await explorer(page).scrollIntoViewIfNeeded();
});
test.afterEach(async ({ page }) => { expect(page.browserErrors).toEqual([]); });

test('approved preview has five course-specific rows and honest data labels', async ({ page }) => {
  const section = explorer(page);
  await expect(rows(page)).toHaveCount(5);
  await expect(rows(page).first()).toContainText('₹2,40,000');
  await expect(rows(page).first()).toContainText('₹8.4 LPA');
  await expect(section).toContainText('Static demo data');
  await expect(section).toContainText('Not a ranking');
  await expect(section).toContainText('2026–27');
  await expect(section).toContainText('2024–25');
  await expect(section.getByRole('checkbox', { checked: true })).toHaveCount(2);
  await expect(section).toContainText('Northfield · Central');
});

test('courses share context with destinations and use different programme records', async ({ page }) => {
  const section = explorer(page);
  await section.getByRole('tab', { name: 'MBA', exact: true }).click();
  await expect(page.locator('#destination-course')).toHaveValue('mba');
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first()).toContainText('Meadow School of Management');
  await expect(rows(page).first()).toContainText('₹2,60,000');
  await expect(section.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await section.getByRole('tab', { name: 'MBBS', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('Not provided');
  await expect(rows(page)).not.toContainText('LPA');
  await section.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('dialog', { name: 'Explore more courses' }).getByRole('button', { name: 'BA', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(rows(page)).toContainText('Riverside College of Arts and Commerce');
  await expect(rows(page)).toContainText('₹70,000');
  await page.locator('#destination-course').selectOption('bca');
  await expect(rows(page)).toHaveCount(3);
  await expect(section.getByRole('tab', { name: 'BCA', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('keyboard tabs, intersection filters, sorting and empty recovery work', async ({ page }) => {
  const section = explorer(page);
  await section.getByRole('tab', { name: 'B.Tech', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(section.getByRole('tab', { name: 'MBA', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(section.getByRole('tab', { name: 'B.Tech', exact: true })).toBeFocused();
  await section.getByLabel('Sort colleges').selectOption('fee-asc');
  await expect(rows(page).first()).toContainText('Riverside University');
  await section.getByLabel('Sort colleges').selectOption('salary');
  await expect(rows(page).first()).toContainText(northfield);
  await section.getByLabel('Sort colleges').selectOption('rating');
  await expect(rows(page).first()).toContainText(central);
  await section.getByLabel('Maximum annual tuition').selectOption('200000');
  await expect(rows(page)).toHaveCount(2);
  await section.getByLabel('College location').selectOption('Maharashtra');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('Meadow Engineering College');
  await section.getByLabel('Maximum annual tuition').selectOption('100000');
  await expect(section.getByRole('heading', { name: 'No sample colleges match these filters' })).toBeVisible();
  await section.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(rows(page)).toHaveCount(5);
  await expect(section.getByRole('tab', { name: 'B.Tech', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('saving is retained across courses and comparison enforces three same-course choices', async ({ page }) => {
  const section = explorer(page);
  await section.getByRole('button', { name: `Save ${northfield}`, exact: true }).click();
  await expect(section.getByRole('status')).toContainText('saved for this visit');
  await section.getByRole('tab', { name: 'BCA', exact: true }).click();
  await expect(section.getByRole('button', { name: `Save ${northfield}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await section.getByRole('tab', { name: 'B.Tech', exact: true }).click();
  await section.getByRole('checkbox', { name: 'Compare Meadow Engineering College', exact: true }).check();
  await section.getByRole('checkbox', { name: 'Compare Riverside University', exact: true }).click();
  await expect(section.getByRole('checkbox', { name: 'Compare Riverside University', exact: true })).not.toBeChecked();
  await expect(section.getByRole('status')).toContainText('up to 3 colleges');
  await section.getByLabel('College location').selectOption('Bengaluru');
  await expect(rows(page)).toHaveCount(1);
  await section.getByRole('button', { name: 'Compare colleges', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Compare selected colleges' });
  await expect(dialog.getByRole('article')).toHaveCount(3);
  await expect(dialog).toContainText('₹2,40,000');
  await expect(dialog).toContainText('₹1,80,000');
  await dialog.getByRole('button', { name: 'Remove Meadow Engineering College from comparison' }).click();
  await expect(dialog.getByRole('article')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(section.getByRole('button', { name: 'Compare colleges', exact: true })).toBeFocused();
  await section.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(section.getByRole('button', { name: 'Compare colleges', exact: true })).toBeDisabled();
});

test('details, application checklist and directory are usable without claiming submissions', async ({ page }) => {
  const section = explorer(page);
  const trigger = rows(page).first().getByRole('button', { name: 'View details', exact: true });
  await trigger.click();
  const details = page.getByRole('dialog', { name: northfield, exact: true });
  await expect(details).toContainText('Annual tuition · 2026–27');
  await details.getByRole('button', { name: 'Application checklist', exact: true }).click();
  const application = page.getByRole('dialog', { name: 'Application checklist', exact: true });
  await expect(application.locator('li')).toHaveCount(4);
  await expect(application).toContainText('Applications cannot be submitted here yet');
  await application.getByRole('button', { name: 'Back to college details' }).click();
  await expect(details).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await section.getByRole('button', { name: 'View all colleges', exact: true }).click();
  const directory = page.getByRole('dialog', { name: 'College directory' });
  await directory.getByRole('textbox', { name: 'Search sample colleges' }).fill('Pune');
  await expect(directory.getByRole('article')).toHaveCount(1);
  await directory.getByRole('textbox', { name: 'Search sample colleges' }).fill('zzzz');
  await expect(directory.getByRole('heading', { name: 'No matching sample colleges' })).toBeVisible();
  await directory.getByRole('button', { name: 'Reset search and filters' }).click();
  await expect(directory.getByRole('article')).toHaveCount(5);
  await directory.getByRole('article').first().getByRole('button', { name: 'View details', exact: true }).click();
  await expect(details).toBeVisible();
});

for (const width of [320, 390, 768, 1024, 1440, 1672, 1920]) {
  test(`section 3 is readable without page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 941 });
    const section = explorer(page);
    await expect(rows(page)).toHaveCount(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const locator of [section.getByLabel('College location'), rows(page).first().getByRole('button', { name: 'View details', exact: true }), rows(page).first().getByRole('button', { name: `Save ${northfield}` })]) {
      const bounds = await locator.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    if (width === 320) {
      await section.getByRole('button', { name: 'Compare colleges', exact: true }).click();
      expect(await page.getByRole('dialog', { name: 'Compare selected colleges' }).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
  });
}

test('campus previews share one compressed image source', async ({ page }) => {
  const images = explorer(page).getByRole('img');
  const sources = await images.locator('image').evaluateAll((elements) => elements.map((element) => element.getAttribute('href')));
  expect(new Set(sources).size).toBe(1);
  const response = await page.request.get(sources[0], { headers: { Accept: 'image/webp' } });
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toBe('image/webp');
  expect((await response.body()).byteLength).toBeLessThan(250_000);
});
