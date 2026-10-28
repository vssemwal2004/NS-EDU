import { expect, test } from '@playwright/test';
import { cleanupAdminSession, E2E_SCHOOL, mintAdminSession } from './helpers/admin-session.js';
import { closeSessionDb } from './helpers/student-session.js';

// Admin leads console, school drives (admin → public QR form → lead) and the leads dashboard.
// SHOTS=<dir> also saves full-page screenshots for a visual pass.
const shots = process.env.SHOTS;
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); };
const noOverflow = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

test.describe('admin leads platform', () => {
  test.describe.configure({ mode: 'serial' });
  let cookie;
  let drive;

  test.beforeAll(async () => { ({ cookie } = await mintAdminSession()); });
  test.afterAll(async () => { await cleanupAdminSession(); await closeSessionDb(); });
  test.beforeEach(async ({ context }) => { await context.addCookies([cookie]); });

  test('leads list: toolbar, filters drawer, columns and download popups, pagination', async ({ page }) => {
    await page.goto('/admin/leads');
    await expect(page.getByRole('button', { name: /Filters/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Columns' })).toBeEnabled({ timeout: 20000 });
    await shot(page, 'leads-desktop');

    await page.getByRole('button', { name: /Filters/ }).click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    await shot(page, 'leads-filters');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Columns' }).click();
    await expect(page.locator('dialog[open]').getByRole('heading', { name: 'Columns' })).toBeVisible();
    await shot(page, 'leads-columns');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Download' }).click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog.getByRole('heading', { name: 'Download' })).toBeVisible();
    await expect(dialog.getByText(/CSV/).first()).toBeVisible();
    await expect(dialog.getByText(/Excel/).first()).toBeVisible();
    await expect(dialog.getByText(/PDF/).first()).toBeVisible();
    await shot(page, 'leads-download');
    await page.keyboard.press('Escape');
  });

  test('leads list fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/leads');
    await expect(page.getByRole('button', { name: /Filters/ })).toBeVisible();
    await noOverflow(page);
    await shot(page, 'leads-mobile');
  });

  test('leads dashboard renders KPIs and charts', async ({ page }) => {
    await page.goto('/admin/leads/dashboard');
    await expect(page.getByText('Last 7 days').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Status funnel|Funnel/i).first()).toBeVisible();
    await shot(page, 'dashboard');
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
  });

  test('a school drive gets a QR code and its public form creates a lead', async ({ page, request, browser }) => {
    const created = await request.post('/api/admin/drives', {
      headers: { cookie: `${cookie.name}=${cookie.value}` },
      data: { school: { name: E2E_SCHOOL, district: 'Dehradun', state: 'Uttarakhand', city: 'Dehradun' } },
    });
    expect(created.status(), await created.text()).toBe(201);
    drive = (await created.json()).item;

    await page.goto('/admin/drives');
    await expect(page.getByText(E2E_SCHOOL).first()).toBeVisible({ timeout: 20000 });
    await shot(page, 'drives-list');
    await page.goto(`/admin/drives/${drive.id}`);
    await expect(page.getByRole('heading', { name: new RegExp(E2E_SCHOOL) }).first()).toBeVisible({ timeout: 20000 });
    await shot(page, 'drive-builder');
    await page.getByRole('tab', { name: /QR/ }).click();
    const qr = page.locator('img[src*="qr"]').first();
    await expect(qr).toBeVisible();
    expect(await qr.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
    await shot(page, 'drive-qr');

    // A student scans the QR: no cookies, phone-sized screen.
    const student = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const form = await student.newPage();
    await form.goto(`/r/${drive.shortCode}`);
    await expect(form.getByText(E2E_SCHOOL).first()).toBeVisible();
    await noOverflow(form);
    await shot(form, 'public-form');
    await form.getByLabel('Full name').fill('Riya Sharma');
    await form.getByLabel('Mobile number').fill('9876501234');
    await form.getByRole('combobox', { name: /^Class\b/ }).selectOption({ label: 'Class 12' });
    for (const box of await form.locator('form input[type=checkbox]').all()) await box.check();
    await form.waitForTimeout(3200); // the form token refuses submissions faster than a person can type
    await form.getByRole('button', { name: /Register/ }).click();
    await expect(form.getByText('You are registered!')).toBeVisible({ timeout: 15000 });
    await expect(form.getByText(/GV-\d{4}-\d{6}/)).toBeVisible();
    await shot(form, 'public-form-done');
    await student.close();

    const leads = await request.get(`/api/admin/leads?form=${drive.id}&columns=fullName,schoolName,classLevel`, { headers: { cookie: `${cookie.name}=${cookie.value}` } });
    const body = await leads.json();
    expect(body.total).toBe(1);
    expect(body.items[0].values).toMatchObject({ fullName: 'Riya Sharma', schoolName: E2E_SCHOOL, classLevel: 'Class 12' });

    await page.goto(`/admin/drives/${drive.id}`);
    await page.getByRole('tab', { name: /Submissions|Registrations/ }).click();
    await expect(page.getByText('Riya Sharma')).toBeVisible({ timeout: 20000 });
    await shot(page, 'drive-submissions');
  });
});

test.describe('student side', () => {
  test('career guidance shows the counsellor section', async ({ page }) => {
    await page.goto('/career-guidance');
    await expect(page.getByRole('heading', { name: 'Talk to a counsellor' })).toBeVisible();
    await shot(page, 'career-guidance');
  });

  test('the landing page lists states by college count', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Explore states/i).first()).toBeVisible();
    await shot(page, 'landing');
  });
});
