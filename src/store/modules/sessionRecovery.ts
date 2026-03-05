const GAME_STATE_KEY = 'word-quest-game-state';
const MAX_SAVE_AGE_MS = 24 * 60 * 60 * 1000;

interface SkillStatsRecord {
    correct: number;
    total: number;
}

export interface SavedGameState<
    TQuestion = unknown,
    TPlayerStats = unknown,
    TItem = unknown,
    TKnowledgeCard = unknown,
    TSessionSource = string
> {
    health: number;
    maxHealth: number;
    score: number;
    questions: TQuestion[];
    currentIndex: number;
    playerStats: TPlayerStats;
    currentMonsterHp: number;
    context: string;
    inventory: TItem[];
    skillStats: Record<string, SkillStatsRecord>;
    bossShieldProgress: number;
    knowledgeCards: TKnowledgeCard[];
    rootFragments: number;
    sessionSource: TSessionSource;
    questionStartedAt: number;
    savedAt: number;
}

export function saveGameStateSnapshot<
    TQuestion = unknown,
    TPlayerStats = unknown,
    TItem = unknown,
    TKnowledgeCard = unknown,
    TSessionSource = string
>(
    partial: Partial<SavedGameState<TQuestion, TPlayerStats, TItem, TKnowledgeCard, TSessionSource>>
) {
    if (typeof window === 'undefined') return;

    try {
        const existing = loadSavedGameStateSnapshot<TQuestion, TPlayerStats, TItem, TKnowledgeCard, TSessionSource>();
        const toSave: SavedGameState<TQuestion, TPlayerStats, TItem, TKnowledgeCard, TSessionSource> = {
            health: partial.health ?? existing?.health ?? 3,
            maxHealth: partial.maxHealth ?? existing?.maxHealth ?? 3,
            score: partial.score ?? existing?.score ?? 0,
            questions: partial.questions ?? existing?.questions ?? [],
            currentIndex: partial.currentIndex ?? existing?.currentIndex ?? 0,
            playerStats: partial.playerStats ?? existing?.playerStats ?? ({} as TPlayerStats),
            currentMonsterHp: partial.currentMonsterHp ?? existing?.currentMonsterHp ?? 1,
            context: partial.context ?? existing?.context ?? '',
            inventory: partial.inventory ?? existing?.inventory ?? [],
            skillStats: partial.skillStats ?? existing?.skillStats ?? {},
            bossShieldProgress: partial.bossShieldProgress ?? existing?.bossShieldProgress ?? 0,
            knowledgeCards: partial.knowledgeCards ?? existing?.knowledgeCards ?? ([] as TKnowledgeCard[]),
            rootFragments: partial.rootFragments ?? existing?.rootFragments ?? 0,
            sessionSource: partial.sessionSource ?? existing?.sessionSource ?? ('battle' as TSessionSource),
            questionStartedAt: partial.questionStartedAt ?? existing?.questionStartedAt ?? Date.now(),
            savedAt: Date.now()
        };

        if (toSave.questions.length > 0 && toSave.currentIndex < toSave.questions.length) {
            window.localStorage.setItem(GAME_STATE_KEY, JSON.stringify(toSave));
            console.log('[Recovery] Game state saved');
        }
    } catch (error) {
        console.error('[Recovery] Failed to save game state:', error);
    }
}

export function loadSavedGameStateSnapshot<
    TQuestion = unknown,
    TPlayerStats = unknown,
    TItem = unknown,
    TKnowledgeCard = unknown,
    TSessionSource = string
>():
    SavedGameState<TQuestion, TPlayerStats, TItem, TKnowledgeCard, TSessionSource> | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(GAME_STATE_KEY);
        if (!raw) return null;

        const saved = JSON.parse(raw) as SavedGameState<TQuestion, TPlayerStats, TItem, TKnowledgeCard, TSessionSource>;
        if (Date.now() - saved.savedAt > MAX_SAVE_AGE_MS) {
            window.localStorage.removeItem(GAME_STATE_KEY);
            return null;
        }

        return saved;
    } catch (error) {
        console.error('[Recovery] Failed to load game state:', error);
        return null;
    }
}

export function clearSavedGameStateSnapshot() {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.removeItem(GAME_STATE_KEY);
        console.log('[Recovery] Game state cleared');
    } catch (error) {
        console.error('[Recovery] Failed to clear game state:', error);
    }
}
