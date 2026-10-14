import { test, expect } from '@playwright/test';
import { calculateBudgetEstimate, findAffordableColleges, getBudgetAssumptions, parseBudgetAmount } from '../src/lib/budget.js';

const section = (page) => page.locator('#college-budget');
const testRecord = { id: 'test', courseId: 'btech', tuitionYear: '2026–27', annualTuitionInr: 240000 };

test('budget arithmetic keeps refundable costs, missing costs and input validation distinct', () => {
  const assumptions = getBudgetAssumptions('hostel');
  const result = calculateBudgetEstimate(testRecord, assumptions, '4,00,000');
  expect(result).toMatchObject({ tuition: 240000, living: 96000, other: 39000, total: 375000, difference: 25000, state: 'within' });
  expect(calculateBudgetEstimate(testRecord, assumptions, '375000').state).toBe('exact');
  expect(calculateBudgetEstimate(testRecord, assumptions, '300000')).toMatchObject({ difference: -75000, state: 'over' });
  expect(calculateBudgetEstimate(testRecord, assumptions, '').difference).toBeNull();
  expect(calculateBudgetEstimate(testRecord, { ...assumptions, meals: '' }, '400000')).toMatchObject({ total: null, state: 'incomplete', invalidFields: ['meals'] });
  expect(calculateBudgetEstimate({ ...testRecord, annualTuitionInr: null }, assumptions, '400000').total).toBeNull();
  expect(calculateBudgetEstimate(testRecord, getBudgetAssumptions('home'), '400000').living).toBe(24000);
  for (const raw of ['', '-1', 'NaN', 'Infinity', '1e6', '4,,00,000', '1.5', '100000001', '0']) expect(parseBudgetAmount(raw)).toBeNull();
  for (const raw of ['4,00,000', '400000', '400,000']) expect(parseBudgetAmount(raw)).toBe(400000);
  expect(parseBudgetAmount('0', { allowZero: true })).toBe(0);
});

test('affordable matches include full costs and reject other courses, years and missing tuition', () => {
  const records = [testRecord, { ...testRecord, id: 'tuition-only-match', annualTuitionInr: 350000 }, { ...testRecord, id: 'missing', annualTuitionInr: null }, { ...testRecord, id: 'old-year', tuitionYear: '2025–26' }, { ...testRecord, id: 'different-course', courseId: 'mba' }];
  const matches = findAffordableColleges(records, { courseId: 'btech', tuitionYear: '2026–27', assumptions: getBudgetAssumptions('hostel'), budget: '400000' });
  expect(matches.map(({ record }) => record.id)).toEqual(['test']);
});

test.describe('student budget flow', () => {
  test.beforeEach(async ({ page }) => {
    page.browserErrors = [];
    page.on('pageerror', (error) => page.browserErrors.push(error.message));
    await page.goto('/budget');
    await section(page).evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  });
  test.afterEach(async ({ page }) => { expect(page.browserErrors).toEqual([]); });

  test('approved default, disclosure editing, reset and living choices recalculate the result', async ({ page }) => {
    const check = section(page);
    await expect(check.locator('[data-budget-total]')).toHaveText('₹3,75,000');
    await expect(check.locator('[data-budget-state]')).toContainText('₹25,000 left in your budget');
    await expect(check.getByLabel('Meals estimate')).not.toBeVisible();
    await check.getByText('View detailed costs', { exact: true }).click();
    await check.getByLabel('Meals estimate').fill('40000');
    await expect(check.locator('[data-budget-total]')).toHaveText('₹3,79,000');
    await check.getByRole('button', { name: 'Reset these estimates' }).click();
    await expect(check.locator('[data-budget-total]')).toHaveText('₹3,75,000');
    await check.getByLabel('Where will you stay?').selectOption('rental');
    await expect(check.locator('[data-budget-total]')).toHaveText('₹3,99,000');
    await check.getByLabel('Accommodation estimate').fill('90000');
    await check.getByLabel('Accommodation estimate').blur();
    await expect(check.locator('[data-budget-state="over"]')).toContainText('₹5,000 above your budget');
    await check.getByLabel('Where will you stay?').selectOption('home');
    await expect(check.locator('[data-budget-total]')).toHaveText('₹3,03,000');
    await check.getByLabel('Where will you stay?').selectOption('rental');
    await expect(check.getByLabel('Accommodation estimate')).toHaveValue('90,000');
    await expect(check.locator('[data-budget-total]')).toHaveText('₹4,05,000');
  });

  test('invalid amounts never yield a false zero cost or a remaining-budget promise', async ({ page }) => {
    const check = section(page);
    await check.getByLabel('Your first-year budget').fill('');
    await expect(check.locator('[data-budget-state="no-budget"]')).toBeVisible();
    await expect(check.getByRole('button', { name: 'Find colleges in my budget' })).toBeDisabled();
    await expect(check.locator('[data-budget-total]')).toHaveText('₹3,75,000');
    await check.getByLabel('Your first-year budget').fill('-10');
    await expect(check.getByLabel('Your first-year budget')).toHaveAttribute('aria-invalid', 'true');
    await check.getByLabel('Your first-year budget').fill('375000');
    await expect(check.locator('[data-budget-state="exact"]')).toContainText('Matches your budget');
    await check.getByText('View detailed costs', { exact: true }).click();
    await check.getByLabel('Meals estimate').fill('');
    await expect(check.locator('[data-budget-total]')).toHaveText('Costs incomplete');
    await expect(check.locator('[data-budget-state="incomplete"]')).toBeVisible();
    await expect(check.getByRole('button', { name: 'Find colleges in my budget' })).toBeDisabled();
    await check.getByLabel('Meals estimate').fill('0');
    await expect(check.locator('[data-budget-total]')).toHaveText('₹3,39,000');
  });

  test('programme selection stays course-specific and budget matches use tuition plus current assumptions', async ({ page }) => {
    const check = section(page);
    await check.getByLabel('Your college', { exact: true }).selectOption('meadow-management-mba');
    await expect(check.locator('#budget-programme')).toContainText('MBA · Pune');
    await expect(check.locator('[data-budget-total]')).toHaveText('₹3,95,000');
    await expect(page).toHaveURL(/\/budget\?course=mba$/);
    expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('nsedu:preferences')).course)).toBe('mba');
    await check.getByRole('button', { name: 'Find colleges in my budget' }).click();
    const dialog = page.getByRole('dialog', { name: 'Colleges in your budget' });
    await expect(dialog.getByRole('article')).toHaveCount(2);
    await dialog.getByRole('article').filter({ hasText: 'Riverside University' }).getByRole('button', { name: 'Use this college' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(check.locator('[data-budget-total]')).toHaveText('₹3,55,000');
    await check.getByLabel('Your first-year budget').fill('100000');
    await check.getByRole('button', { name: 'Find colleges in my budget' }).click();
    await expect(dialog).toContainText('No sample college fits this plan yet');
    await dialog.getByRole('button', { name: 'Adjust my plan' }).click();
    await expect(check.getByLabel('Your first-year budget')).toBeFocused();
  });

  test('scholarship support opens actual resources without deducting an award', async ({ page }) => {
    await expect(section(page).locator('[data-budget-total]')).toHaveText('₹3,75,000');
    await section(page).getByRole('button', { name: 'Find scholarships' }).click();
    await expect(page).toHaveURL(/\/scholarships$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Scholarships & funding');
    await expect(page.getByRole('link', { name: /National Scholarship Portal/ })).toHaveAttribute('href', 'https://scholarships.gov.in/');
    await expect(page.getByRole('link', { name: /Buddy4Study/ })).toHaveAttribute('target', '_blank');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Scholarships', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.goBack();
    await expect(section(page).locator('[data-budget-total]')).toHaveText('₹3,75,000');
  });

  test('budget navigation, keyboard disclosure and small lazy artwork work together', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Can this college fit your budget?');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).locator('[aria-current="page"]')).toHaveText('Budget check');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.locator('[data-group="Resources"]')).toHaveAttribute('data-active', 'true');
    await expect(nav.getByRole('link', { name: 'Compare', exact: true })).not.toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('banner')).toBeVisible();
    expect((await page.getByRole('banner').boundingBox()).y).toBe(0);
    await section(page).locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(section(page).getByLabel('Accommodation estimate')).toBeVisible();
    const img = section(page).locator('img');
    await expect(img).toHaveAttribute('loading', 'lazy');
    const response = await page.request.get('/images/budget/desk.webp');
    expect(response.headers()['content-type']).toContain('image/webp');
    expect((await response.body()).byteLength).toBeLessThan(30000);
  });

  for (const width of [320, 390, 768, 1100, 1440]) {
    test(`responsive default and expanded details fit at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await section(page).getByText('View detailed costs', { exact: true }).click();
      await section(page).getByLabel('Your first-year budget').fill('100000000');
      const layout = await section(page).evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        const overflowing = [...node.querySelectorAll('input, select, button, h2, h3, dd')].filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
        }).map((el) => el.id || el.textContent.trim().slice(0, 50));
        return { overflowing, horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
      });
      expect(layout).toEqual({ overflowing: [], horizontalOverflow: false });
      await expect(section(page).getByLabel('Accommodation estimate')).toBeVisible();
    });
  }
});
