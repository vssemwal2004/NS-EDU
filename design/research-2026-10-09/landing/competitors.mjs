import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire('D:/CP/NS-EDU/frontend/package.json')('@playwright/test');
const out = 'D:/CP/NS-EDU/design/research-2026-10-09/landing';
const sites = [
  ['careers360', 'https://www.careers360.com/'],
  ['collegedekho', 'https://www.collegedekho.com/'],
  ['shiksha', 'https://www.shiksha.com/'],
  ['collegedunia', 'https://collegedunia.com/'],
];
const only = process.argv[2];
const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const mobileUA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const log = [];
for (const [name, url] of sites) {
  if (only && only !== name) continue;
  for (const [mode, vp, ua, mobile] of [['desktop', { width: 1440, height: 900 }, desktopUA, false], ['mobile', { width: 390, height: 844 }, mobileUA, true]]) {
    const ctx = await browser.newContext({ viewport: vp, userAgent: ua, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, locale: 'en-IN' });
    await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));
    const page = await ctx.newPage();
    const entry = { name, url, mode };
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      entry.status = res?.status();
      await page.waitForTimeout(6000);
      // close obvious modals with Escape; scroll to trigger lazy content
      await page.keyboard.press('Escape').catch(() => {});
      for (let y = 0; y < 12; y++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(400); }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1500);
      entry.title = await page.title();
      entry.height = await page.evaluate(() => document.documentElement.scrollHeight);
      entry.headings = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3')].map((h) => `${h.tagName}: ${h.innerText.trim().replace(/\s+/g, ' ')}`).filter((t) => t.length > 4).slice(0, 120));
      await page.screenshot({ path: `${out}/${name}-${mode}-viewport.png` });
      await page.screenshot({ path: `${out}/${name}-${mode}-full.png`, fullPage: true, timeout: 60000 }).catch((e) => { entry.fullErr = String(e).slice(0, 200); });
    } catch (e) { entry.error = String(e).slice(0, 300); }
    log.push(entry);
    console.log(name, mode, entry.status, entry.title, entry.height, entry.error || '');
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(`${out}/capture-log${only ? '-' + only : ''}.json`, JSON.stringify(log, null, 2));
