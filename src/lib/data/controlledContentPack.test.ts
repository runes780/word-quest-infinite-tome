import { LEARNING_OBJECTIVES } from './learningObjectives';
import {
    CONTROLLED_CONTENT_ITEMS,
    getControlledProbeItem,
    getControlledPracticeItems,
    getControlledTransferItem
} from './controlledContentPack';

describe('controlled content pack', () => {
    test('covers every reviewed objective with practice and two non-identical probes', () => {
        LEARNING_OBJECTIVES.forEach((objective) => {
            const family = CONTROLLED_CONTENT_ITEMS.filter((item) => item.learningObjectiveId === objective.objectiveId);
            expect(family.map((item) => item.variantRole).sort()).toEqual(['day-1', 'day-7', 'practice']);
            expect(new Set(family.map((item) => item.contextId)).size).toBe(3);
            expect(new Set(family.map((item) => item.question)).size).toBe(3);
        });
    });

    test('derives a reviewed new-context transfer item without changing the answer key', () => {
        const transfer = getControlledTransferItem('reading_detail');
        expect(transfer).toEqual(expect.objectContaining({
            reviewerStatus: 'system-reviewed',
            assessmentRole: 'transfer',
            transferDistance: 'near',
            supportLevel: 0
        }));
        expect(transfer?.options[transfer.correct_index]).toBe(transfer?.correctAnswer);
    });

    test('keeps all content synthetic, reviewable, and single-answer', () => {
        CONTROLLED_CONTENT_ITEMS.forEach((item) => {
            expect(item.reviewerStatus).toBe('system-reviewed');
            expect(item.reviewNotes).toContain('Synthetic');
            expect(item.options).toHaveLength(4);
            expect(item.options[item.correct_index]).toBe(item.correctAnswer);
            expect(item.sourceContextSpan).toBeTruthy();
            expect(JSON.stringify(item)).not.toMatch(/email|school id|guardian phone/i);
        });
    });

    test('selects an equivalent probe without reusing the original context', () => {
        const practice = getControlledPracticeItems('present_simple', 1)[0];
        const probe = getControlledProbeItem({
            objectiveId: 'present_simple',
            itemFamilyId: practice.itemFamilyId as string,
            equivalenceGroup: practice.equivalenceGroup as string,
            originalContextId: practice.contextId,
            stage: 'day-1'
        });
        expect(probe).toEqual(expect.objectContaining({
            assessmentRole: 'delayed-probe',
            probeStage: 'day-1',
            supportLevel: 0
        }));
        expect(probe?.contextId).not.toBe(practice.contextId);
        expect(probe?.question).not.toBe(practice.question);
    });
});
