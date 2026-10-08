import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const results = [];
const isBudgetImage = (url) => decodeURIComponent(url).includes('/images/budget/desk.webp');
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const images = [];
    const errors = [];
    const reads = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', (response) => {
      if (isBudgetImage(response.url())) reads.push(response.body().then((body) => images.push({ url: response.url(), status: response.status(), bytes: body.byteLength, type: response.headers()['content-type'] })));
    });
    await page.goto('http://127.0.0.1:3001/', { waitUntil: 'networkidle' });
    const beforeScroll = await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => decodeURIComponent(entry.name).includes('/images/budget/desk.webp')).length);
    const section = page.locator('#college-budget');
    await section.evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await section.locator('img').evaluate((img) => img.decode());
    await section.getByLabel('Your first-year budget').fill('300000');
    await section.locator('[data-budget-state="over"]').waitFor();
    await Promise.all(reads);
    results.push({ viewport, requestsBeforeScroll: beforeScroll, imageResponses: images, errors, resultAfterEdit: await section.locator('[data-budget-total]').textContent(), note: 'Local production build, fresh browser context; verifies loading behavior, not a public-network speed guarantee.' });
    await context.close();
  }
  await writeFile(fileURLToPath(new URL('./loading-audit.json', import.meta.url)), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
