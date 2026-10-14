import { defineConfig } from '@playwright/test';
// PLAYWRIGHT_PORT lets tests target a dev server other than the default :3000.
const port = process.env.PLAYWRIGHT_PORT || '3000';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  timeout: 60000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    launchOptions: { channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx next dev --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
