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
        expect(screen.getByPlaceholderText('Paste text, screenshots, PDFs, Word docs, or notes here...')).toBeInTheDocument();
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
        expect(screen.getByPlaceholderText('Paste text, screenshots, PDFs, Word docs, or notes here...')).toHaveValue('');
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
        expect(screen.getByPlaceholderText('Paste text, screenshots, PDFs, Word docs, or notes here...')).toHaveValue('');
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
        expect(screen.getByPlaceholderText('Paste text, screenshots, PDFs, Word docs, or notes here...')).toHaveValue('');
    });
});
