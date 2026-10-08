import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sitePages } from '../../frontend/src/data/site-pages.js';
import { footerGroups } from '../../frontend/src/data/site.js';

const output = new URL('./', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
const routes = [];
try {
  for (const width of [320, 390, 650, 768, 1100, 1440, 1920]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--header-scroll-offset') !== '');
    const footer = page.locator('#site-footer');
    await footer.scrollIntoViewIfNeeded();
    const height = await footer.evaluate((node) => node.getBoundingClientRect().height);
    await page.setViewportSize({ width, height: Math.ceil(height) + 140 });
    await footer.evaluate((node) => window.scrollTo({ top: node.offsetTop - 120, behavior: 'instant' }));
    await footer.screenshot({ path: fileURLToPath(new URL(`footer-${width}.png`, output)), caret: 'initial' });
    const metrics = await footer.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const links = [...node.querySelectorAll('a')];
      return {
        width: window.innerWidth, height: box.height,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        smallTargets: links.filter((link) => link.getBoundingClientRect().height < 43).map((link) => link.textContent || link.getAttribute('aria-label')),
        outOfBounds: links.filter((link) => { const rect = link.getBoundingClientRect(); return rect.left < box.left || rect.right > box.right; }).map((link) => link.textContent || link.getAttribute('aria-label')),
        linkCount: links.length,
        invalidLinks: links.filter((link) => !link.getAttribute('href') || link.getAttribute('href') === '#').map((link) => link.textContent),
        missingAnchors: links.filter((link) => /^\/?#/.test(link.getAttribute('href'))).filter((link) => !document.getElementById(link.getAttribute('href').split('#')[1])).map((link) => link.getAttribute('href')),
        headings: [...node.querySelectorAll('h2,h3')].map((heading) => ({ text: heading.textContent, color: window.getComputedStyle(heading).color })),
      };
    });
    results.push({ ...metrics, errors });
    console.log(JSON.stringify({ ...metrics, headings: metrics.headings.length, errors }));
    if (width === 390) {
      await footer.getByRole('link', { name: 'Back to top' }).click();
      await page.waitForFunction(() => window.scrollY < 2);
    }
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  for (const slug of Object.keys(sitePages)) {
    const response = await page.goto(`http://127.0.0.1:3000/${slug}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    routes.push({ slug, status: response.status(), title: await page.title(), heading: await page.locator('main h1').textContent(), footerCount: await page.locator('#site-footer').count(), robots: await page.locator('meta[name="robots"]').evaluateAll((nodes) => nodes[0]?.getAttribute('content') || null), overflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth) });
    console.log(JSON.stringify({ route: slug, status: response.status() }));
  }
  const unknown = await page.goto('http://127.0.0.1:3000/not-an-nsedu-page');
  await page.goto('http://127.0.0.1:3000/contact');
  await page.screenshot({ path: fileURLToPath(new URL('contact-mobile.png', output)), fullPage: true });
  await page.close();
  const evidence = { date: '2026-10-08', widths: results, routes, unknownRouteStatus: unknown.status(), footerDestinationCount: new Set(footerGroups.flatMap((group) => group.links.map((link) => link.href))).size };
  await writeFile(new URL('browser-evidence.json', output), JSON.stringify(evidence, null, 2));
  if (results.some((result) => result.overflow || result.smallTargets.length || result.outOfBounds.length || result.invalidLinks.length || result.missingAnchors.length || result.errors.length) || routes.some((route) => route.status !== 200 || route.footerCount !== 1 || route.overflow) || unknown.status() !== 404) throw new Error('Footer browser audit failed; inspect browser-evidence.json');
  console.log(JSON.stringify({ routesChecked: routes.length, unknownRouteStatus: unknown.status(), result: 'passed' }));
} finally { await browser.close(); }
