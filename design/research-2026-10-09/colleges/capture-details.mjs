import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const { chromium } = createRequire('D:/CP/NS-EDU/frontend/package.json')('@playwright/test');

const out = 'D:/CP/NS-EDU/design/research-2026-10-09/colleges/';
const scratch = 'C:/Users/422se/AppData/Local/Temp/claude/d--CP-NS-EDU/c76e6622-1671-4a00-8878-89429865b705/scratchpad/colleges/';
const ua = {
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  mobile: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
};
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] });
const log = [];
async function open(url, vp) {
  const mobile = vp === 'mobile';
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, userAgent: ua[vp], locale: 'en-IN' });
  const page = await context.newPage();
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  return { context, page, status: response?.status() };
}
async function step(name, fn) {
  try { const result = await fn(); log.push({ name, ok: true, result }); console.log('ok', name, JSON.stringify(result ?? '').slice(0, 200)); }
  catch (error) { log.push({ name, ok: false, error: String(error).slice(0, 200) }); console.log('fail', name, String(error).slice(0, 200)); }
}
// Sticky tab bar after scrolling on profiles (desktop + mobile)
for (const [key, url] of [
  ['collegedunia-profile', 'https://collegedunia.com/university/25881-indian-institute-of-technology-iit-madras-chennai'],
  ['shiksha-profile', 'https://www.shiksha.com/university/iit-madras-indian-institute-of-technology-madras-3031'],
  ['careers360-profile', 'https://www.careers360.com/university/indian-institute-of-technology-madras'],
]) {
  for (const vp of ['desktop', 'mobile']) {
    await step(`${key}-${vp}-scrolled`, async () => {
      const { context, page, status } = await open(url, vp);
      await page.evaluate(() => window.scrollTo(0, 2600));
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${out}${key}-${vp}-scrolled.png` });
      const sticky = await page.evaluate(() => [...document.querySelectorAll('*')].filter((el) => ['sticky', 'fixed'].includes(getComputedStyle(el).position) && el.getBoundingClientRect().height > 30 && el.getBoundingClientRect().height < 200 && el.innerText?.trim()).slice(0, 6).map((el) => ({ pos: getComputedStyle(el).position, top: Math.round(el.getBoundingClientRect().top), h: Math.round(el.getBoundingClientRect().height), text: el.innerText.trim().replace(/\s+/g, ' ').slice(0, 140) })));
      await context.close();
      return { status, sticky };
    });
  }
}
// Mobile filter drawers
await step('shiksha-listing-mobile-filters', async () => {
  const { context, page } = await open('https://www.shiksha.com/engineering/colleges/b-tech-colleges-india', 'mobile');
  const trigger = page.locator('button, div[role=button], span').filter({ hasText: /^2$/ }).first();
  await trigger.click({ timeout: 8000 }).catch(async () => { await page.mouse.click(52, 365); });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}shiksha-listing-mobile-filters.png` });
  await context.close();
});
await step('careers360-listing-mobile-filters', async () => {
  const { context, page } = await open('https://engineering.careers360.com/colleges/list-of-be-btech-colleges-in-india', 'mobile');
  await page.getByText(/Applied 1/).first().click({ timeout: 8000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}careers360-listing-mobile-filters.png` });
  await context.close();
});
await step('collegedekho-listing-mobile-filters', async () => {
  const { context, page } = await open('https://www.collegedekho.com/btech-colleges-in-india/', 'mobile');
  await page.getByText('Filters', { exact: true }).first().click({ timeout: 8000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}collegedekho-listing-mobile-filters.png` });
  await context.close();
});
// CollegeDekho profile: follow first card link
await step('collegedekho-profile', async () => {
  const { context, page } = await open('https://www.collegedekho.com/btech-colleges-in-india/', 'desktop');
  const href = await page.evaluate(() => [...document.querySelectorAll('a[href*="/colleges/"]')].map((a) => a.href).find((h) => /iit-madras|iitm/i.test(h)) || [...document.querySelectorAll('a[href*="/colleges/"]')].map((a) => a.href)[0]);
  await context.close();
  for (const vp of ['desktop', 'mobile']) {
    const { context: c2, page: p2, status } = await open(href, vp);
    await p2.screenshot({ path: `${out}collegedekho-profile-${vp}.png` });
    await p2.evaluate(async () => { for (let y = 0; y < 6000; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); } window.scrollTo(0, 2600); });
    await p2.waitForTimeout(1200);
    await p2.screenshot({ path: `${out}collegedekho-profile-${vp}-scrolled.png` });
    if (vp === 'desktop') {
      await p2.screenshot({ path: `${out}collegedekho-profile-desktop-full.png`, fullPage: true, timeout: 60000 }).catch(() => {});
      writeFileSync(`${out}collegedekho-profile-text.txt`, (await p2.evaluate(() => document.body.innerText)).slice(0, 60000));
    }
    log.push({ href, vp, status, title: await p2.title() });
    await c2.close();
  }
  return href;
});
// Element clips of key profile sections (desktop)
for (const [key, url, patterns] of [
  ['careers360-profile', 'https://www.careers360.com/university/indian-institute-of-technology-madras', ['Courses Offered', 'Placements', 'Popular College Comparisons', 'Highlights']],
  ['collegedunia-profile', 'https://collegedunia.com/university/25881-indian-institute-of-technology-iit-madras-chennai', ['Courses', 'Placement', 'Similar', 'Fees']],
  ['shiksha-profile', 'https://www.shiksha.com/university/iit-madras-indian-institute-of-technology-madras-3031', ['Courses', 'Placement', 'Similar', 'Compare', 'Fees']],
]) {
  await step(`${key}-sections`, async () => {
    const { context, page } = await open(url, 'desktop');
    await page.evaluate(async () => { for (let y = 0; y < 14000; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 200)); } });
    const found = [];
    for (const pattern of patterns) {
      const heading = page.locator('h2, h3').filter({ hasText: new RegExp(pattern, 'i') }).first();
      if (!(await heading.count())) continue;
      await heading.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -140));
      await page.waitForTimeout(800);
      const file = `${key}-section-${pattern.toLowerCase().replace(/\W+/g, '-')}.png`;
      await page.screenshot({ path: `${scratch}${file}` });
      found.push({ pattern, text: (await heading.innerText()).slice(0, 90), file });
    }
    await context.close();
    return found;
  });
}
writeFileSync(`${out}capture-details-log.json`, JSON.stringify(log, null, 2));
await browser.close();
