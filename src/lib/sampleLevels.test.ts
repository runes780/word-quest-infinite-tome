import { SAMPLE_LEVELS } from './sampleLevels';
import { normalizeMissionMonsters } from '@/lib/data/missionSanitizer';
import type { Monster } from '@/store/gameStore';

describe('sample levels survive mission sanitization', () => {
    test('no sample question is silently replaced by the fallback bank', () => {
        for (const sample of SAMPLE_LEVELS) {
            const sourceText = `${sample.title}\n${sample.context}`;
            const normalized = normalizeMissionMonsters(sample.monsters as Monster[], {
                sourceText
            });

            expect(normalized).toHaveLength(sample.monsters.length);
            for (const monster of sample.monsters) {
                const kept = normalized.find((candidate) => candidate.id === monster.id);
                expect(kept).toBeDefined();
                // The sanitized question must still carry this sample's own
                // content, not a canned fallback passage question. Compare with
                // blanks/quotes stripped so context prepends are tolerated.
                const strip = (value: string) => value.replace(/_{2,}|\[blank\]|["“”]/g, '').replace(/\s+/g, ' ').trim();
                expect(strip(kept?.question || '')).toContain(strip(monster.question).slice(-18));
                expect(kept?.learningObjectiveId).toBe(monster.learningObjectiveId);
            }
        }
    });
});
