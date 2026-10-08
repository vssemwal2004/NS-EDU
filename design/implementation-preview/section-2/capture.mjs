import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Capture the actual running UI; no mockup or image editing is involved.
const folder = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', timeout: 120000 });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(folder, 'first-screen-desktop.png') });
  await page.screenshot({ path: path.join(folder, 'page-desktop.png'), fullPage: true });
  const measurements = [];
  for (const [name, width, height] of [['desktop', 1672, 941], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    const section = page.locator('#study-destinations');
    await section.screenshot({ path: path.join(folder, `${name}.png`) });
    process.stdout.write(`Saved ${name} section preview.\n`);
    measurements.push({ name, width, height, section: await section.boundingBox(), horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  }
  const source = await page.locator('#study-destinations').getByRole('img', { name: /India Gate/ }).locator('image').getAttribute('href');
  const response = await page.request.get(new URL(source, page.url()).href, { headers: { Accept: 'image/webp' } });
  const artwork = { contentType: response.headers()['content-type'], bytes: (await response.body()).byteLength };
  await writeFile(path.join(folder, 'measurements.json'), `${JSON.stringify({ measurements, artwork }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ measurements, artwork })}\n`);
} finally {
  await browser.close();
}
