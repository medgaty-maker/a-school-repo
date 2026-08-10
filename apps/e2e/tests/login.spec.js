import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

const API_URL = process.env.API_URL || 'http://localhost:4100';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@a-school.kz';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

let loginPage;

test.beforeEach(async ({ page }) => {
  loginPage = new LoginPage(page);
  await loginPage.goto();
});

test('should login successfully', async ({ page }) => {
    await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL('/overview');
});

test('should show error message with invalid credentials', async ({ page }) => {
  await loginPage.login(ADMIN_EMAIL, 'wrongpassword');
  await expect(page).toHaveURL('/login');
  await expect(loginPage.errorMessage()).toBeVisible();
});