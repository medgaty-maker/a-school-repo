import { chromium } from '@playwright/test';

async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:3100/login');
  await page.getByLabel('Email').fill(process.env.ADMIN_EMAIL || 'admin@a-school.kz');
  await page.getByLabel('Пароль').fill(process.env.ADMIN_PASSWORD || 'changeme123');
  await page.getByRole('button', { name: 'Войти' }).click();

  await page.waitForURL('**/overview');
  await page.context().storageState({ path: '.auth/admin.json' });
  await browser.close();
}

export default globalSetup;