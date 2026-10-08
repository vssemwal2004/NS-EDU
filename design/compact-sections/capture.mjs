import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const phase = process.argv[2] || 'after';
const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), phase);
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
const measurements = [];
async function capture(section, filename) {
  const original = page.viewportSize();
  const height = Math.ceil((await section.boundingBox()).height) + 260;
  await page.setViewportSize({ width: original.width, height: Math.max(original.height, height) });
  const style = await page.addStyleTag({ content: 'header { visibility: hidden !important; }' });
  await section.evaluate((node) => node.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await page.evaluate(() => new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))));
  await section.screenshot({ path: path.join(folder, filename) });
  await style.evaluate((node) => node.remove());
  await page.setViewportSize(original);
}
try {
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 360, 390, 600, 640, 768, 900, 901, 1100, 1101, 1280, 1440, 1672, 1920]) {
    await page.setViewportSize({ width, height: 941 });
    for (const id of ['course-eligibility', 'college-budget']) {
      const section = page.locator(`#${id}`);
      await section.evaluate((node) => node.scrollIntoView({ behavior: 'instant', block: 'start' }));
      await page.waitForFunction((id) => [...document.getElementById(id).querySelectorAll('img')].every((img) => img.complete && img.naturalWidth > 0), id);
      measurements.push(await section.evaluate((node, width) => {
        const rect = node.getBoundingClientRect();
        const controls = [...node.querySelectorAll('button,input,select,summary')].filter((el) => el.getBoundingClientRect().width > 0);
        const outside = [...node.querySelectorAll('h2,h3,strong,dd,button,input,select')].filter((el) => {
          const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < rect.left - 1 || r.right > rect.right + 1);
        }).map((el) => el.id || el.textContent.trim().slice(0, 55));
        return { id: node.id, width, height: Number(rect.height.toFixed(2)), titleSize: getComputedStyle(node.querySelector('h2')).fontSize, imageHeights: [...node.querySelectorAll('img')].map((img) => Math.round(img.getBoundingClientRect().height)), outside, horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1, smallButtons: controls.filter((el) => ['BUTTON','SUMMARY','SELECT'].includes(el.tagName) && el.getBoundingClientRect().height < 43.9).map((el) => el.textContent.trim().slice(0, 55)) };
      }, width));
      if ([390, 768, 1672].includes(width)) {
        await page.screenshot({ path: path.join(folder, `${id}-${width}-viewport.png`) });
        await capture(section, `${id}-${width}.png`);
      }
    }
  }
  if (phase === 'after') {
    for (const width of [390, 768, 1672]) {
      await page.setViewportSize({ width, height: 941 });
      const budget = page.locator('#college-budget');
      await budget.getByText('View detailed costs', { exact: true }).click();
      await capture(budget, `college-budget-${width}-detailed.png`);
      await budget.getByText('View detailed costs', { exact: true }).click();
      const check = page.locator('#course-eligibility');
      const choose = (selector) => check.locator(selector).locator('..').click();
      const next = () => check.getByRole('button', { name: /^(Continue|Review requirements)$/ }).click();
      await choose('input[name="study-stage"][value="school-completed"]'); await next();
      await capture(check, `course-eligibility-${width}-courses.png`);
      await choose('input[name="eligibility-course"][value="btech"]'); await next();
      await choose('input[name="admission-year"][value="2026–27"]'); await next();
      for (const name of ['Physics', 'Chemistry', 'Mathematics']) await check.getByRole('checkbox', { name, exact: true }).check();
      await next(); await check.locator('#eligibility-marks').fill('78');
      await capture(check, `course-eligibility-${width}-marks.png`);
      await next(); await choose('input[name="entrance-status"][value="not-taken"]'); await next();
      await capture(check, `course-eligibility-${width}-review.png`);
      await check.getByRole('button', { name: 'Start a new check', exact: true }).click();
    }
  }
  await writeFile(path.join(folder, 'measurements.json'), JSON.stringify({ phase, captureMode: 'Same responsive width; isolated captures hide header and extend viewport height for full paint. Viewport captures retain fixed header.', measurements, errors }, null, 2));
  console.log(JSON.stringify({ phase, measurements: measurements.length, failures: measurements.filter((r) => r.outside.length || r.horizontalOverflow || r.smallButtons.length), errors }));
} finally { await browser.close(); }
