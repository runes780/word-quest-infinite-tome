import { defineConfig, devices } from 'playwright/test';

const e2ePort = 3100;
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
    testDir: './tests/browser',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: e2eBaseUrl,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure'
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],
    webServer: {
        command: `npm run start -- --hostname 127.0.0.1 --port ${e2ePort}`,
        url: `${e2eBaseUrl}/demo`,
        // A release gate must never run against an unrelated local service that
        // happens to occupy the configured port. Fail loudly on a conflict.
        reuseExistingServer: false,
        timeout: 120_000
    }
});
