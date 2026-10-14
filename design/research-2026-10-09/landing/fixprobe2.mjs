// Non-destructive probe v2: capped photo scale + photo-edge-aware text column. Injected at runtime only.
import { createRequire } from 'node:module';
const { chromium } = createRequire('D:/CP/NS-EDU/frontend/package.json')('@playwright/test');
const out = 'D:/CP/NS-EDU/design/research-2026-10-09/landing';
const browser = await chromium.launch({ channel: 'chrome' });
const sizes = [[1440, 900], [1366, 768], [1280, 800], [1101, 700], [1920, 1080], [1536, 864], [1280, 1024], [1680, 1050], [2560, 1440], [1920, 1200]];
for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://127.0.0.1:3001/', { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate(() => {
    const h1 = document.querySelector('#hero-title');
    const content = h1.parentElement, inner = content.parentElement, hero = inner.parentElement;
    const art = hero.querySelector(':scope > svg');
    const fields = document.querySelector('nav[aria-label="Explore by field"]');
    const quote = [...inner.querySelectorAll('p[aria-hidden="true"]')].find((p) => p.textContent.startsWith('A brighter'));
    const c = (el) => '.' + [...el.classList].join('.');
    const s = document.createElement('style');
    s.textContent = `
      ${c(inner)}, ${c(art)} {
        --s: min(max(100cqw / 1672, 100cqh / 564), 100cqw / 1450);
        --edge-top: calc(100cqw - 737 * var(--s)); --edge-mid: calc(100cqw - 790 * var(--s)); --edge-low: calc(100cqw - 830 * var(--s));
        --inner-left: max(0px, (100cqw - var(--content-width)) / 2);
      }
      ${c(art)} { inset: auto 0 0 auto !important; width: calc(1672 * var(--s)) !important; height: calc(564 * var(--s)) !important; }
      ${c(content)} { width: min(53%, calc(var(--edge-mid) - var(--inner-left) - var(--hero-gutter) - 2cqw)) !important; }
      ${c(fields)} { max-width: calc(var(--edge-low) - var(--inner-left) - var(--hero-gutter) - 1.5cqw) !important; padding-left: 0 !important; }
      ${c(quote)} { left: calc(var(--edge-top) - var(--inner-left) - 6.6vw) !important; }
      @container (max-aspect-ratio: 25/10) { ${c(quote)} { display: none !important; } }
    `;
    document.head.append(s);
  });
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const r = (el) => el && getComputedStyle(el).display !== 'none' ? el.getBoundingClientRect() : null;
    const h1 = document.querySelector('#hero-title');
    const hero = h1.closest('section');
    const hb = hero.getBoundingClientRect();
    const s = Math.min(Math.max(hb.width / 1672, hb.height / 564), hb.width / 1450);
    const fields = [...document.querySelectorAll('nav[aria-label="Explore by field"] a')];
    const quote = [...document.querySelectorAll('p[aria-hidden="true"]')].find((p) => p.textContent.startsWith('A brighter'));
    const search = hero.querySelector('form');
    const range = document.createRange(); range.selectNodeContents(h1);
    return { aspect: +(hb.width / hb.height).toFixed(2), edgeTop: Math.round(hb.width - 737 * s), edgeMid: Math.round(hb.width - 790 * s), edgeLow: Math.round(hb.width - 830 * s), h1Right: Math.round(range.getBoundingClientRect().right), searchRight: Math.round(r(search)?.right), lastFieldRight: Math.round(r(fields.at(-1))?.right), fieldMinW: Math.round(Math.min(...fields.map((f) => f.getBoundingClientRect().width))), quote: r(quote) ? [Math.round(r(quote).left), Math.round(r(quote).right)] : null, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  console.log(`${w}x${h}`, JSON.stringify(m));
  await page.screenshot({ path: `${out}/probe2-${w}x${h}.png` });
  await page.close();
}
await browser.close();
