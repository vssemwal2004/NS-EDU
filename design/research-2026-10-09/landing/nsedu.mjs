import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire('D:/CP/NS-EDU/frontend/package.json')('@playwright/test');
const out = 'D:/CP/NS-EDU/design/research-2026-10-09/landing';
const base = 'http://127.0.0.1:3001';
const browser = await chromium.launch({ channel: 'chrome' });
const sizes = [[1440, 900], [1366, 768], [1280, 800], [1920, 1080], [1101, 700], [1024, 768], [390, 844]];
const results = [];
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom), visible: getComputedStyle(el).display !== 'none' }; };
    const q = (s) => document.querySelector(s);
    const fields = [...document.querySelectorAll('nav[aria-label="Explore by field"] a')];
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      height: document.documentElement.scrollHeight,
      header: box(q('header')),
      firstScreen: box(q('[data-first-screen]')),
      hero: box(q('#hero-title')?.closest('section')),
      centerQuote: box([...document.querySelectorAll('p[aria-hidden="true"]')].find((p) => p.textContent.startsWith('A brighter'))),
      lastField: box(fields.at(-1)),
      search: box(q('form[role="search"]')),
      sections: [...document.querySelectorAll('main > section, main > div > section')].map((s) => s.getAttribute('aria-labelledby') || s.getAttribute('aria-label') || s.id),
    };
  });
  const tag = `nsedu-home-${w}x${h}`;
  await page.screenshot({ path: `${out}/${tag}-viewport.png` });
  if ([1440, 390, 1024].includes(w)) await page.screenshot({ path: `${out}/${tag}-full.png`, fullPage: true });
  results.push({ tag, errors, ...m });
  console.log(tag, JSON.stringify({ overflow: m.overflow, cq: m.centerQuote, lf: m.lastField, fs: m.firstScreen }));
  await ctx.close();
}
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500 });
  const page = await ctx.newPage();
  await page.goto(`${base}/locations`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/nsedu-locations-${w}-full.png`, fullPage: true });
  results.push({ tag: `locations-${w}`, overflow: await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/nsedu-measurements.json`, JSON.stringify(results, null, 2));
