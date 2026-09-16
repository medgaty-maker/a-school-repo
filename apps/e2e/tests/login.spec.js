import { test, expect } from '../fixtures';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@a-school.kz';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

test('should login successfully @smoke', async ({ page, loginPage }) => {
  await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page).toHaveURL('/overview');
});

test('should show error message with invalid credentials @smoke', async ({ page, loginPage }) => {
  await loginPage.login(ADMIN_EMAIL, 'wrongpassword');
  await expect(page).toHaveURL('/login');
  await expect(loginPage.errorMessage()).toBeVisible();
});