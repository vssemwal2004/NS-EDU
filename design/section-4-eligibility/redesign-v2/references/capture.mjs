import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const targets = [
  ['ucas', 'https://www.ucas.com/explore/career-quiz'],
  ['bigfuture', 'https://bigfuture.collegeboard.org/college-search'],
  ['shiksha', 'https://www.shiksha.com/engineering/jee-main-college-predictor'],
  ['careers360', 'https://engineering.careers360.com/jee-main-college-predictor'],
  ['collegedunia', 'https://collegedunia.com/jee-main-college-predictor'],
  ['collegedekho', 'https://www.collegedekho.com/exam/neet-ug/college-predictor'],
];
const browser = await chromium.launch({ channel: 'chrome' });
const records = [];
try {
  for (let start = 0; start < targets.length; start += 3) {
    await Promise.all(targets.slice(start, start + 3).map(async ([name, url]) => {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const record = { name, requestedUrl: url, visitedAt: new Date().toISOString() };
      try {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        record.status = response?.status();
        await page.waitForTimeout(3500);
        record.finalUrl = page.url();
        record.title = await page.title();
        record.headings = await page.locator('h1,h2,h3').allTextContents();
        record.visibleText = (await page.locator('body').innerText()).slice(0, 10000);
        record.screenshot = `${name}.png`;
        await page.screenshot({ path: path.join(folder, record.screenshot), timeout: 10000 });
      } catch (error) { record.error = error.message; }
      finally { await page.close(); }
      records.push(record);
      process.stdout.write(`${name}: ${record.status ?? 'unavailable'} ${record.title ?? record.error}\n`);
    }));
  }
  await writeFile(path.join(folder, 'observations.json'), `${JSON.stringify(records, null, 2)}\n`);
} finally { await browser.close(); }
