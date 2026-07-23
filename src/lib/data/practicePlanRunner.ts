import { db, getDueCardsWithPriority } from '@/db/db';
import type { FSRSCard, LearningEventSource, PracticePlanRunRecord } from '@/db/db';
import type { Monster } from '@/store/gameStore';
import { normalizeMissionMonsters } from './missionSanitizer';
import { buildTargetedReviewPack } from './targetedReview';
import type { PracticePlan, PracticePlanEvidence, PracticePlanStep } from './dailyPracticePlan';
import {
    getControlledPracticeItems,
    getControlledProbeItem,
    getControlledTransferItem
} from './controlledContentPack';

export interface PracticePlanRun {
    planId: string;
    title: string;
    estimatedMinutes: number;
    steps: PracticePlanStep[];
    currentStepIndex: number;
    completedStepIds: string[];
    startedAt: number;
    updatedAt: number;
}

export interface PracticePlanStepLaunch {
    monsters: Monster[];
    context: string;
    source: LearningEventSource;
    usedFallback: boolean;
}

export function createPracticePlanRun(plan: PracticePlan, now = Date.now()): PracticePlanRun {
    return {
        planId: plan.planId,
        title: plan.title,
        estimatedMinutes: plan.estimatedMinutes,
        steps: plan.steps,
        currentStepIndex: 0,
        completedStepIds: [],
        startedAt: now,
        updatedAt: now
    };
}

export function createPracticePlanRunRecord(plan: PracticePlan, now = Date.now()): PracticePlanRunRecord {
    return {
        planId: plan.planId,
        dateKey: new Date(now).toISOString().slice(0, 10),
        title: plan.title,
        status: plan.steps.length > 0 ? 'active' : 'completed',
        steps: plan.steps,
        completedStepIds: [],
        evidenceBefore: plan.evidence,
        evidenceAfter: [],
        startedAt: now,
        completedAt: plan.steps.length > 0 ? undefined : now,
        updatedAt: now
    };
}

export function completePracticePlanRunRecordStep(
    record: PracticePlanRunRecord,
    stepId: string,
    evidenceAfter: PracticePlanEvidence[] = [],
    now = Date.now()
): PracticePlanRunRecord {
    const completedStepIds = record.completedStepIds.includes(stepId)
        ? record.completedStepIds
        : [...record.completedStepIds, stepId];
    const status = completedStepIds.length >= record.steps.length ? 'completed' : 'active';
    return {
        ...record,
        status,
        completedStepIds,
        evidenceAfter: [...record.evidenceAfter, ...evidenceAfter],
        completedAt: status === 'completed' ? now : record.completedAt,
        updatedAt: now
    };
}

export async function savePracticePlanRunRecord(record: PracticePlanRunRecord): Promise<PracticePlanRunRecord> {
    const existing = await db.practicePlanRuns
        .where('[planId+dateKey]')
        .equals([record.planId, record.dateKey])
        .first();

    if (existing?.id) {
        await db.practicePlanRuns.put({ ...record, id: existing.id });
        return { ...record, id: existing.id };
    }

    const id = await db.practicePlanRuns.add(record);
    return { ...record, id };
}

export async function markPracticePlanRunStepComplete(
    planId: string,
    stepId: string,
    evidenceAfter: PracticePlanEvidence[] = [],
    now = Date.now()
): Promise<PracticePlanRunRecord | null> {
    const records = await db.practicePlanRuns
        .where('planId')
        .equals(planId)
        .toArray();
    const existing = records.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!existing) return null;
    const next = completePracticePlanRunRecordStep(existing, stepId, evidenceAfter, now);
    await db.practicePlanRuns.put({ ...next, id: existing.id });
    return { ...next, id: existing.id };
}

export function currentPracticePlanStep(run?: PracticePlanRun | null): PracticePlanStep | null {
    if (!run) return null;
    return run.steps[run.currentStepIndex] || null;
}

export function completeCurrentPracticePlanStep(run: PracticePlanRun, now = Date.now()): PracticePlanRun {
    const current = currentPracticePlanStep(run);
    if (!current) return { ...run, updatedAt: now };

    const completedStepIds = run.completedStepIds.includes(current.id)
        ? run.completedStepIds
        : [...run.completedStepIds, current.id];

    return {
        ...run,
        completedStepIds,
        currentStepIndex: Math.min(run.currentStepIndex + 1, run.steps.length),
        updatedAt: now
    };
}

export function isPracticePlanComplete(run?: PracticePlanRun | null): boolean {
    if (!run) return false;
    return run.currentStepIndex >= run.steps.length || run.completedStepIds.length >= run.steps.length;
}

export function practicePlanProgressText(run?: PracticePlanRun | null): string {
    if (!run) return '0/0';
    return `${Math.min(run.completedStepIds.length, run.steps.length)}/${run.steps.length}`;
}

function cardsToMonsters(cards: FSRSCard[], step: PracticePlanStep): Monster[] {
    return cards.map((card, idx) => ({
        id: card.id || Date.now() + idx,
        type: card.type || 'vocab',
        question: card.question,
        options: card.options,
        correct_index: card.correct_index,
        explanation: card.explanation || '',
        hint: card.hint,
        skillTag: card.skillTag || `${card.type || 'vocab'}_review`,
        difficulty: 'medium',
        questionMode: card.questionMode || 'choice',
        correctAnswer: card.correctAnswer || card.options[card.correct_index] || '',
        learningObjectiveId: card.learningObjectiveId || step.objectiveId,
        itemFamilyId: card.itemFamilyId || step.itemFamilyId,
        equivalenceGroup: card.equivalenceGroup || step.equivalenceGroup,
        assessmentRole: step.assessmentRole || card.assessmentRole,
        probeStage: step.probeStage,
        probeScheduledFor: step.probeScheduledFor,
        supportLevel: step.supportLevel,
        attemptKind: step.attemptKind,
        sourceContextSpan: card.sourceContextSpan || 'daily_plan'
    }));
}

function withStepMetadata(monsters: Monster[], step: PracticePlanStep): Monster[] {
    return normalizeMissionMonsters(monsters).map((monster) => ({
        ...monster,
        learningObjectiveId: monster.learningObjectiveId || step.objectiveId,
        itemFamilyId: step.itemFamilyId || monster.itemFamilyId,
        equivalenceGroup: step.equivalenceGroup || monster.equivalenceGroup,
        assessmentRole: step.assessmentRole || monster.assessmentRole,
        probeStage: step.probeStage || monster.probeStage,
        probeScheduledFor: step.probeScheduledFor || monster.probeScheduledFor,
        supportLevel: step.supportLevel,
        attemptKind: step.attemptKind,
        sourceContextSpan: monster.sourceContextSpan || 'daily_plan'
    }));
}

async function loadMistakeOrFallbackPack(step: PracticePlanStep): Promise<Monster[]> {
    const mistakes = await db.mistakes.orderBy('timestamp').reverse().limit(20).toArray();
    const pack = buildTargetedReviewPack({
        mistakes,
        weakestSkillTag: step.skillTag,
        desiredCount: step.questionCount
    });
    return withStepMetadata(pack.monsters, step);
}

export async function loadPracticePlanStepLaunch(step: PracticePlanStep): Promise<PracticePlanStepLaunch> {
    if (step.assessmentRole === 'delayed-probe' && step.itemFamilyId && step.equivalenceGroup && step.probeStage) {
        const probe = getControlledProbeItem({
            objectiveId: step.objectiveId,
            itemFamilyId: step.itemFamilyId,
            equivalenceGroup: step.equivalenceGroup,
            originalContextId: step.originalContextId,
            stage: step.probeStage
        });
        if (probe) {
            return {
                monsters: withStepMetadata([probe], step),
                context: `Retention Check: ${step.title}\n${step.rationale}`,
                source: 'srs',
                usedFallback: false
            };
        }
    }

    if (step.type === 'review') {
        const cards = await getDueCardsWithPriority(step.questionCount);
        if (cards.length > 0) {
            return {
                monsters: withStepMetadata(cardsToMonsters(cards, step), step),
                context: `Daily Learning Path: ${step.title}\n${step.rationale}`,
                source: 'srs',
                usedFallback: false
            };
        }
    }

    if (step.type === 'transfer') {
        const transfer = getControlledTransferItem(step.objectiveId);
        if (transfer) {
            return {
                monsters: withStepMetadata([transfer], step),
                context: `Transfer Check: ${step.title}\n${step.rationale}`,
                source: 'battle',
                usedFallback: false
            };
        }
    }

    if (step.type === 'practice') {
        const controlled = getControlledPracticeItems(step.objectiveId, step.questionCount);
        if (controlled.length > 0) {
            return {
                monsters: withStepMetadata(controlled, step),
                context: `Controlled Practice: ${step.title}\n${step.rationale}`,
                source: 'battle',
                usedFallback: false
            };
        }
    }

    const monsters = await loadMistakeOrFallbackPack(step);
    return {
        monsters,
        context: `Daily Learning Path: ${step.title}\n${step.rationale}`,
        source: step.type === 'review' ? 'srs' : 'battle',
        usedFallback: true
    };
}
