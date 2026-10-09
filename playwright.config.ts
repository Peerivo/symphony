import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', workers: 1, retries: 0, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:34391', launchOptions: process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}, trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: { command: 'node .next/standalone/server.js', url: 'http://127.0.0.1:34391/api/health', reuseExistingServer: false,
    env: { HOSTNAME: '127.0.0.1', PORT: '34391', APP_ORIGIN: 'http://127.0.0.1:34391', QUESTION_INTAKE_ENABLED: 'false', RELEASE_SHA: 'local-e2e' } },
});
