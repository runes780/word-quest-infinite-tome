import { db, getDueCardsWithPriority } from '@/db/db';
import type { FSRSCard, LearningEventSource } from '@/db/db';
import type { Monster } from '@/store/gameStore';
import { normalizeMissionMonsters } from './missionSanitizer';
import { buildTargetedReviewPack } from './targetedReview';
import type { PracticePlan, PracticePlanStep } from './dailyPracticePlan';

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
        questionMode: 'choice',
        correctAnswer: card.options[card.correct_index] || '',
        learningObjectiveId: step.objectiveId,
        supportLevel: step.supportLevel,
        attemptKind: step.attemptKind,
        sourceContextSpan: 'daily_plan'
    }));
}

function withStepMetadata(monsters: Monster[], step: PracticePlanStep): Monster[] {
    return normalizeMissionMonsters(monsters).map((monster) => ({
        ...monster,
        learningObjectiveId: step.objectiveId,
        supportLevel: step.supportLevel,
        attemptKind: step.attemptKind,
        sourceContextSpan: 'daily_plan'
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

    const monsters = await loadMistakeOrFallbackPack(step);
    return {
        monsters,
        context: `Daily Learning Path: ${step.title}\n${step.rationale}`,
        source: step.type === 'review' ? 'srs' : 'battle',
        usedFallback: true
    };
}
