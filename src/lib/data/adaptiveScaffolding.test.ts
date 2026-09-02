import {
    buildScaffoldFadingSummary,
    decideAdaptiveScaffold,
    scaffoldDecisionMessage,
    type ScaffoldEvidenceRecord
} from './adaptiveScaffolding';

const answer = (overrides: Partial<ScaffoldEvidenceRecord> = {}): ScaffoldEvidenceRecord => ({
    eventType: 'answer',
    learningObjectiveId: 'vocab_context_meaning',
    skillTag: 'vocab_core',
    isCorrect: true,
    supportLevel: 3,
    attemptKind: 'practice',
    hintUsed: false,
    ...overrides
});

describe('adaptive scaffolding', () => {
    test('requires two no-hint successes at the same level before fading one step', () => {
        const first = decideAdaptiveScaffold({ current: answer() });
        const second = decideAdaptiveScaffold({
            current: answer(),
            priorEvidence: [answer()]
        });

        expect(first).toEqual(expect.objectContaining({
            transition: 'hold',
            reason: 'collect-more-evidence',
            nextSupportLevel: 3
        }));
        expect(second).toEqual(expect.objectContaining({
            transition: 'fade',
            reason: 'stable-success',
            nextSupportLevel: 2
        }));
    });

    test('does not reuse higher-support success to fade a newly reached level', () => {
        const decision = decideAdaptiveScaffold({
            current: answer({ supportLevel: 2 }),
            priorEvidence: [answer({ supportLevel: 3 }), answer({ supportLevel: 3 })]
        });

        expect(decision.reason).toBe('collect-more-evidence');
        expect(decision.nextSupportLevel).toBe(2);
        expect(decision.evidence.consecutiveNoHintSuccessesAtLevel).toBe(1);
    });

    test('hint use keeps support even when the answer is correct', () => {
        const decision = decideAdaptiveScaffold({
            current: answer({ supportLevel: 1, hintUsed: true }),
            priorEvidence: [answer({ supportLevel: 1 })]
        });

        expect(decision).toEqual(expect.objectContaining({
            transition: 'increase',
            reason: 'hint-dependence',
            nextSupportLevel: 2,
            nextAttemptKind: 'practice'
        }));
    });

    test('two independent successes open transfer while a transfer failure only requests repair', () => {
        const ready = decideAdaptiveScaffold({
            current: answer({ supportLevel: 1 }),
            priorEvidence: [answer({ supportLevel: 1 })]
        });
        const failedTransfer = decideAdaptiveScaffold({
            current: answer({ isCorrect: false, result: 'wrong', supportLevel: 0, attemptKind: 'transfer' }),
            priorEvidence: [answer({ supportLevel: 1 }), answer({ supportLevel: 1 })]
        });

        expect(ready).toEqual(expect.objectContaining({
            transition: 'transfer',
            reason: 'transfer-ready',
            nextSupportLevel: 0
        }));
        expect(failedTransfer).toEqual(expect.objectContaining({
            transition: 'repair',
            reason: 'transfer-repair',
            nextSupportLevel: 2,
            nextAttemptKind: 'practice'
        }));
        expect(scaffoldDecisionMessage(failedTransfer, 'en')).toContain('not an ability verdict');
    });

    test('repair success keeps partial support rather than counting as fade evidence', () => {
        const decision = decideAdaptiveScaffold({
            current: answer({ isImmediateRepair: true, supportLevel: 3 }),
            priorEvidence: [answer({ isCorrect: false, result: 'wrong', supportLevel: 1 })]
        });

        expect(decision).toEqual(expect.objectContaining({
            transition: 'hold',
            reason: 'repair-confirmation',
            nextSupportLevel: 2
        }));
    });

    test('summarizes support, hints, transitions, and transfer separately', () => {
        const summary = buildScaffoldFadingSummary([
            answer({ supportLevel: 3, hintUsed: true }),
            answer({ supportLevel: 2, scaffoldTransition: 'fade', scaffoldReason: 'stable-success' }),
            answer({ supportLevel: 1 }),
            answer({ supportLevel: 0, attemptKind: 'transfer', scaffoldReason: 'transfer-confirmed' }),
            answer({ supportLevel: 0, attemptKind: 'transfer', isCorrect: false, result: 'wrong', scaffoldTransition: 'repair' })
        ]);

        expect(summary).toEqual(expect.objectContaining({
            answerCount: 5,
            supportedAttempts: 2,
            independentAttempts: 1,
            hintUsedAnswers: 1,
            hintDependencyRate: 0.2,
            fadedSteps: 1,
            repairSteps: 1,
            transferAttempts: 2,
            transferCorrect: 1,
            transferAccuracy: 0.5
        }));
    });
});
