import { test, expect } from '@playwright/test';

test.use({ storageState: '.auth/admin.json' });

test('видит дашборд без логина', async ({ page }) => {
  await page.goto('/overview');
  await expect(page.getByText('Топ-5 видео по охвату')).toBeVisible();
});