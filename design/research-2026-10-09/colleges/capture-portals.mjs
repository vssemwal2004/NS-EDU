import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire('D:/CP/NS-EDU/frontend/package.json')('@playwright/test');

const out = 'D:/CP/NS-EDU/design/research-2026-10-09/colleges/';
const targets = (process.argv[2] ? JSON.parse(process.argv[2]) : [
  ['collegedunia-listing', 'https://collegedunia.com/btech-colleges'],
  ['shiksha-listing', 'https://www.shiksha.com/engineering/colleges/b-tech-colleges-india'],
  ['collegedekho-listing', 'https://www.collegedekho.com/btech-colleges-in-india/'],
  ['careers360-listing', 'https://engineering.careers360.com/colleges/list-of-be-btech-colleges-in-india'],
  ['careers360-profile', 'https://www.careers360.com/university/indian-institute-of-technology-madras'],
  ['collegedunia-profile', 'https://collegedunia.com/university/25881-indian-institute-of-technology-iit-madras-chennai'],
  ['shiksha-profile', 'https://www.shiksha.com/university/iit-madras-indian-institute-of-technology-madras-3031'],
]);
const viewports = { desktop: { width: 1440, height: 900, mobile: false }, mobile: { width: 390, height: 844, mobile: true } };
const ua = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  mobile: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
};
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] });
const log = [];
for (const [name, url] of targets) {
  for (const [vp, size] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile, userAgent: ua[vp], locale: 'en-IN' });
    const page = await context.newPage();
    await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));
    const entry = { name, url, vp };
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      entry.status = response?.status();
      await page.waitForTimeout(6000);
      entry.title = await page.title();
      entry.finalUrl = page.url();
      await page.screenshot({ path: `${out}${name}-${vp}.png` });
      await page.evaluate(async () => { for (let y = 0; y < 6000; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); } window.scrollTo(0, 0); });
      await page.screenshot({ path: `${out}${name}-${vp}-full.png`, fullPage: true, timeout: 60000 }).catch((e) => { entry.fullError = String(e).slice(0, 120); });
      entry.headings = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3')].slice(0, 60).map((h) => `${h.tagName}: ${h.textContent.trim().replace(/\s+/g, ' ').slice(0, 90)}`));
      entry.bodyChars = await page.evaluate(() => document.body.innerText.length);
      if (vp === 'desktop') writeFileSync(`${out}${name}-text.txt`, (await page.evaluate(() => document.body.innerText)).slice(0, 60000));
    } catch (error) { entry.error = String(error).slice(0, 200); }
    log.push(entry);
    console.log(JSON.stringify({ name, vp, status: entry.status, title: entry.title, error: entry.error, chars: entry.bodyChars }));
    await context.close();
  }
}
writeFileSync(`${out}capture-log-${Date.now()}.json`, JSON.stringify(log, null, 2));
await browser.close();
