import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev',
    env: {
      RESOLVEOPS_DB_PATH: join(process.cwd(), 'test-results', `resolveops-e2e-${process.pid}.sqlite`),
    },
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
