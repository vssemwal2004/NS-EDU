import { test, expect as baseExpect } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000 });

// Student and admin auth endpoints are mocked so these tests never create real accounts or sessions.
const validCode = '123456';
const returning = { id: 'student-1', email: 'asha@example.com', phone: null, name: 'Asha Rao', createdAt: '2026-09-01T10:00:00Z' };
const newcomer = { id: 'student-2', email: null, phone: '+919876543210', name: '' };
const admin = { id: 'admin-1', name: 'Test Admin', email: 'admin@example.com' };
const dashboard = {
  counts: { students: 42, newStudents7d: 3, activeStudents: 40, blockedStudents: 2, institutions: 11, programmes: 29, courses: 16, exams: 4, cities: 8, states: 6, scholarships: 2 },
  studentsByDay: Array.from({ length: 14 }, (_, index) => ({ date: new Date(Date.UTC(2026, 8, 26 + index)).toISOString().slice(0, 10), count: index % 3 })),
  programmesByCourse: [{ courseId: 'btech', courseName: 'B.Tech', count: 5 }, { courseId: 'mba', courseName: 'MBA', count: 2 }],
  recentStudents: [{ id: 'student-1', name: 'Asha Rao', email: 'asha@example.com', lastLoginAt: '2026-10-08T10:00:00Z', status: 'active' }],
};

async function mockStudentApi(page, account, { signedIn = false, devCode } = {}) {
  const state = { student: signedIn ? account : null, calls: [] };
  const log = (route) => { const request = route.request(); state.calls.push({ method: request.method(), path: new URL(request.url()).pathname, body: request.postDataJSON() }); };
  await page.route('**/api/auth/me', (route) => {
    log(route);
    if (route.request().method() === 'PATCH') {
      state.student = { ...state.student, name: route.request().postDataJSON().name };
      return route.fulfill({ json: { student: state.student } });
    }
    return state.student ? route.fulfill({ json: { student: state.student } }) : route.fulfill({ status: 401, json: { error: 'Sign in to continue.' } });
  });
  await page.route('**/api/auth/otp/request', (route) => {
    log(route);
    return route.fulfill({ json: { identifier: route.request().postDataJSON().identifier, expiresInSeconds: 300, resendInSeconds: 30, ...(devCode ? { devCode } : {}) } });
  });
  await page.route('**/api/auth/otp/verify', (route) => {
    log(route);
    if (route.request().postDataJSON().code !== validCode) return route.fulfill({ status: 400, json: { error: 'That code is not correct. Check it and try again.' } });
    state.student = account;
    return route.fulfill({ json: { student: account, isNew: !account.name } });
  });
  await page.route('**/api/auth/logout', (route) => { log(route); state.student = null; return route.fulfill({ status: 204 }); });
  await page.route('**/api/education-news', (route) => route.fulfill({ json: { status: 'ready', articles: [], sources: [], updatedAt: '2026-10-07T12:00:00Z' } }));
  return state;
}
async function enterCode(dialog, code) {
  for (const [index, digit] of [...code].entries()) await dialog.getByLabel(`Digit ${index + 1} of 6`, { exact: true }).fill(digit);
}
const posted = (state, path) => state.calls.filter((call) => call.path === path && call.method !== 'GET').map((call) => call.body);
const loginButton = (page) => page.getByRole('banner').getByRole('button', { name: 'Log in', exact: true });

test.beforeEach(async ({ page }) => {
  page.browserErrors = [];
  page.on('pageerror', (error) => page.browserErrors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(page.browserErrors).toEqual([]); });

test.describe('student login', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

  test('the dialog offers Mobile and Email with client validation and closes on Escape', async ({ page }) => {
    const state = await mockStudentApi(page, returning);
    await page.goto('/');
    await loginButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Log in to your student space' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('complementary', { name: 'Why log in' })).toBeVisible();
    const channels = dialog.getByRole('group', { name: 'Log in with' });
    await expect(channels.getByRole('radio')).toHaveCount(2);
    await expect(channels.getByRole('radio', { name: 'Mobile' })).toBeChecked();
    await expect(dialog.getByLabel('Mobile number')).toBeFocused();
    const submit = dialog.getByRole('button', { name: 'Get OTP' });
    await submit.click();
    await expect(dialog.getByRole('alert')).toHaveText('Enter your 10-digit mobile number.');
    await expect(dialog.getByLabel('Mobile number')).toHaveAttribute('aria-invalid', 'true');
    await dialog.getByLabel('Mobile number').fill('12345');
    await expect(dialog).toContainText('5 / 10 digits');
    await submit.click();
    await expect(dialog.getByRole('alert')).toHaveText('Indian mobile numbers have 10 digits and start with 6, 7, 8 or 9.');
    await dialog.getByLabel('Mobile number').fill('+91 98765-43210');
    await expect(dialog.getByLabel('Mobile number')).toHaveValue('98765 43210');
    await expect(dialog.getByRole('alert')).toHaveCount(0);

    await channels.getByText('Email').click();
    await expect(channels.getByRole('radio', { name: 'Email' })).toBeChecked();
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect(dialog.getByLabel('Email address')).toBeVisible();
    await submit.click();
    await expect(dialog.getByRole('alert')).toHaveText('Enter your email address.');
    await dialog.getByLabel('Email address').fill('asha@');
    await submit.click();
    await expect(dialog.getByRole('alert')).toHaveText('Enter a valid email address, like name@example.com.');
    await dialog.getByLabel('Email address').fill('asha@gmial.com');
    await dialog.getByRole('button', { name: 'Did you mean asha@gmail.com?' }).click();
    await expect(dialog.getByLabel('Email address')).toHaveValue('asha@gmail.com');
    expect(posted(state, '/api/auth/otp/request')).toEqual([]);
    await expect(dialog).not.toContainText(/create account/i);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(loginButton(page)).toBeVisible();
  });

  test('a returning student signs in by email, keeps the session on reload and logs out from the avatar menu', async ({ page }) => {
    const state = await mockStudentApi(page, returning);
    await page.goto('/');
    const header = page.getByRole('banner');
    await loginButton(page).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('group', { name: 'Log in with' }).getByText('Email').click();
    await dialog.getByLabel('Email address').fill('Asha@Example.com');
    await dialog.getByRole('button', { name: 'Get OTP' }).click();
    await expect(page.getByRole('dialog', { name: 'Enter the 6-digit code' })).toContainText('Sent to as••@example.com');
    expect(posted(state, '/api/auth/otp/request')).toEqual([{ channel: 'email', identifier: 'asha@example.com' }]);
    await expect(dialog).toContainText('Code expires in');
    await enterCode(dialog, '111111');
    await expect(dialog.getByRole('alert')).toHaveText('That code is not correct. Check it and try again.');
    await expect(dialog.getByLabel('Digit 1 of 6', { exact: true })).toHaveValue('');
    await expect(loginButton(page)).toBeVisible();
    await enterCode(dialog, validCode);
    await expect(page.getByRole('dialog', { name: 'You’re signed in' })).toContainText('Signed in as Asha Rao');
    await expect(dialog).toBeHidden();
    expect(posted(state, '/api/auth/otp/verify')).toEqual([{ channel: 'email', identifier: 'asha@example.com', code: '111111' }, { channel: 'email', identifier: 'asha@example.com', code: validCode }]);
    const avatar = header.getByRole('button', { name: 'Asha', exact: true });
    await expect(avatar).toContainText('AR');
    await expect(loginButton(page)).toHaveCount(0);
    await avatar.click();
    await expect(avatar).toHaveAttribute('aria-expanded', 'true');
    const menu = header.getByRole('menu', { name: 'Account' });
    await expect(menu).toContainText('asha@example.com');
    await expect(menu.getByRole('menuitem')).toHaveText(['My account', 'My comparisons', 'Log out']);
    await expect(menu.getByRole('menuitem', { name: 'My account' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'My comparisons' })).toBeFocused();
    await expect(menu.getByRole('menuitem', { name: 'My account' })).toHaveAttribute('href', '/account');
    await expect(menu.getByRole('menuitem', { name: 'My comparisons' })).toHaveAttribute('href', '/compare');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(avatar).toBeFocused();
    await page.reload();
    await expect(avatar).toBeVisible();
    await avatar.click();
    await header.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(loginButton(page)).toBeVisible();
    expect(state.calls.some((call) => call.path === '/api/auth/logout' && call.method === 'POST')).toBe(true);
    await page.reload();
    await expect(loginButton(page)).toBeVisible();
  });

  test('a new student completes the mobile OTP flow with the dev-code notice and names their account', async ({ page }) => {
    const state = await mockStudentApi(page, newcomer, { devCode: validCode });
    await page.goto('/');
    const header = page.getByRole('banner');
    await loginButton(page).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Mobile number').fill('98765 43210');
    await dialog.getByRole('button', { name: 'Get OTP' }).click();
    const verify = page.getByRole('dialog', { name: 'Enter the 6-digit code' });
    await expect(verify).toContainText('Sent to +91 98••• ••210');
    await expect(verify).toContainText('Resend code in');
    expect(posted(state, '/api/auth/otp/request')).toEqual([{ channel: 'phone', identifier: '+919876543210' }]);
    await expect(verify.getByRole('textbox', { name: /^Digit \d of 6$/ })).toHaveCount(6);
    await expect(verify.getByLabel('Digit 1 of 6', { exact: true })).toBeFocused();
    await expect(verify).toContainText('Development preview');
    await expect(verify.locator('code')).toHaveText('123 456');
    await verify.getByRole('button', { name: 'Fill code' }).click();
    const profile = page.getByRole('dialog', { name: 'Welcome to NSEDU' });
    await expect(profile).toContainText('Verified · +91 98••• ••210');
    expect(posted(state, '/api/auth/otp/verify')).toEqual([{ channel: 'phone', identifier: '+919876543210', code: validCode }]);
    await expect(profile.getByLabel('Your name')).toBeFocused();
    await profile.getByRole('button', { name: 'Save & continue' }).click();
    await expect(profile.getByRole('alert')).toHaveText('Enter your name, or choose Skip for now.');
    expect(posted(state, '/api/auth/me')).toEqual([]);
    await profile.getByLabel('Your name').fill('Ravi Kumar');
    await profile.getByLabel('Preferred course').selectOption('bca');
    await profile.getByRole('button', { name: 'Save & continue' }).click();
    const done = page.getByRole('dialog', { name: 'You’re signed in' });
    await expect(done).toContainText('Signed in as Ravi Kumar');
    expect(posted(state, '/api/auth/me')).toEqual([{ name: 'Ravi Kumar' }]);
    const avatar = header.getByRole('button', { name: 'Ravi', exact: true });
    await expect(avatar).toContainText('RK');
    expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem('nsedu:preferences')).course)).toBe('bca');
    await done.getByRole('link', { name: 'Go to your student space' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(done).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back, Ravi');
    await expect(page.locator('main')).toContainText('+91 98765 43210');
    await expect(page.locator('main')).toContainText('Signed in with Mobile');
    await avatar.click();
    await expect(header.getByRole('menu')).toContainText('+919876543210');
    await header.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(loginButton(page)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your student space');
  });

  test('the mobile drawer opens the same login dialog', async ({ page }) => {
    await mockStudentApi(page, returning);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(loginButton(page)).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('dialog', { name: 'NSEDU', exact: true }).getByRole('button', { name: 'Log in to NSEDU' }).click();
    const dialog = page.getByRole('dialog', { name: 'Log in to your student space' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'NSEDU', exact: true })).toBeHidden();
    await expect(dialog.getByRole('button', { name: 'Close login' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Close login' }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe('student account page', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

  test('signed out, /account invites a one-time-code login and keeps device preferences usable', async ({ page }) => {
    await mockStudentApi(page, returning);
    await page.goto('/account');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your student space');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).locator('[aria-current="page"]')).toHaveText('My account');
    await expect(page.getByRole('heading', { level: 2, name: 'Log in or create your student space' })).toBeVisible();
    const preferences = page.locator('#preferences');
    await preferences.getByLabel('Preferred course').selectOption('mba');
    await expect(preferences.getByRole('status')).toHaveText('Saved on this device.');
    await expect(preferences.getByRole('link', { name: 'See MBA colleges' })).toHaveAttribute('href', '/colleges?course=mba');
    await page.getByRole('button', { name: 'Log in with OTP' }).click();
    await expect(page.getByRole('dialog', { name: 'Log in to your student space' })).toBeVisible();
  });

  test('signed in, /account shows the dashboard with device comparisons and logs out', async ({ page }) => {
    const state = await mockStudentApi(page, returning, { signedIn: true });
    await page.addInitScript(() => window.localStorage.setItem('nsedu:compare', JSON.stringify({ btech: ['northfield-tech-btech', 'central-tech-btech'], mba: ['not-a-programme'] })));
    await page.goto('/account');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back, Asha');
    await expect(page.getByRole('banner').getByRole('button', { name: 'Asha', exact: true })).toBeVisible();
    const tiles = page.getByRole('list', { name: 'Your space at a glance' });
    await expect(tiles.getByRole('link')).toHaveText([/^1\s*Comparison lists$/, /^2\s*Colleges lined up$/, /^0\s*Saved stories$/, /^Not set\s*Preferred course$/]);
    const comparisons = page.locator('#comparisons');
    await expect(comparisons.getByRole('heading', { level: 3 })).toHaveText(['B.Tech']);
    await expect(comparisons).toContainText('2 of 3 colleges picked');
    await expect(comparisons.getByRole('link', { name: 'Open comparison for B.Tech' })).toHaveAttribute('href', '/compare?course=btech');
    await comparisons.getByRole('button', { name: 'Clear list for B.Tech' }).click();
    await expect(comparisons.getByRole('heading', { name: 'No comparisons yet' })).toBeVisible();
    await expect(page.locator('#security')).toContainText('asha@example.com');
    await expect(page.locator('#security')).toContainText('Member since 1 Sept 2026');
    await page.getByRole('button', { name: 'Edit name' }).click();
    await page.getByLabel('Your name').fill('Asha R');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back, Asha');
    expect(posted(state, '/api/auth/me')).toEqual([{ name: 'Asha R' }]);
    await page.locator('#security').getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your student space');
    await expect(loginButton(page)).toBeVisible();
  });
});

test.describe('admin console access', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

  test('an unauthenticated dashboard visit redirects to the admin sign-in page', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\?next=%2Fadmin%2Fdashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back');
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toHaveCount(0);
    for (const path of ['/admin/students', '/admin/institutions']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/admin\\?next=${encodeURIComponent(path)}$`));
    }
  });

  test('empty and wrong credentials show errors and keep the visitor on sign-in', async ({ page }) => {
    const attempts = [];
    await page.route('**/api/admin/auth/login', (route) => { attempts.push(route.request().postDataJSON()); return route.fulfill({ status: 401, json: { error: 'Invalid credentials' } }); });
    await page.goto('/admin');
    const submit = page.getByRole('button', { name: 'Sign in' });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('Enter your email and password.');
    expect(attempts).toEqual([]);
    await page.getByLabel('Email address').fill('admin@example.com');
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
    await submit.click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('Invalid email or password.');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
    expect(attempts).toEqual([{ email: 'admin@example.com', password: 'wrong-password' }]);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('a successful sign-in lands on the dashboard and the sidebar rail expands on hover', async ({ page, context, baseURL }) => {
    let signedIn = false;
    await page.route('**/api/admin/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/admin/auth/login') {
        signedIn = true;
        await context.addCookies([{ name: 'nsedu_admin', value: 'mocked-admin-session', url: baseURL }]);
        return route.fulfill({ json: { admin } });
      }
      if (path === '/api/admin/auth/me') return signedIn ? route.fulfill({ json: { admin } }) : route.fulfill({ status: 401, json: { error: 'Sign in to continue.' } });
      if (path === '/api/admin/dashboard') return route.fulfill({ json: dashboard });
      return route.fulfill({ status: 404, json: { error: `Not mocked: ${path}` } });
    });
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\?next=%2Fadmin%2Fdashboard$/);
    await page.getByLabel('Email address').fill(admin.email);
    await page.getByLabel('Password', { exact: true }).fill('correct-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
    await expect(page.getByRole('heading', { level: 2, name: /, Test Admin\.$/ })).toBeVisible();
    const figures = page.getByRole('region', { name: 'Key figures' });
    await expect(figures.getByRole('link')).toHaveCount(4);
    await expect(figures.getByRole('link', { name: /Students/ })).toContainText('42');
    await expect(page.getByRole('table')).toContainText('Asha Rao');

    const sidebar = page.getByRole('complementary', { name: 'Admin navigation' });
    const width = () => sidebar.evaluate((node) => node.getBoundingClientRect().width);
    const labelOpacity = () => sidebar.getByText('Dashboard', { exact: true }).evaluate((node) => Number(window.getComputedStyle(node).opacity));
    await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(900, 500);
    await expect.poll(width).toBeCloseTo(76, 0);
    await expect.poll(labelOpacity).toBe(0);
    await sidebar.hover({ position: { x: 38, y: 300 } });
    await expect.poll(width, { timeout: 3000 }).toBeCloseTo(264, 0);
    await expect.poll(labelOpacity, { timeout: 3000 }).toBe(1);
    await expect(sidebar.getByText('Programmes', { exact: true })).toBeVisible();
    await page.mouse.move(900, 500);
    await expect.poll(width, { timeout: 3000 }).toBeCloseTo(76, 0);
    await expect.poll(labelOpacity, { timeout: 3000 }).toBe(0);
  });

  test('a student session cookie alone does not open the admin console', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'nsedu_student', value: 'student-session', url: baseURL }]);
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\?next=%2Fadmin%2Fdashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back');
  });

  test('a forged admin cookie passes the route guard but the API rejects it and returns to sign-in', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'nsedu_admin', value: 'forged-token', url: baseURL }]);
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\?next=%2Fadmin%2Fdashboard$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back');
    await expect(page.getByRole('complementary', { name: 'Admin navigation' })).toHaveCount(0);
  });
});
