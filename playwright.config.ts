import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for the sv-grid E2E suite. Tests live in `tests/e2e/`
 * and target the website's demo routes (vite dev server on port 5180).
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
  // Capped, not `undefined` (which is half the logical cores, 7 here). The
  // suite runs against a Vite DEV server that compiles each demo on first
  // request, so more workers than this just queue up behind the same
  // transform and tests start failing on a 30s `page.goto` timeout. Which
  // test loses the race varies run to run, which reads as flakiness.
  workers: process.env.CI ? 1 : 4,
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
    // The specs navigate to `/sv-grid/#/demos/<id>`, which is a WEBSITE route,
    // not the example gallery (`pnpm dev`, port 5174, served at `/`). So start
    // the website's dev server, which vite.config.ts already pins to 5180, and
    // set the base it expects. `env` rather than an inline `VAR=x` prefix:
    // the command runs through cmd.exe on Windows, which has no such syntax.
    //
    // Note `website/` is a private submodule, so this suite only runs on a
    // checkout that has it. It is not part of CI for that reason.
    command: 'pnpm --filter svgrid-website dev',
    env: { SVGRID_SITE_BASE: '/sv-grid/' },
    url: 'http://localhost:5180/sv-grid/',
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
