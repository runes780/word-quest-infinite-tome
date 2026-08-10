'use client';

import { useRef, useState } from 'react';
import { DatabaseBackup, Download, Loader2, RefreshCw, Upload } from 'lucide-react';
import {
    BACKUP_TABLE_COUNT,
    MAX_BACKUP_JSON_CHARS,
    createIndexedDBBackup,
    parseBackupJson,
    restoreIndexedDBBackup,
    serializeBackup,
    summarizeBackup
} from '@/db/backup';
import type { Language } from '@/store/settingsStore';

interface LocalDataBackupProps {
    language: Language;
}

type BackupAction = 'export' | 'restore' | null;

function backupFileName(createdAt: number): string {
    return `word-quest-backup-${new Date(createdAt).toISOString().slice(0, 10)}.json`;
}

export function LocalDataBackup({ language }: LocalDataBackupProps) {
    const isZh = language === 'zh';
    const inputRef = useRef<HTMLInputElement>(null);
    const [action, setAction] = useState<BackupAction>(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [needsReload, setNeedsReload] = useState(false);

    const handleExport = async () => {
        const confirmed = window.confirm(isZh
            ? '备份包含完整学习历史、题目和错题文本，可能含隐私信息。请勿公开分享。继续创建备份吗？'
            : 'This backup contains full learning history, question text, and mistakes and may be private. Do not share it publicly. Create the backup?');
        if (!confirmed) return;

        setAction('export');
        setMessage('');
        setError('');
        try {
            const backup = await createIndexedDBBackup();
            const summary = summarizeBackup(backup);
            const blob = new Blob([serializeBackup(backup)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = backupFileName(backup.createdAt);
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            setMessage(isZh
                ? `已创建本地备份：${summary.rowCount} 条记录。请妥善保管。`
                : `Local backup created with ${summary.rowCount} records. Keep it private.`);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : String(caught));
        } finally {
            setAction(null);
        }
    };

    const handleRestoreFile = async (file?: File) => {
        if (!file) return;
        setAction('restore');
        setMessage('');
        setError('');
        setNeedsReload(false);
        try {
            if (file.size > MAX_BACKUP_JSON_CHARS) {
                throw new Error(isZh ? '备份文件超过 50 MB 限制。' : 'Backup file exceeds the 50 MB limit.');
            }
            const backup = parseBackupJson(await file.text());
            const summary = summarizeBackup(backup);
            const confirmed = window.confirm(isZh
                ? `将用备份中的 ${summary.rowCount} 条记录替换当前全部 IndexedDB 学习数据。此操作不可撤销，是否继续？`
                : `Replace all current IndexedDB learning data with ${summary.rowCount} records from this backup? This cannot be undone.`);
            if (!confirmed) {
                setMessage(isZh ? '已取消恢复，当前数据未改变。' : 'Restore cancelled. Current data was not changed.');
                return;
            }

            await restoreIndexedDBBackup(backup);
            setNeedsReload(true);
            setMessage(isZh
                ? `已恢复 ${summary.rowCount} 条记录。请立即重新加载应用后再继续学习。`
                : `Restored ${summary.rowCount} records. Reload the app before continuing.`);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : String(caught));
        } finally {
            if (inputRef.current) inputRef.current.value = '';
            setAction(null);
        }
    };

    return (
        <section className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3" aria-labelledby="local-data-backup-title">
            <div className="flex items-center gap-2">
                <DatabaseBackup className="h-4 w-4 text-amber-600" />
                <h3 id="local-data-backup-title" className="text-sm font-semibold text-foreground">
                    {isZh ? '本地学习数据备份' : 'Local learning-data backup'}
                </h3>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
                {isZh
                    ? `备份覆盖 ${BACKUP_TABLE_COUNT} 张 IndexedDB 表，包含完整学习记录，属于隐私敏感文件；不包含 API Key、主题或本地会话快照。恢复前会校验版本和全部表，并在单个事务中替换数据。`
                    : `The backup covers all ${BACKUP_TABLE_COUNT} IndexedDB tables and contains full learning records, so treat it as private. It excludes API keys, theme, and local session snapshots. Restore validates the version and every table before one transactional replacement.`}
            </p>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={handleExport}
                    disabled={action !== null}
                    className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground disabled:opacity-50"
                >
                    {action === 'export' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {isZh ? '创建私密备份' : 'Create private backup'}
                </button>
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={action !== null}
                    className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-xs font-medium text-foreground disabled:opacity-50"
                >
                    {action === 'restore' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {isZh ? '校验并恢复' : 'Validate and restore'}
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    aria-label={isZh ? '选择 Word Quest 备份文件' : 'Choose a Word Quest backup file'}
                    onChange={(event) => void handleRestoreFile(event.target.files?.[0])}
                />
                {needsReload && (
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                    >
                        <RefreshCw className="h-4 w-4" />
                        {isZh ? '立即重新加载' : 'Reload now'}
                    </button>
                )}
            </div>
            <div aria-live="polite" className="min-h-4 text-xs">
                {error ? <p className="text-destructive">{error}</p> : message ? <p className="text-muted-foreground">{message}</p> : null}
            </div>
        </section>
    );
}
