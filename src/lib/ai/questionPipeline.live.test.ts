/**
 * @jest-environment node
 *
 * LIVE end-to-end verification of the question pipeline against a real LLM.
 * Excluded from the default suite via jest.config.js testPathIgnorePatterns.
 *
 * Run explicitly:
 *   node ./node_modules/jest/bin/jest.js --testPathIgnorePatterns=node_modules \
 *     questionPipeline.live --verbose --forceExit
 *
 * SECURITY: the API key is read from the user's Chrome localStorage into a JS
 * variable and passed straight to the OpenRouterClient. It is NEVER printed,
 * logged, or otherwise surfaced — only provider/model (not secret) are shown.
 */
import { chromium } from 'playwright';
import type { Monster } from '@/store/gameStore';
import { FALLBACK_QUESTIONS } from '@/lib/data/fallbackQuestions';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    rmSync,
    statSync
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { generateQuestionPack } from './questionPipeline';

const MATERIAL =
    'Tom has a small dog named Max. Every morning Tom walks Max in the park. ' +
    'One day it rained, so Tom took an umbrella. Max was happy because he loves the water. ' +
    'Tom and Max walked home together after the rain stopped.';

const CHROME_PROFILE = `${process.env.HOME}/Library/Application Support/Google/Chrome`;
const SOURCE_LOCAL_STORAGE = join(CHROME_PROFILE, 'Default', 'Local Storage');

interface LiveSettings {
    apiKey: string;
    model: string;
    apiProvider: 'deepseek' | 'openrouter';
}

/** Recursively copy a dir; skip leveldb LOCK files and any file that errors on read. */
function copyDir(src: string, dest: string): void {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
        if (entry === 'LOCK' || entry === 'LOCK.old') continue;
        const s = join(src, entry);
        const d = join(dest, entry);
        let st: ReturnType<typeof statSync>;
        try {
            st = statSync(s);
        } catch {
            continue;
        }
        if (st.isDirectory()) {
            copyDir(s, d);
        } else {
            try {
                copyFileSync(s, d);
            } catch {
                /* skip unreadable file */
            }
        }
    }
}

async function readSettingsFromProfile(): Promise<LiveSettings | null> {
    if (!existsSync(SOURCE_LOCAL_STORAGE)) return null;
    const userDataDir = mkdtempSync(join(tmpdir(), 'wq-live-'));
    try {
        // Copy just Local Storage into a temp profile so the live Chrome's
        // profile lock never blocks us, and the key is never touched by hand.
        copyDir(SOURCE_LOCAL_STORAGE, join(userDataDir, 'Default', 'Local Storage'));
        const context = await chromium.launchPersistentContext(userDataDir, {
            channel: 'chrome',
            headless: true,
            args: ['--no-first-run', '--no-default-browser-check', '--disable-popup-blocking'],
            viewport: { width: 1280, height: 800 }
        });
        try {
            const page = await context.newPage();
            await page.goto('http://localhost:3000/', {
                waitUntil: 'domcontentloaded',
                timeout: 20000
            });
            const raw = await page.evaluate(() => window.localStorage.getItem('word-quest-settings'));
            if (!raw) return null;
            const parsed = JSON.parse(raw) as { state?: Record<string, unknown> } & Record<string, unknown>;
            const state = (parsed.state ?? parsed) as Record<string, unknown>;
            if (!state.apiKey || typeof state.apiKey !== 'string') return null;
            return {
                apiKey: state.apiKey,
                model: typeof state.model === 'string' ? state.model : '',
                apiProvider: state.apiProvider === 'deepseek' ? 'deepseek' : 'openrouter'
            };
        } finally {
            await context.close();
        }
    } finally {
        try {
            rmSync(userDataDir, { recursive: true, force: true });
        } catch {
            /* best effort cleanup */
        }
    }
}

describe('LIVE end-to-end (real LLM)', () => {
    test('plan -> generate -> critique against real DeepSeek', async () => {
        let settings: LiveSettings | null = null;
        try {
            settings = await readSettingsFromProfile();
        } catch (err) {
            console.log('\n[setup] Could not read Chrome profile: ' + (err as Error).message);
        }

        if (!settings) {
            console.log(
                '\n[LIVE] SKIPPED — no settings/key readable from Chrome profile.\n' +
                'Make sure the dev server (localhost:3000) is running and the key is saved in the app.'
            );
            return;
        }
        console.log(`\n[LIVE] provider=${settings.apiProvider} model="${settings.model}" (key hidden)`);

        const result = await generateQuestionPack(MATERIAL, {
            apiKey: settings.apiKey,
            model: settings.model,
            apiProvider: settings.apiProvider,
            criticEnabled: true,
            material: MATERIAL
        });

        console.log('\n=== MATERIAL ===\n' + MATERIAL);
        console.log('\n=== PIPELINE RESULT ===');
        console.log('degradedPath:', result.degradedPath);
        if (result.plan) {
            console.log('plan.levelTitle:', result.plan.levelTitle);
            console.log('plan.materialSummary:', result.plan.materialSummary);
            console.log('plan.items:');
            result.plan.items.forEach((it, i) =>
                console.log(
                    `  [${i}] ${(it.role ?? '-').padEnd(11)} ${(it.domain ?? '-').padEnd(7)} ` +
                    `${(it.readingSkill ?? '-').padEnd(20)} target="${it.target}" support=${it.supportLevel} ` +
                    `span="${it.sourceSpan.slice(0, 55)}${it.sourceSpan.length > 55 ? '...' : ''}"`
                )
            );
        }
        console.log('\n=== GENERATED QUESTIONS (' + result.monsters.length + ') ===');
        const fallbackQuestions = new Set(FALLBACK_QUESTIONS.map((fb) => fb.question));
        let fallbackCount = 0;
        let lowConfCount = 0;
        result.monsters.forEach((m: Monster, i: number) => {
            const lowConf = (m as Monster & { lowConfidence?: boolean }).lowConfidence;
            const isFallback = fallbackQuestions.has(m.question);
            if (isFallback) fallbackCount += 1;
            if (lowConf) lowConfCount += 1;
            console.log(
                `\n--- Q${i + 1} [${m.questionMode}] type=${m.type} diff=${m.difficulty} ` +
                `support=${m.supportLevel} attempt=${m.attemptKind}` +
                `${isFallback ? ' 🛟 FALLBACK' : ''}${lowConf ? ' ⚠ lowConfidence' : ''} ---`
            );
            console.log('  Q       : ' + m.question);
            console.log('  options : ' + JSON.stringify(m.options));
            console.log('  answer  : ' + m.correctAnswer + ' (idx ' + m.correct_index + ')');
            console.log('  hint    : ' + m.hint);
            console.log('  explain : ' + m.explanation);
            console.log('  span    : ' + m.sourceContextSpan);
        });
        console.log(`\n=== SUMMARY: ${fallbackCount} fallback-replaced, ${lowConfCount} lowConfidence, ${result.monsters.length} total ===`);
        console.log('\n=== CRITIC ===');
        if (result.criticReport) {
            result.criticReport.verdicts.forEach((v) =>
                console.log(
                    `  Q${v.id} ${v.pass ? 'PASS ' : 'FAIL '} axes=[${v.axisFailures.join(',') || '-'}] ` +
                    `offending=[${v.offendingWords.join(',') || '-'}] reason="${v.reason}"`
                )
            );
        } else {
            console.log('  (no critic run)');
        }
    }, 300000); // 5 minutes for real LLM calls
});
