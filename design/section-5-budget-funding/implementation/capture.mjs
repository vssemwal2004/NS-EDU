import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const records = [];
async function captureSection(page, section, destination) {
  const original = page.viewportSize();
  const bounds = await section.boundingBox();
  // Chrome can omit painted layers beyond the viewport in an element screenshot.
  // Extend height for the isolated preview, preserving the responsive width.
  await page.setViewportSize({ width: original.width, height: Math.max(original.height, Math.ceil(bounds.height) + 160) });
  const hiddenHeader = await page.addStyleTag({ content: 'header { visibility: hidden !important; }' });
  await section.evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.evaluate(() => new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))));
  await section.screenshot({ path: destination });
  await hiddenHeader.evaluate((node) => node.remove());
  await page.setViewportSize(original);
}
try {
  for (const [name, width, height] of [['desktop', 1672, 941], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
    const output = path.join(folder, name);
    await mkdir(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    const consoleErrors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const section = page.locator('#college-budget');
    await section.evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await section.locator('img').evaluate((img) => img.decode());
    await page.screenshot({ path: path.join(output, '01-default-viewport.png') });
    await captureSection(page, section, path.join(output, '01-default.png'));
    await section.getByText('View detailed costs', { exact: true }).click();
    await captureSection(page, section, path.join(output, '02-detailed-costs.png'));
    await section.getByText('View detailed costs', { exact: true }).click();
    await section.getByLabel('Your first-year budget').fill('300000');
    await captureSection(page, section, path.join(output, '03-over-budget.png'));
    await section.getByLabel('Your first-year budget').fill('400000');
    await section.getByRole('button', { name: 'Find colleges in my budget' }).click();
    await page.screenshot({ path: path.join(output, '04-college-matches.png') });
    await page.getByRole('dialog', { name: 'Colleges in your budget' }).getByRole('button', { name: 'Close dialog' }).click();
    await section.getByRole('button', { name: 'Find scholarships' }).click();
    await page.screenshot({ path: path.join(output, '05-scholarship-resources.png') });
    records.push({ name, width, height, browserErrors: errors, consoleErrors, note: 'Section-only screenshots temporarily hide header and extend viewport height for full paint; width is preserved. Viewport screenshots retain actual size and fixed header.' });
    await page.close();
  }
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:3000/');
  const section = page.locator('#college-budget');
  const measurements = [];
  for (const width of [320, 360, 390, 414, 600, 760, 768, 900, 1100, 1101, 1280, 1440, 1672, 1920]) {
    await page.setViewportSize({ width, height: 941 });
    for (const expanded of [false, true]) {
      await section.locator('details').evaluate((node, value) => { node.open = value; }, expanded);
      measurements.push(await section.evaluate((node, { width, expanded }) => {
        const bounds = node.getBoundingClientRect();
        const outside = [...node.querySelectorAll('input, select, button, h2, h3, dd')].filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
        }).map((el) => el.id || el.textContent.trim().slice(0, 60));
        return { width, expanded, sectionHeight: Math.round(bounds.height * 100) / 100, horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1, outside, artworkLoading: node.querySelector('img').loading };
      }, { width, expanded }));
    }
  }
  await writeFile(path.join(folder, 'measurements.json'), JSON.stringify({ previews: records, widths: measurements, browserErrors: errors }, null, 2));
  console.log(JSON.stringify({ previews: records, measurements: measurements.length, failures: measurements.filter((row) => row.horizontalOverflow || row.outside.length), errors }, null, 2));
  await page.close();
} finally { await browser.close(); }
