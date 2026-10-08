import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const folder = new URL('./', import.meta.url);
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
try {
  for (const width of [1672, 1366, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 941 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    const section = page.locator('#education-news');
    await section.scrollIntoViewIfNeeded();
    await page.locator('[data-feed-status="ready"], [data-feed-status="partial"]').waitFor({ timeout: 40000 });
    await section.locator('[data-news-cover] img').evaluateAll((images) => Promise.all(images.map((img) => img.complete ? null : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 6000); }))));
    const height = await section.evaluate((node) => node.getBoundingClientRect().height);
    await page.setViewportSize({ width, height: Math.ceil(height) + 160 });
    await section.evaluate((node) => window.scrollTo({ top: node.offsetTop - 120, behavior: 'instant' }));
    await section.screenshot({ path: fileURLToPath(new URL(`news-${width}.png`, folder)), timeout: 30000 });
    const metrics = await section.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const interactive = [...node.querySelectorAll('button,input,select')].map((item) => ({ label: item.getAttribute('aria-label') || item.textContent?.trim(), ...Object.fromEntries(['width', 'height', 'left', 'right'].map((key) => [key, item.getBoundingClientRect()[key]])) }));
      return { height: box.height, viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, smallTargets: interactive.filter((item) => item.width > 0 && item.height > 0 && item.height < 43), images: [...node.querySelectorAll('img')].map((img) => ({ loaded: img.complete && img.naturalWidth > 0, src: img.currentSrc })), nativeCovers: node.querySelectorAll('[data-news-image-fallback]').length, stories: node.querySelectorAll('[data-news-story]').length, visibleStories: [...node.querySelectorAll('[data-news-story]')].filter((story) => story.getBoundingClientRect().height > 0).length, heading: node.querySelector('h2')?.textContent, feedStatus: node.querySelector('[data-feed-status]')?.dataset.feedStatus, headerSection: document.querySelector('header[data-section]')?.dataset.section };
    });
    const result = { width, ...metrics, errors };
    results.push(result);
    console.log(JSON.stringify({ ...result, images: result.images.map(({ loaded }) => ({ loaded })) }));
    await page.close();
  }
  await writeFile(new URL('browser-evidence.json', folder), JSON.stringify(results, null, 2));
  const photoPage = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await photoPage.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  const photoSection = photoPage.locator('#education-news');
  await photoSection.scrollIntoViewIfNeeded();
  await photoPage.locator('[data-feed-status="ready"], [data-feed-status="partial"]').waitFor();
  await photoSection.getByLabel('Search education updates').fill('BHU');
  const neutralPhoto = photoSection.locator('[data-news-cover] img').first();
  await neutralPhoto.waitFor();
  await neutralPhoto.evaluate((img) => img.complete ? null : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 10000); }));
  const photoEvidence = await neutralPhoto.evaluate((img) => ({ loaded: img.complete && img.naturalWidth > 0, src: img.currentSrc }));
  await photoSection.screenshot({ path: fileURLToPath(new URL('news-reviewed-photo.png', folder)) });
  await writeFile(new URL('reviewed-photo-evidence.json', folder), JSON.stringify(photoEvidence, null, 2));
  console.log(JSON.stringify({ reviewedPhoto: photoEvidence.loaded }));
  await photoPage.close();
} finally { await browser.close(); }
