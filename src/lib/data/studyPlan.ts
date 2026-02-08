import type { StudyActionStatus } from '@/db/db';

export interface StudyPlanItemSnapshot {
    id: string;
    title: string;
    estimatedMinutes: number;
}

export interface StudyPlanCompletionRow {
    id: string;
    title: string;
    estimatedMinutes: number;
    status: StudyActionStatus;
}

export interface StudyPlanCompletionSnapshot {
    totalActions: number;
    completedActions: number;
    skippedActions: number;
    pendingActions: number;
    plannedMinutes: number;
    completedMinutes: number;
    rows: StudyPlanCompletionRow[];
}

export function computeStudyPlanCompletionSnapshot(
    items: StudyPlanItemSnapshot[],
    statusById: Record<string, StudyActionStatus>
): StudyPlanCompletionSnapshot {
    const rows = items.map((item) => {
        const status = statusById[item.id] || 'pending';
        return {
            id: item.id,
            title: item.title,
            estimatedMinutes: item.estimatedMinutes,
            status
        };
    });

    const completedActions = rows.filter((row) => row.status === 'completed').length;
    const skippedActions = rows.filter((row) => row.status === 'skipped').length;
    const pendingActions = rows.filter((row) => row.status === 'pending').length;
    const plannedMinutes = rows.reduce((sum, row) => sum + row.estimatedMinutes, 0);
    const completedMinutes = rows
        .filter((row) => row.status === 'completed')
        .reduce((sum, row) => sum + row.estimatedMinutes, 0);

    return {
        totalActions: rows.length,
        completedActions,
        skippedActions,
        pendingActions,
        plannedMinutes,
        completedMinutes,
        rows
    };
}
