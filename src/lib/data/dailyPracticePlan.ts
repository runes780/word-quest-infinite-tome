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
    SkillMasteryRecord
} from '@/db/db';
import {
    AttemptKind,
    LearningObjectiveId,
    SupportLevel,
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
    masteryRecords: SkillMasteryRecord[];
    dueCards: FSRSCard[];
    recentMistakes: MistakeRecord[];
    learningTasks: LearningTask[];
    profile?: GlobalPlayerProfile | null;
    now?: number;
}

const MAX_MINUTES = 15;

function compactSkill(skillTag?: string) {
    return (skillTag || 'core_skill').replace(/[:\s]+/g, '_');
}

function stepId(type: PracticePlanStepType, objectiveId: LearningObjectiveId, skillTag?: string) {
    return `${type}_${objectiveId}_${compactSkill(skillTag)}`;
}

function countByObjectiveFromDueCards(cards: FSRSCard[], now: number) {
    const buckets = new Map<LearningObjectiveId, { count: number; skillTag?: string; overdueMs: number }>();
    cards.forEach((card) => {
        const objectiveId = mapSkillTagToObjectiveId({
            skillTag: card.skillTag,
            type: card.type
        });
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

function masteryAccuracy(row: SkillMasteryRecord) {
    return row.attempts > 0 ? row.correct / row.attempts : 0;
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
            evidence: [{ label: 'Starter path', value: 'Recommended Grade 5 baseline', source: 'starter' }]
        },
        {
            id: 'starter_transfer',
            type: 'transfer',
            title: 'Try one independent recall',
            objectiveId: 'vocab_context_meaning',
            skillTag: 'vocab_core',
            estimatedMinutes: 3,
            questionCount: 1,
            supportLevel: 1,
            attemptKind: 'transfer',
            rationale: 'A small recall step checks whether the learner can move beyond recognition.',
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
        steps.push({
            id: stepId('review', objectiveId, data.skillTag),
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
        steps.push({
            id: stepId('practice', objectiveId, data.skillTag || data.causeTag),
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
        const objectiveId = mapSkillTagToObjectiveId({ skillTag: learningMastery.skillTag });
        const stepEvidence = {
            label: 'Mastery',
            value: `${learningMastery.skillTag} is ${learningMastery.state} at ${learningMastery.score}%`,
            source: 'mastery' as const
        };
        evidence.push(stepEvidence);
        steps.push({
            id: stepId('practice', objectiveId, learningMastery.skillTag),
            type: 'practice',
            title: `Consolidate ${objectiveTitle(objectiveId)}`,
            objectiveId,
            skillTag: learningMastery.skillTag,
            estimatedMinutes: 4,
            questionCount: 3,
            supportLevel: selectSupportLevelForMastery(learningMastery),
            attemptKind: 'practice',
            rationale: 'Learning-state objectives need short, focused repetition.',
            evidence: [stepEvidence]
        });
    }

    const transferMastery = [...input.masteryRecords]
        .filter((row) => row.state === 'consolidated' || row.state === 'mastered' || row.score >= 68)
        .sort((a, b) => b.score - a.score || b.attempts - a.attempts)[0];
    if (transferMastery) {
        const objectiveId = mapSkillTagToObjectiveId({ skillTag: transferMastery.skillTag });
        const stepEvidence = {
            label: 'Transfer ready',
            value: `${transferMastery.skillTag} is ${transferMastery.state} at ${transferMastery.score}%`,
            source: 'mastery' as const
        };
        evidence.push(stepEvidence);
        steps.push({
            id: stepId('transfer', objectiveId, transferMastery.skillTag),
            type: 'transfer',
            title: `Transfer ${objectiveTitle(objectiveId)}`,
            objectiveId,
            skillTag: transferMastery.skillTag,
            estimatedMinutes: 3,
            questionCount: 2,
            supportLevel: Math.min(1, selectSupportLevelForMastery(transferMastery)) as SupportLevel,
            attemptKind: 'transfer',
            rationale: 'Near-mastered skills should be checked through productive recall or a new context.',
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
        db.skillMastery.toArray(),
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
