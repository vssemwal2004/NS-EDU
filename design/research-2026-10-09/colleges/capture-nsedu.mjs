import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire('D:/CP/NS-EDU/frontend/package.json')('@playwright/test');

const out = 'D:/CP/NS-EDU/design/research-2026-10-09/colleges/';
const base = 'http://127.0.0.1:3001';
const pages = [
  ['nsedu-colleges', '/colleges'],
  ['nsedu-colleges-mba-pune', '/colleges?course=mba&location=Pune'],
  ['nsedu-home-section', '/'],
  ['nsedu-compare', '/compare?course=btech'],
  ['nsedu-profile-probe', '/colleges/northfield-tech'],
];
const sizes = { '1440': { width: 1440, height: 900 }, '1024': { width: 1024, height: 768 }, '390': { width: 390, height: 844 } };
const browser = await chromium.launch({ channel: 'chrome' });
const log = [];
for (const [name, path] of pages) {
  for (const [label, viewport] of Object.entries(sizes)) {
    if (label === '1024' && name !== 'nsedu-colleges') continue;
    const context = await browser.newContext({ viewport, isMobile: label === '390', hasTouch: label === '390' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
    const entry = { name, path, label };
    try {
      const response = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 });
      entry.status = response?.status();
      await page.waitForTimeout(1500);
      if (name === 'nsedu-home-section') {
        await page.locator('#course-colleges').scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
        await page.locator('#course-colleges').screenshot({ path: `${out}${name}-${label}.png` });
      } else {
        await page.screenshot({ path: `${out}${name}-${label}.png` });
        await page.screenshot({ path: `${out}${name}-${label}-full.png`, fullPage: true });
      }
      entry.overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      entry.h1 = await page.evaluate(() => document.querySelector('h1')?.innerText);
    } catch (error) { entry.error = String(error).slice(0, 200); }
    entry.errors = errors;
    log.push(entry);
    console.log(JSON.stringify(entry));
    await context.close();
  }
}
writeFileSync(`${out}nsedu-capture-log.json`, JSON.stringify(log, null, 2));
await browser.close();
