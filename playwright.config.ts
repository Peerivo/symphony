import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
const port = Number(process.env.E2E_PORT || '34391');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid isolated E2E_PORT');
const baseURL = `http://127.0.0.1:${port}`;
const release = JSON.parse(readFileSync('.next/release.json', 'utf8')) as { revision: string };
const unavailable = process.env.E2E_WITHOUT_DATABASE === 'true';
export default defineConfig({
  testDir: './tests/e2e', workers: 1, retries: 0, timeout: 30000,
  testMatch: unavailable ? '**/unavailable.spec.ts' : '**/reading.spec.ts',
  use: { baseURL, launchOptions: process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}, trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile-small', use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 740 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: { command: 'node .next/standalone/server.js', url: `${baseURL}/api/${unavailable ? 'live' : 'health'}`, reuseExistingServer: false,
    env: { HOSTNAME: '127.0.0.1', PORT: String(port), APP_ORIGIN: baseURL, QUESTION_INTAKE_ENABLED: 'false', RELEASE_SHA: release.revision } },
});
