import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const folder = new URL('./', import.meta.url);
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const records = [];
try {
  for (const [name, url, heading] of [
    ['shiksha', 'https://www.shiksha.com/news', 'All News'],
    ['collegedekho', 'https://www.collegedekho.com/news/', 'Latest Education News'],
    ['careers360', 'https://news.careers360.com/', 'Latest News'],
    ['collegedunia', 'https://collegedunia.com/news', 'Featured news'],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const record = { name, url, fetchedAt: new Date().toISOString(), status: null, title: '', screenshot: null, error: null };
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      record.status = response?.status() ?? null;
      record.title = await page.title();
      const target = page.getByText(heading, { exact: false }).first();
      if (await target.count()) await target.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await page.screenshot({ path: new URL(`${name}.png`, folder).pathname.replace(/^\/([A-Z]:)/, '$1'), timeout: 12000 });
      record.screenshot = `${name}.png`;
    } catch (error) { record.error = error.message; }
    finally { await page.close(); }
    records.push(record);
    await writeFile(new URL('browser-evidence.json', folder), JSON.stringify(records, null, 2));
    console.log(JSON.stringify(record));
  }
} finally { await browser.close(); }
