import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for the sv-grid E2E suite. Tests live in `tests/e2e/`
 * and target the demos gallery (vite dev server on port 5180).
 *
 * Coverage focus: things jsdom CAN'T do reliably:
 *   - Real drag-and-drop pointer sequences (column reorder, row reorder)
 *   - position: sticky measurement after a scroll
 *   - Focus management across keyboard navigation
 *
 * Run:  pnpm test:e2e
 * Run with UI:  pnpm test:e2e --ui
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:5180',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Reuses the gallery's existing dev server. Start with the
    // workspace's `pnpm dev` (it filters to the example gallery).
    command: 'pnpm dev',
    url: 'http://localhost:5180/sv-grid/',
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
