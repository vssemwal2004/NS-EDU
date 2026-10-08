import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const measurements = [];
const chosen = (selector) => page.locator(`#course-eligibility ${selector}`).locator('..').click();
const next = () => page.locator('#course-eligibility').getByRole('button', { name: /^(Continue|Review requirements)$/ }).click();
try {
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  for (const [name, width, height] of [['desktop', 1672, 941], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    const check = page.locator('#course-eligibility');
    await check.evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForTimeout(400);
    await chosen('input[name="study-stage"][value="school-completed"]');
    const destination = path.join(folder, name);
    await mkdir(destination, { recursive: true });
    async function capture(label) {
      await check.locator('img:visible').evaluateAll((images) => Promise.all(images.map((img) => img.decode().catch(() => {}))));
      const header = page.getByRole('banner', { includeHidden: true });
      const previousStyle = await header.getAttribute('style');
      await header.evaluate((node) => { node.style.visibility = 'hidden'; });
      try {
        await check.screenshot({ path: path.join(destination, `${label}.png`), timeout: 30000 });
      } finally {
        await header.evaluate((node, original) => { if (original === null) node.removeAttribute('style'); else node.setAttribute('style', original); }, previousStyle);
      }
      measurements.push({ name, width, height, label, step: await check.getAttribute('data-step'), section: await check.boundingBox(), horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), buttons: await check.getByRole('button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height }))) });
      await writeFile(path.join(folder, 'measurements.json'), `${JSON.stringify({ captureMode: 'Isolated section previews; fixed header hidden only during section screenshot, then restored. Actual viewport previews keep the header visible.', measurements, errors }, null, 2)}\n`);
      if (label === '01-study-stage' || label === '08-review') {
        await check.locator('#eligibility-question').evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await page.screenshot({ path: path.join(destination, `${label}-viewport.png`) });
      }
      console.log(`Captured ${name}/${label}.`);
    }
    await capture('01-study-stage'); await next();
    await chosen('input[name="eligibility-course"][value="btech"]');
    await capture('02-course'); await next();
    await chosen('input[name="admission-year"][value="2026–27"]');
    await capture('03-year'); await next();
    for (const subject of ['Physics', 'Chemistry', 'Mathematics']) await check.getByRole('checkbox', { name: subject, exact: true }).check();
    await capture('04-subjects'); await next();
    await check.locator('#eligibility-marks').fill('78');
    await capture('05-marks'); await next();
    await chosen('input[name="entrance-status"][value="result"]');
    await capture('06-entrance'); await next();
    await check.getByRole('combobox', { name: 'Entrance exam', exact: true }).selectOption('jee');
    await check.getByLabel('Result type').selectOption('rank');
    await check.getByLabel('Value on your scorecard').fill('12500');
    await capture('07-exam-details'); await next();
    await capture('08-review');
    await check.getByRole('button', { name: 'Start a new check', exact: true }).click();
    await check.getByRole('button', { name: /Diploma or another qualification/ }).click();
    await check.getByLabel('Highest qualification').selectOption('diploma');
    await check.getByLabel('Completion status').selectOption('completed');
    await capture('09-other-qualification');
    await check.getByRole('button', { name: 'Back', exact: true }).click();
  }
  await writeFile(path.join(folder, 'measurements.json'), `${JSON.stringify({ captureMode: 'Isolated section previews; fixed header hidden only during section screenshot, then restored. Actual viewport previews keep the header visible.', measurements, errors }, null, 2)}\n`);
  console.log(JSON.stringify({ screenshots: measurements.length, horizontalOverflow: measurements.filter((item) => item.horizontalOverflow), errors }));
} finally { await browser.close(); }
