import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { InputSection } from './InputSection';

const startGame = jest.fn();
const setSettingsOpen = jest.fn();
const mockRecognizeImageText = jest.fn();
let mockApiKey = 'test-key';

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt, src, ...props }: {
        alt: string;
        src: string;
        fill?: boolean;
        unoptimized?: boolean;
        sizes?: string;
        className?: string;
    }) => {
        const domProps = { ...props };
        delete domProps.fill;
        delete domProps.unoptimized;
        delete domProps.sizes;
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={alt} src={src} {...domProps} />
        );
    }
}));

jest.mock('@/store/gameStore', () => ({
    useGameStore: () => ({
        startGame
    }),
    __esModule: true
}));

jest.mock('@/store/settingsStore', () => ({
    useSettingsStore: () => ({
        apiKey: mockApiKey,
        apiProvider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        setSettingsOpen,
        language: 'en'
    })
}));

jest.mock('@/lib/ai/openrouter', () => ({
    OpenRouterClient: jest.fn()
}));

jest.mock('@/lib/ocr/tesseractOcr', () => ({
    recognizeImageText: (...args: unknown[]) => mockRecognizeImageText(...args)
}));

const generateQuestionPackMock = jest.fn();

jest.mock('@/lib/ai/questionPipeline', () => ({
    generateQuestionPack: (...args: unknown[]) => generateQuestionPackMock(...args)
}));

jest.mock('./BlessingSelection', () => ({
    BlessingSelection: () => null
}));

jest.mock('@/db/db', () => ({
    getPlayerProfile: jest.fn(async () => ({
        dailyStreak: 1,
        dailyXpGoal: 50,
        dailyXpEarned: 10,
        lastActiveDate: new Date().toISOString().slice(0, 10),
        globalLevel: 2
    }))
}));

jest.mock('@/lib/data/dailyPracticePlan', () => ({
    getDailyPracticePlan: jest.fn(async () => ({
        estimatedMinutes: 8,
        steps: []
    }))
}));

jest.mock('@/lib/data/dailyFlame', () => ({
    buildDailyFlameStatus: jest.fn(() => null)
}));

jest.mock('@/lib/data/practicePlanRunner', () => ({
    createPracticePlanRun: jest.fn(),
    currentPracticePlanStep: jest.fn(),
    loadPracticePlanStepLaunch: jest.fn()
}));

jest.mock('./DailyFlameCard', () => ({
    DailyFlameCard: () => null
}));

jest.mock('./DailyChallenge', () => ({
    DailyChallenge: () => null
}));

jest.mock('./SRSDashboard', () => ({
    SRSDashboard: () => null
}));

jest.mock('./BlessingSelection', () => ({
    BlessingSelection: () => null
}));

describe('InputSection material intake', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockApiKey = 'test-key';
        mockRecognizeImageText.mockResolvedValue('Mock OCR text from the textbook image.');
        global.URL.createObjectURL = jest.fn(() => 'blob:preview');
        global.URL.revokeObjectURL = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('shows one material composer for text, paste, drag, and attachments', async () => {
        render(<InputSection />);

        expect(await screen.findByText('Today\'s Learning Path')).toBeInTheDocument();
        expect(screen.getByLabelText('Learning material composer')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Paste text, screenshots, or notes here...')).toBeInTheDocument();
        expect(screen.getByText('Paste, drag, or upload screenshots and notes. Image OCR runs locally; extracted text stays editable.')).toBeInTheDocument();
        expect(screen.queryByText('Or snap a photo of your textbook')).not.toBeInTheDocument();
    });

    test('lets a learner start a synthetic local quest without an API key', async () => {
        mockApiKey = '';
        render(<InputSection />);

        expect(await screen.findByText('Local practice is ready')).toBeInTheDocument();
        expect(screen.getByText(/nothing is sent to an AI provider/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Start local quest' }));

        expect(startGame).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ question: expect.any(String) })]),
            expect.stringContaining('Daily Learning Path'),
            'battle'
        );
        expect(setSettingsOpen).not.toHaveBeenCalled();
    });

    test('keeps AI connection optional and explicitly opens settings on request', async () => {
        mockApiKey = '';
        render(<InputSection />);

        fireEvent.click(await screen.findByRole('button', { name: 'Connect AI' }));

        expect(setSettingsOpen).toHaveBeenCalledWith(true);
        expect(startGame).not.toHaveBeenCalled();
    });

    test('does not send the game level to the mission pipeline as a learner level', async () => {
        // The player's game level is progression, not English proficiency: raising
        // globalLevel must not raise any learner-level input to the AI pipeline.
        const { getPlayerProfile } = jest.requireMock('@/db/db') as { getPlayerProfile: jest.Mock };
        generateQuestionPackMock.mockResolvedValue({
            monsters: Array.from({ length: 5 }, (_, index) => ({
                id: index + 1,
                type: 'vocab',
                skillTag: 'vocab_context_meaning',
                question: `Synthetic question ${index + 1}`,
                options: ['alpha', 'beta', 'gamma', 'delta'],
                correct_index: 0,
                hint: 'Look at the sentence.',
                explanation: 'The sentence states the answer.'
            })),
            plan: { levelTitle: 'Synthetic Mission' },
            degradedPath: 'none'
        });

        for (const globalLevel of [1, 42]) {
            getPlayerProfile.mockResolvedValue({
                dailyStreak: 1,
                dailyXpGoal: 50,
                dailyXpEarned: 10,
                lastActiveDate: new Date().toISOString().slice(0, 10),
                globalLevel
            });
            generateQuestionPackMock.mockClear();

            const renderResult = render(<InputSection />);
            const composer = await screen.findByPlaceholderText('Paste text, screenshots, or notes here...');
            fireEvent.change(composer, { target: { value: 'The fox runs under the pine tree because it is shy.' } });
            fireEvent.click(screen.getByRole('button', { name: 'Initialize Mission' }));

            await waitFor(() => {
                expect(generateQuestionPackMock).toHaveBeenCalledTimes(1);
            });

            const options = generateQuestionPackMock.mock.calls[0][1] as Record<string, unknown>;
            expect(options.learnerLevel).toBeUndefined();
            expect(options.criticEnabled).toBe(true);
            expect(options.material).toContain('The fox runs under the pine tree');
            renderResult.unmount();
        }
    });

    test('accepts pasted image files and appends OCR text to the editable material', async () => {
        render(<InputSection />);
        const composer = await screen.findByLabelText('Learning material composer');
        const image = new File(['image-bytes'], 'unit-photo.png', { type: 'image/png' });

        fireEvent.paste(composer, {
            clipboardData: {
                files: [image],
                getData: () => ''
            }
        });

        expect(await screen.findByText('unit-photo.png')).toBeInTheDocument();
        expect(mockRecognizeImageText).toHaveBeenCalledWith(image);
        await waitFor(() => {
            expect(screen.getByDisplayValue(/Mock OCR text from the textbook image\./)).toBeInTheDocument();
        });
    });

    test('marks image attachments as failed when OCR cannot extract text', async () => {
        mockRecognizeImageText.mockRejectedValue(new Error('OCR failed'));
        render(<InputSection />);
        const composer = await screen.findByLabelText('Learning material composer');
        const image = new File(['image-bytes'], 'blurry-photo.png', { type: 'image/png' });

        await act(async () => {
            fireEvent.drop(composer, {
                dataTransfer: {
                    files: [image]
                }
            });
        });

        const row = await screen.findByText('blurry-photo.png');
        const attachment = row.closest('li');
        expect(attachment).not.toBeNull();
        await waitFor(() => {
            expect(within(attachment as HTMLElement).getByText('Could not extract text')).toBeInTheDocument();
        });
        expect(screen.getByPlaceholderText('Paste text, screenshots, or notes here...')).toHaveValue('');
    });

    test('accepts dropped text files and appends their contents to the editable material', async () => {
        render(<InputSection />);
        const composer = await screen.findByLabelText('Learning material composer');
        const textFile = new File(['The moon is bright.'], 'lesson.txt', { type: 'text/plain' });

        fireEvent.drop(composer, {
            dataTransfer: {
                files: [textFile]
            }
        });

        expect(await screen.findByText('lesson.txt')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByDisplayValue(/The moon is bright\./)).toBeInTheDocument();
        });
    });

    test('marks unsupported attachments without changing the material text', async () => {
        render(<InputSection />);
        const composer = await screen.findByLabelText('Learning material composer');
        const archive = new File(['zip'], 'worksheets.zip', { type: 'application/zip' });

        fireEvent.drop(composer, {
            dataTransfer: {
                files: [archive]
            }
        });

        const row = await screen.findByText('worksheets.zip');
        const attachment = row.closest('li');
        expect(attachment).not.toBeNull();
        expect(within(attachment as HTMLElement).getByText('Unsupported file type')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Paste text, screenshots, or notes here...')).toHaveValue('');
    });

    test('removes an attachment and its extracted text from the material', async () => {
        render(<InputSection />);
        const composer = await screen.findByLabelText('Learning material composer');
        const textFile = new File(['Clouds bring rain.'], 'weather.txt', { type: 'text/plain' });

        fireEvent.drop(composer, {
            dataTransfer: {
                files: [textFile]
            }
        });

        await waitFor(() => {
            expect(screen.getByDisplayValue(/Clouds bring rain\./)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByLabelText('Remove weather.txt'));

        expect(screen.queryByText('weather.txt')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('Paste text, screenshots, or notes here...')).toHaveValue('');
    });

    test('rejects PDF and Word documents instead of inserting demo placeholder text', async () => {
        render(<InputSection />);
        const composer = await screen.findByPlaceholderText('Paste text, screenshots, or notes here...');
        const pdf = new File(['%PDF-1.4 fake'], 'lesson.pdf', { type: 'application/pdf' });

        await act(async () => {
            fireEvent.drop(composer, { dataTransfer: { files: [pdf] } });
        });

        const row = await screen.findByText('lesson.pdf');
        const attachment = row.closest('li');
        expect(attachment).not.toBeNull();
        await waitFor(() => {
            expect(within(attachment as HTMLElement).getByText(/PDF and Word files are not supported yet/i)).toBeInTheDocument();
        });
        expect(screen.getByPlaceholderText('Paste text, screenshots, or notes here...')).toHaveValue('');
    });
});

const LOCAL_QUEST_MATERIAL =
    'Yesterday was Sunday. Mia went to the park with her friends. ' +
    'They played football under a big tree. The weather was sunny and warm. ' +
    'She shared her sandwiches because everyone was hungry. ' +
    'Later they walked beside the river and watched the birds.';

describe('InputSection local material quest', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockApiKey = 'test-key';
    });

    const openBrief = async () => {
        render(<InputSection />);
        const composer = await screen.findByPlaceholderText('Paste text, screenshots, or notes here...');
        fireEvent.change(composer, { target: { value: LOCAL_QUEST_MATERIAL } });

        const cta = await screen.findByRole('button', { name: 'Start local quest from this material' });
        expect(screen.getByText(/Runs entirely on this device/i)).toBeInTheDocument();
        fireEvent.click(cta);

        return screen.findByRole('group', { name: 'Learning brief' });
    };

    test('offers a key-free local quest from pasted material and starts a grounded battle', async () => {
        mockApiKey = '';
        const brief = await openBrief();

        // The AI connection stays available as a separate, optional action.
        expect(screen.getByRole('button', { name: 'Connect AI' })).toBeInTheDocument();

        fireEvent.click(within(brief).getByRole('button', { name: 'Start quest' }));

        await waitFor(() => {
            expect(startGame).toHaveBeenCalledTimes(1);
        });
        const [monsters, context] = startGame.mock.calls[0];
        expect(context).toContain('Local Material Quest');
        expect(monsters.length).toBeGreaterThanOrEqual(6);
        expect(monsters.length).toBeLessThanOrEqual(8);
        for (const monster of monsters) {
            expect(LOCAL_QUEST_MATERIAL).toContain(monster.sourceContextSpan);
            expect(monster.learningObjectiveId).toBeTruthy();
        }
    });

    test('a removed suggested practice item never appears in the started quest', async () => {
        const brief = await openBrief();

        // Remove one removable item; its word must not be tested.
        const removeButtons = within(brief).getAllByRole('button', { name: 'Remove item' });
        expect(removeButtons.length).toBeGreaterThanOrEqual(3);
        const removedRow = removeButtons[0].closest('li') as HTMLElement;
        const removedWord = within(removedRow).getAllByText(/^[A-Za-z]+$/)[0].textContent as string;

        fireEvent.click(removeButtons[0]);
        fireEvent.click(within(brief).getByRole('button', { name: 'Start quest' }));

        await waitFor(() => {
            expect(startGame).toHaveBeenCalledTimes(1);
        });
        const monsters = startGame.mock.calls[0][0];
        for (const monster of monsters) {
            expect(monster.correctAnswer.toLowerCase()).not.toBe(removedWord.toLowerCase());
        }
    });

    test('insufficient material explains how to improve instead of offering the quest', async () => {
        render(<InputSection />);
        const composer = await screen.findByPlaceholderText('Paste text, screenshots, or notes here...');
        fireEvent.change(composer, { target: { value: 'The cat sat.' } });

        expect(await screen.findByText(/Paste a few more full English sentences/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start local quest from this material' })).not.toBeInTheDocument();
    });
});
