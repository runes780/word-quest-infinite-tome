import { waitFor } from '@testing-library/dom';

const mockCreateWorker = jest.fn();
const mockSetParameters = jest.fn();
const mockRecognize = jest.fn();
const mockTerminate = jest.fn();
const mockBitmapClose = jest.fn();

jest.mock('tesseract.js', () => ({
    createWorker: (...args: unknown[]) => mockCreateWorker(...args)
}));

const makeFile = (name: string) => new File(['image-bytes'], name, { type: 'image/png' });

describe('recognizeImageText', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockCreateWorker.mockResolvedValue({
            setParameters: mockSetParameters,
            recognize: mockRecognize,
            terminate: mockTerminate
        });
        mockSetParameters.mockResolvedValue(undefined);
        mockRecognize.mockResolvedValue({ data: { text: 'OCR result' } });
        mockTerminate.mockResolvedValue(undefined);
        global.createImageBitmap = jest.fn(async () => ({
            width: 400,
            height: 200,
            close: mockBitmapClose
        } as unknown as ImageBitmap));
    });

    test('reuses one Tesseract worker for multiple image recognitions', async () => {
        const { recognizeImageText } = await import('./tesseractOcr');

        await recognizeImageText(makeFile('one.png'));
        await recognizeImageText(makeFile('two.png'));

        expect(mockCreateWorker).toHaveBeenCalledTimes(1);
        expect(mockSetParameters).toHaveBeenCalledTimes(1);
        expect(mockRecognize).toHaveBeenCalledTimes(2);
        expect(mockTerminate).not.toHaveBeenCalled();
    });

    test('serializes concurrent image recognitions through one worker', async () => {
        const releases: Array<() => void> = [];
        let activeRecognitions = 0;
        let maxActiveRecognitions = 0;
        mockRecognize.mockImplementation(() => new Promise((resolve) => {
            activeRecognitions += 1;
            maxActiveRecognitions = Math.max(maxActiveRecognitions, activeRecognitions);
            releases.push(() => {
                activeRecognitions -= 1;
                resolve({ data: { text: `OCR result ${releases.length}` } });
            });
        }));

        const { recognizeImageText } = await import('./tesseractOcr');
        const first = recognizeImageText(makeFile('one.png'));
        const second = recognizeImageText(makeFile('two.png'));

        await waitFor(() => {
            expect(releases).toHaveLength(1);
        });

        releases[0]();
        await first;
        await waitFor(() => {
            expect(releases).toHaveLength(2);
        });

        releases[1]();
        await second;

        expect(mockCreateWorker).toHaveBeenCalledTimes(1);
        expect(maxActiveRecognitions).toBe(1);
    });
});
