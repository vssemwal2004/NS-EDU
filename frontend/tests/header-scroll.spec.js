import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.browserErrors = [];
  page.on('pageerror', (error) => page.browserErrors.push(error.message));
  await page.goto('/');
});
test.afterEach(async ({ page }) => { expect(page.browserErrors).toEqual([]); });

test('desktop header stays fixed, compacts by section and restores without moving content', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const header = page.getByRole('banner');
  const firstScreen = page.locator('[data-first-screen]');
  await expect(header).toHaveAttribute('data-mode', 'full');
  const originalHeight = (await header.boundingBox()).height;
  const originalStart = await firstScreen.evaluate((node) => node.getBoundingClientRect().y + window.scrollY);
  await page.evaluate(() => window.scrollTo({ top: 150, behavior: 'instant' }));
  await expect(header).toHaveAttribute('data-mode', 'full');
  expect((await header.boundingBox()).y).toBe(0);
  await page.locator('#study-destinations').evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await expect(header).toHaveAttribute('data-mode', 'compact');
  await expect(header).toHaveAttribute('data-section', 'locations');
  await expect(header.getByRole('link', { name: 'Locations', exact: true })).toHaveAttribute('aria-current', 'location');
  await expect.poll(async () => (await header.boundingBox()).height).toBeLessThan(originalHeight);
  await header.getByRole('link', { name: 'Course-wise colleges', exact: true }).click();
  await expect(header).toHaveAttribute('data-section', 'colleges');
  await expect(header.getByRole('link', { name: 'Course-wise colleges', exact: true })).toHaveAttribute('aria-current', 'location');
  await expect.poll(async () => {
    const title = await page.getByRole('heading', { name: 'Course-wise colleges in India', exact: true }).boundingBox();
    return title.y >= (await header.boundingBox()).height;
  }).toBe(true);
  expect(await firstScreen.evaluate((node) => node.getBoundingClientRect().y + window.scrollY)).toBeCloseTo(originalStart, 1);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(header).toHaveAttribute('data-mode', 'full');
  await expect.poll(async () => (await header.boundingBox()).height).toBeCloseTo(originalHeight, 1);
  const bounds = await firstScreen.boundingBox();
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(901);
});

test('compact desktop search, city selection, menus and account dialogs remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const header = page.getByRole('banner');
  await page.locator('#course-colleges').evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await expect(header).toHaveAttribute('data-mode', 'compact');
  await header.locator('#header-city').selectOption('Pune');
  await header.getByRole('textbox', { name: 'Search NSEDU', exact: true }).fill('MBA');
  await header.getByRole('button', { name: 'Search NSEDU', exact: true }).click();
  const browse = page.getByRole('dialog', { name: 'Explore NSEDU' });
  await expect(browse).toContainText('Your preferred city: Pune');
  await page.keyboard.press('Escape');
  const nav = header.getByRole('navigation', { name: 'Main navigation', exact: true });
  await nav.locator('summary').filter({ hasText: /^Resources/ }).click();
  const resource = nav.getByRole('button', { name: 'Admission checklist', exact: true });
  const bounds = await resource.boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(1280);
  await resource.click();
  await expect(page.getByRole('dialog', { name: 'Before you apply' })).toBeVisible();
  await page.keyboard.press('Escape');
  await header.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Your next chapter starts here' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(header.getByRole('button', { name: 'Create account', exact: true })).toBeFocused();
});

for (const [width, height] of [[320, 900], [390, 900], [768, 900], [1101, 600], [1920, 900]]) {
  test(`scroll header and controls fit at ${width}×${height} with reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const header = page.getByRole('banner');
    await page.locator('#course-colleges').evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expect(header).toHaveAttribute('data-section', 'colleges');
    expect((await header.boundingBox()).y).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width <= 1100) {
      await expect.poll(async () => (await header.boundingBox()).height).toBeLessThanOrEqual(65);
      const trigger = header.getByRole('button', { name: 'Open navigation' });
      await trigger.click();
      const drawer = page.getByRole('dialog', { name: 'NSEDU', exact: true });
      await expect(drawer).toBeVisible();
      await drawer.locator('#mobile-city').selectOption('Chennai');
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
    } else {
      const controls = header.locator('summary, .button, input, select, nav a');
      for (const control of await controls.all()) {
        if (!await control.isVisible()) continue;
        const bounds = await control.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual((await header.boundingBox()).height + 1);
      }
    }
  });
}
