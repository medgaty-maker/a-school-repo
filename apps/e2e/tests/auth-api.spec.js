import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:4100';

test('should login successfully', async ({ request }) => {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: 'admin@a-school.kz', password: 'changeme123' },
  });
  expect(response.status()).toBe(200);
  const responseBody = await response.json();
  expect(responseBody).toHaveProperty('accessToken');
  expect(responseBody).toHaveProperty('user');
  expect(responseBody.user).toHaveProperty('email', 'admin@a-school.kz');
  console.log(responseBody);
});

test('should fail login with invalid credentials', async ({ request }) => {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: 'invalid@example.com', password: 'wrongpassword' },
  });
  const responseBody = await response.json();
  expect(response.status()).toBe(401);
  expect(responseBody).toHaveProperty('message', 'Invalid credentials');
  console.log(responseBody);
});