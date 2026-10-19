import { test, expect } from '@playwright/test';
import { displayNewsImage, filterEducationStories, readSavedNews, safeNewsImage, validEducationStory } from '../src/lib/education-news.js';
// The default `news` content entry (served from MongoDB at runtime).
import config from '../../backend/src/modules/content/defaults/news.js';

const newsImagePolicy = config.imagePolicy;

const makeStory = (id, title, category, type = 'news', day = 7) => ({ id, title, category, type, description: 'Education reporting for students.', source: 'The Indian Express', sourceId: 'indian-express', url: `https://indianexpress.com/article/education/${id}/`, imageUrl: null, publishedAt: `2026-10-0${day}T08:00:00Z` });
const stories = [
  makeStory('regional', 'Regional board announces examination scorecard update', 'exams'),
  makeStory('learning', 'New digital learning tools for college students', 'learning', 'news', 6),
  makeStory('school', 'School curriculum changes explained by the education department', 'schools', 'news', 5),
  makeStory('policy', 'Higher education funding policy update', 'policy', 'news', 4),
  makeStory('admissions', 'University admissions and scholarship applications open', 'admissions', 'news', 3),
  makeStory('article-one', 'How to choose a university course', 'higher-education', 'article', 7),
  makeStory('article-two', 'A practical guide to learning online', 'learning', 'article', 6),
  makeStory('article-three', 'Understanding school curriculum choices', 'schools', 'article', 5),
];
const feed = { status: 'ready', articles: stories, sources: [{ id: 'indian-express', name: 'The Indian Express', state: 'fresh' }], updatedAt: '2026-10-07T12:00:00Z', refreshAfterSeconds: 600 };
const section = (page) => page.locator('#education-news');
const contentNav = (page) => section(page).getByRole('navigation', { name: 'Education content' });
const mainStories = (page) => section(page).locator('[data-news-story]').filter({ has: page.locator('h4') });

async function openNews(page) {
  await page.goto('/news');
  await section(page).evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await expect(section(page).locator('[data-feed-status="ready"]')).toBeVisible();
}

test('untrusted links and malformed browser bookmarks are rejected while arbitrary education topics remain searchable', () => {
  expect(validEducationStory(stories[0], config)).toBe(true);
  expect(validEducationStory({ ...stories[0], url: 'https://indianexpress.com/article/sports/other/' }, config)).toBe(false);
  expect(validEducationStory({ ...stories[0], url: 'javascript:alert(1)' }, config)).toBe(false);
  expect(safeNewsImage('https://evil.example/cover.jpg')).toBeNull();
  expect(displayNewsImage('https://images.indianexpress.com/2026/10/unreviewed.jpg', config)).toBeNull();
  expect(displayNewsImage(newsImagePolicy.reviewedUrls[0], config)).toBe(newsImagePolicy.reviewedUrls[0]);
  expect(readSavedNews({ getItem: () => '{broken' }, config)).toEqual([]);
  expect(filterEducationStories(stories, { query: 'regional' }).map((story) => story.id)).toEqual(['regional']);
  expect(filterEducationStories(stories, { category: 'learning', type: 'article' }).map((story) => story.id)).toEqual(['article-two']);
});

test.describe('education feed interactions', () => {
  test.beforeEach(async ({ page }) => {
    page.browserErrors = [];
    page.on('pageerror', (error) => page.browserErrors.push(error.message));
    await page.route('**/api/education-news', (route) => route.fulfill({ json: feed }));
  });
  test.afterEach(async ({ page }) => { expect(page.browserErrors).toEqual([]); });

  test('the homepage requests the feed only when its news section nears the viewport', async ({ page }) => {
    let calls = 0;
    await page.unroute('**/api/education-news');
    await page.route('**/api/education-news', (route) => { calls++; return route.fulfill({ json: feed }); });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('#study-destinations')).toBeVisible();
    await page.waitForTimeout(1000);
    expect(calls).toBe(0);
    await expect(section(page).locator('[data-feed-status="idle"]')).toHaveCount(1);
    await section(page).scrollIntoViewIfNeeded();
    await expect(section(page).locator('[data-feed-status="ready"]')).toBeVisible();
    expect(calls).toBe(1);
    await expect(mainStories(page)).toHaveCount(6);
    await expect(section(page).getByRole('link', { name: /Regional board announces examination scorecard update/ }).first()).toHaveAttribute('href', stories[0].url);
    await page.getByRole('navigation', { name: 'More education news' }).getByRole('link', { name: 'View all news & articles' }).click();
    await expect(page).toHaveURL(/\/news$/, { timeout: 30_000 });
  });

  test('the news page loads the feed once and renders safe original links', async ({ page }) => {
    let calls = 0;
    await page.unroute('**/api/education-news');
    await page.route('**/api/education-news', (route) => { calls++; return route.fulfill({ json: feed }); });
    await page.goto('/news');
    await expect(section(page).locator('[data-feed-status="ready"]')).toBeVisible();
    expect(calls).toBe(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Education news & articles');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).locator('[aria-current="page"]')).toHaveText('Education news');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).locator('[data-group="Resources"]')).toHaveAttribute('data-active', 'true');
    await expect(section(page).getByRole('heading', { name: 'Education, in focus.' })).toBeVisible();
    await expect(section(page).getByRole('link', { name: /Regional board announces examination scorecard update/ }).first()).toHaveAttribute('target', '_blank');
    await expect(section(page).getByRole('navigation', { name: 'Education topics' }).getByRole('button')).toHaveCount(7);
    await expect(section(page).getByRole('heading', { name: 'Read & understand' })).toBeVisible();
    await page.waitForTimeout(500);
    expect(calls).toBe(1);
  });

  test('broad category filters, arbitrary keyword search and empty states work together', async ({ page }) => {
    await openNews(page);
    await section(page).getByRole('navigation', { name: 'Education topics' }).getByRole('button', { name: 'Exams & results' }).click();
    await section(page).getByLabel('Search education updates').fill('regional');
    await expect(mainStories(page)).toHaveCount(1);
    await section(page).getByLabel('Search education updates').fill('not-a-real-story');
    await expect(section(page).getByRole('heading', { name: 'No stories match this view.' })).toBeVisible();
    await section(page).getByRole('button', { name: 'Clear filters' }).click();
    await expect(mainStories(page)).toHaveCount(6);
  });

  test('article/news views and chronological sorting change actual results', async ({ page }) => {
    await openNews(page);
    await contentNav(page).getByRole('button', { name: 'Articles', exact: true }).click();
    await expect(mainStories(page)).toHaveCount(3);
    await expect(mainStories(page).first()).toHaveAttribute('data-story-type', 'article');
    await contentNav(page).getByRole('button', { name: 'News', exact: true }).click();
    await section(page).getByLabel('Sort education updates').selectOption('oldest');
    await expect(mainStories(page).first()).toContainText('University admissions and scholarship applications open');
    await section(page).getByRole('button', { name: 'Show more updates' }).click();
    await expect(mainStories(page)).toHaveCount(5);
  });

  test('saved stories persist on this device and can be removed', async ({ page }) => {
    await openNews(page);
    await section(page).getByRole('button', { name: 'Save Regional board announces examination scorecard update', exact: true }).click();
    await contentNav(page).getByRole('button', { name: /Saved/ }).click();
    await expect(mainStories(page)).toHaveCount(1);
    await page.reload();
    await section(page).evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await contentNav(page).getByRole('button', { name: /Saved/ }).click();
    await expect(mainStories(page)).toHaveCount(1);
    await section(page).getByRole('button', { name: 'Unsave Regional board announces examination scorecard update', exact: true }).click();
    await expect(section(page).getByRole('heading', { name: 'Keep a story for later.' })).toBeVisible();
  });

  test('an unavailable feed is honest and retry restores real response content', async ({ page }) => {
    let failed = true;
    await page.unroute('**/api/education-news');
    await page.route('**/api/education-news', (route) => route.fulfill({ status: failed ? 503 : 200, json: failed ? { status: 'unavailable', articles: [] } : feed }));
    await page.goto('/news');
    await section(page).evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expect(section(page).getByRole('heading', { name: 'We couldn’t load education updates.' })).toBeVisible();
    await expect(mainStories(page)).toHaveCount(0);
    failed = false;
    await section(page).getByRole('button', { name: 'Refresh updates' }).click();
    await expect(section(page).locator('[data-feed-status="ready"]')).toBeVisible();
    await expect(mainStories(page)).toHaveCount(6);
    failed = true;
    await section(page).getByRole('button', { name: 'Refresh updates' }).click();
    await expect(section(page).locator('[data-feed-status="offline"]')).toHaveText('Showing earlier updates');
    await expect(mainStories(page)).toHaveCount(6);
  });

  test('broken publisher images fall back to native education graphics', async ({ page }) => {
    await page.unroute('**/api/education-news');
    await page.route('**/api/education-news', (route) => route.fulfill({ json: { ...feed, articles: [{ ...stories[0], imageUrl: newsImagePolicy.reviewedUrls[0] }] } }));
    await page.route('**/_next/image?**', (route) => route.fulfill({ status: 404, body: 'Image unavailable' }));
    await openNews(page);
    await expect(section(page).locator('[data-news-image-fallback]')).toBeVisible();
  });

  test('a successful empty feed is distinct from an outage and never invents stories', async ({ page }) => {
    await page.unroute('**/api/education-news');
    await page.route('**/api/education-news', (route) => route.fulfill({ json: { ...feed, articles: [] } }));
    await openNews(page);
    await expect(section(page).getByRole('heading', { name: 'No education updates available yet.' })).toBeVisible();
    await expect(mainStories(page)).toHaveCount(0);
  });

  test('mobile and desktop controls stay readable, usable and inside the viewport', async ({ page }) => {
    for (const width of [320, 390, 768, 1366, 1672]) {
      await page.setViewportSize({ width, height: 900 });
      await openNews(page);
      const metrics = await section(page).evaluate((node) => ({ overflow: document.documentElement.scrollWidth > window.innerWidth, smallTargets: [...node.querySelectorAll('button,input,select')].filter((item) => { const box = item.getBoundingClientRect(); return box.width > 0 && box.height > 0 && box.height < 43; }).map((item) => item.textContent), mobileInput: window.getComputedStyle(node.querySelector('input')).fontSize }));
      expect(metrics.overflow, `${width}px viewport`).toBe(false);
      expect(metrics.smallTargets, `${width}px targets`).toEqual([]);
      if (width < 600) expect(metrics.mobileInput).toBe('16px');
      await contentNav(page).getByRole('button', { name: 'Articles', exact: true }).click();
      await expect(mainStories(page)).toHaveCount(3);
      for (const story of await mainStories(page).all()) await expect(story).toBeVisible();
    }
  });
});
