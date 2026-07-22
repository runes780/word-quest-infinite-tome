import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { WordQuestDB } from './db';

if (!globalThis.structuredClone) {
    globalThis.structuredClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
}

describe('evidence model schema migration', () => {
    test('adds v15 evidence counters conservatively and never preserves unsupported mastery', async () => {
        const name = `WordQuestEvidenceMigration-${Date.now()}-${Math.random()}`;
        try {
            const legacy = new Dexie(name);
            legacy.version(14).stores({
                objectiveMastery: '++id, objectiveId, state, score, updatedAt, nextReviewAt'
            });
            await legacy.open();
            await legacy.table('objectiveMastery').add({
                objectiveId: 'present_simple',
                score: 92,
                state: 'mastered',
                attempts: 12,
                correct: 11,
                attemptsByMode: { choice: 8, 'fill-blank': 2, typing: 2 },
                transferAttempts: 2,
                transferCorrect: 2,
                hintCount: 1,
                hintRate: 1 / 12,
                lastReviewedAt: 100,
                nextReviewAt: 200,
                confidence: 0.9,
                updatedAt: 100
            });
            legacy.close();

            const upgraded = new WordQuestDB(name);
            await upgraded.open();
            const row = await upgraded.objectiveMastery.get(1);
            expect(row).toEqual(expect.objectContaining({
                state: 'consolidated',
                qualifiedAttempts: 0,
                qualifiedCorrect: 0,
                independentAttempts: 0,
                delayedProbeAttempts: 0,
                delayedProbeCorrect: 0,
                evidenceModelVersion: 1
            }));
            expect(upgraded.tables.map((table) => table.name)).toContain('contentReviews');
            upgraded.close();
            await upgraded.delete();
        } catch (error) {
            const details = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
            throw new Error(`evidence migration failed: ${details}`);
        }
    });
});
