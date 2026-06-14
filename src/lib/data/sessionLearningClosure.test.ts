import { buildSessionLearningClosure } from './sessionLearningClosure';

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
                supportLevel: 0
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
});
