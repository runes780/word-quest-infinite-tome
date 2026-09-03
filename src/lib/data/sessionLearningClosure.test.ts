import { buildSessionLearningClosure } from './sessionLearningClosure';
import { supportLevelLabel } from './learningObjectives';

describe('session learning closure evidence', () => {
    test('summarizes objective evidence with transfer and next action signals', () => {
        const closure = buildSessionLearningClosure([
            {
                questionId: 1,
                questionText: 'Choose the meaning of bright.',
                userChoice: 'clear',
                correctChoice: 'clear',
                isCorrect: true,
                learningObjectiveId: 'vocab_context_meaning',
                attemptKind: 'practice',
                supportLevel: 2,
                causeTag: 'context_clue'
            },
            {
                questionId: 2,
                questionText: 'Use bright in a new sentence.',
                userChoice: 'bright',
                correctChoice: 'bright',
                isCorrect: true,
                learningObjectiveId: 'vocab_context_meaning',
                attemptKind: 'transfer',
                supportLevel: 0,
                evidenceStrength: 'transfer-independent'
            },
            {
                questionId: 3,
                questionText: 'Find the cause.',
                userChoice: 'The bird was tired.',
                correctChoice: 'Winter was coming.',
                isCorrect: false,
                learningObjectiveId: 'reading_inference',
                attemptKind: 'practice',
                supportLevel: 2,
                causeTag: 'cause_effect'
            }
        ], 'en');

        expect(closure.objectiveEvidence).toHaveLength(2);
        expect(closure.objectiveEvidence[0]).toEqual(expect.objectContaining({
            objectiveId: 'vocab_context_meaning',
            title: 'Vocabulary in Context',
            correct: 2,
            total: 2,
            transferCorrect: 1,
            state: 'transfer-ready',
            nextAction: 'Try a fresh context without hints.'
        }));
        expect(closure.objectiveEvidence[1]).toEqual(expect.objectContaining({
            objectiveId: 'reading_inference',
            correct: 0,
            total: 1,
            state: 'needs-repair',
            nextAction: 'Repair the mistake pattern before moving on.'
        }));
        expect(closure.headline).toBe('1 objective secured with transfer evidence');
        expect(closure.followUp).toBe('Repair Reading Inference, then continue today\'s path.');
    });

    test('does not infer transfer evidence from a no-hint answer without transfer-independent strength', () => {
        const closure = buildSessionLearningClosure([
            {
                questionId: 1,
                questionText: 'Choose the meaning of bright.',
                userChoice: 'clear',
                correctChoice: 'clear',
                isCorrect: true,
                learningObjectiveId: 'vocab_context_meaning',
                attemptKind: 'practice',
                supportLevel: 0,
                evidenceStrength: 'independent'
            },
            {
                questionId: 2,
                questionText: 'Fill the blank: the box was ___ (empty).',
                userChoice: 'empty',
                correctChoice: 'empty',
                isCorrect: true,
                learningObjectiveId: 'vocab_context_meaning',
                attemptKind: 'practice',
                supportLevel: 0
            }
        ], 'zh');

        const objective = closure.objectiveEvidence[0];
        expect(objective.transferAttempts).toBe(0);
        expect(objective.transferCorrect).toBe(0);
        expect(objective.state).not.toBe('transfer-ready');
        expect(supportLevelLabel(0, 'zh')).toBe('无提示独立作答');
        expect(supportLevelLabel(0, 'en')).toBe('independent, no hints');
    });

    test('an unreviewed or same-context transfer attempt is not counted as transfer evidence', () => {
        const closure = buildSessionLearningClosure([
            {
                questionId: 1,
                questionText: 'Use bright in a new sentence.',
                userChoice: 'bright',
                correctChoice: 'bright',
                isCorrect: true,
                learningObjectiveId: 'vocab_context_meaning',
                attemptKind: 'transfer',
                supportLevel: 0
            },
            {
                questionId: 2,
                questionText: 'Use bright in another new sentence.',
                userChoice: 'bright',
                correctChoice: 'bright',
                isCorrect: true,
                learningObjectiveId: 'vocab_context_meaning',
                attemptKind: 'transfer',
                supportLevel: 0,
                evidenceStrength: 'no-credit'
            }
        ], 'en');

        const objective = closure.objectiveEvidence[0];
        expect(objective.transferAttempts).toBe(0);
        expect(objective.transferCorrect).toBe(0);
        expect(objective.state).not.toBe('transfer-ready');
    });
});
