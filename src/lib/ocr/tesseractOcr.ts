const OCR_LANGUAGES = 'eng+chi_sim';
const FAST_TESSDATA_PATH = 'https://tessdata.projectnaptha.com/4.0.0_fast';
const MAX_IMAGE_EDGE = 1800;
const OCR_IMAGE_QUALITY = 0.88;

type TesseractModule = typeof import('tesseract.js');
type TesseractWorker = Awaited<ReturnType<TesseractModule['createWorker']>>;

let workerPromise: Promise<TesseractWorker> | null = null;
let recognitionQueue: Promise<unknown> = Promise.resolve();

export function recognizeImageText(file: File): Promise<string> {
    const job = recognitionQueue.then(() => recognizeQueuedImageText(file));
    recognitionQueue = job.catch(() => undefined);
    return job;
}

async function recognizeQueuedImageText(file: File): Promise<string> {
    const image = await prepareImageForOcr(file);
    const worker = await getOcrWorker();

    const result = await worker.recognize(image, { rotateAuto: true });
    const text = result.data.text.trim();
    if (!text) {
        throw new Error('OCR produced no text');
    }
    return text;
}

async function getOcrWorker(): Promise<TesseractWorker> {
    if (workerPromise) return workerPromise;

    const nextWorkerPromise = createOcrWorker();
    workerPromise = nextWorkerPromise;
    nextWorkerPromise.catch(() => {
        if (workerPromise === nextWorkerPromise) {
            workerPromise = null;
        }
    });
    return nextWorkerPromise;
}

async function createOcrWorker(): Promise<TesseractWorker> {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(OCR_LANGUAGES, undefined, {
        langPath: FAST_TESSDATA_PATH,
        logger: () => undefined
    });
    await worker.setParameters({
        preserve_interword_spaces: '1'
    });
    return worker;
}

async function prepareImageForOcr(file: File): Promise<File | Blob> {
    if (typeof document === 'undefined') return file;

    try {
        const source = await loadImageSource(file);
        const width = source.width;
        const height = source.height;
        const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));

        if (scale >= 1) {
            closeImageSource(source);
            return file;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) {
            closeImageSource(source);
            return file;
        }

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        closeImageSource(source);

        const blob = await canvasToBlob(canvas, imageOutputType(file.type));
        if (!blob) return file;
        return new File([blob], file.name, { type: blob.type || file.type });
    } catch {
        return file;
    }
}

async function loadImageSource(file: File): Promise<HTMLImageElement | ImageBitmap> {
    if ('createImageBitmap' in globalThis) {
        return createImageBitmap(file);
    }

    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not decode image'));
        };
        image.src = url;
    });
}

function closeImageSource(source: HTMLImageElement | ImageBitmap) {
    if ('close' in source) {
        source.close();
    }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
    return new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, type, OCR_IMAGE_QUALITY);
    });
}

function imageOutputType(type: string) {
    return type === 'image/png' ? 'image/png' : 'image/jpeg';
}
