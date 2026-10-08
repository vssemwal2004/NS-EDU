import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [section, id] of [['intro', null], ['locations', 'study-destinations'], ['colleges', 'course-colleges']]) {
      await page.evaluate((id) => id ? document.getElementById(id).scrollIntoView({ block: 'start', behavior: 'instant' }) : window.scrollTo({ top: 0, behavior: 'instant' }), id);
      await page.waitForFunction((section) => document.querySelector('header').dataset.section === section, section);
      await page.screenshot({ path: path.join(folder, `${name}-${section}.png`) });
      measurements.push({ name, section, header: await page.getByRole('banner').boundingBox(), horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) });
    }
  }
  await writeFile(path.join(folder, 'measurements.json'), `${JSON.stringify({ measurements, errors }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ measurements, errors })}\n`);
} finally { await browser.close(); }
