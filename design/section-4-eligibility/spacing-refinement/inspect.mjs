import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const sizes = [];
try {
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1920, 1672, 1366, 1101, 1024, 1000, 901, 900, 768, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 941 });
    const check = page.locator('#course-eligibility');
    await check.evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await check.locator('img:visible').evaluateAll((images) => Promise.all(images.map((img) => img.decode().catch(() => {}))));
    await check.locator('input[value="school-completed"]').locator('..').click();
    sizes.push(await check.evaluate((section) => {
      const box = (node) => { const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height }; };
      const layout = section.querySelector('aside').parentElement;
      const cards = [...section.querySelectorAll('label:has(input[name="study-stage"])')];
      const controls = [...section.querySelectorAll('button')];
      return {
        width: window.innerWidth, section: box(section), layout: box(layout),
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        cards: cards.map((card) => ({ ...box(card), title: box(card.querySelector('strong')), description: box(card.querySelector('strong + span')) })),
        controls: controls.map((button) => ({ label: button.textContent.trim(), ...box(button) })),
        overflowText: [...section.querySelectorAll('strong, p, h2, h3')].filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.textContent),
      };
    }));
    if ([1920, 1366, 901, 768, 390].includes(width)) {
      const header = page.getByRole('banner', { includeHidden: true });
      const original = await header.getAttribute('style');
      await header.evaluate((node) => { node.style.visibility = 'hidden'; });
      try { await check.screenshot({ path: path.join(folder, `entry-${width}.png`) }); }
      finally { await header.evaluate((node, style) => { if (style === null) node.removeAttribute('style'); else node.setAttribute('style', style); }, original); }
    }
    console.log(`${width}px: section ${Math.round(sizes.at(-1).section.height)}px; cards ${Math.round(sizes.at(-1).cards[0].height)}px; overflow ${sizes.at(-1).horizontalOverflow}.`);
  }
  await writeFile(path.join(folder, 'responsive-measurements.json'), `${JSON.stringify({ sizes, errors }, null, 2)}\n`);
} finally { await browser.close(); }
