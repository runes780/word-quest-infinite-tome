import type { Monster } from '@/store/gameStore';
import type { LearningObjectiveId } from './learningObjectives';
import type { RetentionProbeStage } from './learningEvidenceContract';

export const CONTROLLED_CONTENT_PACK_ID = 'daily-life-foundations';
export const CONTROLLED_CONTENT_PACK_VERSION = 1;

export interface ControlledContentItem extends Monster {
    contentPackId: string;
    contentPackVersion: number;
    variantRole: 'practice' | RetentionProbeStage;
    reviewNotes: string;
}

interface FamilyDefinition {
    objectiveId: LearningObjectiveId;
    itemFamilyId: string;
    equivalenceGroup: string;
    skillTag: string;
    type: Monster['type'];
    correctAnswer: string;
    options: string[];
    contexts: [string, string, string];
    questions: [string, string, string];
    explanations: [string, string, string];
}

const FAMILIES: FamilyDefinition[] = [
    {
        objectiveId: 'present_simple',
        itemFamilyId: 'family_present_routine_third_person',
        equivalenceGroup: 'equiv_present_routine_s',
        skillTag: 'present_simple:daily_routine',
        type: 'grammar',
        correctAnswer: 'walks',
        options: ['walks', 'walk', 'walked', 'walking'],
        contexts: [
            'Mia walks to the library every morning.',
            'Leo walks to the park every afternoon.',
            'Ava walks to the shop every Saturday.'
        ],
        questions: [
            'Read: "Mia walks to the library every morning." Complete the routine: Mia ___ to the library.',
            'Read: "Leo walks to the park every afternoon." Which verb completes the routine: Leo ___ to the park?',
            'Read: "Ava walks to the shop every Saturday." Type or choose the verb: Ava ___ to the shop.'
        ],
        explanations: [
            'Use walks with one person in a present-simple routine.',
            'Leo is one person, so the routine verb is walks.',
            'Ava is one person, so walks completes the routine.'
        ]
    },
    {
        objectiveId: 'past_tense_basic',
        itemFamilyId: 'family_past_regular_visited',
        equivalenceGroup: 'equiv_past_regular_ed',
        skillTag: 'past_tense:regular_ed',
        type: 'grammar',
        correctAnswer: 'visited',
        options: ['visited', 'visits', 'visit', 'visiting'],
        contexts: [
            'Yesterday, Mia visited the library.',
            'Last Saturday, Leo visited the museum.',
            'Two days ago, Ava visited the garden.'
        ],
        questions: [
            'Read: "Yesterday, Mia visited the library." Complete the past event: Mia ___ the library.',
            'Read: "Last Saturday, Leo visited the museum." Which verb shows the past event?',
            'Read: "Two days ago, Ava visited the garden." Complete: Ava ___ the garden.'
        ],
        explanations: [
            'Visited is the past form used with yesterday.',
            'Last Saturday signals the past, so visited is correct.',
            'Two days ago signals the past form visited.'
        ]
    },
    {
        objectiveId: 'vocab_context_meaning',
        itemFamilyId: 'family_vocab_calm_context',
        equivalenceGroup: 'equiv_calm_peaceful',
        skillTag: 'vocab_context:calm',
        type: 'vocab',
        correctAnswer: 'peaceful',
        options: ['peaceful', 'noisy', 'crowded', 'hurried'],
        contexts: [
            'The room was calm, with no loud sounds.',
            'The lake looked calm in the quiet morning.',
            'After the bell stopped, the hall became calm.'
        ],
        questions: [
            'Read: "The room was calm, with no loud sounds." What does calm mean here?',
            'Read: "The lake looked calm in the quiet morning." Which meaning fits calm?',
            'Read: "After the bell stopped, the hall became calm." What is the closest meaning of calm?'
        ],
        explanations: [
            'No loud sounds is a clue that calm means peaceful.',
            'Quiet morning supports the meaning peaceful.',
            'When the noise stops, calm means peaceful.'
        ]
    },
    {
        objectiveId: 'pronoun_reference',
        itemFamilyId: 'family_pronoun_subject_person',
        equivalenceGroup: 'equiv_she_named_person',
        skillTag: 'pronoun_reference:she',
        type: 'reading',
        correctAnswer: 'Mia',
        options: ['Mia', 'book', 'desk', 'window'],
        contexts: [
            'Mia put the book on the desk. She opened the window.',
            'Mia carried a bag to the door. She put it down.',
            'Mia found a pencil near the chair. She picked it up.'
        ],
        questions: [
            'Read: "Mia put the book on the desk. She opened the window." Who does She refer to?',
            'Read: "Mia carried a bag to the door. She put it down." Who does She refer to?',
            'Read: "Mia found a pencil near the chair. She picked it up." Who does She refer to?'
        ],
        explanations: [
            'She refers back to the person Mia.',
            'She refers to Mia, the person carrying the bag.',
            'She refers to Mia, the person who found the pencil.'
        ]
    },
    {
        objectiveId: 'preposition_place_time',
        itemFamilyId: 'family_preposition_clock_at',
        equivalenceGroup: 'equiv_at_clock_time',
        skillTag: 'preposition_time:at',
        type: 'grammar',
        correctAnswer: 'at',
        options: ['at', 'on', 'in', 'under'],
        contexts: [
            'The class starts at nine o’clock.',
            'The bus arrives at seven o’clock.',
            'The shop closes at six o’clock.'
        ],
        questions: [
            'Read: "The class starts at nine o’clock." Complete: The class starts ___ nine o’clock.',
            'Read: "The bus arrives at seven o’clock." Which preposition goes before the clock time?',
            'Read: "The shop closes at six o’clock." Complete: The shop closes ___ six o’clock.'
        ],
        explanations: [
            'Use at before a clock time.',
            'At is used with seven o’clock.',
            'At is used before six o’clock.'
        ]
    },
    {
        objectiveId: 'reading_detail',
        itemFamilyId: 'family_reading_explicit_location',
        equivalenceGroup: 'equiv_find_stated_place',
        skillTag: 'reading_detail:location',
        type: 'reading',
        correctAnswer: 'library',
        options: ['library', 'garden', 'market', 'station'],
        contexts: [
            'Mia returned the blue book to the library after lunch.',
            'Mia read the blue book in the library before dinner.',
            'Mia found the blue book beside a chair in the library.'
        ],
        questions: [
            'Read: "Mia returned the blue book to the library after lunch." Where did Mia return the book?',
            'Read: "Mia read the blue book in the library before dinner." Where did Mia read?',
            'Read: "Mia found the blue book beside a chair in the library." Where did Mia find the book?'
        ],
        explanations: [
            'The sentence directly states library.',
            'The place stated in the sentence is library.',
            'The sentence says the book was in the library.'
        ]
    },
    {
        objectiveId: 'reading_inference',
        itemFamilyId: 'family_inference_weather_umbrella',
        equivalenceGroup: 'equiv_clouds_umbrella_rain',
        skillTag: 'reading_inference:weather',
        type: 'reading',
        correctAnswer: 'It may rain.',
        options: ['It may rain.', 'It is lunchtime.', 'The bag is empty.', 'The room is warm.'],
        contexts: [
            'Dark clouds filled the sky, so Mia took an umbrella.',
            'Leo saw dark clouds and carried an umbrella outside.',
            'Ava heard thunder and put an umbrella in her bag.'
        ],
        questions: [
            'Read: "Dark clouds filled the sky, so Mia took an umbrella." What can you infer?',
            'Read: "Leo saw dark clouds and carried an umbrella outside." What is likely to happen?',
            'Read: "Ava heard thunder and put an umbrella in her bag." What can you infer?'
        ],
        explanations: [
            'Dark clouds and an umbrella are clues that it may rain.',
            'The weather clues suggest that it may rain.',
            'Thunder and an umbrella support the inference that it may rain.'
        ]
    }
];

const VARIANT_ROLES: ControlledContentItem['variantRole'][] = ['practice', 'day-1', 'day-7'];

export const CONTROLLED_CONTENT_ITEMS: ControlledContentItem[] = FAMILIES.flatMap((family, familyIndex) =>
    VARIANT_ROLES.map((variantRole, variantIndex) => ({
        id: 70_000 + familyIndex * 10 + variantIndex,
        type: family.type,
        question: family.questions[variantIndex],
        options: family.options,
        correct_index: 0,
        explanation: family.explanations[variantIndex],
        hint: variantRole === 'practice' ? 'Use the clue in the sentence.' : undefined,
        skillTag: family.skillTag,
        difficulty: 'medium' as const,
        questionMode: 'choice' as const,
        correctAnswer: family.correctAnswer,
        learningObjectiveId: family.objectiveId,
        objectiveConfidence: 1,
        objectiveCatalogVersion: 2,
        objectiveClassificationStatus: 'canonical' as const,
        evidenceContractVersion: 1,
        itemFamilyId: family.itemFamilyId,
        contextId: `${family.itemFamilyId}_context_${variantIndex + 1}`,
        equivalenceGroup: family.equivalenceGroup,
        assessmentRole: variantRole === 'practice' ? 'practice' as const : 'delayed-probe' as const,
        transferDistance: variantRole === 'practice' ? 'same-context' as const : 'near' as const,
        reviewerStatus: 'system-reviewed' as const,
        supportLevel: variantRole === 'practice' ? 1 as const : 0 as const,
        attemptKind: variantRole === 'practice' ? 'practice' as const : 'review' as const,
        probeStage: variantRole === 'practice' ? undefined : variantRole,
        sourceContextSpan: family.contexts[variantIndex],
        contentPackId: CONTROLLED_CONTENT_PACK_ID,
        contentPackVersion: CONTROLLED_CONTENT_PACK_VERSION,
        variantRole,
        reviewNotes: 'Synthetic, single-objective item reviewed for answer key, context grounding, and age-neutral language.'
    }))
);

export function getControlledPracticeItems(objectiveId: LearningObjectiveId, limit = 3): ControlledContentItem[] {
    return CONTROLLED_CONTENT_ITEMS
        .filter((item) => item.learningObjectiveId === objectiveId && item.variantRole === 'practice')
        .slice(0, limit);
}

export function getControlledProbeItem(input: {
    objectiveId: LearningObjectiveId;
    itemFamilyId: string;
    equivalenceGroup: string;
    originalContextId?: string;
    stage: RetentionProbeStage;
}): ControlledContentItem | undefined {
    const candidates = CONTROLLED_CONTENT_ITEMS.filter((item) =>
        item.learningObjectiveId === input.objectiveId &&
        item.itemFamilyId === input.itemFamilyId &&
        item.equivalenceGroup === input.equivalenceGroup &&
        item.contextId !== input.originalContextId
    );
    const selected = candidates.find((item) => item.variantRole === input.stage) || candidates[0];
    if (!selected) return undefined;
    return {
        ...selected,
        variantRole: input.stage,
        assessmentRole: 'delayed-probe',
        attemptKind: 'review',
        supportLevel: 0,
        probeStage: input.stage,
        transferDistance: 'near'
    };
}

export function getControlledTransferItem(objectiveId: LearningObjectiveId): ControlledContentItem | undefined {
    const selected = CONTROLLED_CONTENT_ITEMS.find((item) =>
        item.learningObjectiveId === objectiveId && item.variantRole === 'day-1'
    );
    if (!selected) return undefined;
    return {
        ...selected,
        assessmentRole: 'transfer',
        attemptKind: 'transfer',
        supportLevel: 0,
        probeStage: undefined,
        transferDistance: 'near'
    };
}
