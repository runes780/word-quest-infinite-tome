import { expect, test } from 'playwright/test';

test('cold start offers a local quest without opening AI settings', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.removeItem('word-quest-settings');
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/demo');

    await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Local practice is ready' })).toBeVisible();
    await expect(page.getByText(/nothing is sent to an AI provider/i)).toBeVisible();

    await page.getByRole('button', { name: 'Start local quest' }).click();

    await expect(page.locator('h3').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start voice answer' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Merchant:/ })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    await page.getByRole('button', { name: 'waters', exact: true }).click();

    const result = page.getByRole('status');
    await expect(result).toContainText(/Correct answer/i);
    await expect(result).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Next Level' })).toBeInViewport();
});
