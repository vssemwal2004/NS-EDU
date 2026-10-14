import { test, expect } from '@playwright/test';

const section = (page) => page.locator('#course-eligibility');
const next = (page) => section(page).getByRole('button', { name: /^(Continue|Review requirements)$/ }).click();
const choose = (input) => input.locator('..').click();
async function begin(page, { stage = 'school-completed', course = 'btech', year = '2026–27', qualification, completion = 'completed' } = {}) {
  const check = section(page);
  if (stage === 'other') await check.getByRole('button', { name: /Diploma or another qualification/ }).click();
  else { await choose(check.locator(`input[name="study-stage"][value="${stage}"]`)); await next(page); }
  if (['college', 'other'].includes(stage)) {
    await check.getByLabel('Highest qualification').selectOption(qualification || 'degree');
    await check.getByLabel('Completion status').selectOption(completion);
    await next(page);
  }
  await check.getByLabel('Search eligibility courses').fill(course === 'btech' ? 'B.Tech' : course === 'mba' ? 'MBA' : course === 'mbbs' ? 'MBBS' : course === 'mtech' ? 'M.Tech' : 'B.Com');
  await choose(check.locator(`input[name="eligibility-course"][value="${course}"]`));
  await next(page);
  await choose(check.locator(`input[name="admission-year"][value="${year}"]`));
  await next(page);
}
async function subjects(page, values = ['Physics', 'Chemistry', 'Mathematics']) {
  for (const name of values) await section(page).getByRole('checkbox', { name, exact: true }).check();
  await next(page);
}
async function complete(page, { marks = '78', grading = 'percentage', exam = 'not-taken' } = {}) {
  if (grading !== 'percentage') await choose(section(page).locator(`input[name="mark-format"][value="${grading}"]`));
  if (grading !== 'pending') await section(page).locator('#eligibility-marks').fill(marks);
  await next(page);
  await choose(section(page).locator(`input[name="entrance-status"][value="${exam}"]`));
  await next(page);
}

test.beforeEach(async ({ page }) => {
  page.browserErrors = [];
  page.on('pageerror', (error) => page.browserErrors.push(error.message));
  await page.goto('/eligibility');
  await section(page).evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
});
test.afterEach(async ({ page }) => { expect(page.browserErrors).toEqual([]); });

test('entry has no assumed qualification, accessible choices and lazy small artwork', async ({ page }) => {
  const check = section(page);
  await expect(check.getByRole('radio')).toHaveCount(3);
  await expect(check.locator('input:checked')).toHaveCount(0);
  await next(page);
  await expect(check.getByRole('alert')).toContainText('Choose your study stage');
  const radio = check.locator('input[value="school-studying"]');
  await radio.focus();
  await page.keyboard.press('ArrowRight');
  await expect(check.locator('input[value="school-completed"]')).toBeChecked();
  for (const asset of ['notebook', 'certificate', 'graduation']) {
    const img = check.locator(`img[src*="${asset}"]`);
    await expect(img).toHaveAttribute('loading', 'lazy');
    const response = await page.request.get(`/images/eligibility/${asset}.webp`);
    expect(response.headers()['content-type']).toContain('image/webp');
    expect((await response.body()).byteLength).toBeLessThan(30000);
  }
});

test('matching fictional B.Tech rules gives an explained academic review, not an admission prediction', async ({ page }) => {
  await begin(page); await subjects(page); await complete(page);
  const check = section(page);
  await expect(check.locator('[data-result="match"]')).toContainText('Sample academic criteria match');
  await expect(check.locator('[data-requirement-state="match"]')).toHaveCount(3);
  await expect(check).toContainText('Entrance-route requirements are not checked');
  await expect(check).toContainText('Sample rules are fictional');
  await check.getByRole('button', { name: 'Save for this visit', exact: true }).click();
  await expect(check.getByRole('status')).toContainText('while this page stays open');
  await check.getByRole('button', { name: 'Explore B.Tech colleges', exact: true }).click();
  await expect(page).toHaveURL(/\/colleges\?course=btech$/);
  await expect(page.getByRole('group', { name: 'Choose a course' }).getByRole('button', { name: 'B.Tech', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#results-title')).toHaveText('B.Tech colleges in India');
});

test('eligibility route marks Resources active and shares the chosen course with other pages', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check your eligibility');
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).locator('[aria-current="page"]')).toHaveText('Eligibility');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).locator('[data-group="Resources"]')).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).locator('[data-group="Colleges"]')).toHaveAttribute('data-active', 'false');
  await begin(page, { stage: 'college', qualification: 'degree', course: 'mba' });
  await expect(page).toHaveURL(/[?&]course=mba\b/);
  await page.goto('/');
  await expect(page.locator('#destination-course')).toHaveValue('mba');
});

test('a course in the URL is used when the student reaches the course step', async ({ page }) => {
  await page.goto('/eligibility?course=mba');
  const check = section(page);
  await choose(check.locator('input[name="study-stage"][value="college"]')); await next(page);
  await check.getByLabel('Highest qualification').selectOption('degree');
  await check.getByLabel('Completion status').selectOption('completed');
  await next(page);
  await expect(check.locator('input[name="eligibility-course"][value="mba"]')).toBeChecked();
});

test('subjects missing and percentage below the sample minimum remain distinct unmet requirements', async ({ page }) => {
  await begin(page); await subjects(page, ['Physics', 'Chemistry']); await complete(page, { marks: '40' });
  await expect(section(page).locator('[data-result="not-met"]')).toBeVisible();
  await expect(section(page).locator('[data-requirement-state="not-met"]')).toHaveCount(2);
  await expect(section(page)).toContainText('40%');
});

test('pending school completion and awaited marks are reported as pending rather than accepted', async ({ page }) => {
  await begin(page, { stage: 'school-studying' });
  await section(page).getByRole('checkbox', { name: 'I do not have these details yet' }).check();
  await next(page); await complete(page, { grading: 'pending', exam: 'awaited' });
  await expect(section(page).locator('[data-result="pending"]')).toBeVisible();
  await expect(section(page).locator('[data-requirement-state="pending"]')).toHaveCount(3);
});

test('CGPA stays unverified without an official conversion rather than becoming an assumed percentage', async ({ page }) => {
  await begin(page); await subjects(page); await complete(page, { grading: 'cgpa', marks: '8.1' });
  await expect(section(page).locator('[data-result="unverified"]')).toBeVisible();
  await expect(section(page)).toContainText('8.1 / 10 CGPA · official conversion needed');
  await expect(section(page)).not.toContainText('81%');
});

test('postgraduate route asks degree and completion, and uses degree aggregate rather than PCM marks', async ({ page }) => {
  await begin(page, { stage: 'college', qualification: 'degree', course: 'mba' });
  await expect(section(page)).toHaveAttribute('data-step', 'marks');
  await expect(section(page).getByLabel('Bachelor’s degree aggregate (%)')).toBeVisible();
  await complete(page, { marks: '65' });
  await expect(section(page).locator('[data-result="match"]')).toBeVisible();
  await expect(section(page).locator('[data-requirement-state="match"]')).toHaveCount(2);
});

test('diploma route needs a programme-specific review even when marks and subjects match', async ({ page }) => {
  await begin(page, { stage: 'other', qualification: 'diploma' });
  await subjects(page); await complete(page);
  await expect(section(page).locator('[data-result="unverified"]')).toBeVisible();
  await expect(section(page)).toContainText('Diploma · completed');
});

test('medical courses and another year do not reuse invented or outdated academic rules', async ({ page }) => {
  await begin(page, { course: 'mbbs' }); await complete(page);
  await expect(section(page).locator('[data-result="unverified"]')).toBeVisible();
  await expect(section(page).locator('[data-requirement-state]')).toHaveCount(0);
  await section(page).getByRole('button', { name: 'Start a new check', exact: true }).click();
  await begin(page, { year: '2027–28' }); await subjects(page); await complete(page);
  await expect(section(page).locator('[data-result="unverified"]')).toBeVisible();
  await expect(section(page)).toContainText('2027–28');
});

test('range validation, changing format and entrance-rank distinction remain usable', async ({ page }) => {
  await begin(page); await subjects(page);
  await section(page).locator('#eligibility-marks').fill('101'); await next(page);
  await expect(section(page).getByRole('alert')).toContainText('0 to 100');
  await section(page).locator('#eligibility-marks').fill('78'); await next(page);
  await choose(section(page).locator('input[name="entrance-status"][value="result"]')); await next(page);
  await section(page).getByRole('combobox', { name: 'Entrance exam', exact: true }).selectOption('jee');
  await section(page).getByLabel('Result type').selectOption('rank');
  await section(page).getByLabel('Value on your scorecard').fill('12.5'); await next(page);
  await expect(section(page).getByRole('alert')).toContainText('whole number');
  await section(page).getByLabel('Value on your scorecard').fill('12500'); await next(page);
  await expect(section(page)).toContainText('JEE Main · general rank: 12500');
  await expect(section(page)).toContainText('Entrance-route requirements are not checked');
});

test('editing preserves answers, while changing courses clears the old subject and mark basis', async ({ page }) => {
  await begin(page); await subjects(page); await complete(page);
  await section(page).getByRole('button', { name: 'Edit answers', exact: true }).click();
  await expect(section(page).locator('input[value="school-completed"]')).toBeChecked();
  await next(page);
  await section(page).getByLabel('Search eligibility courses').fill('B.Com');
  await choose(section(page).locator('input[name="eligibility-course"][value="bcom"]')); await next(page); await next(page);
  await expect(section(page)).toHaveAttribute('data-step', 'marks');
  await expect(section(page).locator('#eligibility-marks')).toHaveValue('');
  await expect(section(page).getByLabel('Class 12 aggregate (%)')).toBeVisible();
});

for (const width of [320, 390, 768, 1101, 1672]) {
  test(`eligibility flow and header fit ${width}px with reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await section(page).evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const header = page.getByRole('banner');
    expect((await header.boundingBox()).y).toBe(0);
    if (width > 1100) await expect(header.locator('[data-group="Resources"]')).toHaveAttribute('data-active', 'true');
    else await expect(header.getByRole('button', { name: 'Open navigation' })).toBeVisible();
    await begin(page); await subjects(page);
    if (width <= 640) expect(await section(page).locator('#eligibility-marks').evaluate((node) => parseFloat(window.getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    await complete(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const button of await section(page).getByRole('button').all()) {
      if (!await button.isVisible()) continue;
      const bounds = await button.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    expect(await section(page).locator('form').count()).toBe(0);
    expect(await section(page).locator('[data-result]').evaluate((node) => window.getComputedStyle(node).animationName)).toBe('none');
  });
}
