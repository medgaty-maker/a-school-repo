import { test, expect } from '@playwright/test';
import mockVideos from '../fixtures/top-videos.json' assert { type: 'json' };

test.use({ storageState: '.auth/admin.json' });

test('показывает фейковое видео без реального YouTube-синка', async ({ page }) => {
  await page.route('**/api/integrations/youtube/top-videos**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockVideos),
    });
  });

  await page.goto('/overview');

  const mockedTitle = page.getByText('МОЙ ТЕСТОВЫЙ МОК');
  await expect(mockedTitle).toHaveCount(2);
  await expect(mockedTitle.first()).toBeVisible();
});
