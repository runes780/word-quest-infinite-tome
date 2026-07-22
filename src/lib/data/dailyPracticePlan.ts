import {
    db,
    getDueCardsWithPriority,
    getPlayerProfile,
    getWeeklyLearningTasks
} from '@/db/db';
import type {
    FSRSCard,
    GlobalPlayerProfile,
    LearningTask,
    MistakeRecord,
    ObjectiveMasteryRecord
} from '@/db/db';
import {
    AttemptKind,
    LearningObjectiveId,
    SupportLevel,
    getLearningObjective,
    isKnownObjectiveId,
    mapSkillTagToObjectiveId,
    objectiveTitle,
    selectSupportLevelForMastery
} from './learningObjectives';

export type PracticePlanStepType = 'review' | 'practice' | 'transfer';
export type PracticePlanEvidenceSource = 'srs' | 'mistake' | 'mastery' | 'task' | 'starter';

export interface PracticePlanEvidence {
    label: string;
    value: string;
    source: PracticePlanEvidenceSource;
}

export interface PracticePlanStep {
    id: string;
    type: PracticePlanStepType;
    title: string;
    objectiveId: LearningObjectiveId;
    skillTag?: string;
    estimatedMinutes: number;
    questionCount: number;
    supportLevel: SupportLevel;
    attemptKind: AttemptKind;
    rationale: string;
    evidence: PracticePlanEvidence[];
}

export interface PracticePlan {
    planId: string;
    title: string;
    estimatedMinutes: number;
    steps: PracticePlanStep[];
    rationale: string;
    evidence: PracticePlanEvidence[];
    generatedAt: number;
}

export interface BuildDailyPracticePlanInput {
    masteryRecords: ObjectiveMasteryRecord[];
    dueCards: FSRSCard[];
    recentMistakes: MistakeRecord[];
    learningTasks: LearningTask[];
    profile?: GlobalPlayerProfile | null;
    now?: number;
}

const MAX_MINUTES = 15;

function stepId(type: PracticePlanStepType, objectiveId: LearningObjectiveId) {
    return `${type}_${objectiveId}`;
}

function countByObjectiveFromDueCards(cards: FSRSCard[], now: number) {
    const buckets = new Map<LearningObjectiveId, { count: number; skillTag?: string; overdueMs: number }>();
    cards.forEach((card) => {
        const objectiveId = isKnownObjectiveId(card.learningObjectiveId)
            ? card.learningObjectiveId
            : mapSkillTagToObjectiveId({ skillTag: card.skillTag, type: card.type });
        if (!objectiveId) return;
        const current = buckets.get(objectiveId) || { count: 0, skillTag: card.skillTag, overdueMs: 0 };
        current.count += 1;
        current.skillTag ||= card.skillTag;
        current.overdueMs += Math.max(0, now - card.due);
        buckets.set(objectiveId, current);
    });
    return Array.from(buckets.entries())
        .sort((a, b) => b[1].count - a[1].count || b[1].overdueMs - a[1].overdueMs);
}

function countByObjectiveFromMistakes(records: MistakeRecord[]) {
    const buckets = new Map<LearningObjectiveId, { count: number; skillTag?: string; causeTag?: string; latest: number }>();
    records.forEach((record) => {
        const objectiveId = mapSkillTagToObjectiveId({
            skillTag: record.skillTag || record.mentorCauseTag,
            type: record.type
        });
        if (!objectiveId) return;
        const current = buckets.get(objectiveId) || {
            count: 0,
            skillTag: record.skillTag,
            causeTag: record.mentorCauseTag,
            latest: 0
        };
        current.count += 1;
        current.skillTag ||= record.skillTag;
        current.causeTag ||= record.mentorCauseTag;
        current.latest = Math.max(current.latest, record.timestamp || 0);
        buckets.set(objectiveId, current);
    });
    return Array.from(buckets.entries())
        .sort((a, b) => b[1].count - a[1].count || b[1].latest - a[1].latest);
}

function activeTaskEvidence(tasks: LearningTask[]): PracticePlanEvidence[] {
    return tasks
        .filter((task) => task.status === 'active')
        .slice(0, 2)
        .map((task) => ({
            label: 'Questline',
            value: `${task.title}: ${task.progress}/${task.goal}`,
            source: 'task' as const
        }));
}

function masteryAccuracy(row: ObjectiveMasteryRecord) {
    const attempts = row.qualifiedAttempts || 0;
    return attempts > 0 ? (row.qualifiedCorrect || 0) / attempts : 0;
}

export function getPrerequisiteReadiness(
    objectiveId: LearningObjectiveId,
    masteryRecords: ObjectiveMasteryRecord[]
): { ready: boolean; missing: LearningObjectiveId[] } {
    const objective = getLearningObjective(objectiveId);
    if (!objective || objective.prerequisites.length === 0) return { ready: true, missing: [] };
    const byObjective = new Map(masteryRecords.map((row) => [row.objectiveId, row]));
    const missing = objective.prerequisites.filter((prerequisiteId) => {
        const row = byObjective.get(prerequisiteId);
        const prerequisite = getLearningObjective(prerequisiteId);
        if (!row || !prerequisite) return true;
        return !(
            (row.state === 'consolidated' || row.state === 'mastered') &&
            row.score >= prerequisite.masteryThreshold.score &&
            (row.independentAttempts || 0) >= prerequisite.evidenceRequirements.minimumIndependentAttempts
        );
    });
    return { ready: missing.length === 0, missing };
}

function buildStarterPlan(now: number): PracticePlan {
    const steps: PracticePlanStep[] = [
        {
            id: 'starter_vocab_context_meaning',
            type: 'practice',
            title: 'Build vocabulary meaning',
            objectiveId: 'vocab_context_meaning',
            skillTag: 'vocab_core',
            estimatedMinutes: 5,
            questionCount: 3,
            supportLevel: 3,
            attemptKind: 'diagnostic',
            rationale: 'Use guided choices to collect the first learning signals.',
            evidence: [{ label: 'Starter path', value: 'No local learning evidence yet', source: 'starter' }]
        },
        {
            id: 'starter_reading_detail',
            type: 'practice',
            title: 'Find reading details',
            objectiveId: 'reading_detail',
            skillTag: 'reading_detail',
            estimatedMinutes: 4,
            questionCount: 2,
            supportLevel: 3,
            attemptKind: 'practice',
            rationale: 'Reading details create evidence for later inference work.',
            evidence: [{ label: 'Starter path', value: 'Adaptive baseline before local evidence', source: 'starter' }]
        },
        {
            id: 'starter_independent_check',
            type: 'practice',
            title: 'Try one independent recall',
            objectiveId: 'vocab_context_meaning',
            skillTag: 'vocab_core',
            estimatedMinutes: 3,
            questionCount: 1,
            supportLevel: 1,
            attemptKind: 'practice',
            rationale: 'A small same-context recall step collects independent evidence before transfer is unlocked.',
            evidence: [{ label: 'Starter path', value: 'Keeps first session under 15 minutes', source: 'starter' }]
        }
    ];

    return {
        planId: `daily_${new Date(now).toISOString().slice(0, 10)}_starter`,
        title: 'Today\'s Learning Path',
        estimatedMinutes: steps.reduce((sum, step) => sum + step.estimatedMinutes, 0),
        steps,
        rationale: 'starter plan for the first local learning session',
        evidence: [{ label: 'Starter path', value: 'No due cards, mistakes, or mastery records found', source: 'starter' }],
        generatedAt: now
    };
}

function pushUniqueStep(steps: PracticePlanStep[], step: PracticePlanStep) {
    const existing = steps.find((candidate) => candidate.id === step.id);
    if (!existing) {
        steps.push(step);
        return true;
    }

    const seenEvidence = new Set(existing.evidence.map((row) => `${row.source}:${row.label}:${row.value}`));
    step.evidence.forEach((row) => {
        const key = `${row.source}:${row.label}:${row.value}`;
        if (seenEvidence.has(key)) return;
        seenEvidence.add(key);
        existing.evidence.push(row);
    });
    return false;
}

export function buildDailyPracticePlan(input: BuildDailyPracticePlanInput): PracticePlan {
    const now = input.now ?? Date.now();
    const evidence: PracticePlanEvidence[] = [];
    const steps: PracticePlanStep[] = [];

    if (input.dueCards.length === 0 && input.recentMistakes.length === 0 && input.masteryRecords.length === 0) {
        return buildStarterPlan(now);
    }

    const dueObjective = countByObjectiveFromDueCards(input.dueCards, now)[0];
    if (dueObjective) {
        const [objectiveId, data] = dueObjective;
        const questionCount = Math.min(5, Math.max(2, data.count));
        const stepEvidence = {
            label: 'Due review',
            value: `${data.count} card${data.count === 1 ? '' : 's'} due for ${objectiveTitle(objectiveId)}`,
            source: 'srs' as const
        };
        evidence.push(stepEvidence);
        pushUniqueStep(steps, {
            id: stepId('review', objectiveId),
            type: 'review',
            title: `Review ${objectiveTitle(objectiveId)}`,
            objectiveId,
            skillTag: data.skillTag,
            estimatedMinutes: Math.min(6, Math.max(4, questionCount)),
            questionCount,
            supportLevel: 3,
            attemptKind: 'review',
            rationale: 'Due FSRS cards have the highest risk of forgetting, so they come first.',
            evidence: [stepEvidence]
        });
    }

    const mistakeObjective = countByObjectiveFromMistakes(input.recentMistakes)[0];
    if (mistakeObjective) {
        const [objectiveId, data] = mistakeObjective;
        const stepEvidence = {
            label: 'Recent mistake',
            value: `${data.count} recent signal${data.count === 1 ? '' : 's'}${data.causeTag ? `: ${data.causeTag}` : ''}`,
            source: 'mistake' as const
        };
        evidence.push(stepEvidence);
        pushUniqueStep(steps, {
            id: stepId('practice', objectiveId),
            type: 'practice',
            title: `Fix ${objectiveTitle(objectiveId)}`,
            objectiveId,
            skillTag: data.skillTag,
            estimatedMinutes: 4,
            questionCount: Math.min(4, Math.max(2, data.count + 1)),
            supportLevel: 2,
            attemptKind: 'practice',
            rationale: 'Recent mistakes return with scaffolding before support is removed.',
            evidence: [stepEvidence]
        });
    }

    const learningMastery = [...input.masteryRecords]
        .filter((row) => row.state === 'learning' || (row.state === 'new' && row.attempts >= 2))
        .sort((a, b) => a.score - b.score || masteryAccuracy(a) - masteryAccuracy(b))[0];
    if (learningMastery && steps.length < 3) {
        const readiness = getPrerequisiteReadiness(learningMastery.objectiveId, input.masteryRecords);
        const objectiveId = readiness.missing[0] || learningMastery.objectiveId;
        const stepEvidence = {
            label: readiness.ready ? 'Objective evidence' : 'Prerequisite gate',
            value: readiness.ready
                ? `${objectiveTitle(learningMastery.objectiveId)} is ${learningMastery.state} at ${learningMastery.score}% with ${learningMastery.independentAttempts || 0} independent attempts`
                : `${objectiveTitle(objectiveId)} comes before ${objectiveTitle(learningMastery.objectiveId)}`,
            source: 'mastery' as const
        };
        evidence.push(stepEvidence);
        pushUniqueStep(steps, {
            id: stepId('practice', objectiveId),
            type: 'practice',
            title: `Consolidate ${objectiveTitle(objectiveId)}`,
            objectiveId,
            estimatedMinutes: 4,
            questionCount: 3,
            supportLevel: readiness.ready ? selectSupportLevelForMastery(learningMastery) : 3,
            attemptKind: 'practice',
            rationale: readiness.ready
                ? 'Learning-state objectives need short, focused repetition.'
                : 'The next knowledge component stays locked until its prerequisite has enough independent evidence.',
            evidence: [stepEvidence]
        });
    }

    const transferMastery = [...input.masteryRecords]
        .filter((row) => {
            const objective = getLearningObjective(row.objectiveId);
            if (!objective || (row.state !== 'consolidated' && row.state !== 'mastered')) return false;
            return (row.independentAttempts || 0) >= objective.evidenceRequirements.minimumIndependentAttempts &&
                getPrerequisiteReadiness(row.objectiveId, input.masteryRecords).ready;
        })
        .sort((a, b) => b.score - a.score || b.attempts - a.attempts)[0];
    if (transferMastery) {
        const objectiveId = transferMastery.objectiveId;
        const stepEvidence = {
            label: 'Transfer ready',
            value: `${objectiveTitle(objectiveId)} has ${transferMastery.independentAttempts || 0} independent attempts and its prerequisites are ready`,
            source: 'mastery' as const
        };
        evidence.push(stepEvidence);
        pushUniqueStep(steps, {
            id: stepId('transfer', objectiveId),
            type: 'transfer',
            title: `Transfer ${objectiveTitle(objectiveId)}`,
            objectiveId,
            estimatedMinutes: 3,
            questionCount: 2,
            supportLevel: Math.min(1, selectSupportLevelForMastery(transferMastery)) as SupportLevel,
            attemptKind: 'transfer',
            rationale: 'A new-context check is unlocked only after enough independent evidence and prerequisite readiness.',
            evidence: [stepEvidence]
        });
    }

    if (steps.length === 0) {
        return buildStarterPlan(now);
    }

    const taskEvidence = activeTaskEvidence(input.learningTasks);
    evidence.push(...taskEvidence);

    let minuteBudget = 0;
    const boundedSteps = steps.filter((step) => {
        if (minuteBudget + step.estimatedMinutes > MAX_MINUTES) return false;
        minuteBudget += step.estimatedMinutes;
        return true;
    });

    return {
        planId: `daily_${new Date(now).toISOString().slice(0, 10)}`,
        title: 'Today\'s Learning Path',
        estimatedMinutes: boundedSteps.reduce((sum, step) => sum + step.estimatedMinutes, 0),
        steps: boundedSteps,
        rationale: 'Uses due review, recent mistakes, mastery state, and active questline evidence to choose a 10-15 minute path.',
        evidence,
        generatedAt: now
    };
}

export async function getDailyPracticePlan(now = Date.now()): Promise<PracticePlan> {
    const cutoff = now - 14 * 24 * 60 * 60 * 1000;
    const [masteryRecords, dueCards, recentMistakes, learningTasks, profile] = await Promise.all([
        db.objectiveMastery.toArray(),
        getDueCardsWithPriority(12),
        db.mistakes
            .where('timestamp')
            .aboveOrEqual(cutoff)
            .reverse()
            .limit(20)
            .toArray(),
        getWeeklyLearningTasks(now),
        getPlayerProfile().catch(() => null)
    ]);

    return buildDailyPracticePlan({
        masteryRecords,
        dueCards,
        recentMistakes,
        learningTasks,
        profile,
        now
    });
}
