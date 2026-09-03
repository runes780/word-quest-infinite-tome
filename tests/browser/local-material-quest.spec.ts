import { expect, test, type Page } from 'playwright/test';

/**
 * Local material quest: a learner pastes their own English material with no AI
 * key configured, confirms the learning brief, and completes a full battle
 * whose questions are all grounded in that material. No provider request is
 * made, and the fixed fallback bank never supplies questions.
 */

const SYNTHETIC_MATERIAL =
    'Yesterday was Sunday. Mia went to the park with her friends. ' +
    'They played football under a big tree. The weather was sunny and warm. ' +
    'She shared her sandwiches because everyone was hungry. ' +
    'Later they walked beside the river and watched the birds.';

const MATERIAL_SENTENCES = SYNTHETIC_MATERIAL.split(/(?<=[.!?])\s+/);

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every local question blanks one word inside a quoted material span, so the
 * keyed answer can be recovered deterministically by matching the blanked span
 * back against the original sentence.
 */
function answerForQuestion(questionText: string): string {
    const quoted = questionText.match(/"([^"]+)"/)?.[1] ?? '';
    const parts = quoted.split(/_{3}/);
    if (parts.length < 2) return 'went';
    const pattern = new RegExp(parts.map(escapeRegex).join("([A-Za-z']+)"), 'i');
    for (const sentence of MATERIAL_SENTENCES) {
        const match = sentence.match(pattern);
        if (match?.[1]) return match[1];
    }
    return 'went';
}

async function readEvidenceCounts(page: Page) {
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

test('local material quest completes without an AI key and stays grounded in the material', async ({ page }) => {
    test.setTimeout(90_000);
    let providerRequests = 0;
    await page.route(/api\.(deepseek|openai)\.com|openrouter\.ai/, async (route) => {
        providerRequests += 1;
        await route.abort();
    });

    await page.goto('/demo');
    await page.evaluate(() => {
        for (const key of Object.keys(localStorage)) {
            if (/api|key|provider|model/i.test(key)) localStorage.removeItem(key);
        }
    });
    await page.reload();

    const composer = page.getByRole('group', { name: 'Learning material composer' });
    await composer.locator('textarea').fill(SYNTHETIC_MATERIAL);

    const cta = page.getByRole('button', { name: 'Start local quest from this material' });
    await expect(cta).toBeVisible();
    await cta.click();

    // Learning brief: grounded targets with source sentences; remove one target
    // and assert its word is never tested.
    const brief = page.getByRole('group', { name: 'Learning brief' });
    await expect(brief).toBeVisible();
    await expect(brief.getByText(/Material language: English/i)).toBeVisible();
    const removeButton = brief.getByRole('button', { name: 'Remove target' }).first();
    const removedWord = ((await removeButton.locator('..').locator('span.font-black').first().textContent()) ?? '').trim().toLowerCase();
    await removeButton.click();
    await brief.getByRole('button', { name: 'Start quest' }).click();

    // Battle starts with material-grounded questions (no blessing step).
    await expect(page.locator('h3.text-2xl').first()).toBeVisible({ timeout: 10_000 });

    const seenQuestions: string[] = [];
    const victoryHeading = page.getByRole('heading', { name: 'Mission Accomplished' });

    for (let index = 0; index < 12; index += 1) {
        // After each answer, either the next question or the victory report appears.
        await Promise.race([
            page.locator('h3.text-2xl').first().waitFor({ state: 'visible', timeout: 15_000 }),
            victoryHeading.waitFor({ state: 'visible', timeout: 15_000 })
        ]);
        if (await victoryHeading.count()) break;

        const heading = page.locator('h3.text-2xl').first();
        const questionText = ((await heading.textContent()) ?? '').trim();
        if (!questionText || seenQuestions.includes(questionText)) break;
        seenQuestions.push(questionText);

        // Every question embeds a quoted span from the learner's material; the
        // blank stands for exactly one material word.
        const quoted = questionText.match(/"([^"]+)"/);
        expect(quoted, `Question without a quoted material span: ${questionText}`).toBeTruthy();
        const spanPattern = new RegExp(escapeRegex(quoted![1]).replace(/_{3}/g, "\\s*[A-Za-z']+\\s*"), 'i');
        expect(spanPattern.test(SYNTHETIC_MATERIAL), `Span not grounded in material: ${quoted![1]}`).toBe(true);
        expect(questionText).not.toMatch(/^Transfer check:/i);

        const answer = answerForQuestion(questionText);
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

    // The removed target was deselected in the brief and must not be tested.
    if (removedWord.length >= 4) {
        for (const question of seenQuestions) {
            expect(question.toLowerCase()).not.toContain(`"${removedWord}"`);
        }
    }

    await expect(victoryHeading).toBeVisible({ timeout: 15_000 });

    await expect.poll(() => readEvidenceCounts(page), { timeout: 10_000 }).toMatchObject({
        learningEvents: expect.any(Number),
        fsrsCards: expect.any(Number),
        history: expect.any(Number)
    });
    const counts = await readEvidenceCounts(page);
    expect(counts.learningEvents).toBeGreaterThanOrEqual(seenQuestions.length);
    expect(counts.fsrsCards).toBeGreaterThanOrEqual(1);
    expect(counts.history).toBeGreaterThanOrEqual(1);

    expect(providerRequests).toBe(0);
});
