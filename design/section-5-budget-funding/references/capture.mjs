import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: 'chrome' });
const records = [];
const sites = [
  ['shiksha-fees', 'https://www.shiksha.com/college/iit-madras-indian-institute-of-technology-adyar-chennai-3031/fees'],
  ['collegedekho', 'https://www.collegedekho.com/'],
  ['collegedunia-fees', 'https://collegedunia.com/college/13351-dhole-patil-college-of-engineering-dpcoe-pune/courses-fees'],
  ['careers360-fees', 'https://engineering.careers360.com/articles/bitsat-fee-structure'],
  ['bigfuture-cost', 'https://bigfuture.collegeboard.org/pay-for-college/get-started/focus-on-net-price-not-sticker-price'],
  ['buddy4study', 'https://www.buddy4study.com/'],
];
try {
  await mkdir(folder, { recursive: true });
  for (const [name, url] of sites) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const record = { name, url, fetchedAt: new Date().toISOString(), status: null, title: '', text: '', screenshot: null, error: null };
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      record.status = response?.status() ?? null;
      await page.waitForTimeout(2000);
      record.title = await page.title();
      record.text = (await page.locator('body').innerText({ timeout: 5000 })).slice(0, 22000);
      record.screenshot = `${name}.png`;
      await page.screenshot({ path: path.join(folder, record.screenshot), timeout: 15000 });
    } catch (error) { record.error = error.message; }
    finally { await page.close(); }
    records.push(record);
    await writeFile(path.join(folder, 'browser-evidence.json'), `${JSON.stringify(records, null, 2)}\n`);
    console.log(`${name}: status ${record.status}; screenshot ${record.screenshot ?? 'unavailable'}; ${record.error ? 'navigation/capture error' : record.title.slice(0, 100)}.`);
  }
} finally { await browser.close(); }
