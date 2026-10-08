import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  page.browserErrors = [];
  page.on('pageerror', (error) => page.browserErrors.push(error.message));
  await page.goto('/');
});
test.afterEach(async ({ page }) => {
  expect(page.browserErrors).toEqual([]);
});

for (const width of [320, 375, 390, 600, 768, 1024, 1440, 1672, 1920]) {
  test(`landing fits a ${width}px screen and loads its image/fonts`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find a college that fits your future.');
    const photo = page.getByRole('img', { name: 'Three students exploring their next chapter together in a university library' });
    await expect(photo).toBeVisible();
    const source = await photo.locator('image').getAttribute('href');
    const response = await page.request.get(source, { headers: { Accept: 'image/webp' } });
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toBe('image/webp');
    expect((await response.body()).byteLength).toBeLessThan(150_000);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.fonts.check('400 16px "Plus Jakarta Sans"') && document.fonts.check('16px "DM Serif Display"'))).toBe(true);
    if ([390, 768, 1440].includes(width)) {
      const directory = path.resolve('..', 'design', 'implementation-preview');
      await fs.mkdir(directory, { recursive: true });
      await page.screenshot({ path: path.join(directory, `landing-${width}.png`), fullPage: true });
    }
  });
}

test('course and exam search filter real starter content and have an empty state', async ({ page }) => {
  await page.getByRole('tab', { name: 'Courses', exact: true }).click();
  await page.getByLabel('Search courses', { exact: true }).fill('MBA');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Explore NSEDU' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'MBA', exact: true })).toBeVisible();
  await expect(dialog.getByRole('article')).toHaveCount(1);
  await dialog.getByLabel('Filter courses').fill('nonexistent-course');
  await expect(dialog.getByRole('status')).toContainText('No matching options');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('tab', { name: 'Exams', exact: true }).click();
  await page.getByLabel('Search exams', { exact: true }).fill('JEE');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'JEE Main', exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /Visit official exam website/ })).toHaveAttribute('href', 'https://jeemain.nta.nic.in/');
});

test('search tabs work with keyboard navigation', async ({ page }) => {
  const colleges = page.getByRole('tab', { name: 'Colleges', exact: true });
  await colleges.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Courses', exact: true })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Courses', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Exams', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(colleges).toBeFocused();
});

test('desktop dropdowns, preferred city and dialog focus work', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#header-city').selectOption('Pune');
  const nav = page.getByRole('navigation', { name: 'Main navigation', exact: true });
  await nav.locator('summary').filter({ hasText: /^Courses/ }).click();
  await nav.getByRole('button', { name: 'Engineering', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Explore NSEDU' });
  await expect(dialog.getByRole('heading', { name: 'B.Tech', exact: true })).toBeVisible();
  await expect(dialog).toContainText('Your preferred city: Pune');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await nav.locator('summary').filter({ hasText: /^Colleges/ }).click();
  await expect(nav.getByRole('button', { name: 'Explore all colleges' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(nav.getByRole('button', { name: 'Explore all colleges' })).not.toBeVisible();
});

test('mobile navigation has location selection, closes after selection and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: 'NSEDU', exact: true });
  await expect(drawer).toBeVisible();
  await drawer.locator('#mobile-city').selectOption('Bengaluru');
  await drawer.locator('summary').filter({ hasText: /^Courses/ }).click();
  await drawer.getByRole('button', { name: 'Design', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  const browse = page.getByRole('dialog', { name: 'Explore NSEDU' });
  await expect(browse.getByRole('heading', { name: 'B.Des', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('all compact student shortcuts open useful guides', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Tools for your college journey' });
  for (const name of ['Compare colleges', 'Explore scholarships', 'Career guidance']) {
    const trigger = nav.getByRole('button', { name: new RegExp(name) });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('li')).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
  await nav.getByRole('button', { name: /Check eligibility/ }).click();
  await expect(page.locator('#eligibility-question')).toBeFocused();
  await expect(page.locator('#course-eligibility')).toHaveAttribute('data-step', 'stage');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('college and account UI clearly shows what is not connected', async ({ page }) => {
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Explore NSEDU' })).toContainText('preparing the college directory');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Your next chapter starts here' });
  await expect(dialog).toContainText('Student accounts are coming next');
  await dialog.getByRole('button', { name: 'Explore courses' }).click();
  await expect(page.getByRole('dialog', { name: 'Explore NSEDU' }).getByRole('article')).toHaveCount(16);
});

test('reduced motion disables the decorative reveal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.getByRole('img', { name: 'Three students exploring their next chapter together in a university library' }).evaluate((image) => window.getComputedStyle(image.parentElement).animationName)).toBe('none');
});

for (const [width, height] of [[1280, 720], [1366, 600], [1366, 768], [1440, 900], [1672, 941], [1920, 1080]]) {
  test(`desktop ${width}×${height} keeps the intro in one viewport with destinations below`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    const intro = await page.locator('[data-first-screen]').boundingBox();
    expect(intro.y + intro.height).toBeLessThanOrEqual(height + 1);
    const destinations = await page.locator('#study-destinations').boundingBox();
    expect(destinations.y).toBeGreaterThanOrEqual(height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
    for (const navigation of ['Explore by field', 'Popular courses', 'Tools for your college journey']) {
      const buttons = page.getByRole('navigation', { name: navigation }).getByRole('button');
      for (const button of await buttons.all()) {
        const bounds = await button.boundingBox();
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        if (navigation === 'Explore by field') {
          const heroBounds = await page.locator('section[aria-labelledby="hero-title"]').boundingBox();
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(heroBounds.y + heroBounds.height);
        }
      }
    }
    if ([1366, 1672].includes(width) && height !== 600) {
      const directory = path.resolve('..', 'design', 'implementation-preview');
      await fs.mkdir(directory, { recursive: true });
      await page.screenshot({ path: path.join(directory, `landing-${width}x${height}.png`), fullPage: true });
    }
  });
}

test('location actions preserve the course and distinguish city from state preferences', async ({ page }) => {
  const section = page.getByRole('region', { name: 'Explore where you want to study', exact: true });
  await section.locator('#destination-course').selectOption('mba');
  await section.getByRole('button', { name: 'Explore colleges in Pune', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Explore NSEDU' });
  await expect(dialog).toContainText('City: Pune');
  await expect(dialog).toContainText('Course: MBA');
  await dialog.getByRole('button', { name: 'Explore MBA', exact: true }).click();
  await expect(dialog.getByRole('article')).toHaveCount(1);
  await expect(dialog.getByRole('heading', { name: 'MBA', exact: true })).toBeVisible();
  await expect(dialog).toContainText('City: Pune');
  await page.keyboard.press('Escape');
  await expect(section.getByRole('button', { name: 'Explore colleges in Pune', exact: true })).toBeFocused();
  await section.getByRole('button', { name: 'Explore colleges in Karnataka', exact: true }).click();
  await expect(dialog).toContainText('State: Karnataka');
  await expect(dialog).toContainText('Course: MBA');
  await expect(dialog).not.toContainText('Your preferred city: Pune');
  await page.keyboard.press('Escape');
  await expect(section.locator('#destination-course')).toHaveValue('mba');
});

test('a course chosen in the first screen carries into location discovery', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Popular courses', exact: true }).getByRole('button', { name: 'B.Des', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#destination-course')).toHaveValue('bdes');
  await page.getByRole('button', { name: 'Explore colleges in Maharashtra', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Explore NSEDU' })).toContainText('Course: B.Des');
});

test('location directories filter, handle empty searches and support locations beyond preview tiles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'View all states', exact: true }).click();
  const states = page.getByRole('dialog', { name: 'Choose a state' });
  await states.getByRole('searchbox', { name: 'Search states' }).fill('zzzz');
  await expect(states.getByRole('status')).toContainText('No matching locations');
  await states.getByRole('searchbox', { name: 'Search states' }).fill('Rajasthan');
  await states.getByRole('button', { name: 'Rajasthan', exact: true }).click();
  await expect(states).not.toBeVisible();
  const browse = page.getByRole('dialog', { name: 'Explore NSEDU' });
  await expect(browse).toContainText('State: Rajasthan');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'View all states', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'View all locations', exact: true }).click();
  const cities = page.getByRole('dialog', { name: 'Choose a city' });
  await cities.getByRole('searchbox', { name: 'Search cities' }).fill('Ahmedabad');
  await cities.getByRole('button', { name: 'Ahmedabad', exact: true }).click();
  await expect(browse).toContainText('City: Ahmedabad');
});

test('destination artwork uses a shared compressed source and readable controls at narrow widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const section = page.locator('#study-destinations');
  const image = section.getByRole('img', { name: /India Gate/ });
  const source = await image.locator('image').getAttribute('href');
  const response = await page.request.get(source, { headers: { Accept: 'image/webp' } });
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toBe('image/webp');
  expect((await response.body()).byteLength).toBeLessThan(250_000);
  await section.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const label of ['Study destinations by city', 'Study destinations by state']) {
    for (const button of await section.getByRole('navigation', { name: label }).getByRole('button').all()) {
      const bounds = await button.boundingBox();
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    }
  }
});

test('keyboard users can skip the header and reach the main content', async ({ page }) => {
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS('clip-path', 'none');
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});
