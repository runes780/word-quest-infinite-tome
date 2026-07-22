import type { Table } from 'dexie';
import { CURRENT_DB_SCHEMA_VERSION, db, type WordQuestDB } from './db';

export const BACKUP_FORMAT = 'word-quest-indexeddb-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const MAX_BACKUP_JSON_CHARS = 50 * 1024 * 1024;
export const MAX_BACKUP_ROWS = 100_000;

export const BACKUP_TABLES = [
    'history',
    'mistakes',
    'questionCache',
    'fsrsCards',
    'playerProfile',
    'learningEvents',
    'learningTasks',
    'studyActionExecutions',
    'guardianDashboardEvents',
    'aiRequestMetrics',
    'sessionRecoveryEvents',
    'skillMastery',
    'objectiveMastery',
    'practicePlanRuns',
    'contentReviews'
] as const;
export const BACKUP_TABLE_COUNT = BACKUP_TABLES.length;

export type BackupTableName = typeof BACKUP_TABLES[number];
export type BackupRow = Record<string, unknown>;
export type BackupTables = Record<BackupTableName, BackupRow[]>;

export interface WordQuestBackup {
    format: typeof BACKUP_FORMAT;
    formatVersion: typeof BACKUP_FORMAT_VERSION;
    schemaVersion: number;
    createdAt: number;
    tables: BackupTables;
}

export interface BackupSummary {
    schemaVersion: number;
    createdAt: number;
    tableCount: number;
    rowCount: number;
}

const TABLE_INTRODUCED_AT: Record<BackupTableName, number> = {
    history: 1,
    mistakes: 1,
    questionCache: 3,
    fsrsCards: 4,
    playerProfile: 5,
    learningEvents: 6,
    skillMastery: 7,
    learningTasks: 8,
    studyActionExecutions: 9,
    guardianDashboardEvents: 10,
    aiRequestMetrics: 11,
    sessionRecoveryEvents: 12,
    objectiveMastery: 14,
    practicePlanRuns: 14,
    contentReviews: 15
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validationError(message: string): Error {
    return new Error(`Invalid Word Quest backup: ${message}`);
}

export function validateBackupPayload(payload: unknown): WordQuestBackup {
    if (!isRecord(payload)) throw validationError('root must be an object');
    if (payload.format !== BACKUP_FORMAT) throw validationError('format marker is missing or unsupported');
    if (payload.formatVersion !== BACKUP_FORMAT_VERSION) {
        throw validationError(`format version ${String(payload.formatVersion)} is unsupported`);
    }
    const schemaVersion = Number(payload.schemaVersion);
    if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
        throw validationError('schemaVersion must be a positive integer');
    }
    if (schemaVersion > CURRENT_DB_SCHEMA_VERSION) {
        throw validationError(`schema version ${schemaVersion} is newer than supported version ${CURRENT_DB_SCHEMA_VERSION}`);
    }
    const createdAt = Number(payload.createdAt);
    if (!Number.isFinite(createdAt) || createdAt <= 0) {
        throw validationError('createdAt must be a positive timestamp');
    }
    if (!isRecord(payload.tables)) throw validationError('tables must be an object');
    const rawTables = payload.tables;

    const unknownTables = Object.keys(rawTables)
        .filter((name) => !BACKUP_TABLES.includes(name as BackupTableName));
    if (unknownTables.length > 0) {
        throw validationError(`unknown table: ${unknownTables[0]}`);
    }

    let rowCount = 0;
    const tables = {} as BackupTables;
    BACKUP_TABLES.forEach((tableName) => {
        const rawRows = rawTables[tableName];
        const existedAtSourceVersion = TABLE_INTRODUCED_AT[tableName] <= schemaVersion;
        if (rawRows === undefined && existedAtSourceVersion) {
            throw validationError(`required table ${tableName} is missing`);
        }
        if (rawRows !== undefined && !Array.isArray(rawRows)) {
            throw validationError(`table ${tableName} must be an array`);
        }
        const rows = (rawRows ?? []) as unknown[];
        if (rows.some((row) => !isRecord(row))) {
            throw validationError(`table ${tableName} contains a non-object row`);
        }
        rowCount += rows.length;
        if (rowCount > MAX_BACKUP_ROWS) {
            throw validationError(`row count exceeds ${MAX_BACKUP_ROWS}`);
        }
        tables[tableName] = rows as BackupRow[];
    });

    return {
        format: BACKUP_FORMAT,
        formatVersion: BACKUP_FORMAT_VERSION,
        schemaVersion,
        createdAt,
        tables
    };
}

export function parseBackupJson(json: string): WordQuestBackup {
    if (json.length > MAX_BACKUP_JSON_CHARS) {
        throw validationError(`file exceeds ${MAX_BACKUP_JSON_CHARS} characters`);
    }
    let payload: unknown;
    try {
        payload = JSON.parse(json);
    } catch {
        throw validationError('file is not valid JSON');
    }
    return validateBackupPayload(payload);
}

export function summarizeBackup(backup: WordQuestBackup): BackupSummary {
    return {
        schemaVersion: backup.schemaVersion,
        createdAt: backup.createdAt,
        tableCount: BACKUP_TABLE_COUNT,
        rowCount: BACKUP_TABLES.reduce((total, tableName) => total + backup.tables[tableName].length, 0)
    };
}

export async function createIndexedDBBackup(
    database: WordQuestDB = db,
    now = Date.now()
): Promise<WordQuestBackup> {
    await database.open();
    const tableEntries = await Promise.all(BACKUP_TABLES.map(async (tableName) => [
        tableName,
        await database.table(tableName).toArray() as BackupRow[]
    ] as const));

    return {
        format: BACKUP_FORMAT,
        formatVersion: BACKUP_FORMAT_VERSION,
        schemaVersion: CURRENT_DB_SCHEMA_VERSION,
        createdAt: now,
        tables: Object.fromEntries(tableEntries) as BackupTables
    };
}

export function serializeBackup(backup: WordQuestBackup): string {
    return JSON.stringify(validateBackupPayload(backup), null, 2);
}

export async function restoreIndexedDBBackup(
    payload: unknown,
    database: WordQuestDB = db
): Promise<BackupSummary> {
    const backup = validateBackupPayload(payload);
    await database.open();
    const tables = BACKUP_TABLES.map((tableName) => database.table(tableName)) as Table[];

    await database.transaction('rw', tables, async () => {
        for (const tableName of BACKUP_TABLES) {
            const table = database.table(tableName);
            await table.clear();
            const rows = backup.tables[tableName];
            if (rows.length > 0) await table.bulkAdd(rows);
        }
    });

    return summarizeBackup(backup);
}
