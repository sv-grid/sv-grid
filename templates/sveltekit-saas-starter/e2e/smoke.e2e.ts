import { expect, test, type Page } from '@playwright/test';

// One pass through the paths every change could break: sign-up, the editable
// projects grid, the plan gate's numbers, and the server-sorted admin grid.
// Runs against `npm run build && npm run preview` on the seeded PGlite database.

async function signIn(page: Page, email: string, password: string) {
	await page.goto('/login');
	await page.getByRole('textbox', { name: 'Email' }).fill(email);
	await page.locator('input[type=password]').fill(password);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await page.waitForURL('**/dashboard');
}

test('a new account signs up, lands on the dashboard and creates a project', async ({ page }) => {
	const email = `e2e-${Date.now()}@example.com`;
	await page.goto('/register');
	await page.getByRole('textbox', { name: 'Name' }).fill('E2E Person');
	await page.getByRole('textbox', { name: 'Email' }).fill(email);
	await page.locator('input[type=password]').fill('e2e-password-1');
	await page.getByRole('button', { name: 'Create account' }).click();
	await page.waitForURL('**/dashboard');
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

	await page.getByRole('link', { name: 'Projects' }).click();
	await expect(page.getByText('No projects yet')).toBeVisible();
	await page.getByRole('button', { name: 'New project' }).first().click();
	// The new row opens with its name editor focused.
	const editor = page.locator('[role=grid] input').first();
	await expect(editor).toBeFocused();
	await editor.fill('Launch plan');
	await editor.press('Enter');
	await expect(page.getByRole('status')).toHaveText('Saved');

	await page.reload();
	await expect(page.getByRole('gridcell', { name: 'Launch plan' })).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toContainText('1 of 15 on Free');
});

test('a normal user is kept out of the admin area', async ({ page }) => {
	await signIn(page, 'user@example.com', 'starter-user-1');
	await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
	const res = await page.goto('/admin/users');
	expect(res?.status()).toBe(403);
});

test('the admin users grid sorts and pages on the server', async ({ page }) => {
	await signIn(page, 'admin@example.com', 'starter-admin-1');
	await page.getByRole('link', { name: 'Users' }).click();
	await page.waitForURL('**/admin/users');

	await page.getByRole('columnheader', { name: 'Name' }).click();
	await expect(page).toHaveURL(/sort=name&dir=asc/);
	const names = await page.locator('[role=row] [role=gridcell]:nth-child(2)').allInnerTexts();
	const sorted = [...names].sort((a, b) => a.localeCompare(b));
	expect(names.length).toBeGreaterThan(5);
	expect(names).toEqual(sorted);

	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page).toHaveURL(/page=1/);
	await expect(page.getByText(/^Page 2 of \d+$/)).toBeVisible();
});

test('billing without Stripe keys explains the setup', async ({ page }) => {
	await signIn(page, 'user@example.com', 'starter-user-1');
	await page.goto('/billing');
	await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible();
	test.skip((await page.getByText('Billing is not set up').count()) === 0, 'Stripe keys are set in .env');
	await expect(page.getByRole('button', { name: /Upgrade to Pro/ })).toBeDisabled();
});
