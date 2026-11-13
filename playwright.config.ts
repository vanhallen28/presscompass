import { defineConfig, devices } from '@playwright/test';

// E2E runs against a production build and a fake Supabase (tests/fake-supabase/server.mjs): fake Auth
// plus a Data API that runs real SQL on a fresh local PostgreSQL database, so no Supabase project is needed.
const PORT = 3100;
const MOCK_SUPABASE_PORT = 3101;
const E2E_ENV = {
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_SUPABASE_PORT}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e',
  // The fake Supabase treats any sb_secret_ key as service_role (the cron endpoint needs it).
  SUPABASE_SECRET_KEY: 'sb_secret_e2e',
  // The fake Supabase also plays Cloudinary (tests/fake-supabase/cloudinary.mjs): signed uploads, Admin API, delivery.
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'demo',
  NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL: `http://127.0.0.1:${MOCK_SUPABASE_PORT}/fake-cloudinary`,
  CLOUDINARY_API_URL: `http://127.0.0.1:${MOCK_SUPABASE_PORT}/fake-cloudinary`,
  CLOUDINARY_API_KEY: 'fake-key',
  CLOUDINARY_API_SECRET: 'fake-secret',
  // Lets the tests call /api/cron/run and /api/revalidate (data seeded with SQL bypasses the Newsroom).
  CRON_SECRET: 'e2e-cron-secret-that-is-long-enough-1234',
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Locally you may point at an installed Chrome: PW_CHROME_PATH=/usr/bin/google-chrome
    launchOptions: process.env.PW_CHROME_PATH ? { executablePath: process.env.PW_CHROME_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node tests/fake-supabase/server.mjs',
      port: MOCK_SUPABASE_PORT,
      reuseExistingServer: false,
      env: { FAKE_SUPABASE_PORT: String(MOCK_SUPABASE_PORT), FAKE_DATABASE_NAME: 'presscompass_e2e' },
    },
    {
      command: `npm run build && npm run start -- --port ${PORT}`,
      url: `http://localhost:${PORT}`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: E2E_ENV,
    },
  ],
});
