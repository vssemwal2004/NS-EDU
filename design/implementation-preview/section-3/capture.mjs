import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', timeout: 120000 });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  const measurements = [];
  for (const [name, width, height] of [['desktop', 1672, 941], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    const section = page.locator('#course-colleges');
    await section.screenshot({ path: path.join(folder, `${name}.png`) });
    measurements.push({ name, width, height, section: await section.boundingBox(), rowHeights: await section.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height)), horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
    process.stdout.write(`Saved ${name} section preview.\n`);
  }
  for (const width of [320, 1101, 1250, 1366]) {
    await page.setViewportSize({ width, height: 941 });
    const section = page.locator('#course-colleges');
    measurements.push({ name: 'additional-width-check', width, height: 941, section: await section.boundingBox(), rowHeights: await section.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height)), horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), controlsFit: await section.locator('tbody button, tbody label').evaluateAll((elements) => elements.every((element) => { const rect = element.getBoundingClientRect(); const row = element.closest('tr').getBoundingClientRect(); return rect.x >= row.x && rect.right <= row.right + 1; })) });
  }
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.locator('#course-colleges').getByRole('button', { name: 'Compare colleges', exact: true }).click();
  await page.getByRole('dialog', { name: 'Compare selected colleges' }).screenshot({ path: path.join(folder, 'compare.png') });
  const source = await page.locator('#course-colleges').getByRole('img').first().locator('image').getAttribute('href');
  const response = await page.request.get(new URL(source, page.url()).href, { headers: { Accept: 'image/webp' } });
  const artwork = { contentType: response.headers()['content-type'], bytes: (await response.body()).byteLength };
  await writeFile(path.join(folder, 'measurements.json'), `${JSON.stringify({ measurements, artwork, errors }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ measurements, artwork, errors })}\n`);
} finally { await browser.close(); }
