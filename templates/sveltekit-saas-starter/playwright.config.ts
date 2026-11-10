import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
	testMatch: '**/*.e2e.{ts,js}',
	// The tests share one seeded database; keep them in order.
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	use: { baseURL: `http://localhost:${port}` },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		// setup-env writes .env on a fresh checkout (CI has none). Without
		// DATABASE_URL the preview creates and seeds .data/pglite on start.
		command: `node scripts/setup-env.mjs && npm run build && npm run preview -- --port ${port} --strictPort`,
		port,
		timeout: 240_000,
		reuseExistingServer: !process.env.CI,
		env: { ORIGIN: `http://localhost:${port}` }
	}
});
