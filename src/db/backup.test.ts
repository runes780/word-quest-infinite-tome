import 'fake-indexeddb/auto';

if (!globalThis.structuredClone) {
    globalThis.structuredClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
}

import { WordQuestDB } from './db';
import {
    BACKUP_FORMAT,
    BACKUP_FORMAT_VERSION,
    BACKUP_TABLE_COUNT,
    BACKUP_TABLES,
    createIndexedDBBackup,
    parseBackupJson,
    restoreIndexedDBBackup,
    serializeBackup,
    summarizeBackup,
    validateBackupPayload,
    type BackupTables,
    type WordQuestBackup
} from './backup';

function emptyTables(): BackupTables {
    return Object.fromEntries(BACKUP_TABLES.map((tableName) => [tableName, []])) as BackupTables;
}

function currentBackup(tables: Partial<BackupTables> = {}): WordQuestBackup {
    return {
        format: BACKUP_FORMAT,
        formatVersion: BACKUP_FORMAT_VERSION,
        schemaVersion: 15,
        createdAt: Date.parse('2026-07-15T08:00:00Z'),
        tables: { ...emptyTables(), ...tables }
    };
}

describe('IndexedDB backup and restore', () => {
    let database: WordQuestDB;

    beforeEach(() => {
        database = new WordQuestDB(`WordQuestBackupTest-${Date.now()}-${Math.random()}`);
    });

    afterEach(async () => {
        database.close();
        await database.delete();
        localStorage.clear();
    });

    test('round-trips every schema table without including localStorage credentials', async () => {
        await database.open();
        expect(database.tables.map((table) => table.name).sort()).toEqual([...BACKUP_TABLES].sort());
        for (const [index, tableName] of BACKUP_TABLES.entries()) {
            await database.table(tableName).add({ id: index + 1, marker: `synthetic-${tableName}` });
        }
        localStorage.setItem('word-quest-settings', JSON.stringify({ apiKey: 'synthetic-secret-not-for-backup' }));

        const createdAt = Date.parse('2026-07-15T08:00:00Z');
        const backup = await createIndexedDBBackup(database, createdAt);
        const json = serializeBackup(backup);

        expect(json).not.toContain('synthetic-secret-not-for-backup');
        expect(summarizeBackup(backup)).toEqual({
            schemaVersion: 15,
            createdAt,
            tableCount: BACKUP_TABLE_COUNT,
            rowCount: BACKUP_TABLE_COUNT
        });

        for (const tableName of BACKUP_TABLES) await database.table(tableName).clear();
        await restoreIndexedDBBackup(parseBackupJson(json), database);

        for (const tableName of BACKUP_TABLES) {
            await expect(database.table(tableName).count()).resolves.toBe(1);
            await expect(database.table(tableName).toArray()).resolves.toEqual([
                expect.objectContaining({ marker: `synthetic-${tableName}` })
            ]);
        }
    });

    test('restores schema v13 backups and initializes v14 tables as empty', async () => {
        const legacyTables = emptyTables() as Record<string, unknown>;
        legacyTables.history = [{ id: 7, timestamp: 1, score: 10, totalQuestions: 1, levelTitle: 'Synthetic' }];
        delete legacyTables.objectiveMastery;
        delete legacyTables.practicePlanRuns;
        delete legacyTables.contentReviews;

        const legacy = validateBackupPayload({
            format: BACKUP_FORMAT,
            formatVersion: BACKUP_FORMAT_VERSION,
            schemaVersion: 13,
            createdAt: Date.parse('2026-06-01T00:00:00Z'),
            tables: legacyTables
        });

        expect(legacy.tables.objectiveMastery).toEqual([]);
        expect(legacy.tables.practicePlanRuns).toEqual([]);
        expect(legacy.tables.contentReviews).toEqual([]);
        await restoreIndexedDBBackup(legacy, database);

        await expect(database.history.get(7)).resolves.toEqual(expect.objectContaining({ levelTitle: 'Synthetic' }));
        await expect(database.objectiveMastery.count()).resolves.toBe(0);
        await expect(database.practicePlanRuns.count()).resolves.toBe(0);
        await expect(database.contentReviews.count()).resolves.toBe(0);
    });

    test('round-trips optional confidence, reward, and scaffold evidence without a schema index migration', async () => {
        await database.learningEvents.add({
            eventType: 'answer',
            source: 'battle',
            result: 'correct',
            attemptKind: 'transfer',
            selfConfidence: 'high',
            progressRewardKind: 'transfer-success',
            rewardXp: 18,
            rewardGold: 10,
            rewardCounted: true,
            hintUsed: false,
            scaffoldTransition: 'transfer',
            scaffoldReason: 'transfer-ready',
            nextSupportLevel: 0,
            nextAttemptKind: 'transfer',
            timestamp: Date.parse('2026-07-15T08:00:00Z')
        });

        const backup = await createIndexedDBBackup(database, Date.parse('2026-07-15T09:00:00Z'));
        await database.learningEvents.clear();
        await restoreIndexedDBBackup(backup, database);

        await expect(database.learningEvents.toArray()).resolves.toEqual([
            expect.objectContaining({
                result: 'correct',
                selfConfidence: 'high',
                progressRewardKind: 'transfer-success',
                rewardXp: 18,
                rewardGold: 10,
                rewardCounted: true,
                hintUsed: false,
                scaffoldTransition: 'transfer',
                scaffoldReason: 'transfer-ready',
                nextSupportLevel: 0,
                nextAttemptKind: 'transfer'
            })
        ]);
    });

    test('rejects future, unknown, and malformed backups before changing current data', async () => {
        await database.history.add({
            timestamp: 1,
            score: 20,
            totalQuestions: 2,
            levelTitle: 'Existing synthetic history'
        });

        expect(() => validateBackupPayload({ ...currentBackup(), schemaVersion: 99 }))
            .toThrow('newer than supported');
        expect(() => validateBackupPayload({
            ...currentBackup(),
            tables: { ...emptyTables(), unexpectedPrivateTable: [] }
        })).toThrow('unknown table');
        expect(() => validateBackupPayload({
            ...currentBackup(),
            tables: { ...emptyTables(), history: ['not-an-object'] }
        })).toThrow('non-object row');
        expect(() => parseBackupJson('{not json')).toThrow('not valid JSON');

        await expect(restoreIndexedDBBackup({ ...currentBackup(), schemaVersion: 99 }, database))
            .rejects.toThrow('newer than supported');
        await expect(database.history.count()).resolves.toBe(1);
        await expect(database.history.toArray()).resolves.toEqual([
            expect.objectContaining({ levelTitle: 'Existing synthetic history' })
        ]);
    });

    test('requires every table that existed in the source schema', () => {
        const tables = emptyTables() as Record<string, unknown>;
        delete tables.learningEvents;

        expect(() => validateBackupPayload({
            ...currentBackup(),
            tables
        })).toThrow('required table learningEvents is missing');
    });
});
