import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
    createIndexedDBBackup,
    parseBackupJson,
    restoreIndexedDBBackup,
    serializeBackup,
    summarizeBackup
} from '@/db/backup';
import { LocalDataBackup } from './LocalDataBackup';

jest.mock('@/db/backup', () => ({
    BACKUP_TABLE_COUNT: 14,
    MAX_BACKUP_JSON_CHARS: 50 * 1024 * 1024,
    createIndexedDBBackup: jest.fn(),
    parseBackupJson: jest.fn(),
    restoreIndexedDBBackup: jest.fn(),
    serializeBackup: jest.fn(),
    summarizeBackup: jest.fn()
}));

const syntheticBackup = {
    format: 'word-quest-indexeddb-backup',
    formatVersion: 1,
    schemaVersion: 14,
    createdAt: Date.parse('2026-07-15T08:00:00Z'),
    tables: {}
};

describe('LocalDataBackup', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(window, 'confirm').mockReturnValue(true);
        jest.mocked(createIndexedDBBackup).mockResolvedValue(syntheticBackup as never);
        jest.mocked(parseBackupJson).mockReturnValue(syntheticBackup as never);
        jest.mocked(restoreIndexedDBBackup).mockResolvedValue({
            schemaVersion: 14,
            createdAt: syntheticBackup.createdAt,
            tableCount: 14,
            rowCount: 3
        });
        jest.mocked(serializeBackup).mockReturnValue('{"synthetic":true}');
        jest.mocked(summarizeBackup).mockReturnValue({
            schemaVersion: 14,
            createdAt: syntheticBackup.createdAt,
            tableCount: 14,
            rowCount: 3
        });
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: jest.fn(() => 'blob:synthetic-backup')
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: jest.fn()
        });
        jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('warns before exporting and downloads a generic private-backup filename', async () => {
        render(<LocalDataBackup language="en" />);

        fireEvent.click(screen.getByRole('button', { name: 'Create private backup' }));

        await waitFor(() => expect(createIndexedDBBackup).toHaveBeenCalledTimes(1));
        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Do not share it publicly'));
        expect(serializeBackup).toHaveBeenCalledWith(syntheticBackup);
        expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Local backup created with 3 records. Keep it private.')).toBeInTheDocument();
    });

    test('validates and confirms before replacing data, then requires a reload', async () => {
        render(<LocalDataBackup language="en" />);
        const file = new File(['{"synthetic":true}'], 'private.json', { type: 'application/json' });
        Object.defineProperty(file, 'text', {
            value: jest.fn(async () => '{"synthetic":true}')
        });

        fireEvent.change(screen.getByLabelText('Choose a Word Quest backup file'), {
            target: { files: [file] }
        });

        await waitFor(() => expect(restoreIndexedDBBackup).toHaveBeenCalledWith(syntheticBackup));
        expect(parseBackupJson).toHaveBeenCalledWith('{"synthetic":true}');
        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('cannot be undone'));
        expect(screen.getByText('Restored 3 records. Reload the app before continuing.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reload now' })).toBeInTheDocument();
    });

    test('does not touch IndexedDB when backup validation fails', async () => {
        jest.mocked(parseBackupJson).mockImplementation(() => {
            throw new Error('Invalid Word Quest backup: schema version is newer than supported');
        });
        render(<LocalDataBackup language="en" />);
        const file = new File(['{}'], 'future.json', { type: 'application/json' });
        Object.defineProperty(file, 'text', { value: jest.fn(async () => '{}') });

        fireEvent.change(screen.getByLabelText('Choose a Word Quest backup file'), {
            target: { files: [file] }
        });

        expect(await screen.findByText(/newer than supported/)).toBeInTheDocument();
        expect(restoreIndexedDBBackup).not.toHaveBeenCalled();
    });
});
