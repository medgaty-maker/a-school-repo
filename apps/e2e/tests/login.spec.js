import { test, expect } from '@playwright/test';

// QA-101: Проверить флоу авторизации в Marketing Dashboard
//
// Acceptance criteria:
// 1. Успешный логин с валидными данными админа -> редирект на /overview
// 2. Логин с неверным паролем -> остаёмся на /login, видим сообщение об ошибке

const ADMIN_EMAIL = 'admin@a-school.kz';
const ADMIN_PASSWORD = 'changeme123';

test('успешный логин с валидными данными', async ({ page }) => {
  // 1. Перейди на /login (baseURL уже настроен, можно относительный путь)
await page.goto('/login');
  // 2. Заполни email через getByLabel('Email').fill('...')
  //    (на странице есть <label htmlFor="email">Email</label>, связанный с полем)
await page.getByLabel('Email').fill(ADMIN_EMAIL);
  // 3. Заполни пароль через getByLabel('Пароль').fill('...')
await page.getByLabel('Пароль').fill(ADMIN_PASSWORD);
  // 4. Кликни кнопку через getByRole('button', { name: 'Войти' }).click()
await page.getByRole('button', { name: 'Войти' }).click();
  // 5. Проверь редирект: await expect(page).toHaveURL(/.*overview/)
await expect(page).toHaveURL(/.*overview/);
});

test('логин с неверным паролем показывает ошибку', async ({ page }) => {
  // 1. Перейди на /login
await page.goto('/login');
  // 2. Email правильный, пароль - заведомо неверный
await page.getByLabel('Email').fill(ADMIN_EMAIL);
await page.getByLabel('Пароль').fill('wrongpassword123');
  // 3. Кликни "Войти"
await page.getByRole('button', {name: 'Войти'}).click();
  // 4. Проверь, что URL НЕ поменялся на /overview (остались на /login)
await expect(page).not.toHaveURL(/.*overview/);
  // 5. Проверь текст ошибки на странице
  //    (сервер бросает 'Invalid credentials' - см. auth.service.ts)
  await expect(page.getByText('Invalid credentials')).toBeVisible();
});