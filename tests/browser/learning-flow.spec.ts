import { expect, test, type Page } from 'playwright/test';
import { SYNTHETIC_FALLBACK_ANSWERS, SYNTHETIC_STUDY_MATERIAL } from '../fixtures/syntheticLearning';

async function readLearningCounts(page: Page) {
    return page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('WordQuestDB');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const tableNames = ['learningEvents', 'fsrsCards', 'history'] as const;
        const transaction = db.transaction([...tableNames], 'readonly');
        const count = (tableName: typeof tableNames[number]) => new Promise<number>((resolve, reject) => {
            const request = transaction.objectStore(tableName).count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const [learningEvents, fsrsCards, history] = await Promise.all(tableNames.map(count));
        db.close();
        return { learningEvents, fsrsCards, history };
    });
}

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('word-quest-settings', JSON.stringify({
            state: {
                apiKey: 'synthetic-e2e-key',
                apiProvider: 'deepseek',
                model: 'deepseek-v4-flash',
                language: 'en',
                theme: 'light',
                soundEnabled: false,
                ttsEnabled: false
            },
            version: 1
        }));
    });
});

test('offline mission fallback completes battle, persists evidence, and exposes SRS', async ({ page }) => {
    test.setTimeout(60_000);
    let providerRequests = 0;
    await page.route('https://api.deepseek.com/**', async (route) => {
        providerRequests += 1;
        await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: { message: 'synthetic E2E rejection' } })
        });
    });

    await page.goto('/demo');
    const composer = page.getByRole('group', { name: 'Learning material composer' });
    await composer.locator('textarea').fill(SYNTHETIC_STUDY_MATERIAL);
    await page.getByRole('button', { name: 'Initialize Mission' }).click();

    await expect(page.getByRole('dialog', { name: 'Choose Your Blessing' })).toBeVisible();
    expect(providerRequests).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Skip', exact: true }).click();

    for (let questionNumber = 0; questionNumber < SYNTHETIC_FALLBACK_ANSWERS.length; questionNumber += 1) {
        const questionHeading = page.locator('h3.text-2xl').first();
        await expect(questionHeading).toBeVisible();
        const question = (await questionHeading.textContent()) ?? '';
        const matchingAnswer = SYNTHETIC_FALLBACK_ANSWERS.find(([fragment]) => question.includes(fragment));
        expect(matchingAnswer, `No synthetic answer mapping for: ${question}`).toBeTruthy();
        const answer = matchingAnswer![1];

        const textInput = page.locator('input[type="text"]:visible');
        if (await textInput.count()) {
            await textInput.fill(answer);
            await page.getByRole('button', { name: 'Submit Answer' }).click();
        } else {
            await page.getByRole('button', { name: answer, exact: true }).click();
        }

        const next = page.getByRole('button', { name: 'Next Level' });
        await expect(next).toBeVisible({ timeout: 6_000 });
        await next.click();
    }

    await expect(page.getByRole('heading', { name: 'Mission Accomplished' })).toBeVisible();
    await expect(page.getByText('Learning Evidence Snapshot')).toBeVisible();

    await expect.poll(() => readLearningCounts(page), { timeout: 10_000 }).toMatchObject({
        learningEvents: expect.any(Number),
        fsrsCards: expect.any(Number),
        history: expect.any(Number)
    });
    const counts = await readLearningCounts(page);
    expect(counts.learningEvents).toBeGreaterThanOrEqual(SYNTHETIC_FALLBACK_ANSWERS.length);
    expect(counts.fsrsCards).toBeGreaterThanOrEqual(SYNTHETIC_FALLBACK_ANSWERS.length);
    expect(counts.history).toBeGreaterThanOrEqual(1);

    await page.getByRole('button', { name: 'Initialize New Mission' }).click();
    await page.getByRole('button', { name: 'SRS Review' }).first().click();
    const reviewDialog = page.getByRole('dialog', { name: 'Review Dashboard' });
    await expect(reviewDialog).toBeVisible();
    await expect(reviewDialog).toContainText('FSRS Spaced Repetition');
});
